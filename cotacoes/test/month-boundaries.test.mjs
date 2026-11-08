import test from 'node:test'
import assert from 'node:assert/strict'
import { shiftMonths } from '../src/format.js'
import { bndesRows } from '../src/bndes.js'
import { groupRows } from '../src/moedas.js'

test('month shifts clamp to the destination month, including leap years and year boundaries', () => {
  for (const [date, months, expected] of [
    ['2026-03-31', -1, '2026-02-28'], ['2024-03-31', -1, '2024-02-29'],
    ['2024-02-29', -12, '2023-02-28'], ['2026-05-31', -1, '2026-04-30'],
    ['2026-01-31', -1, '2025-12-31'], ['2026-01-31', 1, '2026-02-28'],
  ]) assert.equal(shiftMonths(date, months), expected)
})

test('BNDES and contractual currency month changes use the last observation before the correct month boundary', () => {
  const points = [['2026-02-27', 10], ['2026-03-02', 11], ['2026-03-31', 12]]
  const row = bndesRows({ series: { TFB_36_30: { points } } })[0]
  assert.equal(row.month.ref, '2026-02-27')
  assert.equal(row.month.diff, 2)
  const currency = groupRows({ series: { C01: { points } } }, 'tfc', Date.parse('2026-04-01T12:00:00Z'))[0]
  assert.equal(currency.month.ref, '2026-02-27')
  assert.equal(currency.month.diff, 2)
})
