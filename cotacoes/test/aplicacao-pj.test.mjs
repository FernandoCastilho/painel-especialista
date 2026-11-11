import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateInvestment, investmentAlone, creditVsCash, irRate, iofRate } from '../src/aplicacaoPj.js'
import { growthAt } from '../src/cdiFuturo.js'
import { busDaysIn } from '../src/holidays.js'

const FLAT = [[21, 14], [252, 14], [504, 14], [756, 14], [1260, 14]]
const base = { pts: FLAT, curveBase: '2027-01-04', product: 'cdb-pos', rate: 100, deposit: 1e6, adicional: true }
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`)

test('tabelas: IR regressivo, fundo curto prazo e IOF', () => {
  assert.deepEqual([180, 181, 360, 361, 720, 721].map(d => irRate(d, 'cdb-pos')), [0.225, 0.2, 0.2, 0.175, 0.175, 0.15])
  assert.deepEqual([180, 181, 900].map(d => irRate(d, 'fundo-cp')), [0.225, 0.2, 0.2])
  assert.equal(iofRate(1), 0.96); assert.equal(iofRate(29), 0.03); assert.equal(iofRate(30), 0)
})

test('rendimento bruto do CDB 100% do CDI = fator da curva nos dias úteis do período', () => {
  const r = investmentAlone({ ...base, regime: 'simples', start: '2027-01-04', end: '2029-01-04' })
  assert.equal(r.ok, true)
  const du = busDaysIn('2027-01-04', '2029-01-04', ['BR'])
  near(r.gross, 1e6 * (growthAt(FLAT, du) - 1), 1e-4)
})

test('Simples: IR na fonte é o imposto final (15% acima de 720 dias)', () => {
  const r = investmentAlone({ ...base, regime: 'simples', start: '2027-01-04', end: '2029-01-04' })
  near(r.tax, r.gross * 0.15, 1e-4)
  near(r.net, r.gross * 0.85, 1e-4)
  near(r.finalNet, 1e6 + r.net, 1e-4)
})

test('Presumido: 34% no resgate (24% sem adicional), sem PIS/Cofins', () => {
  const r = investmentAlone({ ...base, regime: 'presumido', start: '2027-01-04', end: '2029-01-04' })
  near(r.tax, r.gross * 0.34, 1e-4); assert.equal(r.pisCofins, 0)
  const s = investmentAlone({ ...base, regime: 'presumido', adicional: false, start: '2027-01-04', end: '2029-01-04' })
  near(s.tax, s.gross * 0.24, 1e-4)
})

test('Real: 34% por competência; PIS/Cofins 4,65% só até 31/12/2026 e dedutível do IRPJ/CSLL', () => {
  const r = investmentAlone({ ...base, regime: 'real', start: '2027-01-04', end: '2029-01-04' })
  assert.equal(r.pisCofins, 0)
  near(r.tax, r.gross * 0.34, 1e-4)
  const c = { ...base, curveBase: '2026-11-03' }
  const y = investmentAlone({ ...c, regime: 'real', start: '2026-11-03', end: '2026-12-31' })
  near(y.pisCofins, y.gross * 0.0465, 1e-6)
  near(y.tax, (y.gross - y.pisCofins) * 0.34, 1e-6)
})

test('IOF no resgate antes de 30 dias, antes do IR', () => {
  const r = investmentAlone({ ...base, regime: 'simples', start: '2027-01-04', end: '2027-01-14' })
  near(r.iof, r.gross * 0.66, 1e-6) // 10 dias corridos
  near(r.tax, r.gross * 0.34 * 0.225, 1e-6)
})

test('Fundo no Simples: come-cotas é abatido no resgate; sem taxa de adm. o total fica em 15% do ganho bruto', () => {
  const r = investmentAlone({ ...base, product: 'fundo-lp', adminFee: 0, regime: 'simples', start: '2027-01-04', end: '2029-01-04' })
  assert.ok(r.withheld > 0)
  // come-cotas reduz o saldo que rende: o bruto fica abaixo do CDB, e o imposto total segue 15% do ganho bruto acumulado
  const cdb = investmentAlone({ ...base, regime: 'simples', start: '2027-01-04', end: '2029-01-04' })
  assert.ok(r.gross < cdb.gross)
  near(r.tax, r.gross * 0.15, 1)
})

test('crédito x caixa: sem juros e sem rendimento, sobra zero', () => {
  const credit = { ok: true, start: '2027-01-04', lastDate: '2027-03-04', value: 1000, net: 1000, rows: [{ date: '2027-02-04', payment: 500, amortization: 500 }, { date: '2027-03-04', payment: 500, amortization: 500 }] }
  const r = creditVsCash(credit, { ...base, rate: 0.0001, regime: 'presumido' })
  near(r.leftover, 0, 0.01)
})

test('crédito x caixa no Lucro Real: despesa do crédito devolve 34% em economia de imposto', () => {
  const credit = { ok: true, start: '2027-01-04', lastDate: '2027-02-04', value: 1000, net: 1000, rows: [{ date: '2027-02-04', payment: 1100, amortization: 1000 }] }
  const p = { ...base, rate: 0.0001, regime: 'real' }
  const r = creditVsCash(credit, p)
  near(r.shield, 34, 1e-6)
  near(r.leftover, 1000 + 34 - 1100, 0.05)
})

test('entradas inválidas', () => {
  assert.equal(simulateInvestment({ ...base, regime: 'x', start: '2027-01-04', end: '2028-01-04' }).ok, false)
  assert.equal(simulateInvestment({ ...base, regime: 'real', start: '2026-01-04', end: '2028-01-04' }).ok, false)
  assert.equal(simulateInvestment({ ...base, regime: 'real', start: '2027-01-04', end: '2040-01-04' }).ok, false)
})
