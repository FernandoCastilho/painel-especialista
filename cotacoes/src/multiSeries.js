// Séries sobrepostas no mesmo gráfico (aba BNDES › comparar): funções puras para alinhar, recortar e normalizar.
import { marcasRedondas } from './chartEixo.js'
const DAY = 864e5
export const tOf = (iso) => Date.parse(`${iso}T12:00:00Z`)
export const isoOf = (t) => new Date(t).toISOString().slice(0, 10)
// Uma matiz por série; o brilho acompanha a superfície sem alterar os dados.
export const colorOf = (i) => `hsl(${Math.round((i * 137.508) % 360)} 68% var(--series-lightness, 62%))`

// Último ponto com t <= alvo (série esparsa mantém o último valor conhecido); antes do início, null.
export function valueAt(points, t) {
  let lo = 0, hi = points.length - 1, ans = -1
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (points[mid].t <= t) { ans = mid; lo = mid + 1 } else hi = mid - 1 }
  return ans < 0 ? null : points[ans]
}

export const sameUnit = (series) => series.length > 0 && series.every((s) => s.unit === series[0].unit)

// Intervalo comum de exibição: atalho em meses a partir do dado mais recente entre as séries, ou datas escolhidas (limitadas à cobertura).
export function viewRange(lists, preset, custom) {
  const firsts = lists.filter((l) => l.length).map((l) => l[0].period), lasts = lists.filter((l) => l.length).map((l) => l.at(-1).period)
  if (!firsts.length) return null
  const min = firsts.reduce((a, b) => (a < b ? a : b)), max = lasts.reduce((a, b) => (a > b ? a : b))
  if (custom) return { start: custom.start < min ? min : custom.start, end: custom.end > max ? max : custom.end }
  if (preset === 'all') return { start: min, end: max }
  const d = new Date(tOf(max)); d.setUTCMonth(d.getUTCMonth() - preset)
  const start = isoOf(d.getTime())
  return { start: start < min ? min : start, end: max }
}

export const clip = (list, range) => (range ? list.filter((p) => p.period >= range.start && p.period <= range.end) : [])
export const toPoints = (list) => list.map((p) => ({ t: tOf(p.period), v: p.value }))
// Variação % sobre o primeiro ponto da própria série no período (séries com unidades diferentes ficam comparáveis).
export const normalize = (points) => (points.length && points[0].v ? points.map((p) => ({ t: p.t, v: (p.v / points[0].v - 1) * 100 })) : [])

// Eixo com 4 a 6 marcas "redondas" cobrindo [lo, hi]: mesma regra de todos os gráficos (chartEixo.js).
export function niceTicks(lo, hi) {
  return marcasRedondas(lo, hi)
}

// Resumo de cada série no recorte: primeiro, último e variação (p.p. para taxa; % para nível/normalizado).
export const spanOf = (points) => (points.length ? { first: points[0], last: points.at(-1) } : null)
export { DAY }
