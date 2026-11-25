import { validarConversa } from './fredixSeguranca.js'

// Só o endereço público do servidor e a chave pública do anti-robô ficam no painel. Nenhum segredo aqui.
export function fredixEndpoint(config) {
  return /^https:\/\/[a-z0-9.-]+(\/[\w./-]*)?$/i.test(config?.endpoint ?? '') ? config.endpoint.replace(/\/$/, '') : null
}

export async function perguntarAoFredix(config, mensagens, { antiRobo, fetcher = fetch, signal } = {}) {
  const endpoint = fredixEndpoint(config)
  if (!endpoint) throw new Error('O Fredix ainda está em configuração.')
  const invalida = validarConversa(mensagens)
  if (invalida) throw new Error(invalida)
  const resposta = await fetcher(`${endpoint}/pergunta`, {
    method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mensagens, antiRobo }),
  })
  const corpo = await resposta.json().catch(() => null)
  if (!resposta.ok || typeof corpo?.resposta !== 'string') throw new Error(corpo?.erro || 'O Fredix não conseguiu responder agora. Tente de novo.')
  return corpo.resposta
}

// Quebra a resposta em texto e links internos do painel (#rota). Links de fora viram texto simples.
export function partesDaResposta(bruto) {
  const texto = String(bruto).replace(/\*\*(.+?)\*\*/g, '$1')
  const partes = []
  const padrao = /\[([^\]]{1,80})\]\((#[\w/-]+)\)/g
  let inicio = 0
  for (const achado of texto.matchAll(padrao)) {
    if (achado.index > inicio) partes.push({ texto: texto.slice(inicio, achado.index) })
    partes.push({ texto: achado[1], rota: achado[2] })
    inicio = achado.index + achado[0].length
  }
  if (inicio < texto.length) partes.push({ texto: texto.slice(inicio) })
  return partes
}
