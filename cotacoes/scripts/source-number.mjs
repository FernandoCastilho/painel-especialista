// An absent observation is not zero. Preserve legitimate zero/negative rates.
export function sourceNumber(value) {
  if (!['number', 'string'].includes(typeof value) || (typeof value === 'string' && !value.trim())) return NaN
  const number = Number(value)
  return Number.isFinite(number) ? number : NaN
}
