import test from 'node:test'
import assert from 'node:assert/strict'
import { DISCOUNT_INITIAL_FORM, discountOperation, discountGiro, parseDiscountForm } from '../src/analiseDesconto.js'

// Recálculos independentes das regras de 11/11/2026 (CET da Res. CMN 4.881, dias reais e próximo dia útil).
// Datas ajustadas à mão; CET por bisseção própria com potências (1 + taxa)^(dias/365), sem o motor.
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`)
const dayCount = (from, to) => (Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000
function cetOracle(net, flows) {
  const pv = rate => flows.reduce((sum, [days, payment]) => sum + payment / (1 + rate) ** (days / 365), 0)
  let lo = 0, hi = 50
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (pv(mid) > net) lo = mid; else hi = mid }
  return (lo + hi) / 2
}

test('exemplo padrão: 05/12/2026 é sábado, paga em 07/12 e juros, IOF e CET contam 32 dias', () => {
  const { operation: r } = parseDiscountForm({ ...DISCOUNT_INITIAL_FORM, titleFeeMode: 'total' })
  const gross = 225600.43, days = dayCount('2026-11-05', '2026-12-07')
  assert.equal(days, 32)
  assert.equal(r.rows[0].paymentDate, '2026-12-07')
  assert.equal(r.rows[0].adjusted, true)
  const interest = gross * 0.0183 * days / 30
  const iof = (gross - interest) * (0.0038 + 0.000082 * days)
  const net = gross - interest - iof - 564 - 260
  near(r.interest, interest); near(r.iof, iof); near(r.net, net)
  // Um único pagamento: forma fechada (nominal / líquido)^(365/dias) − 1.
  near(r.cet, (gross / net) ** (365 / days) - 1, 1e-9)
  near(r.cet, cetOracle(net, [[days, gross]]), 1e-9)
  assert.equal((r.cet * 100).toFixed(2), '40.66')
})

test('feriado nacional também adia o pagamento: 25/12/2026 (Natal, sex) → 28/12 (seg)', () => {
  const r = discountOperation({ date: '2026-11-04', titleRows: [{ value: 10000, count: 1, dueDate: '2026-12-25' }], rate: 2, feeMode: 'total', fee: 0, tac: 0 })
  assert.equal(r.rows[0].paymentDate, '2026-12-28')
  assert.equal(r.rows[0].days, 54)
  near(r.interest, 10000 * 0.02 * 54 / 30)
})

test('vencimento em dia útil não muda: 04/12/2026 (sex) fica com 30 dias', () => {
  const r = discountOperation({ date: '2026-11-04', titleRows: [{ value: 10000, count: 1, dueDate: '2026-12-04' }], rate: 2, feeMode: 'total', fee: 10, tac: 20 })
  assert.equal(r.rows[0].paymentDate, '2026-12-04')
  assert.equal(r.rows[0].adjusted, false)
  near(r.cet, (10000 / r.net) ** (365 / 30) - 1, 1e-9)
})

test('vários títulos: cada nominal é um pagamento na sua data ajustada; racional também', () => {
  for (const convention of ['commercial30', 'rational30']) {
    const titleRows = [
      { value: 50000, count: 10, dueDate: '2026-12-05' }, // sáb → 07/12
      { value: 30000, count: 5, dueDate: '2027-02-08' }, // Carnaval (seg) → 10/02 (qua)
      { value: 20000, count: 2, dueDate: '2027-03-15' }, // seg, dia útil
    ]
    const r = discountOperation({ date: '2026-11-05', titleRows, rate: 1.9, convention, feeMode: 'unit', fee: 3.5, tac: 150 })
    assert.equal(r.ok, true)
    const paid = ['2026-12-07', '2027-02-10', '2027-03-15']
    assert.deepEqual(r.rows.map(row => row.paymentDate), paid)
    let net = 100000 - 17 * 3.5 - 150
    const flows = titleRows.map((row, i) => {
      const d = dayCount('2026-11-05', paid[i])
      const interest = convention === 'commercial30' ? row.value * 0.019 * d / 30 : row.value - row.value / (1 + 0.019 * d / 30)
      net -= interest + (row.value - interest) * (0.0038 + 0.000082 * d)
      return [d, row.value]
    })
    near(r.net, net)
    near(r.cet, cetOracle(net, flows), 1e-9)
    // O CET devolve exatamente o líquido quando desconta os nominais.
    near(flows.reduce((s, [d, v]) => s + v / (1 + r.cet) ** (d / 365), 0), r.net, 1e-6)
  }
})

test('giro: saldo por dias reais zera, IOF e TAC na liberação e CET recalculado à parte', () => {
  const principal = 1000000, tac = 3150, rate = 1.83
  const g = discountGiro({ principal, months: 12, rate, tac, date: '2026-11-05' })
  assert.equal(g.ok, true)
  // Vencimentos mensais no dia 5, ajustados à mão para o próximo dia útil.
  const dates = ['2026-12-07', '2027-01-05', '2027-02-05', '2027-03-05', '2027-04-05', '2027-05-05', '2027-06-07', '2027-07-05', '2027-08-05', '2027-09-06', '2027-10-05', '2027-11-05']
  assert.deepEqual(g.schedule.map(row => row.dueDate), dates)
  // Juros por dias corridos entre vencimentos: (1 + i)^(dias/30). As parcelas pagas devem quitar o saldo.
  let balance = principal, prior = '2026-11-05', paid = 0
  for (const row of g.schedule) {
    balance = balance * (1 + rate / 100) ** (dayCount(prior, row.dueDate) / 30) - row.installment
    paid += row.installment; prior = row.dueDate
  }
  near(balance, 0, 1e-4)
  // Parcela Price constante (a última fecha o saldo).
  for (const row of g.schedule) near(row.installment, g.installment, 0.01)
  // IOF: adicional sobre o principal + diário sobre cada amortização pelos dias até a parcela.
  near(g.schedule.reduce((s, row) => s + row.amortization, 0), principal, 1e-4)
  const iof = principal * 0.0038 + g.schedule.reduce((s, row) => s + row.amortization * Math.min(dayCount('2026-11-05', row.dueDate), 365) * 0.000082, 0)
  near(g.iof, iof, 1e-4)
  const net = principal - tac - iof
  near(g.net, net, 1e-4)
  near(g.cost, paid - net, 1e-4)
  near(g.cost, g.interest + tac + g.iof, 1e-4)
  near(g.cet, cetOracle(net, g.schedule.map(row => [dayCount('2026-11-05', row.dueDate), row.installment])), 1e-9)
})

test('comparação mostra CET dos dois lados e mantém a economia em reais', () => {
  const { result } = parseDiscountForm({ ...DISCOUNT_INITIAL_FORM, titleFeeMode: 'total' })
  assert.equal(result.ok, true)
  // CET do desconto vem da projeção (taxa 1,75%), que é a base dos custos comparados.
  const gross = 225600.43, days = 32, interest = gross * 0.0175 * days / 30
  const net = gross - interest - (gross - interest) * (0.0038 + 0.000082 * days) - 564 - 260
  near(result.projected.cet, (gross / net) ** (365 / days) - 1, 1e-9)
  near(result.monthly.cost, 6 * (gross - net), 1e-6)
  for (const row of result.comparisons) {
    assert.ok(row.giro.cet > 0)
    near(row.discountCost, result.monthly.cost * row.months, 1e-6)
    near(row.savings, row.discountCost - row.giro.cost, 1e-6)
  }
})
