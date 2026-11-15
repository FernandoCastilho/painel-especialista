// Leitura descritiva das observações; não projeta nem altera taxas.
export function summarizeRate(points, range, step = false) {
  const start = range.start.getTime(), end = range.end.getTime() + 86400000 - 1
  const valid = points.filter(p => Number.isFinite(p.t) && Number.isFinite(p.value) && p.t <= end).sort((a,b) => a.t-b.t)
  const inside = valid.filter(p => p.t >= start)
  const baseline = step ? valid.filter(p => p.t < start).at(-1) : null
  const selected = baseline ? [baseline, ...inside] : inside
  if (!selected.length) return null
  const first=selected[0], last=selected.at(-1)
  return { first, last, change:last.value-first.value, count:selected.length, step }
}
