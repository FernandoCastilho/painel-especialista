import test from 'node:test'
import assert from 'node:assert/strict'
import { giroOperation } from '../src/creditComparison.js'
import { isBusinessDay } from '../src/holidays.js'

// Regra aprovada por Fernando em 11/11/2026: Capital de Giro com juros por dias reais, vencimento no próximo dia útil,
// IOF e TAC na liberação e CET da Resolução CMN 4.881 (dias corridos/365).
const base = { value: 100000, n: 12, rate: 2, unit: 'am', start: '2026-11-11', firstDue: '2026-12-11', profile: 'pj', eligible: false, fees: 0 }
const cents = value => Math.round(value * 100) / 100
const civil = iso => Date.parse(`${iso}T00:00:00Z`) / 86400000

test('vencimentos em dia útil e juros de cada período por dias corridos sobre a taxa ao mês', () => {
  for (const system of ['price', 'sac']) {
    const r = giroOperation({ ...base, system })
    assert.ok(r.ok, r.error)
    let previous = base.start, balance = base.value
    for (const row of r.rows) {
      assert.ok(isBusinessDay(row.date, 'BR'), `${row.date} é dia útil`)
      const expected = balance * (Math.pow(1.02, (civil(row.date) - civil(previous)) / 30) - 1)
      assert.ok(Math.abs(row.interest - cents(expected)) < 1e-6, `${system} ${row.date}`)
      balance = cents(balance - row.amortization); previous = row.date
    }
    // 11/04/2027 é domingo: vence na segunda, 12/04/2027.
    assert.equal(r.rows.find(row => row.date.startsWith('2027-04')).date, '2027-04-12')
  }
})

test('CET reconcilia o valor líquido (valor − IOF − TAC) com as parcelas em dias corridos/365', () => {
  for (const fees of [0, 1500]) {
    const r = giroOperation({ ...base, system: 'price', fees })
    const net = base.value - r.iof - fees
    const pv = r.rows.reduce((sum, row) => sum + row.payment / Math.pow(1 + r.cet, (civil(row.date) - civil(base.start)) / 365), 0)
    assert.ok(Math.abs(pv - net) < 0.01, `${fees}: ${pv} × ${net}`)
    assert.ok(Math.abs(r.total - (r.paid + r.iof + fees)) < 1e-6)
  }
  const plain = giroOperation({ ...base, system: 'price' }), withFee = giroOperation({ ...base, system: 'price', fees: 1500 })
  assert.ok(withFee.cet > plain.cet)
  // Sem IOF e sem TAC, o CET é a taxa efetiva dos juros: (1,02)^(365/30) − 1.
  const exempt = giroOperation({ ...base, system: 'price', value: 20000, profile: 'simples', eligible: true })
  if (exempt.ok && exempt.iof === 0) assert.ok(Math.abs(exempt.cet - (Math.pow(1.02, 365 / 30) - 1)) < 1e-9)
})

test('Bullet paga tudo no último vencimento mensal, em dia útil', () => {
  const r = giroOperation({ ...base, system: 'bullet' })
  assert.ok(r.ok); assert.equal(r.rows.length, 1); assert.equal(r.installment, null)
  assert.equal(r.rows[0].date, '2027-11-11')
})

test('despesas à vista e financiadas reconciliam líquido, saldo, parcelas e CET', () => {
  const setup = { ...base, value: 120000, system: 'sac', rate: 1, start: '2026-11-17', firstDue: '2026-12-17' }
  const expenses = { fees: 300, financedFees: 1200 }
  const periods = [30, 62, 92, 120, 153, 181, 212, 244, 273, 304, 335, 365]
  const iof = cents(121200 * 0.0038 + periods.reduce((sum, days) => sum + 10100 * days * 0.000082, 0))
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} ≠ ${expected}`)
  for (const financeIof of [false, true]) {
    const r = giroOperation({ ...setup, ...expenses, financeIof })
    assert.ok(r.ok, r.error)
    assert.deepEqual(r.rows.map(row => row.days), periods)
    const principal = financeIof ? 123673.70 : 121200
    const net = 120000 - 300 - (financeIof ? 0 : iof)
    let balance = principal, previous = 0, paid = 0
    const payments = periods.map((days, index) => {
      const amortization = cents(cents(principal * ((index + 1) / periods.length)) - (principal - balance))
      const payment = cents(amortization + cents(balance * (1.01 ** ((days - previous) / 30) - 1)))
      paid = cents(paid + payment)
      balance = cents(balance - amortization)
      previous = days
      return payment
    })
    close(r.iof, financeIof ? 2473.70 : iof)
    close(r.financedBalance, principal)
    close(r.net, net)
    close(r.cost, paid - net)
    close(r.total, paid + (120000 - net))
    r.rows.forEach((row, i) => close(row.payment, payments[i]))
    close(payments.reduce((sum, payment, i) => sum + payment / (1 + r.cet) ** (periods[i] / 365), 0), net)
  }
})

test('custos financiados seguem a carência capitalizada e a garantia não é premissa numérica', () => {
  const setup = { ...base, system: 'price', firstDue: '2027-01-10', financedFees: 1200 }
  const r = giroOperation(setup)
  assert.ok(r.ok, r.error)
  assert.equal(r.graceDays, 30)
  assert.ok(Math.abs(r.capitalizedGrace - 2024) < 1e-6)
  assert.deepEqual(giroOperation({ ...setup, guarantee: 'Aval' }), r)
  assert.equal(giroOperation({ ...setup, fees: setup.value }).ok, false)
  assert.equal(giroOperation({ ...setup, financedFees: -1 }).ok, false)
})

test('IOF financiado considera o principal bruto no limite do Simples', () => {
  const setup = { ...base, system: 'bullet', n: 1, profile: 'simples', eligible: true, start: '2026-11-17', firstDue: '2026-12-17', financeIof: true }
  const reduced = giroOperation({ ...setup, value: 29861.34 })
  assert.ok(reduced.ok, reduced.error)
  assert.equal(reduced.financedBalance, 30000)
  assert.equal(reduced.iof, 138.66)
  assert.equal(reduced.tax.daily, 0.00274)
  const general = giroOperation({ ...setup, value: 29861.35 })
  assert.ok(general.ok, general.error)
  assert.equal(general.tax.daily, 0.0082)
  assert.equal(general.iof, 188.11)
  assert.equal(general.financedBalance, 30049.46)
})

test('Bullet com IOF financiado apura sobre o principal bruto com teto de 365 dias', () => {
  const setup = { ...base, system: 'bullet', n: 24, rate: 1, start: '2026-11-17', firstDue: '2026-12-17', financeIof: true }
  const r = giroOperation(setup)
  assert.ok(r.ok, r.error)
  assert.equal(r.financedBalance, 103490.74)
  assert.equal(r.iof, 3490.74)
  assert.equal(r.net, 100000)
  assert.equal(r.rows.length, 1)
  assert.ok(r.rows[0].days > 365)
  const payment = cents(103490.74 * 1.01 ** (r.rows[0].days / 30))
  assert.ok(Math.abs(r.paid - payment) < 1e-6)
  assert.ok(Math.abs(r.cet - ((payment / 100000) ** (365 / r.rows[0].days) - 1)) < 1e-9)
})

test('CET e totais usam os fluxos em centavos que aparecem no cronograma', () => {
  const setup = { ...base, system: 'bullet', n: 1, value: 100, rate: 0, start: '2026-11-17', firstDue: '2026-11-18' }
  const bullet = giroOperation(setup)
  assert.ok(bullet.ok, bullet.error)
  assert.equal(bullet.iof, 0.39)
  assert.equal(bullet.net, 99.61)
  assert.equal(bullet.rows[0].payment, 100)
  assert.ok(Math.abs(bullet.cet - ((100 / 99.61) ** 365 - 1)) < 1e-8)
  for (const system of ['price', 'sac', 'bullet']) {
    for (const financeIof of [false, true]) {
      const r = giroOperation({ ...base, system, financeIof, fees: 349.78, financedFees: 1200.28 })
      assert.ok(r.ok, r.error)
      for (const row of r.rows) assert.equal(row.payment, cents(row.amortization + row.interest))
      assert.equal(cents(r.rows.reduce((total, row) => total + row.payment, 0)), r.paid)
      assert.equal(cents(r.rows.reduce((total, row) => total + row.originalAmortization, 0)), r.financedBalance)
      assert.equal(r.rows.at(-1).balance, 0)
      assert.equal(cents(r.paid - r.net), r.cost)
      assert.equal(cents(r.rows.reduce((total, row) => total + row.payment / (1 + r.cet) ** (row.days / 365), 0)), r.net)
    }
  }
})


test('Giro arredonda meio centavo de juros para cima de forma consistente', () => {
  const setup = { ...base, system: 'bullet', n: 1, rate: 1, start: '2026-11-17', firstDue: '2026-12-17' }
  for (const [value, interest] of [[14.50, 0.15], [100.50, 1.01], [102.50, 1.03]]) {
    const r = giroOperation({ ...setup, value })
    assert.ok(r.ok, r.error)
    assert.equal(r.rows[0].interest, interest)
    assert.equal(r.rows[0].payment, cents(value + interest))
  }
})

test('Price não paga mais que o saldo quando o valor é de poucos centavos', () => {
  const r = giroOperation({ ...base, system: 'price', n: 5, value: 0.03, rate: 0, financeIof: true })
  assert.ok(r.ok, r.error)
  assert.equal(r.paid, 0.03)
  assert.equal(r.net, 0.03)
  assert.equal(r.rows.at(-1).balance, 0)
  assert.ok(r.rows.every(row => row.payment >= 0))
})


test('IOF financiado fecha no Price mesmo perto de uma mudança de centavo', () => {
  const setup = { ...base, system: 'price', start: '2026-11-17', firstDue: '2026-12-17', financeIof: true }
  const scenarios = [
    { n: 25, rate: 2.265384543919936, value: 291717.22, financedFees: 53.69, fees: 8.84 },
    { n: 54, rate: 1.7864984383340925, value: 2227.20, financedFees: 406.75, fees: 24.13 },
  ]
  for (const p of scenarios) {
    const r = giroOperation({ ...setup, ...p })
    assert.ok(r.ok, r.error)
    const daily = r.rows.reduce((sum, row) => sum + row.originalAmortization * Math.min(row.days, 365) * 0.000082, 0)
    assert.equal(r.iof, cents(r.financedBalance * 0.0038 + daily))
    assert.equal(r.financedBalance, cents(p.value + p.financedFees + r.iof))
    assert.equal(r.rows.at(-1).balance, 0)
  }
})
