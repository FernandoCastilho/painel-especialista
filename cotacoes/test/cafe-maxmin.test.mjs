import assert from 'node:assert/strict'
import test from 'node:test'
import { parseYahooLastBar } from '../scripts/intraday-lib.mjs'
import { INSUMOS_PRECOS, checkUnit, lastDayRange, toDailyPoints } from '../scripts/insumos-precos-lib.mjs'
import { indexDayRange } from '../scripts/indices-lib.mjs'
import { dayRange, kpiItems, rangeText } from '../src/terminal.js'
import { coffeeNyContext } from '../src/marketContext.js'

const yahoo = (bars, meta = {}) => ({ chart: { result: [{ meta, timestamp: bars.map((b) => b[0]), indicators: { quote: [{ high: bars.map((b) => b[1]), low: bars.map((b) => b[2]), close: bars.map((b) => b[3]) }] } }] } })

test('Yahoo: última barra com máxima e mínima; barra incoerente ou sem dados não vira faixa', () => {
  const j = yahoo([[100, 12, 10, 11], [200, 22, 20, 21], [300, null, null, null]], { regularMarketTime: 250 })
  assert.deepEqual(parseYahooLastBar(j), { t: 200000, high: 22, low: 20, close: 21, marketTime: 250000 })
  assert.equal(parseYahooLastBar(yahoo([[100, 10, 12, 11]])), null, 'mínima acima da máxima')
  assert.equal(parseYahooLastBar(yahoo([[100, null, 10, 11]])), null, 'sem máxima')
  assert.equal(parseYahooLastBar({}), null)
  assert.equal(parseYahooLastBar(yahoo([[200, 22, 20, 21]], { regularMarketTime: 150 })).marketTime, undefined, 'horário anterior à barra é descartado')
})

test('café KC: centavos por libra-peso, faixa barra outra unidade, máx./mín. só do último pregão', () => {
  const def = INSUMOS_PRECOS.find((d) => d.id === 'cafe-arabica')
  assert.equal(def.symbol, 'KC=F'); assert.equal(def.unit, 'US¢/libra-peso'); assert.equal(def.factor, 1)
  const pts = toDailyPoints([[1, 380.5], [2, 385.25]], def)
  assert.doesNotThrow(() => checkUnit(pts, def))
  assert.throws(() => checkUnit(toDailyPoints([[1, 3.8]], def), def), /fora da faixa/, 'em dólar por libra viria perto de 3')
  assert.doesNotThrow(() => checkUnit([[1, 11000]], INSUMOS_PRECOS[0]), 'cobre não tem faixa')
  assert.deepEqual(lastDayRange({ t: 2, high: 390.123, low: 380.456, marketTime: 5 }, pts, def), { t: 2, high: 390.12, low: 380.46, marketTime: 5 })
  assert.equal(lastDayRange({ t: 1, high: 390, low: 380 }, pts, def), null, 'barra de outro dia')
  assert.equal(lastDayRange(null, pts, def), null)
  assert.deepEqual(indexDayRange({ t: 9, high: 158123.6, low: 156000.2 }, [[9, 157000]]), { t: 9, high: 158124, low: 156000 })
  assert.equal(indexDayRange({ t: 8, high: 1, low: 1 }, [[9, 157000]]), null)
})

test('faixa do dia nos cards: texto, data quando não é de hoje e nada inventado', () => {
  const at = Date.parse('2026-11-27T15:00:00Z')
  assert.equal(rangeText(dayRange(5.6525, 5.6513, at, 4), at), 'Máx. 5,6525 · Mín. 5,6513')
  assert.equal(rangeText(dayRange(5.6525, 5.6513, at, 4), at + 864e5), 'Máx. 5,6525 · Mín. 5,6513 · 27/11')
  assert.equal(dayRange(NaN, 5, at, 4), null); assert.equal(dayRange(5, 6, at, 4), null); assert.equal(dayRange(5, 0, at, 4), null); assert.equal(dayRange(6, 5, NaN, 4), null)
  assert.equal(rangeText(null), null)

  const t = Date.now()
  const q = (bid, extra = {}) => ({ bid, ask: bid, high: bid * 1.01, low: bid * 0.99, pct: 0.1, timestamp: t, ...extra })
  const quotes = { USD: q(5, { source: 'USD' }), EUR: q(6, { source: 'EUR' }), EURUSD: q(1.2) }
  const rates = [{ key: 'selic', label: 'Selic', value: 14.25, delta: 0 }, { key: 'cdi', label: 'CDI', value: 14.15, delta: 0 }, { key: 'di1', label: 'DI 1 ano', value: 13.8, delta: 0 }]
  const ibov = { series: { ibov: { points: [[t - 864e5, 150000], [t, 151000]], lastDay: { t, high: 152000, low: 149500 } } } }
  const ipca = { points: [{ period: '2026-09', y12: 5.1 }, { period: '2026-10', y12: 5 }] }
  const byKey = Object.fromEntries(kpiItems(quotes, rates, ipca, ibov).map((i) => [i.key, i.range ?? null]))
  for (const k of ['USDBRL', 'EURBRL', 'EURUSD', 'IBOV']) assert.ok(byKey[k], `${k} tem faixa`)
  for (const k of ['IPCA', 'selic', 'cdi', 'di1']) assert.equal(byKey[k], null, `${k} sem faixa`)
  assert.equal(byKey.IBOV.high, '152.000')

  const fb = kpiItems({ USD: q(5, { source: 'USD', fallback: true, high: NaN, low: NaN }) }, [])
  assert.equal(fb[0].range, null, 'referência de reserva não tem faixa')
  const old = { series: { ibov: { points: [[t, 151000]], lastDay: { t: t - 1, high: 152000, low: 149500 } } } }
  assert.equal(kpiItems({}, [], null, old)[0].range, null, 'barra de outro pregão')
})

test('café de Nova York em Commodities: último dia, máx./mín. coerentes, unidade conferida', () => {
  const d1 = Date.parse('2026-11-26T18:00:00Z'), d2 = Date.parse('2026-11-27T14:00:00Z'), d2b = Date.parse('2026-11-27T19:00:00Z')
  const s = { unit: 'US¢/libra-peso', points: [[d1, 380], [d2, 384], [d2b, 386.5]], lastDay: { t: d2b, high: 390, low: 381, marketTime: d2b }, checkedAt: d2b }
  const it = coffeeNyContext({ series: { 'cafe-arabica': s } })
  assert.equal(it.value, 386.5); assert.equal(it.period, '2026-11-27'); assert.equal(it.time, '16:00')
  assert.equal(it.dayHigh, 390); assert.equal(it.dayLow, 381)
  assert.deepEqual(it.history, [{ period: '2026-11-26', value: 380 }, { period: '2026-11-27', value: 386.5 }])
  assert.equal(coffeeNyContext({ series: { 'cafe-arabica': { ...s, lastDay: { t: d2b, high: 385, low: 381 } } } }).dayHigh, null, 'preço fora da faixa: sem máx./mín.')
  assert.equal(coffeeNyContext({ series: { 'cafe-arabica': { ...s, unit: 'USD/libra' } } }), null)
  assert.equal(coffeeNyContext({ series: {} }), null)
})
