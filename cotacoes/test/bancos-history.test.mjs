import test from 'node:test'
import assert from 'node:assert/strict'
import { bankMetricHistory, bankMetricLeaders, bankMetricAnalysis } from '../src/bancosHistory.js'

const point = (period, value, basis = 'same', origin = 'bc', metric = 'basel') => ({ period, origin, metrics: { [metric]: { value, basis, source: 'https://example.com/source' } } })
const column = (id, period, value, basis = 'same', origin = 'bc', metric = 'basel') => ({ bank: { id, name: id }, point: point(period, value, basis, origin, metric) })
test('history keeps exact origin and criterion, with missing quarters explicit and no older fill', () => {
  const bank = { observations: [point(202606, 15), point(202603, 14), point(202506, 12), point(202503, 11, 'changed')], releases: [point(202609, 16, 'own', 'ri'), point(202606, 15, 'own', 'ri')] }
  assert.deepEqual(bankMetricHistory(bank, 'bc', 'basel').map(p => [p.period, p.item?.value]), [[202506, 12], [202509, undefined], [202512, undefined], [202603, 14], [202606, 15]])
  assert.deepEqual(bankMetricHistory(bank, 'latest', 'basel').map(p => p.item.value), [15, 16])
  bank.releases[0].metrics = {}
  assert.deepEqual(bankMetricHistory(bank, 'latest', 'basel'), [])
})
test('troféu limits the visible cohort by period, source and criterion, and identifies exclusions', () => {
  const columns = [column('a', 202606, 15), column('b', 202606, 16), column('c', 202609, 99), column('d', 202606, 50, 'own'), column('e', 202606, 50, 'same', 'ri')]
  const result = bankMetricLeaders(columns, 'basel')
  assert.deepEqual(result.winners, ['b'])
  assert.equal(result.eligible.length, 2)
  assert.match(result.scope, /2T2026 · 2\/5 bancos/)
  assert.match(result.reason, /3 fora/)
  assert.equal(bankMetricLeaders([columns[0]], 'basel').winners.length, 0)
})
test('ties use displayed precision; absent and negative values are not replaced by zero', () => {
  assert.deepEqual(bankMetricLeaders([column('a', 202606, 15.00001), column('b', 202606, 15.00002)], 'basel').winners, ['a', 'b'])
  assert.deepEqual(bankMetricLeaders([column('a', 202606, null), column('b', 202606, 15)], 'basel').winners, [])
  assert.deepEqual(bankMetricLeaders([column('a', 202606, -5e9, 'profit', 'bc', 'profit'), column('b', 202606, -2e9, 'profit', 'bc', 'profit')], 'profit').winners, ['b'])
})
test('lower NPL wins; credit trophies mean scale; provision never forces a quality rank', () => {
  assert.deepEqual(bankMetricLeaders([column('a', 202606, 1, 'npl', 'bc', 'nplTotal'), column('b', 202606, 2, 'npl', 'bc', 'nplTotal')], 'nplTotal').winners, ['a'])
  const credit = bankMetricLeaders([column('a', 202606, 1e9, 'credit', 'bc', 'creditPJ'), column('b', 202606, 2e9, 'credit', 'bc', 'creditPJ')], 'creditPJ')
  assert.deepEqual(credit.winners, ['b']); assert.match(credit.rule.label, /porte/)
  assert.deepEqual(bankMetricLeaders([column('a', 202606, 1, 'p', 'bc', 'provisionTotal'), column('b', 202606, 2, 'p', 'bc', 'provisionTotal')], 'provisionTotal').winners, [])
})
test('different ROE windows and methodologies do not acquire a trophy by sharing a metric name', () => {
  const result = bankMetricLeaders([column('a', 202606, 20, 'roe-quarterly-recurring', 'bc', 'roe'), column('b', 202606, 30, 'roe-half-year-ifrs', 'bc', 'roe')], 'roe')
  assert.deepEqual(result.winners, [])
})
test('analysis separates direction from quality, and requires the exact comparison quarter', () => {
  const bank = { observations: [point(202606, 3, 'risk', 'bc', 'nplTotal'), point(202603, 2, 'risk', 'bc', 'nplTotal'), point(202506, 1, 'risk', 'bc', 'nplTotal')] }
  assert.match(bankMetricAnalysis(bank, 'bc', 'nplTotal', -1), /alta de 1,00 p.p.*piora/)
  assert.match(bankMetricAnalysis(bank, 'bc', 'nplTotal', -4), /alta de 2,00 p.p.*piora/)
  bank.observations.splice(1, 1)
  assert.match(bankMetricAnalysis(bank, 'bc', 'nplTotal', -1), /Sem base equivalente/)
})
test('segundo troféu: maior crescimento em R$, podendo coincidir com o maior valor', () => {
  const withPrev = (id, value, prev) => ({ ...column(id, 202606, value, 'credit', 'bc', 'creditPJ'), previous: point(202603, prev, 'credit', 'bc', 'creditPJ') })
  const split = bankMetricLeaders([withPrev('a', 1e9, 0.5e9), withPrev('b', 5e9, 4e9)], 'creditPJ')
  assert.deepEqual(split.winners, ['b']); assert.deepEqual(split.growthWinners, ['a'])
  const both = bankMetricLeaders([withPrev('a', 1e9, 0.9e9), withPrev('b', 5e9, 4e9)], 'creditPJ')
  assert.deepEqual(both.winners, ['b']); assert.deepEqual(both.growthWinners, ['b'])
  assert.deepEqual(bankMetricLeaders([withPrev('a', 1e9, 2e9), withPrev('b', 5e9, 6e9)], 'creditPJ').growthWinners, [])
  assert.deepEqual(bankMetricLeaders([column('a', 202606, 15), column('b', 202606, 16)], 'basel').growthWinners, [])
})
