/** Color the direction of a signed variation, not whether that move is desirable. */
export function variationTone(value) {
  if (!Number.isFinite(value)) return null
  return value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
}

export function variationColor(value) {
  const tone = variationTone(value)
  return tone === 'up' ? 'var(--up)' : tone === 'down' ? 'var(--down)' : 'var(--mut)'
}
