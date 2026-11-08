import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateCbsCash } from '../src/cbsCash.js'

const base = { revenue: 1000000, spendingRatio: .5, eligibleShare: 100, cbsRate: 10,
  currentNetRate: 3, splitShare: 100, receiveDays: 10, payDays: 30, stockDays: 20,
  currentDueDays: 30, futureDueDays: 30, creditDelayDays: 0 }
test('same-price scenario removes tax from tax-inclusive receipts and purchases', () => {
  const r = simulateCbsCash(base)
  assert.equal(r.ok, true)
  assert.ok(Math.abs(r.outputTax - 1000000 / 11) < 1e-8)
  assert.ok(Math.abs(r.credits - 500000 / 11) < 1e-8)
  assert.ok(Math.abs(r.netTax - 500000 / 11) < 1e-8)
  assert.equal(r.timingDelta, 20000)
  assert.equal(r.reserveImmediate, 20000)
  assert.equal(r.reserveDelayed, 20000)
})
test('retained cash is not a monthly accumulating loan principal', () => {
  const r = simulateCbsCash({ ...base, currentDueDays: 30, receiveDays: 10 })
  assert.notEqual(r.reserveImmediate, r.splitNet)
  assert.notEqual(r.reserveImmediate, r.splitNet * 12)
})
test('same taxes and same timing without split create no extra reserve', () => {
  const currentNetRate = (1 / 11 - .5 / 11) * 100
  const r = simulateCbsCash({ ...base, currentNetRate, splitShare: 0 })
  assert.ok(Math.abs(r.timingDelta) < 1e-8)
})
test('split does not postpone tax due before receipt or charge it twice', () => {
  const r = simulateCbsCash({ ...base, receiveDays: 60, currentNetRate: 50 / 11 })
  assert.ok(Math.abs(r.timingDelta) < 1e-8)
  assert.equal(r.splitNet, 0)
  assert.equal(r.settlementDays, 30)
})
test('delayed credits are an additional stress scenario, never immediate cash', () => {
  const a = simulateCbsCash(base)
  const b = simulateCbsCash({ ...base, creditDelayDays: 30 })
  assert.equal(a.netTax, b.netTax)
  assert.equal(b.creditExposure, b.creditsUsable)
  assert.equal(b.reserveDelayed, b.reserveImmediate + b.creditExposure)
})
test('excess credits do not make tax remittance negative or become a refund', () => {
  const r = simulateCbsCash({ ...base, spendingRatio: 1.5 })
  assert.equal(r.netTax, 0)
  assert.ok(r.excessCredits > 0)
  assert.equal(r.splitNet, 0)
})
test('supplier timing and stocks change credit exposure, not legal credit eligibility', () => {
  const a = simulateCbsCash(base)
  const b = simulateCbsCash({ ...base, payDays: 90, stockDays: 0 })
  assert.notEqual(a.cycleDays, b.cycleDays)
  assert.equal(a.credits, b.credits)
  assert.ok(b.creditExposure > a.creditExposure)
})
test('zero, missing, negative, infinite and invalid percentage inputs', () => {
  assert.equal(simulateCbsCash({ ...base, cbsRate: 0 }).outputTax, 0)
  for (const change of [{ revenue: 0 }, { revenue: Infinity }, { spendingRatio: -1 },
    { splitShare: 101 }, { eligibleShare: -1 }, { receiveDays: '' }, { receiveDays: 1.5 },
    { currentNetRate: NaN }, { creditDelayDays: 366 }]) {
    assert.equal(simulateCbsCash({ ...base, ...change }).ok, false)
  }
})
