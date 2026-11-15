// IOF nas telas BNDES TLP exigível e Selic + LCD. Recálculo independente: dias corridos, divisão do principal,
// alíquotas e CET feitos aqui à mão, sem iofRules.js, bndesProfileIof.js nem creditCet.
import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateTlpExigivel } from '../src/bndesTlpExigivel.js'
import { simulateLcdCap } from '../src/bndesLcdCap.js'

// Alíquotas do Decreto 6.306/2007 (art. 7º) desde 17/07/2025, escritas à mão: PJ 0,0082% ao dia; Simples/MEI até R$ 30 mil 0,00274%; adicional 0,38%.
const PJ_DAILY = 0.000082, SIMPLES_DAILY = 0.0000274, ADDITIONAL = 0.0038
// CET por bisseção própria: VP das parcelas em dias corridos/365 = valor líquido.
function handCet(net, flows) {
  const pv = rate => flows.reduce((sum, [days, payment]) => sum + payment / (1 + rate) ** (days / 365), 0)
  let lo = -0.99, hi = 10
  for (let i = 0; i < 300; i++) { const mid = (lo + hi) / 2; if (pv(mid) > net) lo = mid; else hi = mid }
  return (lo + hi) / 2
}

// TLP: R$ 100.000 liberados em 16/11/2026 (segunda). Carência até 16/02/2027 e três amortizações SAC.
// Dias corridos desde a liberação, contados à mão: 17/05/2027 = 182; 16/11/2027 = 365; 16/05/2028 = 547 (2028 é bissexto) → teto 365.
const tlpInput = (iof, ipca = '4') => ({ mode: 'projection', principalCents: 10000000, releaseFeeCents: 50000, releaseDate: '2026-11-16',
  j: { annualPct: '5', source: 'Sintético', confirmed: true }, spreads: { bndes: '2', agent: '3' }, ipcaScenario: { annualPct: ipca, acknowledged: true },
  schedule: { source: 'Sintético', confirmed: true, events: [{ date: '2027-02-16', businessDays: 60, amortize: false }, { date: '2027-05-17', businessDays: 60, amortize: true }, { date: '2027-11-16', businessDays: 125, amortize: true }, { date: '2028-05-16', businessDays: 125, amortize: true }] },
  ...(iof === undefined ? {} : { iof }) })
const TLP_DAYS = { '2027-02-16': 92, '2027-05-17': 182, '2027-11-16': 365, '2028-05-16': 547 }
// Principal dividido em centavos: 3.333.333 + 3.333.334 + 3.333.333.
const TLP_SPLIT = [3333333, 3333334, 3333333]

test('TLP · PJ geral: IOF diário por amortização com teto de 365 dias, adicional sobre o valor', () => {
  const r = simulateTlpExigivel(tlpInput({ profile: 'pj' }))
  assert.equal(r.ok, true, r.error?.message)
  const daily = (3333333 * 182 + 3333334 * 365 + 3333333 * Math.min(547, 365)) * PJ_DAILY // 249.280,005 centavos
  assert.equal(r.iof.dailyCents, 249280); assert.ok(Math.abs(r.iof.dailyCents - daily) <= 0.5)
  assert.equal(r.iof.additionalCents, 10000000 * ADDITIONAL) // R$ 380,00
  assert.equal(r.iof.totalCents, 287280) // R$ 2.872,80
  assert.deepEqual(r.iof.bases.map(b => [b.date, b.principalCents, b.elapsedDays, b.cappedDays]), [['2027-05-17', TLP_SPLIT[0], 182, 182], ['2027-11-16', TLP_SPLIT[1], 365, 365], ['2028-05-16', TLP_SPLIT[2], 547, 365]])
  // Líquido = principal − tarifa (R$ 500) − IOF; as duas linhas de custo usam o mesmo líquido.
  assert.equal(r.cet.netReleaseCents, 10000000 - 50000 - 287280); assert.equal(r.cet.iofCents, 287280)
  const projected = r.rows.map(row => [TLP_DAYS[row.date], row.paymentCents / 100])
  assert.ok(Math.abs(r.cet.projectedAnnualRate - handCet(r.cet.netReleaseCents / 100, projected)) < 1e-9)
  // Parte fixa: o mesmo contrato com IPCA zero, que nesta tela é outra simulação com IPCA 0.
  const fixedRows = simulateTlpExigivel(tlpInput({ profile: 'pj' }, '0')).rows
  assert.ok(Math.abs(r.cet.fixedAnnualRate - handCet(r.cet.netReleaseCents / 100, fixedRows.map(row => [TLP_DAYS[row.date], row.paymentCents / 100]))) < 1e-9)
})

test('TLP · IOF não muda juros nem parcelas e aumenta as duas linhas de custo', () => {
  const zero = simulateTlpExigivel(tlpInput()), explicit = simulateTlpExigivel(tlpInput({ profile: 'zero' })), pj = simulateTlpExigivel(tlpInput({ profile: 'pj' }))
  assert.deepEqual(zero.rows, pj.rows); assert.deepEqual(zero.totals, pj.totals)
  assert.deepEqual(zero.cet, explicit.cet); assert.equal(zero.iof.profile, 'zero'); assert.equal(zero.iof.totalCents, 0)
  assert.equal(zero.cet.netReleaseCents, 10000000 - 50000)
  assert.ok(pj.cet.fixedAnnualRate > zero.cet.fixedAnnualRate); assert.ok(pj.cet.projectedAnnualRate > zero.cet.projectedAnnualRate)
  assert.match(zero.warnings.join(' '), /não verifica o enquadramento/)
})

test('TLP · Simples/MEI: alíquota reduzida só até R$ 30 mil e só com confirmação', () => {
  // R$ 30.000,00 com uma amortização em 100 dias (16/11/2026 → 24/02/2027).
  const small = cents => ({ ...tlpInput({ profile: 'simples', eligible: true }), principalCents: cents, releaseFeeCents: 0, schedule: { source: 'S', confirmed: true, events: [{ date: '2027-02-24', businessDays: 60, amortize: true }] } })
  const r = simulateTlpExigivel(small(3000000))
  assert.equal(r.iof.dailyCents, Math.round(3000000 * 100 * SIMPLES_DAILY)) // R$ 82,20
  assert.equal(r.iof.additionalCents, 11400)
  const above = simulateTlpExigivel(small(3000001)) // um centavo acima do limite: alíquota PJ
  assert.equal(above.iof.dailyCents, Math.round(3000001 * 100 * PJ_DAILY))
  const unconfirmed = simulateTlpExigivel({ ...small(3000000), iof: { profile: 'simples', eligible: false } })
  assert.equal(unconfirmed.ok, false); assert.equal(unconfirmed.error.code, 'IOF_NOT_RESOLVED')
})

test('TLP · IOF PJ antes de 17/07/2025 é bloqueado; tarifa + IOF não podem consumir o principal', () => {
  const old = { ...tlpInput({ profile: 'pj' }), releaseDate: '2025-07-15', schedule: { source: 'S', confirmed: true, events: [{ date: '2025-10-15', businessDays: 60, amortize: true }] } }
  assert.equal(simulateTlpExigivel(old).error.code, 'IOF_NOT_RESOLVED')
  assert.equal(simulateTlpExigivel({ ...old, iof: { profile: 'zero' } }).ok, true)
  assert.equal(simulateTlpExigivel({ ...tlpInput({ profile: 'pj' }), releaseFeeCents: 10000000 - 287280 }).error.code, 'INVALID_FEE')
})

// LCD: R$ 1.000.000 em 03/11/2026, cinco amortizações trimestrais de R$ 200.000 de principal.
// Dias corridos, contados à mão: 92, 181, 273, 365 e 457 (teto 365).
const lcdInput = (iof, selic = '14.25') => ({ mode: 'projection', principalCents: 100000000, contractDate: '2026-11-03', releaseDate: '2026-11-03',
  ld1: { annualPct: '1.5', fixingDate: '2026-11-03', source: 'Sintético', confirmed: true }, spreads: { bndes: '1', intermediation: '0.5', agent: '2' },
  selicScenario: { annualPct: selic, acknowledged: true },
  schedule: { source: 'Sintético', confirmed: true, events: ['2027-02-03', '2027-05-03', '2027-08-03', '2027-11-03', '2028-02-03'].map(date => ({ date, businessDays: 60, amortize: true })) },
  ...(iof === undefined ? {} : { iof }) })
const LCD_DAYS = { '2027-02-03': 92, '2027-05-03': 181, '2027-08-03': 273, '2027-11-03': 365, '2028-02-03': 457 }

test('LCD · PJ geral: base diária é o principal, sem a Selic capitalizada', () => {
  const r = simulateLcdCap(lcdInput({ profile: 'pj' }))
  assert.equal(r.ok, true, r.error?.message)
  const daily = 20000000 * (92 + 181 + 273 + 365 + 365) * PJ_DAILY // 2.092.640 centavos
  assert.equal(r.iof.dailyCents, Math.round(daily)); assert.equal(r.iof.dailyCents, 2092640)
  assert.equal(r.iof.additionalCents, 380000)
  assert.equal(r.iof.totalCents, 2472640) // R$ 24.726,40
  // A Selic aumenta as amortizações, mas não a base do IOF: mesmo IOF com Selic zero.
  assert.ok(r.rows[0].amortizationCents > 20000000)
  assert.deepEqual(simulateLcdCap(lcdInput({ profile: 'pj' }, '0')).iof, r.iof)
  assert.equal(r.cet.netReleaseCents, 100000000 - 2472640)
  assert.ok(Math.abs(r.cet.projectedAnnualRate - handCet(r.cet.netReleaseCents / 100, r.rows.map(row => [LCD_DAYS[row.date], row.paymentCents / 100]))) < 1e-9)
  const fixedRows = simulateLcdCap(lcdInput({ profile: 'pj' }, '0')).rows
  assert.ok(Math.abs(r.cet.fixedAnnualRate - handCet(r.cet.netReleaseCents / 100, fixedRows.map(row => [LCD_DAYS[row.date], row.paymentCents / 100]))) < 1e-9)
})

test('LCD · padrão é IOF zero; escolha não muda juros nem parcelas; escolha inválida bloqueia', () => {
  const zero = simulateLcdCap(lcdInput()), pj = simulateLcdCap(lcdInput({ profile: 'pj' }))
  assert.equal(zero.iof.totalCents, 0); assert.equal(zero.cet.netReleaseCents, 100000000)
  assert.deepEqual(zero.rows, pj.rows); assert.deepEqual(zero.totals, pj.totals)
  assert.ok(pj.cet.fixedAnnualRate > zero.cet.fixedAnnualRate)
  assert.match(zero.warnings.join(' '), /não verifica o enquadramento/)
  for (const iof of [true, { profile: 'manual' }, { profile: 'pj', additional: 0 }]) assert.equal(simulateLcdCap(lcdInput(iof)).error.code, 'INVALID_IOF')
  // Acima de R$ 30 mil, Simples/MEI confirmado usa a alíquota geral.
  assert.equal(simulateLcdCap(lcdInput({ profile: 'simples', eligible: true })).iof.totalCents, 2472640)
})
