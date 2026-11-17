import { marketDate } from './marketReturns.js'

// Bolinhas de notícia no gráfico de câmbio. Arquivo: fx-noticias.json ({ moedas: { USD: { dias: { 'AAAA-MM-DD': { itens } } } } }).
// Só marca dias que têm manchete guardada; entre eles, as maiores altas e as maiores baixas do período exibido.
export const FX_MAIORES = 5
export const FX_VARIACAO_MINIMA = 0.5 // % (fechamento contra o fechamento anterior)

const diasDa = (arquivo, code) => arquivo?.moedas?.[code]?.dias ?? null

// Gráfico diário: um evento por dia marcado, com a variação do dia e as manchetes.
export function eventosDiarios(points, arquivo, code, { maiores = FX_MAIORES, minimo = FX_VARIACAO_MINIMA } = {}) {
  const dias = diasDa(arquivo, code)
  if (!dias || !Array.isArray(points) || points.length < 2) return []
  const mov = []
  for (let i = 1; i < points.length; i++) {
    const p = points[i], a = points[i - 1]
    if (!(p.bid > 0) || !(a.bid > 0)) continue
    const dia = marketDate(p.t)
    const itens = dias[dia]?.itens
    if (!itens?.length || dia === marketDate(a.t)) continue
    const pct = (p.bid / a.bid - 1) * 100
    if (Math.abs(pct) >= minimo) mov.push({ t: p.t, bid: p.bid, dia, pct, tom: pct > 0 ? 'up' : 'down', itens })
  }
  const altas = mov.filter((m) => m.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, maiores)
  const baixas = mov.filter((m) => m.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, maiores)
  return [...altas, ...baixas].sort((a, b) => a.t - b.t)
}

// Gráfico do dia: uma bolinha por manchete, no horário em que saiu, sobre a cotação mais próxima desse horário.
export function eventosDoDia(points, arquivo, code, dia) {
  const itens = diasDa(arquivo, code)?.[dia]?.itens
  if (!itens?.length || !Array.isArray(points) || !points.length) return []
  const t0 = points[0].t, t1 = points.at(-1).t
  return itens
    .filter((n) => n.t >= t0 && n.t <= t1)
    .map((n) => {
      const perto = points.reduce((b, p) => (Math.abs(p.t - n.t) < Math.abs(b.t - n.t) ? p : b), points[0])
      return { t: n.t, bid: perto.bid, dia, tom: 'news', itens: [n] }
    })
    .sort((a, b) => a.t - b.t)
}
