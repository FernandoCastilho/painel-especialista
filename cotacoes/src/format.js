// Formatadores e utilitários de série compartilhados (sem dependências de tela).
export const nf = (v, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
export const dmy = (iso) => iso.split('-').reverse().join('/')
export const t12 = (iso) => Date.parse(`${iso}T12:00:00Z`)
export function shiftMonths(iso, n) {
  const date = new Date(t12(iso)), day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + n)
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, last))
  return date.toISOString().slice(0, 10)
}
// Última observação [data, valor] em ou antes de `limit` (AAAA-MM-DD), com pontos em ordem crescente; null se a série começa depois.
export function atOrBefore(points, limit) {
  let found = null
  for (const p of points) { if (p[0] <= limit) found = p; else break }
  return found
}

// Arredondamento da ABNT NBR 5891, exigido para divulgar o CET com duas casas (Res. CMN 4.881/2020, art. 4º, parágrafo único, II):
// descarta-se o excedente quando ele é menor que meia unidade da última casa e soma-se 1 quando é maior; quando é exatamente meia
// unidade (5 seguido só de zeros), a última casa fica par. Tolerância relativa para o ruído de ponto flutuante.
export function nbr5891(value, digits = 2) {
  if (!Number.isFinite(value)) return value
  const scale = 10 ** digits, scaled = value * scale, floor = Math.floor(scaled), rest = scaled - floor
  const half = Math.abs(rest - 0.5) <= 1e-9 * Math.max(1, Math.abs(scaled))
  const kept = half ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(scaled)
  return kept / scale
}
// CET em % com duas casas pela NBR 5891, no padrão brasileiro (ex.: 21,87).
export const cetPct = (percent, digits = 2) => nbr5891(percent, digits).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
