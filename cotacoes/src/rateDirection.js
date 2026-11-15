// Só compara níveis publicados; não calcula taxas, rendimentos ou médias de faixas.
export function rateDirection(current, historical) {
  const a = Array.isArray(current) ? current : [current]
  const b = Array.isArray(historical) ? historical : [historical]
  if (a.length !== b.length || !a.length || !a.every(Number.isFinite) || !b.every(Number.isFinite)) return null
  const signs = a.map((value, i) => Math.sign(value - b[i]))
  if (signs.every(s => s === 0)) return 'flat'
  if (signs.every(s => s >= 0)) return 'up'
  if (signs.every(s => s <= 0)) return 'down'
  return null // Uma faixa que se alarga/estreita em sentidos opostos não tem direção única.
}
