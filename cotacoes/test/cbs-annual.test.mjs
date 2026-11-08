import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCbsAnnual } from '../src/cbsAnnual.js'
import { simulateCbsCash } from '../src/cbsCash.js'

const inputs = { spendingRatio: 0.6, eligibleShare: 70, cbsRate: 11.2, currentNetRate: 3.65, splitShare: 50, receiveDays: 30, payDays: 30, stockDays: 30, currentDueDays: 40, futureDueDays: 40, creditDelayDays: 30 }
test('annual view repeats the base revenue without inventing seasonality or accumulating reserves', () => {
  const months = buildCbsAnnual('1.000.000,00', {}, inputs)
  assert.equal(months.length, 12)
  const expected = simulateCbsCash({ ...inputs, revenue: 1000000 })
  for (const month of months) assert.deepEqual(month.result, expected)
})
test('each monthly override is independent and uses the unchanged timing formula', () => {
  const months = buildCbsAnnual('1.000.000,00', { 1: '2.000.000,00' }, inputs)
  assert.equal(months[1].result.reserveDelayed, months[0].result.reserveDelayed * 2)
  assert.equal(months[2].revenue, 1000000)
  assert.deepEqual(months[1].result, simulateCbsCash({ ...inputs, revenue: 2000000 }))
})
test('invalid or zero revenue creates a missing scenario, never a fabricated zero reserve', () => {
  const months = buildCbsAnnual('1.000.000,00', { 0: '0', 1: '', 2: 'abc' }, inputs)
  for (const index of [0, 1, 2]) {
    assert.equal(months[index].result.ok, false)
    assert.equal(months[index].result.reserveDelayed, undefined)
  }
  assert.equal(months[3].result.ok, true)
})
