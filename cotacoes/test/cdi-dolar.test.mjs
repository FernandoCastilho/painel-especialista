import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { calendarDays, parseDecimal, returnAt, simulateCdiDolar } from '../src/cdiDolar.js'

const near = (a, b, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`)
const base = { spot: 5.2, target: 5.5, amount: 520000, cdi: 0.1415, pct: 0.98, start: '2026-06-25' }

// Exemplo da planilha enviada por Fernando (18/11/2026): os valores exibidos no Excel.
test('reproduz a planilha CDI x Dólar', () => {
  const r = simulateCdiDolar(base)
  assert.equal(r.ok, true)
  near(r.oscillation * 100, 5.77)
  near(r.variation, 0.3, 1e-9)
  near(r.dailyCdi * 100, 0.0525, 0.00005)
  near(r.dailyProduct * 100, 0.0515, 0.00005)
  assert.equal(r.n, 136)
  assert.equal(r.end, '2027-01-02')
  assert.equal(r.days, 191)
  near(r.gross * 100, 7.25)
  near(r.grossValue, 557701.58)
  near(r.grossGain, 37701.58)
  assert.equal(r.iof, 0)
  assert.equal(r.ir, 0.2)
  near(r.netGain, 30161.27)
  near(r.netValue, 550161.27)
})

test('prazo é o primeiro dia útil em que o líquido alcança a oscilação', () => {
  const r = simulateCdiDolar(base)
  const before = returnAt(r.n - 1, { amount: base.amount, dailyProduct: r.dailyProduct })
  assert.ok(before.net < r.oscillation)
  assert.ok(r.net >= r.oscillation)
})

// Conta independente, feita à mão a partir das premissas da aba Fórmulas.
test('conferência independente: IOF regressivo e IR de 22,5% em prazo curto', () => {
  const p = { ...base, target: 5.2 * 1.001 }
  const r = simulateCdiDolar(p)
  const daily = ((1.1415 ** (1 / 252)) - 1) * 0.98
  const IOF = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3]
  let n = 0, net = 0
  do {
    n++
    const days = Math.ceil(n * 1.4)
    const iof = days < 30 ? IOF[days - 1] / 100 : 0
    net = ((1 + daily) ** n - 1) * (1 - iof) * (1 - 0.225)
  } while (net < 0.001)
  assert.equal(r.n, n)
  assert.ok(r.iof > 0, 'prazo curto deve cair na tabela de IOF')
  assert.equal(r.ir, 0.225)
})

test('dias corridos e faixas de IR', () => {
  assert.equal(calendarDays(136), 191)
  assert.equal(calendarDays(5), 7)
  assert.equal(returnAt(128, { amount: 1, dailyProduct: 0.0005 }).days, 180)
  assert.equal(returnAt(128, { amount: 1, dailyProduct: 0.0005 }).ir, 0.225)
  assert.equal(returnAt(129, { amount: 1, dailyProduct: 0.0005 }).ir, 0.2)
  assert.equal(returnAt(600, { amount: 1, dailyProduct: 0.0005 }).ir, 0.15)
})

test('dólar alvo igual ou abaixo do atual não exige prazo', () => {
  const r = simulateCdiDolar({ ...base, target: 5.0 })
  assert.equal(r.ok, true)
  assert.equal(r.already, true)
})

test('erros de preenchimento e alvo inalcançável', () => {
  assert.equal(simulateCdiDolar({ ...base, spot: NaN }).ok, false)
  assert.equal(simulateCdiDolar({ ...base, amount: 0 }).ok, false)
  assert.equal(simulateCdiDolar({ ...base, start: '' }).ok, false)
  const far = simulateCdiDolar({ ...base, target: 500, cdi: 0.01 })
  assert.equal(far.ok, false)
  assert.match(far.error, /5\.000 dias úteis/)
})

test('lê números no formato brasileiro', () => {
  assert.equal(parseDecimal('5,20'), 5.2)
  assert.equal(parseDecimal('14,15'), 14.15)
  assert.equal(parseDecimal('5.5'), 5.5)
  assert.equal(parseDecimal('1.234,5'), 1234.5)
  assert.ok(Number.isNaN(parseDecimal('abc')))
  assert.ok(Number.isNaN(parseDecimal('')))
})

test('calculadora aparece na lista e abre pelo endereço e pelo terminal', () => {
  const calc = readFileSync(new URL('../src/Calculadora.jsx', import.meta.url), 'utf8')
  assert.match(calc, /id: 'cdi-dolar', title: 'CDI x Dólar'/)
  assert.match(calc, /view === 'cdi-dolar'\) return <CdiDolar/)
  const term = readFileSync(new URL('../src/terminal.js', import.meta.url), 'utf8')
  assert.match(term, /CDIDOLAR: \['calculadora', 'cdi-dolar'\]/)
})
