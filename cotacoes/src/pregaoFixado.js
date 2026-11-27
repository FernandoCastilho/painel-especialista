import { marketDate } from './marketReturns.js'

// Pregão fixado: um dia marcante que fica aberto no gráfico intradiário por alguns dias (public/pregao-fixado.json),
// com as amostras daquele dia e as manchetes do dólar com horário, mesmo depois de sair da janela de 5 dias do intraday.json.
export const PREGAO_FIXADO_ARQUIVO = 'pregao-fixado.json'

const DIA = /^\d{4}-\d{2}-\d{2}$/

// O arquivo vale do dia fixado até `ate` (inclusive, em Brasília). Fora disso, ou inválido, nada é fixado.
export function fixadoAtivo(arq, agora = Date.now()) {
  if (!arq || !DIA.test(arq.dia ?? '') || !DIA.test(arq.ate ?? '') || typeof arq.series !== 'object') return null
  const hoje = marketDate(agora)
  return hoje >= arq.dia && hoje <= arq.ate ? arq : null
}

// Amostras fixadas da moeda no dia pedido, como { t, bid }, em ordem; [] se o dia não é o fixado.
export function pontosFixados(arq, code, dia) {
  if (!arq || dia !== arq.dia) return []
  const pts = arq.series?.[code]
  if (!Array.isArray(pts)) return []
  return pts
    .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[1] > 0 && marketDate(p[0]) === dia)
    .map(([t, bid]) => ({ t, bid }))
    .sort((a, b) => a.t - b.t)
}

// Junta as amostras ao vivo com as fixadas, sem repetir horário (a do arquivo ao vivo vale quando as duas existem).
export function juntarPontos(vivos, fixados) {
  const porT = new Map()
  for (const p of fixados ?? []) porT.set(p.t, p)
  for (const p of vivos ?? []) porT.set(p.t, p)
  return [...porT.values()].sort((a, b) => a.t - b.t)
}

// Data curta para os textos (27/11).
export const diaCurto = (dia) => dia.split('-').reverse().slice(0, 2).join('/')
