// Preço diário aproximado de insumos: contratos futuros (COMEX e ICE Nova York) pelo Yahoo Finance. Atrasado, não oficial; serve de referência, não de preço de negociação.
export const LB_PER_TONNE = 2204.62262185
export const INSUMOS_PRECOS = [
  { id: 'cobre', symbol: 'HG=F', name: 'Cobre · contrato futuro COMEX (HG)', unit: 'USD/tonelada', factor: LB_PER_TONNE, url: 'https://query1.finance.yahoo.com/v8/finance/chart/HG%3DF?interval=1d&range=6mo' },
  // Café arábica: contrato "C" da ICE Futures U.S. (Nova York), em centavos de dólar por libra-peso (moeda USX no Yahoo).
  // Dois anos de fechamentos para as variações de 12 meses e do ano; a faixa barra resposta em outra unidade (em dólar, viria perto de 3).
  { id: 'cafe-arabica', symbol: 'KC=F', name: 'Café arábica · contrato futuro ICE Nova York (KC)', unit: 'US¢/libra-peso', factor: 1, range: [30, 2000], url: 'https://query1.finance.yahoo.com/v8/finance/chart/KC%3DF?interval=1d&range=2y' },
]
const toPanelUnit = (v, def) => Math.round(v * def.factor * 100) / 100
// [[ms, fechamento na unidade original]] -> [[ms, valor na unidade do painel]]; pontos inválidos ficam de fora, nunca viram zero.
export const toDailyPoints = (raw, def) => raw
  .filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v) && v > 0)
  .map(([t, v]) => [t, toPanelUnit(v, def)])
// Faixa esperada (quando definida): valor em outra unidade derruba só esta série, e o coletor preserva a anterior.
export function checkUnit(points, def) {
  if (def.range && points.some(([, v]) => v < def.range[0] || v > def.range[1])) throw new Error('valor fora da faixa esperada')
}
// Máxima e mínima do último pregão, na unidade do painel; só quando a barra é a do último ponto da série.
export function lastDayRange(bar, points, def) {
  if (!bar || bar.t !== points.at(-1)?.[0]) return null
  return { t: bar.t, high: toPanelUnit(bar.high, def), low: toPanelUnit(bar.low, def), ...(bar.marketTime ? { marketTime: bar.marketTime } : {}) }
}
export function dailyFile(series, now, errors = []) {
  return { schemaVersion: 1, generatedAt: now, stale: Object.values(series).length > 0 && Object.values(series).every((s) => s.stale), errors, series }
}
