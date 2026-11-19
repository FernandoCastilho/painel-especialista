import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateCbsCash } from '../src/cbsCash.js'

// Vendas e compras sem tributos (base "por fora"); CBS de 10% sem IBS para isolar o motor de caixa.
const regular = (aliquotas = { cbs: 10, ibsUf: 0, ibsMun: 0 }, extra = {}) => ({ regime: 'regular', aliquotas, reducao: {}, isRate: 0, ...extra })
const base = { revenue: 1000000, spendingRatio: .5, eligibleShare: 100, taxes: regular(),
  currentNetRate: 3, splitShare: 100, receiveDays: 10, payDays: 30, stockDays: 20,
  currentDueDays: 30, futureDueDays: 30, creditDelayDays: 0 }
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`)

test('imposto por fora: alíquota sobre vendas e compras sem tributos', () => {
  const r = simulateCbsCash(base)
  assert.equal(r.ok, true)
  assert.equal(r.outputTax, 100000)
  assert.equal(r.credits, 50000)
  assert.equal(r.netTax, 50000)
  assert.equal(r.grossReceipts, 1100000)
  assert.equal(r.timingDelta, 20000)
  assert.equal(r.reserveImmediate, 20000)
  assert.equal(r.reserveDelayed, 20000)
})
test('retained cash is not a monthly accumulating loan principal', () => {
  const r = simulateCbsCash(base)
  assert.notEqual(r.reserveImmediate, r.splitNet)
  assert.notEqual(r.reserveImmediate, r.splitNet * 12)
})
test('same taxes and same timing without split create no extra reserve', () => {
  const r = simulateCbsCash({ ...base, currentNetRate: 5, splitShare: 0 })
  near(r.timingDelta, 0)
})
test('split does not postpone tax due before receipt or charge it twice', () => {
  const r = simulateCbsCash({ ...base, receiveDays: 60, currentNetRate: 5 })
  near(r.timingDelta, 0)
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
test('partial split preserves credit wait on the early portion before weighting', () => {
  const r = simulateCbsCash({ ...base, splitShare: 50, receiveDays: 10,
    payDays: 20, stockDays: 0, currentDueDays: 40, futureDueDays: 40, creditDelayDays: 0 })
  assert.equal(r.creditGapDays, 5)
  near(r.creditExposure, 25000 / 3)
  near(r.reserveImmediate, 5000)
  near(r.reserveDelayed, 5000 + 25000 / 3)
})
test('excess credits do not make tax remittance negative or become a refund', () => {
  const r = simulateCbsCash({ ...base, spendingRatio: 1.5 })
  assert.equal(r.netTax, 0)
  assert.equal(r.excessCredits, 50000)
  assert.equal(r.splitNet, 0)
})
test('supplier timing and stocks change credit exposure, not legal credit eligibility', () => {
  const a = simulateCbsCash(base)
  const b = simulateCbsCash({ ...base, payDays: 90, stockDays: 0 })
  assert.notEqual(a.cycleDays, b.cycleDays)
  assert.equal(a.credits, b.credits)
  assert.ok(b.creditExposure > a.creditExposure)
})
test('CBS, IBS estadual e municipal com redução oficial: alíquota × (1 − redução)', () => {
  const r = simulateCbsCash({ ...base, taxes: regular({ cbs: 8.8, ibsUf: 0.05, ibsMun: 0.05 }, { reducao: { cbs: 60, ibsUf: 60, ibsMun: 60 } }) })
  assert.equal(r.cbs, 35200)
  assert.equal(r.ibsUf, 200)
  assert.equal(r.ibsMun, 200)
  assert.equal(r.outputTax, 35600)
  near(r.creditRate, 3.56)
  near(r.credits, 500000 * 0.0356)
})
test('Imposto Seletivo entra na base de CBS/IBS, não gera crédito e vence sem split', () => {
  const r = simulateCbsCash({ ...base, taxes: regular({ cbs: 8.8, ibsUf: 0, ibsMun: 0 }, { isRate: 10 }) })
  assert.equal(r.isTax, 100000)
  assert.equal(r.taxBase, 1100000)
  near(r.cbs, 96800)
  near(r.credits, 500000 * 0.088)
  near(r.monthlyTaxDelta, r.netTax + 100000 - 30000)
  near(r.futureFloat, r.netTax * (r.settlementDays - 10) / 30 + 100000 * (30 - 10) / 30)
})
test('Simples: alíquotas do DAS repartidas como na oficial, sem crédito nas compras', () => {
  const simples = tipoReceita => ({ ...base, taxes: { regime: 'simples', pCbs: 2.75, pIbs: 1.25, tipoReceita } })
  const interno = simulateCbsCash(simples(1))
  assert.equal(interno.cbs, 27500)
  assert.equal(interno.ibs, 12500)
  assert.equal(interno.credits, 0)
  assert.equal(simulateCbsCash(simples(5)).outputTax, 20000)
  assert.equal(simulateCbsCash(simples(3)).outputTax, 0)
  const indireta = simulateCbsCash(simples(4))
  assert.equal(indireta.outputTax, 0)
  assert.equal(indireta.pendingTax, 40000)
})
test('zero, missing, negative, infinite and invalid percentage inputs', () => {
  assert.equal(simulateCbsCash({ ...base, taxes: regular({ cbs: 0, ibsUf: 0, ibsMun: 0 }) }).outputTax, 0)
  for (const change of [{ revenue: 0 }, { revenue: Infinity }, { spendingRatio: -1 },
    { splitShare: 101 }, { eligibleShare: -1 }, { receiveDays: '' }, { receiveDays: 1.5 },
    { currentNetRate: NaN }, { creditDelayDays: 366 }, { taxes: regular({ cbs: 101, ibsUf: 0, ibsMun: 0 }) },
    { taxes: regular({ cbs: NaN, ibsUf: 0, ibsMun: 0 }) }, { taxes: regular(undefined, { reducao: { cbs: -1 } }) },
    { taxes: { regime: 'simples', pCbs: NaN, pIbs: 1, tipoReceita: 1 } }, { taxes: { regime: 'simples', pCbs: 1, pIbs: 1, tipoReceita: 7 } }]) {
    assert.equal(simulateCbsCash({ ...base, ...change }).ok, false)
  }
})
test('Simples: tributo do DAS já está na receita bruta, nada é somado ao recebimento', () => {
  const r = simulateCbsCash({ ...base, revenue: 100000, taxes: { regime: 'simples', pCbs: 2.75, pIbs: 1.25, tipoReceita: 1 } })
  assert.equal(r.outputTax, 4000)
  assert.equal(r.grossReceipts, 100000)
  assert.equal(r.receiptsAfterNetSplit, 100000 - r.splitNet)
})
test('2026: CBS e IBS compensados com PIS/Cofins, só conta ilustrativa, sem reserva nem diferença', () => {
  const r = simulateCbsCash({ ...base, currentNetRate: 3, taxes: regular({ cbs: 0.9, ibsUf: 0.1, ibsMun: 0 }, { compensated: true }) })
  assert.equal(r.illustrative, true)
  assert.equal(r.cbs, 9000)
  assert.equal(r.ibs, 1000)
  assert.equal(r.currentTax, 0)
  assert.equal(r.monthlyTaxDelta, 0)
  assert.equal(r.reserveImmediate, 0)
  assert.equal(r.reserveDelayed, 0)
})
