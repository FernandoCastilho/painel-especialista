// Índices de bolsa (fechamento diário pelo Yahoo Finance, atrasado e não oficial). Hoje: Ibovespa.
export const INDICES = [
  { id: 'ibov', symbol: '^BVSP', name: 'Ibovespa', unit: 'pontos', url: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?interval=1d&range=6mo' },
]
// [[ms, valor]] -> pontos inteiros; inválidos ficam de fora, nunca viram zero.
export const toIndexPoints = (raw) => raw.filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v) && v > 0).map(([t, v]) => [t, Math.round(v)])
export function indicesFile(series, now, errors = []) {
  return { schemaVersion: 1, generatedAt: now, stale: Object.values(series).length > 0 && Object.values(series).every((s) => s.stale), errors, series }
}
// Máxima e mínima do último pregão (barra do Yahoo), arredondadas como os pontos; só quando a barra é a do último ponto.
export function indexDayRange(bar, points) {
  if (!bar || bar.t !== points.at(-1)?.[0]) return null
  return { t: bar.t, high: Math.round(bar.high), low: Math.round(bar.low) }
}
