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
