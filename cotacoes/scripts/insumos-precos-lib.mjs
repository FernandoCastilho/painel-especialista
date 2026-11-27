// Preço diário aproximado de insumos: contratos futuros (COMEX e ICE Nova York) pelo Yahoo Finance. Atrasado, não oficial; serve de referência, não de preço de negociação.
import { parseYahoo, parseYahooLastBar } from './intraday-lib.mjs'
export const LB_PER_TONNE = 2204.62262185
export const INSUMOS_PRECOS = [
  { id: 'cobre', symbol: 'HG=F', name: 'Cobre · contrato futuro COMEX (HG)', unit: 'USD/tonelada', factor: LB_PER_TONNE, url: 'https://query1.finance.yahoo.com/v8/finance/chart/HG%3DF?interval=1d&range=6mo' },
  // Café arábica: contrato "C" da ICE Futures U.S. (Nova York), em centavos de dólar por libra-peso (moeda USX no Yahoo).
  // Dois anos de fechamentos para as variações de 12 meses e do ano; a faixa barra resposta em outra unidade (em dólar, viria perto de 3).
  // contracts: na troca de contrato, o KC=F do Yahoo mistura dois vencimentos na barra do dia; o coletor confere no contrato com vencimento.
  { id: 'cafe-arabica', symbol: 'KC=F', name: 'Café arábica · contrato futuro ICE Nova York (KC)', unit: 'US¢/libra-peso', factor: 1, range: [30, 2000], contracts: 'KC', url: 'https://query1.finance.yahoo.com/v8/finance/chart/KC%3DF?interval=1d&range=2y' },
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
const nyDay = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
// Vencimentos do café na ICE: março, maio, julho, setembro e dezembro. Os três próximos a partir do mês da data (fuso de Nova York),
// no formato do Yahoo: KCH27.NYB. O vencimento do próprio mês entra porque o contrato segue negociado até a metade dele.
const KC_MONTHS = [[3, 'H'], [5, 'K'], [7, 'N'], [9, 'U'], [12, 'Z']]
export function nextContracts(root, now) {
  const [y, m] = nyDay(now).split('-').map(Number)
  const out = []
  for (let yy = y; out.length < 3; yy++) for (const [mm, code] of KC_MONTHS) if ((yy > y || mm >= m) && out.length < 3) out.push(`${root}${code}${String(yy % 100).padStart(2, '0')}`)
  return out
}
export const contractUrl = (code) => `https://query1.finance.yahoo.com/v8/finance/chart/${code}.NYB?interval=1d&range=5d`
// Barra do dia no mesmo contrato do último ponto do KC=F: o vencimento cuja última barra é do mesmo dia e fecha no mesmo valor.
// contracts: [{ code, json }] já baixados. Devolve { t, high, low, marketTime?, contract, prevClose, roll } na unidade do painel, ou null.
// roll: o fechamento anterior do KC=F é de outro vencimento (o Yahoo trocou de contrato entre os dois pregões).
export function sameContractDay(contracts, points, def) {
  const [t, close] = points.at(-1) ?? [], prev = points.at(-2)
  for (const { code, json } of contracts) {
    const bar = parseYahooLastBar(json), closes = toDailyPoints(parseYahoo(json), def), last = closes.at(-1)
    if (!bar || !last || nyDay(bar.t) !== nyDay(t) || nyDay(last[0]) !== nyDay(t) || last[1] !== close) continue
    const prevClose = closes.at(-2)?.[1]
    if (!Number.isFinite(prevClose)) return null
    return { t, high: toPanelUnit(bar.high, def), low: toPanelUnit(bar.low, def), ...(bar.marketTime ? { marketTime: bar.marketTime } : {}), contract: code, prevClose, roll: prev?.[1] !== prevClose }
  }
  return null
}
export function dailyFile(series, now, errors = []) {
  return { schemaVersion: 1, generatedAt: now, stale: Object.values(series).length > 0 && Object.values(series).every((s) => s.stale), errors, series }
}
