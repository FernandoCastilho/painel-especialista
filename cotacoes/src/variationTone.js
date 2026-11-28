/** Color the direction of a signed variation, not whether that move is desirable. */
// Apenas apresentação: usa a mesma precisão do número lido na tela.
export function displayedVariation(value, digits = 2) {
  if (!Number.isFinite(value)) return value
  return Number(value.toLocaleString('en-US', { maximumFractionDigits: digits, useGrouping: false })) || 0
}

export function variationTone(value, digits) {
  if (digits != null) value = displayedVariation(value, digits)
  if (!Number.isFinite(value)) return null
  return value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
}

export function variationColor(value, digits) {
  const tone = variationTone(value, digits)
  return tone === 'up' ? 'var(--up)' : tone === 'down' ? 'var(--down)' : 'var(--mut)'
}
