import test from 'node:test'
import assert from 'node:assert/strict'
import { operatingWorkingCapital } from '../src/cbsAnnual.js'

const base = { revenue: 3000000, receiveDays: 90, payDays: 30, stockDays: 120, monthlyCmv: 2000000, monthlyPurchases: 2000000 }
test('calcula recebíveis, estoques e fornecedores com bases distintas', () => {
  assert.deepEqual(operatingWorkingCapital(base), { receivables: 9000000, inventory: 8000000, suppliers: 2000000, total: 15000000 })
  assert.equal(operatingWorkingCapital({ ...base, monthlyCmv: 1800000, monthlyPurchases: 2100000 }).total, 14100000)
})
test('ausência não é zero; zero informado e NCG negativa são preservados', () => {
  assert.equal(operatingWorkingCapital({ ...base, monthlyCmv: NaN }), null)
  assert.equal(operatingWorkingCapital({ ...base, receiveDays: 366 }), null)
  assert.equal(operatingWorkingCapital({ ...base, stockDays: 1.5 }), null)
  assert.equal(operatingWorkingCapital({ ...base, monthlyCmv: 0, monthlyPurchases: 0 }).total, 9000000)
  assert.equal(operatingWorkingCapital({ ...base, receiveDays: 0, stockDays: 0, payDays: 90 }).total, -6000000)
})
