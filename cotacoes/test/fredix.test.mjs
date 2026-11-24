import test from 'node:test'
import assert from 'node:assert/strict'
import { temDadoSensivel, validarConversa } from '../src/fredixSeguranca.js'
import { fredixEndpoint, partesDaResposta, perguntarAoFredix } from '../src/fredix.js'
import { ARQUIVOS, conferirLimites, conversar, custoDaChamada, filtrarDados, lerDadosDoPainel, lerLimites, resumirDados, sistema, somarUso } from '../worker/fredix-core.mjs'
import { atender } from '../worker/fredix.mjs'

const agora = Date.parse('2026-11-24T15:00:00Z') // 12h em Brasília
const limites = lerLimites({})

test('dados de cliente são barrados; números de mercado passam', () => {
  for (const texto of ['meu CPF é 123.456.789-09', 'cnpj 12.345.678/0001-90', 'cliente 12345678901', '12345678000190', 'fulano@empresa.com.br', 'liga (11) 98765-4321'])
    assert.equal(temDadoSensivel(texto), true, texto)
  for (const texto of ['Selic de 15,00% e CDI de 14,90%', 'R$ 10.000.000,00 em giro', 'dólar a 5,9293', 'prazo de 48 meses em 2026'])
    assert.equal(temDadoSensivel(texto), false, texto)
})

test('a conversa precisa alternar e terminar na pergunta', () => {
  assert.equal(validarConversa([{ role: 'user', content: 'Como está o dólar?' }]), '')
  assert.match(validarConversa([]), /pergunta/)
  assert.match(validarConversa([{ role: 'assistant', content: 'oi' }]), /inválido/)
  assert.match(validarConversa([{ role: 'user', content: 'x'.repeat(601) }]), /600/)
  assert.match(validarConversa([{ role: 'user', content: 'CPF 123.456.789-09' }]), /CPF/)
  assert.match(validarConversa(Array.from({ length: 9 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'a' }))), /longa/)
})

test('limites: por visitante, por dia e teto do mês', () => {
  assert.equal(conferirLimites({ limites, agora }), '')
  assert.match(conferirLimites({ visitante: { hora: '2026-11-24T12', dia: '2026-11-24', perguntasHora: 10, perguntasDia: 10 }, limites, agora }), /seguidas/)
  assert.match(conferirLimites({ visitante: { hora: '2026-11-24T11', dia: '2026-11-24', perguntasHora: 3, perguntasDia: 30 }, limites, agora }), /hoje/)
  assert.match(conferirLimites({ geral: { dia: '2026-11-24', mes: '2026-11', custoDia: 0.27, custoMes: 1, perguntasDia: 5 }, limites, agora }), /hoje/)
  assert.match(conferirLimites({ geral: { dia: '2026-11-24', mes: '2026-11', custoDia: 0, custoMes: 8, perguntasDia: 0 }, limites, agora }), /mês/)
  // Virada de dia e de mês zera as contagens.
  assert.equal(conferirLimites({ geral: { dia: '2026-10-31', mes: '2026-10', custoDia: 9, custoMes: 9, perguntasDia: 999 }, visitante: { hora: '2026-10-31T23', dia: '2026-10-31', perguntasHora: 99, perguntasDia: 99 }, limites, agora }), '')
  const uso = somarUso({ geral: { dia: '2026-11-24', mes: '2026-11', custoDia: 0.1, custoMes: 2, perguntasDia: 4 }, custo: 0.01, agora })
  assert.deepEqual(uso.visitante, { hora: '2026-11-24T12', dia: '2026-11-24', perguntasHora: 1, perguntasDia: 1 })
  assert.equal(uso.geral.perguntasDia, 5)
  assert.ok(Math.abs(uso.geral.custoMes - 2.01) < 1e-9)
})

test('tetos configuráveis só aceitam números positivos', () => {
  assert.equal(lerLimites({ TETO_MENSAL_USD: '5' }).tetoMensalUsd, 5)
  assert.equal(lerLimites({ TETO_MENSAL_USD: 'abc' }).tetoMensalUsd, 8)
  assert.equal(lerLimites({ TETO_MENSAL_USD: '-1' }).tetoMensalUsd, 8)
})

test('custo conta entrada, saída e cache', () => {
  assert.ok(Math.abs(custoDaChamada({ input_tokens: 1e6, output_tokens: 1e6 }) - 0.6) < 1e-9)
  assert.equal(custoDaChamada(undefined), 0)
})

test('dados do painel: resumo de séries longas, datas legíveis e filtro', async () => {
  const resumo = resumirDados({ generatedAt: 1795482138821, cdi: Array.from({ length: 100 }, (_, i) => i) })
  assert.equal(resumo.generatedAt, '2026-11-24T01:02:18.821Z')
  assert.equal(resumo.cdi.length, 12)
  assert.deepEqual(resumo.cdi.slice(-2), [98, 99])
  const dados = { generatedAt: 1, commodities: [{ name: 'Soja', price: 120 }, { name: 'Milho', price: 60 }] }
  assert.deepEqual(filtrarDados(dados, ['soja']), { commodities: [{ name: 'Soja', price: 120 }], generatedAt: 1 })
  assert.deepEqual(resumirDados({ selic: [[1795521600000, 13.75]] }).selic, [['2026-11-24T12:00:00.000Z', 13.75]])
  const lido = await lerDadosDoPainel({ arquivo: 'commodities.json', filtro: 'Soja' }, async () => dados)
  assert.match(lido.texto, /Soja/)
  assert.doesNotMatch(lido.texto, /Milho/)
  assert.equal((await lerDadosDoPainel({ arquivo: '../segredo', filtro: '' }, async () => ({}))).erro, true)
  assert.equal((await lerDadosDoPainel({ arquivo: 'macro.json', filtro: '' }, async () => { throw new Error('x') })).erro, true)
})

test('instruções do Fredix citam regras e só arquivos da lista', () => {
  const texto = sistema('24/11/2026')
  assert.match(texto, /Não faça cálculos financeiros/)
  assert.match(texto, /24\/11\/2026/)
  for (const arquivo of Object.keys(ARQUIVOS)) assert.match(texto, new RegExp(arquivo.replace('.', '\\.')))
})

function clienteFalso(respostas) {
  const pedidos = []
  return { pedidos, messages: { create: async pedido => { pedidos.push(structuredClone(pedido)); return respostas.shift() } } }
}
const usoBase = { input_tokens: 2000, output_tokens: 200 }

test('agente: pede dado, recebe e responde', async () => {
  const cliente = clienteFalso([
    { stop_reason: 'tool_use', usage: usoBase, content: [{ type: 'tool_use', id: 't1', name: 'ler_dados_do_painel', input: { arquivo: 'quotes.json', filtro: 'USD' } }] },
    { stop_reason: 'end_turn', usage: usoBase, content: [{ type: 'text', text: 'Dólar a R$ 5,93 (quotes.json).' }] },
  ])
  const lidos = []
  const r = await conversar({ cliente, mensagens: [{ role: 'user', content: 'dólar?' }], buscarArquivo: async a => { lidos.push(a); return { quotes: { USDBRL: { bid: '5.93' } } } }, hoje: '24/11/2026' })
  assert.equal(r.texto, 'Dólar a R$ 5,93 (quotes.json).')
  assert.deepEqual(lidos, ['quotes.json'])
  assert.equal(cliente.pedidos[0].model, 'claude-haiku-5-5')
  assert.equal(cliente.pedidos[1].messages.at(-1).content[0].tool_use_id, 't1')
  assert.ok(r.custo > 0)
})

test('agente: recusa da IA vira mensagem educada e o laço tem fim', async () => {
  const recusa = await conversar({ cliente: clienteFalso([{ stop_reason: 'refusal', usage: usoBase, content: [] }]), mensagens: [{ role: 'user', content: 'x' }], buscarArquivo: async () => ({}), hoje: '' })
  assert.match(recusa.texto, /Não posso ajudar/)
  const pedeSempre = { stop_reason: 'tool_use', usage: usoBase, content: [{ type: 'tool_use', id: 't', name: 'ler_dados_do_painel', input: { arquivo: 'macro.json', filtro: '' } }] }
  const cliente = clienteFalso([pedeSempre, pedeSempre, pedeSempre, pedeSempre])
  const r = await conversar({ cliente, mensagens: [{ role: 'user', content: 'x' }], buscarArquivo: async () => ({}), hoje: '' })
  assert.match(r.texto, /Não consegui concluir/)
  assert.equal(cliente.pedidos.length, 4)
  assert.equal(cliente.pedidos[3].tool_choice.type, 'none')
})

function kvFalso(inicial = {}) {
  const dados = new Map(Object.entries(inicial).map(([k, v]) => [k, JSON.stringify(v)]))
  return { dados, get: async (k, tipo) => dados.has(k) ? (tipo === 'json' ? JSON.parse(dados.get(k)) : dados.get(k)) : null, put: async (k, v) => { dados.set(k, v) } }
}
const env = (extra = {}) => ({ ANTHROPIC_API_KEY: 'teste', TURNSTILE_SECRET_KEY: 'segredo', FREDIX_KV: kvFalso(), ...extra })
const pedido = (corpo, origem = 'https://fernandocastilho.github.io') => new Request('https://fredix.exemplo.workers.dev/pergunta', { method: 'POST', headers: { origin: origem, 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7' }, body: JSON.stringify(corpo) })
const antiRoboOk = async url => String(url).includes('siteverify') ? Response.json({ success: true }) : Response.json({ quotes: {} })
const respostaFinal = () => clienteFalso([{ stop_reason: 'end_turn', usage: usoBase, content: [{ type: 'text', text: 'Resposta.' }] }])
const corpoOk = { mensagens: [{ role: 'user', content: 'Como está o dólar?' }], antiRobo: 'tok' }

test('servidor: responde, grava só contagens e não guarda a conversa', async () => {
  const e = env()
  const r = await atender(pedido(corpoOk), e, { fetcher: antiRoboOk, cliente: respostaFinal(), agora })
  assert.equal(r.status, 200)
  assert.equal((await r.json()).resposta, 'Resposta.')
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://fernandocastilho.github.io')
  const gravado = [...e.FREDIX_KV.dados.values()].join(' ')
  assert.doesNotMatch(gravado, /dólar|Resposta|203\.0\.113\.7/)
  assert.equal(JSON.parse(e.FREDIX_KV.dados.get('geral')).perguntasDia, 1)
})

test('servidor: barra origem de fora, robô, dado de cliente, configuração faltando e limite estourado', async () => {
  const falso = respostaFinal()
  assert.equal((await atender(pedido(corpoOk, 'https://outro.site'), env(), { fetcher: antiRoboOk, cliente: falso, agora })).status, 403)
  const robo = async () => Response.json({ success: false })
  assert.equal((await atender(pedido(corpoOk), env(), { fetcher: robo, cliente: falso, agora })).status, 403)
  // Sem a chave do anti-robô configurada, o servidor recusa (fecha por segurança).
  assert.equal((await atender(pedido(corpoOk), env({ TURNSTILE_SECRET_KEY: '' }), { fetcher: antiRoboOk, cliente: falso, agora })).status, 403)
  const cpf = await atender(pedido({ ...corpoOk, mensagens: [{ role: 'user', content: 'cliente CPF 123.456.789-09' }] }), env(), { fetcher: antiRoboOk, cliente: falso, agora })
  assert.equal(cpf.status, 400)
  assert.equal((await atender(pedido(corpoOk), env({ ANTHROPIC_API_KEY: '' }), { fetcher: antiRoboOk, cliente: falso, agora })).status, 503)
  const cheio = env({ FREDIX_KV: kvFalso({ geral: { dia: '2026-11-24', mes: '2026-11', custoDia: 0.5, custoMes: 8.2, perguntasDia: 50 } }) })
  const r = await atender(pedido(corpoOk), cheio, { fetcher: antiRoboOk, cliente: falso, agora })
  assert.equal(r.status, 429)
  assert.match((await r.json()).erro, /mês/)
  assert.equal(falso.pedidos.length, 0, 'nenhum pedido chegou à IA')
})

test('servidor: o 11º pedido do mesmo visitante na mesma hora é barrado', async () => {
  const e = env()
  for (let i = 0; i < 10; i++) assert.equal((await atender(pedido(corpoOk), e, { fetcher: antiRoboOk, cliente: respostaFinal(), agora })).status, 200)
  assert.equal((await atender(pedido(corpoOk), e, { fetcher: antiRoboOk, cliente: respostaFinal(), agora })).status, 429)
})

test('painel: endereço, envio e links internos', async () => {
  assert.equal(fredixEndpoint({ endpoint: '' }), null)
  assert.equal(fredixEndpoint({ endpoint: 'http://inseguro.dev' }), null)
  assert.equal(fredixEndpoint({ endpoint: 'https://fredix.conta.workers.dev/' }), 'https://fredix.conta.workers.dev')
  await assert.rejects(perguntarAoFredix({ endpoint: '' }, corpoOk.mensagens), /configuração/)
  await assert.rejects(perguntarAoFredix({ endpoint: 'https://a.dev' }, [{ role: 'user', content: 'CPF 123.456.789-09' }], { fetcher: async () => assert.fail('não deveria enviar') }), /CPF/)
  let enviado
  const resposta = await perguntarAoFredix({ endpoint: 'https://a.dev' }, corpoOk.mensagens, { antiRobo: 'tok', fetcher: async (url, opcoes) => { enviado = { url, corpo: JSON.parse(opcoes.body) }; return Response.json({ resposta: 'ok' }) } })
  assert.equal(resposta, 'ok')
  assert.equal(enviado.url, 'https://a.dev/pergunta')
  assert.equal(enviado.corpo.antiRobo, 'tok')
  await assert.rejects(perguntarAoFredix({ endpoint: 'https://a.dev' }, corpoOk.mensagens, { fetcher: async () => Response.json({ erro: 'limite' }, { status: 429 }) }), /limite/)
  assert.deepEqual(partesDaResposta('Veja a **[calculadora](#calculadora/giro)** e [site](https://x.com).'), [
    { texto: 'Veja a ' }, { texto: 'calculadora', rota: '#calculadora/giro' }, { texto: ' e [site](https://x.com).' },
  ])
})
