import test from 'node:test'
import assert from 'node:assert/strict'
import { giroOperation } from '../src/creditComparison.js'
import { isBusinessDay } from '../src/holidays.js'

// Regra aprovada por Fernando em 11/11/2026: Capital de Giro com juros por dias reais, vencimento no próximo dia útil,
// IOF e TAC na liberação e CET da Resolução CMN 4.881 (dias corridos/365).
const base = { value: 100000, n: 12, rate: 2, unit: 'am', start: '2026-11-11', firstDue: '2026-12-11', profile: 'pj', eligible: false, fees: 0 }
const civil = iso => Date.parse(`${iso}T00:00:00Z`) / 86400000

test('vencimentos em dia útil e juros de cada período por dias corridos sobre a taxa ao mês', () => {
  for (const system of ['price', 'sac']) {
    const r = giroOperation({ ...base, system })
    assert.ok(r.ok, r.error)
    let previous = base.start, balance = base.value
    for (const row of r.rows) {
      assert.ok(isBusinessDay(row.date, 'BR'), `${row.date} é dia útil`)
      const expected = balance * (Math.pow(1.02, (civil(row.date) - civil(previous)) / 30) - 1)
      assert.ok(Math.abs(row.interest - expected) < 1e-6, `${system} ${row.date}`)
      balance -= row.amortization; previous = row.date
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
  const iof = 121200 * 0.0038 + periods.reduce((sum, days) => sum + 10100 * days * 0.000082, 0)
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} ≠ ${expected}`)
  for (const financeIof of [false, true]) {
    const r = giroOperation({ ...setup, ...expenses, financeIof })
    assert.ok(r.ok, r.error)
    assert.deepEqual(r.rows.map(row => row.days), periods)
    const principal = 121200 + (financeIof ? iof : 0)
    const net = 120000 - 300 - (financeIof ? 0 : iof)
    const amortization = principal / 12
    let balance = principal, previous = 0, paid = 0
    const payments = periods.map(days => {
      const payment = amortization + balance * (1.01 ** ((days - previous) / 30) - 1)
      paid += payment
      balance -= amortization
      previous = days
      return payment
    })
    close(r.iof, iof)
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

test('CET respeita o limite técnico no fluxo selecionado, sem validar um fluxo à vista hipotético', () => {
  const setup = { ...base, system: 'bullet', n: 1, rate: 16.947, start: '2026-11-23', firstDue: '2026-11-26' }
  assert.equal(giroOperation(setup).ok, false)
  const financed = giroOperation({ ...setup, financeIof: true })
  assert.ok(financed.ok, financed.error)
  assert.ok(financed.cet < 10)
})
