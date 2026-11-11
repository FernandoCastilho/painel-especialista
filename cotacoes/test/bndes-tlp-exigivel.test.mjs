import assert from 'node:assert/strict'
import test from 'node:test'
import { simulateTlpExigivel, parseTlpSchedule } from '../src/bndesTlpExigivel.js'
const input = () => ({ mode: 'projection', principalCents: 1000000, releaseDate: '2026-10-15', j: { annualPct: '5', source: 'J ajustado sintético de teste', confirmed: true }, spreads: { bndes: '2', agent: '3' }, ipcaScenario: { annualPct: '4', acknowledged: true }, schedule: { source: 'Cronograma sintético', confirmed: true, events: [{ date: '2027-10-15', businessDays: 252, amortize: true }, { date: '2028-10-16', businessDays: 252, amortize: true }] } })
const blocked = (data, code) => { const r = simulateTlpExigivel(data); assert.equal(r.ok, false); assert.equal(r.error.code, code); assert.deepEqual(r.rows, []); assert.equal(r.totals, null); assert.equal(r.cet, null) }

test('oracle independente anual: composição multiplicativa e IPCA não incorporado ao principal', () => {
  const r = simulateTlpExigivel(input()); assert.equal(r.ok, true)
  // 1.04 * 1.05 * 1.02 * 1.03 = 1.1472552. Não 1.14.
  assert.deepEqual(r.rows.map(x => [x.openingCents, x.interestCents, x.amortizationCents, x.paymentCents, x.closingCents]), [[1000000, 147255, 500000, 647255, 500000], [500000, 73628, 500000, 573628, 0]])
  assert.equal(r.totals.paymentCents, 1220883)
  assert.equal(r.totals.amortizationCents, 1000000)
  assert.equal(r.status, 'projection-not-contract-validated')
  // CET existe só como taxa calculada; não altera juros, parcelas nem o cronograma travado acima.
  assert.equal(typeof r.cet.fixedAnnualRate, 'number'); assert.equal(typeof r.cet.projectedAnnualRate, 'number'); assert.equal(r.cet.netReleaseCents, 1000000)
  assert.match(r.warnings.join(' '), /16 casas/)
})
test('carência cobra IPCA e juros sem capitalizá-los; depois amortiza principal original', () => {
  const d = input(); d.schedule.events[0].amortize = false
  const r = simulateTlpExigivel(d); assert.equal(r.ok, true)
  assert.equal(r.rows[0].paymentCents, 147255); assert.equal(r.rows[0].closingCents, d.principalCents)
  assert.equal(r.rows[1].amortizationCents, d.principalCents)
})
test('126 DU usa raiz do produto anual; não usa dias corridos ou soma das taxas', () => {
  const d = input(); d.schedule.events = [{ date: '2027-04-15', businessDays: 126, amortize: true }]
  const r = simulateTlpExigivel(d); assert.equal(r.ok, true)
  assert.ok(Math.abs(r.rows[0].interestFactor - Math.sqrt(1.1472552)) < 1e-14)
  assert.equal(r.rows[0].interestCents, Math.round(1000000 * (Math.sqrt(1.1472552) - 1)))
})
test('zero explícito permitido; ausência, null, número, vazio e whitespace não viram zero', () => {
  const d = input(); d.j.annualPct = '0'; d.spreads = { bndes: '0', agent: '0' }; d.ipcaScenario.annualPct = '0'
  assert.equal(simulateTlpExigivel(d).totals.paymentCents, d.principalCents)
  for (const missing of [undefined, null, '', ' ', 0, NaN]) { const x = input(); x.spreads.agent = missing; blocked(x, 'INVALID_RATE') }
})
test('juros negativos menores que amortização descontam prestação e não são zerados', () => {
  const d = input(); d.j.annualPct = '0'; d.spreads = { bndes: '0', agent: '0' }; d.ipcaScenario.annualPct = '-10'
  const r = simulateTlpExigivel(d)
  assert.deepEqual(r.rows.map(x => [x.interestCents, x.paymentCents, x.closingCents]), [[-100000, 400000, 500000], [-50000, 450000, 0]])
})
test('juros negativos maiores que amortização reduzem também principal e recalculam saldo remanescente SAC', () => {
  const d = input(); d.j.annualPct = '0'; d.spreads = { bndes: '0', agent: '0' }; d.ipcaScenario.annualPct = '-80'
  const r = simulateTlpExigivel(d); assert.equal(r.ok, true)
  assert.deepEqual(r.rows.map(x => [x.interestCents, x.amortizationCents, x.negativeInterestPrincipalReductionCents, x.paymentCents, x.closingCents]), [[-800000, 500000, 300000, 0, 200000], [-160000, 200000, 0, 40000, 0]])
  assert.equal(r.totals.amortizationCents + r.totals.negativeInterestPrincipalReductionCents, d.principalCents)
  assert.equal(r.totals.paymentCents, d.principalCents + r.totals.interestCents)
})
test('juros negativos na carência reduzem integralmente principal, sem cobrança', () => {
  const d = input(); d.j.annualPct = '0'; d.spreads = { bndes: '0', agent: '0' }; d.ipcaScenario.annualPct = '-10'; d.schedule.events[0].amortize = false
  const r = simulateTlpExigivel(d); assert.equal(r.ok, true)
  assert.equal(r.rows[0].paymentCents, 0); assert.equal(r.rows[0].closingCents, 900000); assert.equal(r.rows[1].interestCents, -90000)
})
test('meio centavo racional é arredondado para fora de zero; última parcela elimina resíduos', () => {
  const d = input(); d.principalCents = 101; d.j.annualPct = '0'; d.spreads = { bndes: '0', agent: '0' }; d.ipcaScenario.annualPct = '50'
  const r = simulateTlpExigivel(d); assert.equal(r.ok, true)
  assert.deepEqual(r.rows.map(x => [x.amortizationCents, x.interestCents, x.closingCents]), [[51, 51, 50], [50, 25, 0]])
  d.ipcaScenario.annualPct = '-50'; assert.equal(simulateTlpExigivel(d).rows[0].interestCents, -51)
})
test('esquema fechado impede ignorar capitalização, Price, custos ou eventos extras', () => {
  for (const key of ['price', 'fees', 'capitalize', 'contractDate']) { const d = input(); d[key] = true; blocked(d, 'UNSUPPORTED_FIELD') }
  // IOF agora é campo próprio, mas só com escolha fechada: valor solto ou campo extra não passa.
  for (const iof of [true, 0, { profile: 'manual' }, { profile: 'pj', daily: 0.001 }]) { const d = input(); d.iof = iof; blocked(d, 'INVALID_IOF') }
  { const d = input(); d.schedule.events[0].iof = 0; blocked(d, 'UNSUPPORTED_FIELD') }
  const d = input(); d.schedule.events[0].extraRelease = 1; blocked(d, 'UNSUPPORTED_FIELD')
  d.schedule.events[0] = { date: '2027-10-15', businessDays: 252, amortize: true }; d.mode = 'historical'; blocked(d, 'UNSUPPORTED_MODE')
})
test('entradas inconsistentes são bloqueadas atomicamente', () => {
  const cases = [
    [d => { d.j.confirmed = false }, 'J_NOT_CONFIRMED'],
    [d => { d.j.source = '' }, 'J_NOT_CONFIRMED'],
    [d => { d.ipcaScenario.acknowledged = false }, 'SCENARIO_NOT_CONFIRMED'],
    [d => { d.ipcaScenario.annualPct = '-100' }, 'INVALID_RATE'],
    [d => { d.schedule.confirmed = false }, 'SCHEDULE_NOT_CONFIRMED'],
    [d => { d.schedule.events[1].date = d.schedule.events[0].date }, 'DATE_ORDER'],
    [d => { d.schedule.events[0].date = '2027-02-30' }, 'INVALID_DATE'],
    [d => { d.schedule.events[0].date = '2027-10-16' }, 'NON_BUSINESS_DATE'],
    [d => { d.schedule.events[0].businessDays = 300 }, 'INVALID_BUSINESS_DAYS'],
    [d => { d.schedule.events[0].businessDays = 0 }, 'INVALID_BUSINESS_DAYS'],
    [d => { d.schedule.events[0].businessDays = 1.5 }, 'INVALID_BUSINESS_DAYS'],
    [d => { d.schedule.events[1].amortize = false }, 'GRACE_AFTER_AMORTIZATION'],
    [d => { d.schedule.events.forEach(e => { e.amortize = false }) }, 'INCOMPLETE_SCHEDULE'],
    [d => { d.principalCents = 1.5 }, 'INVALID_MONEY']
  ]
  for (const [change, code] of cases) { const d = input(); change(d); blocked(d, code) }
})
test('parser simples mantém DU e fase explícitos e não aceita colunas ignoradas', () => {
  assert.deepEqual(parseTlpSchedule('2027-10-15;252;C\n2028-10-16;252;A').events, [{ date: '2027-10-15', businessDays: 252, amortize: false }, { date: '2028-10-16', businessDays: 252, amortize: true }])
  assert.equal(parseTlpSchedule('2027-10-15;252;A;Price').ok, false)
})
test('identidade de caixa e principal conserva centavos em diversos cenários', () => {
  for (const annualPct of ['-99', '-80', '-10', '0', '4', '50', '100']) {
    for (const principalCents of [101, 12345, 1000000]) {
      const d = input(); d.ipcaScenario.annualPct = annualPct; d.principalCents = principalCents
      const r = simulateTlpExigivel(d); assert.equal(r.ok, true)
      assert.equal(r.totals.closingCents, 0)
      assert.equal(r.totals.paymentCents, principalCents + r.totals.interestCents)
      assert.equal(r.totals.amortizationCents + r.totals.negativeInterestPrincipalReductionCents, principalCents)
      for (const row of r.rows) { assert.ok(row.closingCents <= row.openingCents); assert.ok(row.paymentCents >= 0) }
    }
  }
})


test('fatores da imagem: 1,0812 × 1,0125 × 1,02 × 1,1029; sem presumir cronograma do exemplo', () => {
  const d = input(); d.principalCents = 10000000
  d.j.annualPct = '8.12'; d.spreads = { bndes: '1.25', agent: '2' }; d.ipcaScenario.annualPct = '10.29'
  d.schedule.events[0].amortize = false
  // Período sintético de 252 DU só para validar o produto anual mostrado na foto.
  const r = simulateTlpExigivel(d); assert.equal(r.ok, true)
  assert.ok(Math.abs(r.rows[0].interestFactor - 1.23150839697) < 1e-12)
  assert.equal(r.rows[0].interestCents, 2315084)
  assert.equal(r.rows[0].closingCents, d.principalCents)
})

test('juros arredondados a zero não geram -0, preservando os juros negativos reais', () => {
  const d = input(); d.principalCents = 101
  d.j.annualPct = '-8'; d.spreads = { bndes: '1', agent: '2' }; d.ipcaScenario.annualPct = '0'
  d.schedule.events = [{ date: '2026-11-16', businessDays: 21, amortize: true }]
  const r = simulateTlpExigivel(d)
  assert.equal(r.ok, true)
  assert.equal(r.rows[0].interestCents, 0)
  assert.equal(Object.is(r.rows[0].interestCents, -0), false)
  assert.equal(r.totals.paymentCents, 101)
  d.principalCents = 1000000
  assert.ok(simulateTlpExigivel(d).rows[0].interestCents < 0)
  d.principalCents = 1; d.j.annualPct = '-0.01'; d.spreads = { bndes: '0', agent: '0' }
  d.schedule.events = [{ date: '2027-10-15', businessDays: 252, amortize: true }]
  const annual = simulateTlpExigivel(d)
  assert.equal(annual.ok, true)
  assert.equal(Object.is(annual.rows[0].interestCents, -0), false)
})
