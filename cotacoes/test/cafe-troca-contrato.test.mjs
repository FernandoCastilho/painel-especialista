import assert from 'node:assert/strict'
import test from 'node:test'
import { INSUMOS_PRECOS, contractUrl, nextContracts, sameContractDay, toDailyPoints } from '../scripts/insumos-precos-lib.mjs'
import { coffeeNyContext } from '../src/marketContext.js'
import { amplitudeText } from '../src/format.js'

const KC = INSUMOS_PRECOS.find((d) => d.id === 'cafe-arabica')
const sec = (iso) => Date.parse(iso) / 1000
// Resposta do Yahoo com barras diárias [iso, máx., mín., fechamento].
const yahoo = (bars) => ({ chart: { result: [{ meta: {}, timestamp: bars.map((b) => sec(b[0])), indicators: { quote: [{ high: bars.map((b) => b[1]), low: bars.map((b) => b[2]), close: bars.map((b) => b[3]) }] } }] } })
const D1 = '2026-11-26T05:00:00Z', D2 = '2026-11-27T05:00:00Z'

test('vencimentos do café: os três próximos no formato do Yahoo', () => {
  assert.deepEqual(nextContracts('KC', Date.parse('2026-11-27T15:00:00Z')), ['KCZ26', 'KCH27', 'KCK27'])
  assert.deepEqual(nextContracts('KC', Date.parse('2027-01-10T15:00:00Z')), ['KCH27', 'KCK27', 'KCN27'])
  assert.deepEqual(nextContracts('KC', Date.parse('2027-10-02T15:00:00Z')), ['KCZ27', 'KCH28', 'KCK28'])
  assert.equal(contractUrl('KCH27'), 'https://query1.finance.yahoo.com/v8/finance/chart/KCH27.NYB?interval=1d&range=5d')
})

test('troca de contrato: máx., mín. e anterior vêm do vencimento que confere com o KC=F', () => {
  // KC=F: ontem fechou no vencimento de dezembro (250,10); hoje já é março (276,20).
  const points = toDailyPoints([[Date.parse(D1), 250.1], [Date.parse(D2), 276.2]], KC)
  const dez = yahoo([[D1, 252, 248, 250.1], [D2, 262, 255, 258.65]])
  const mar = yahoo([[D1, 270, 266, 268.54], [D2, 278.4, 268.9, 276.2]])
  const day = sameContractDay([{ code: 'KCZ26', json: dez }, { code: 'KCH27', json: mar }], points, KC)
  assert.deepEqual(day, { t: Date.parse(D2), high: 278.4, low: 268.9, contract: 'KCH27', prevClose: 268.54, roll: true })
})

test('sem troca: mesmo vencimento dos dois dias, roll falso; nada confere, nada sai', () => {
  const points = toDailyPoints([[Date.parse(D1), 268.54], [Date.parse(D2), 276.2]], KC)
  const mar = yahoo([[D1, 270, 266, 268.54], [D2, 278.4, 268.9, 276.2]])
  assert.equal(sameContractDay([{ code: 'KCH27', json: mar }], points, KC).roll, false)
  const outro = yahoo([[D1, 270, 266, 268.54], [D2, 278.4, 268.9, 277]])
  assert.equal(sameContractDay([{ code: 'KCH27', json: outro }], points, KC), null, 'fechamento diferente: outro vencimento')
  assert.equal(sameContractDay([{ code: 'KCH27', json: yahoo([[D1, 270, 266, 276.2]]) }], points, KC), null, 'barra de outro dia')
  assert.equal(sameContractDay([], points, KC), null)
})

test('painel em dia de troca: anterior e variação do mesmo vencimento, com o mês do contrato', () => {
  const d1 = Date.parse('2026-11-26T18:00:00Z'), d2 = Date.parse('2026-11-27T19:00:00Z')
  const s = { unit: 'US¢/libra-peso', points: [[d1, 250.1], [d2, 276.2]], lastDay: { t: d2, high: 278.4, low: 268.9, contract: 'KCH27', prevClose: 268.54, roll: true }, checkedAt: d2 }
  const it = coffeeNyContext({ series: { 'cafe-arabica': s } })
  assert.equal(it.dayPrev, 268.54); assert.equal(it.contract, 'mar/27'); assert.equal(it.dayLow, 268.9)
  const semTroca = coffeeNyContext({ series: { 'cafe-arabica': { ...s, lastDay: { ...s.lastDay, roll: false } } } })
  assert.equal(semTroca.dayPrev, null); assert.equal(semTroca.contract, null)
})

test('amplitude bate com a máxima e a mínima mostradas no card', () => {
  assert.equal(amplitudeText(1.09844, 1.09386, 4), 'Amplitude = 0,0045 (0,41%)', '1,0984 − 1,0939')
  assert.equal(amplitudeText(390, 381, 2), 'Amplitude = 9,00 (2,36%)')
})
