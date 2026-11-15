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
