// Servidor intermediário do Fredix na Cloudflare.
// Guarda a chave da IA, confere o anti-robô e os limites de uso e conversa com a IA usando só os dados do painel.
import Anthropic from '@anthropic-ai/sdk'
import { validarConversa } from '../src/fredixSeguranca.js'
import { conferirLimites, conversar, lerLimites, periodos, RESERVA_POR_PERGUNTA, somarUso } from './fredix-core.mjs'

const SITE_PADRAO = 'https://fernandocastilho.github.io/painel-especialista'
const COTACOES_PADRAO = 'https://raw.githubusercontent.com/fernandocastilho/painel-especialista/data'
const ORIGENS_PADRAO = 'https://fernandocastilho.github.io'
const TAMANHO_MAXIMO = 20000

function cabecalhos(origem, env) {
  const permitidas = String(env.ORIGENS_PERMITIDAS || ORIGENS_PADRAO).split(',').map(o => o.trim())
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...(permitidas.includes(origem) && { 'access-control-allow-origin': origem, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'Origin' }),
  }
}

const responder = (corpo, status, headers) => new Response(JSON.stringify(corpo), { status, headers })

async function conferirAntiRobo(token, ip, env, fetcher) {
  if (!env.TURNSTILE_SECRET_KEY) return env.EXIGIR_ANTI_ROBO === 'nao'
  if (typeof token !== 'string' || !token) return false
  const form = new FormData()
  form.append('secret', env.TURNSTILE_SECRET_KEY)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)
  const resposta = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
  const resultado = await resposta.json().catch(() => null)
  return resultado?.success === true
}

// Identificador do visitante sem guardar o IP: resumo criptográfico que muda todo dia.
async function idVisitante(ip, dia, sal = '') {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${sal}|${dia}|${ip}`))
  return [...new Uint8Array(bytes)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('')
}

function criarBuscador(env, fetcher) {
  const site = env.SITE_DADOS || SITE_PADRAO, cotacoes = env.SITE_COTACOES || COTACOES_PADRAO
  return async arquivo => {
    const url = `${arquivo === 'quotes.json' ? cotacoes : site}/${arquivo}`
    const resposta = await fetcher(url, { signal: AbortSignal.timeout(10000), cf: { cacheTtl: 300, cacheEverything: true } })
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`)
    return resposta.json()
  }
}

export async function atender(request, env, { fetcher = fetch, cliente, agora = Date.now(), ctx } = {}) {
  const origem = request.headers.get('origin') || ''
  const headers = cabecalhos(origem, env)
  const url = new URL(request.url)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (url.pathname === '/saude') return responder({ ok: true }, 200, headers)
  if (url.pathname !== '/pergunta' || request.method !== 'POST') return responder({ erro: 'Endereço não encontrado.' }, 404, headers)
  if (!headers['access-control-allow-origin']) return responder({ erro: 'Origem não autorizada.' }, 403, headers)
  if (!env.ANTHROPIC_API_KEY || !env.FREDIX_KV) return responder({ erro: 'O Fredix está em configuração.' }, 503, headers)

  const bruto = await request.text()
  if (bruto.length > TAMANHO_MAXIMO) return responder({ erro: 'Pergunta grande demais.' }, 413, headers)
  let corpo
  try { corpo = JSON.parse(bruto) } catch { return responder({ erro: 'Pedido inválido.' }, 400, headers) }
  const invalida = validarConversa(corpo?.mensagens)
  if (invalida) return responder({ erro: invalida }, 400, headers)

  const ip = request.headers.get('cf-connecting-ip') || ''
  if (!await conferirAntiRobo(corpo.antiRobo, ip, env, fetcher).catch(() => false)) return responder({ erro: 'Não consegui confirmar que você não é um robô. Tente de novo.' }, 403, headers)

  const limites = lerLimites(env)
  const { dia } = periodos(agora)
  const chaveVisitante = `v:${await idVisitante(ip, dia, env.SAL_VISITANTE)}`
  let visitante, geral
  try {
    [visitante, geral] = await Promise.all([env.FREDIX_KV.get(chaveVisitante, 'json'), env.FREDIX_KV.get('geral', 'json')])
  } catch {
    return responder({ erro: 'O Fredix está indisponível agora. Tente mais tarde.' }, 503, headers)
  }
  const bloqueio = conferirLimites({ visitante, geral, limites, agora })
  if (bloqueio) return responder({ erro: bloqueio }, 429, headers)

  // Reserva o pior caso antes de chamar a IA: pergunta que falha ou visitante que sai também conta.
  // Só contagens e gasto são gravados. A pergunta e a resposta, nunca.
  const reserva = somarUso({ visitante, geral, custo: RESERVA_POR_PERGUNTA, agora })
  try {
    await Promise.all([
      env.FREDIX_KV.put(chaveVisitante, JSON.stringify(reserva.visitante), { expirationTtl: 2 * 86400 }),
      env.FREDIX_KV.put('geral', JSON.stringify(reserva.geral)),
    ])
  } catch {
    return responder({ erro: 'O Fredix está indisponível agora. Tente mais tarde.' }, 503, headers)
  }

  const gasto = { custo: 0 }
  let resultado, falha
  try {
    resultado = await conversar({
      cliente: cliente ?? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 45000 }),
      mensagens: corpo.mensagens,
      buscarArquivo: criarBuscador(env, fetcher),
      hoje: dia.split('-').reverse().join('/'),
      gasto,
    })
  } catch (erro) {
    falha = erro
  }

  // Troca a reserva pelo gasto real, inclusive o das rodadas pagas antes de uma falha.
  const acerto = acertarReserva(env.FREDIX_KV, gasto.custo - RESERVA_POR_PERGUNTA, agora).catch(() => console.error('fredix: acerto do gasto não gravado'))
  if (ctx?.waitUntil) ctx.waitUntil(acerto)
  else await acerto

  if (falha) {
    const ocupado = falha instanceof Anthropic.RateLimitError || falha instanceof Anthropic.InternalServerError || falha instanceof Anthropic.APIConnectionError
    console.error('fredix: falha na IA', falha?.status ?? falha?.name)
    return responder({ erro: ocupado ? 'O Fredix está ocupado. Tente de novo em instantes.' : 'O Fredix não conseguiu responder agora.' }, 503, headers)
  }
  return responder({ resposta: resultado.texto }, 200, headers)
}

// Relê o total geral (outra pergunta pode ter gravado no meio) e aplica a diferença.
async function acertarReserva(kv, diferenca, agora) {
  const { dia, mes } = periodos(agora)
  const geral = await kv.get('geral', 'json')
  if (!geral || (geral.dia !== dia && geral.mes !== mes)) return
  await kv.put('geral', JSON.stringify({
    ...geral,
    ...(geral.dia === dia && { custoDia: Math.max(0, geral.custoDia + diferenca) }),
    ...(geral.mes === mes && { custoMes: Math.max(0, geral.custoMes + diferenca) }),
  }))
}

export default { fetch: (request, env, ctx) => atender(request, env, { ctx }) }
