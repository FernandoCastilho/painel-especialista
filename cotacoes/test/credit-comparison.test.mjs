import test from 'node:test'
import assert from 'node:assert/strict'
import { creditOperation, creditCet, equivalentCredit, creditBusinessDays, creditMarketReference } from '../src/creditComparison.js'
import { loan, loanDates } from '../src/emprestimo.js'
const base = { value: 100000, n: 12, rate: 2, unit: 'am', system: 'price', start: '2026-11-08', firstDue: '2026-12-08', fees: 0, monthlyFees: 0 }
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`)
test('zero interest preserves principal, dates and cash-flow reconciliations', () => {
  for (const system of ['price', 'sac', 'bullet']) {
    const r = creditOperation({ ...base, system, rate: 0 })
    assert.ok(r.ok, r.error); near(r.interest, 0); near(r.rows.reduce((s, x) => s + x.originalAmortization, 0), base.value)
    near(r.rows.at(-1).balance, 0); near(r.paid, base.value); near(r.cost, r.iof)
  }
})
test('one 30-day payment reproduces existing loan engine', () => {
  for (const system of ['price', 'sac', 'bullet']) {
    const p = { ...base, n: 1, system }, r = creditOperation(p), old = loan(p)
    assert.ok(r.ok); near(r.interest, old.interest); near(r.iof, old.iof); near(r.total, old.total)
  }
})
test('Price cash-flow has equal payments across actual dates; SAC principal is equal', () => {
  const p = creditOperation(base), s = creditOperation({ ...base, system: 'sac' })
  assert.ok(p.ok && s.ok)
  for (const row of p.rows) near(row.payment, p.rows[0].payment)
  for (const row of s.rows) near(row.amortization, base.value / 12)
  near(p.rows.reduce((sum, r) => sum + r.payment / (1 + p.cet) ** (r.days / 365), 0), p.net)
})
test('capitalized grace is explicitly computed before amortization and does not inflate IOF original principal', () => {
  // 08/02/2027 é segunda de Carnaval (feriado bancário nacional): o vencimento passa para 10/02/2027, 64 dias.
  const r = creditOperation({ ...base, firstDue: '2027-02-08', system: 'sac' })
  assert.ok(r.ok); assert.equal(r.rows[0].date, '2027-02-10'); assert.equal(r.graceDays, 64)
  near(r.capitalizedGrace, base.value * ((1.02) ** (64 / 30) - 1))
  near(r.rows.reduce((sum, row) => sum + row.originalAmortization, 0), base.value)
  near(r.rows.reduce((sum, row) => sum + row.amortization, 0), base.value + r.capitalizedGrace)
  assert.ok(r.iof <= base.value * (0.0038 + 365 * 0.000082) + 1e-6)
})
test('CDI and spread compound in DU/252; holidays are explicit', () => {
  assert.equal(creditBusinessDays('2026-11-06', '2026-11-10'), 2)
  assert.equal(creditBusinessDays('2026-11-06', '2026-11-10', ['2026-11-09']), 1)
  const p = { ...base, system: 'bullet', rateType: 'cdi', rate: 0.3, cdi: 12, cdiPercent: 100, firstDue: '2026-12-08' }
  const r = creditOperation(p), du = creditBusinessDays(p.start, p.firstDue)
  assert.ok(r.ok); near(r.interest, p.value * (Math.pow(1.12 * 1.003 ** 12, du / 252) - 1))
  assert.ok(creditOperation({ ...p, cdi: 14 }).cost > r.cost)
  assert.ok(creditOperation({ ...p, cdi: 10 }).cost < r.cost)
})
test('fees are included once at disbursement and in every payment', () => {
  const r = creditOperation({ ...base, fees: 1000, monthlyFees: 50 }), old = creditOperation(base)
  assert.ok(r.ok); near(old.net - r.net, 1000); near(r.paid - old.paid, 600)
  near(r.cost - old.cost, 1600); assert.ok(r.cet > old.cet)
})
test('equivalence solves principal and leaves fees/guarantees unchanged', () => {
  const p = { ...base, fees: 800, monthlyFees: 20, guaranteeValue: 200000 }, r = equivalentCredit(p, 100000)
  assert.ok(r.ok, r.error); near(r.net, 100000, 0.01); assert.ok(r.value > 100800)
  near(r.coverage, 200000 / r.value * 100); assert.equal(r.fees, 800)
  assert.equal(p.value, 100000)
})
test('Simples eligibility and tax boundary are honored during equivalence', () => {
  assert.equal(creditOperation({ ...base, profile: 'simples' }).ok, false)
  const small = creditOperation({ ...base, value: 30000, profile: 'simples', eligible: true })
  const large = creditOperation({ ...base, value: 30000.01, profile: 'simples', eligible: true })
  assert.equal(small.tax.daily, 0.00274); assert.equal(large.tax.daily, 0.0082)
  const r = equivalentCredit({ ...base, fees: 0, profile: 'simples', eligible: true }, 29500)
  assert.ok(r.ok, r.error); near(r.net, 29500, 0.01)
})
test('unknown guarantee stays unknown; zero and specified guarantees remain distinct', () => {
  assert.equal(creditOperation(base).coverage, null)
  assert.equal(creditOperation({ ...base, guaranteeValue: 0 }).coverage, 0)
  assert.equal(creditOperation({ ...base, guaranteeValue: 150000 }).coverage, 150)
})
test('invalid, incomplete and extreme inputs never expose successful results', () => {
  for (const patch of [{ value: 0 }, { rate: NaN }, { rate: -1 }, { n: 1.2 }, { n: 601 }, { firstDue: base.start }, { firstDue: '2027-02-30' }, { profile: 'pf' }, { fees: 100000 }, { monthlyFees: -1 }, { guaranteeValue: -1 }, { holidays: ['not-a-date'] }, { value: 1e12, rate: 1000 }, { start: '2025-01-01' }]) {
    assert.equal(creditOperation({ ...base, ...patch }).ok, false, JSON.stringify(patch))
  }
  assert.equal(creditCet(0, []), null)
  assert.equal(equivalentCredit(base, -1).ok, false)
})
test('end of month/leap dates and maximum term preserve valid calendar and balance', () => {
  assert.deepEqual(loanDates('2027-12-31', '2028-01-31', 3).map(d => d.date), ['2028-01-31', '2028-02-29', '2028-03-31'])
  const r = creditOperation({ ...base, n: 600, rate: 0.01 })
  assert.ok(r.ok, r.error); near(r.rows.at(-1).balance, 0)
})
test('market reference rejects future/non-numeric points and exposes age/source', () => {
  const now = Date.parse('2026-11-08T12:00:00Z')
  assert.equal(creditMarketReference(null, now), null)
  assert.equal(creditMarketReference({ cdi: [[-1e300, 12]] }, now), null)
  const r = creditMarketReference({ cdi: [[now + 1000, 20], [now - 86400000, 12], [now - 1, 'bad']] }, now)
  assert.equal(r.value, 12); assert.equal(r.stale, false)
  assert.equal(creditMarketReference({ cdi: [[now - 9 * 86400000, 12]] }, now).stale, true)
})
test('equivalence finds valid principal even when doubled upper probe exceeds monetary limit', () => {
  const p = { ...base, value: 500e9 }, original = creditOperation(p)
  assert.ok(original.ok, original.error)
  const r = equivalentCredit(p, original.net)
  assert.ok(r.ok, r.error); near(r.net, original.net, 0.01); near(r.value, p.value, 0.01)
})
test('percentage of CDI scales the daily rate before compounding, not annual log return', () => {
  const p = { ...base, rateType: 'cdi', system: 'bullet', cdi: 15, cdiPercent: 200, rate: 0, start: '2026-11-08', firstDue: '2027-11-07' }
  // Dias úteis descontam fins de semana e feriados nacionais: 260 dias de segunda a sexta, 249 dias úteis.
  const du = creditBusinessDays(p.start, p.firstDue), r = creditOperation(p)
  assert.equal(creditBusinessDays(p.start, p.firstDue, [], false), 260)
  assert.equal(du, 249); assert.ok(r.ok, r.error)
  const daily = Math.pow(1.15, 1 / 252) - 1
  near(r.interest, 100000 * (Math.pow(1 + daily * 2, 249) - 1), 1e-6)
})
test('Res. CMN 4.881, art. 5º: no pós-CDI o CET regulatório é o do mesmo contrato com CDI zero, recálculo independente', () => {
  const p = { ...base, system: 'bullet', rateType: 'cdi', rate: 0.35, cdi: 14.9, cdiPercent: 100, firstDue: '2027-11-08' }
  const r = creditOperation(p)
  assert.ok(r.ok, r.error)
  // Só o spread, na mesma base de dias úteis/252 com feriados nacionais e nas mesmas datas.
  const du = creditBusinessDays(p.start, r.rows[0].date), days = r.rows[0].days
  const payment = p.value * Math.pow(1.0035, 12 * du / 252)
  const net = p.value - p.value * 0.0038 - p.value * Math.min(days, 365) * 0.000082
  const expected = Math.pow(payment / net, 365 / days) - 1
  near(r.cetRegulatory, expected, 1e-9); near(r.regulatoryNet, net, 1e-6)
  // O CET com CDI projetado continua disponível e é maior; o regulatório não depende do cenário do CDI.
  assert.ok(r.cet > r.cetRegulatory)
  near(creditOperation({ ...p, cdi: 10 }).cetRegulatory, r.cetRegulatory, 1e-12)
  near(creditOperation({ ...p, cdi: 0 }).cet, r.cetRegulatory, 1e-12)
})
test('no prefixado o CET regulatório coincide com o CET do fluxo', () => {
  for (const system of ['price', 'sac', 'bullet']) {
    const r = creditOperation({ ...base, system })
    assert.equal(r.cetRegulatory, r.cet); assert.equal(r.regulatoryNet, r.net)
  }
})
