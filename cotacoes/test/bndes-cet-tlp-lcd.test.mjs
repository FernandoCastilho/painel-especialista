// CET das calculadoras TLP exigível e Selic + LCD (Res. CMN 4.881/2020, art. 4º e 5º).
// Recálculo independente: parcelas montadas à mão, dias corridos contados aqui e taxa resolvida por
// bisseção própria em (1 + i)^(dias/365), sem usar creditCet nem os motores para o oráculo.
import assert from 'node:assert/strict'
import test from 'node:test'
import { simulateTlpExigivel } from '../src/bndesTlpExigivel.js'
import { simulateLcdCap } from '../src/bndesLcdCap.js'

const DAY = 86400000
const calendarDays = (from, to) => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY
const pv = (rate, flows) => flows.reduce((sum, [days, payment]) => sum + payment / (1 + rate) ** (days / 365), 0)
function oracleRate(net, flows) {
  let lo = -0.99, hi = 10
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (pv(mid, flows) > net) lo = mid; else hi = mid }
  return (lo + hi) / 2
}
const flowsOf = (release, rows) => rows.map(row => [calendarDays(release, row.date), row.paymentCents / 100])

const tlpInput = () => ({ mode: 'projection', principalCents: 1000000, releaseDate: '2026-10-15', j: { annualPct: '5', source: 'J sintético', confirmed: true }, spreads: { bndes: '2', agent: '3' }, ipcaScenario: { annualPct: '4', acknowledged: true }, schedule: { source: 'Cronograma sintético', confirmed: true, events: [{ date: '2027-10-15', businessDays: 252, amortize: true }, { date: '2028-10-16', businessDays: 252, amortize: true }] } })
const lcdInput = () => ({ mode: 'projection', principalCents: 100000000, contractDate: '2026-10-05', releaseDate: '2026-10-15', ld1: { annualPct: '0.5', fixingDate: '2026-10-01', source: 'LD1 sintética', confirmed: true }, spreads: { bndes: '1.25', intermediation: '0.25', agent: '3' }, selicScenario: { annualPct: '10', acknowledged: true }, schedule: { source: 'Cronograma sintético', confirmed: true, events: [{ date: '2027-10-15', businessDays: 252, amortize: true }, { date: '2028-10-16', businessDays: 252, amortize: true }] } })

test('TLP: CET da parte fixa usa J + spreads sem IPCA, recalculado à mão', () => {
  const r = simulateTlpExigivel(tlpInput()); assert.equal(r.ok, true)
  // Sem IPCA: 1,05 × 1,02 × 1,03 = 1,10313 em 252 DU. SAC de 2 parcelas.
  const fixed = [[365, 5000 + 1031.30], [732, 5000 + 515.65]]
  const expected = oracleRate(10000, fixed)
  assert.ok(Math.abs(r.cet.fixedAnnualRate - expected) < 1e-9, `${r.cet.fixedAnnualRate} vs ${expected}`)
  assert.ok(Math.abs(pv(r.cet.fixedAnnualRate, fixed) - 10000) < 0.001, 'valor presente das parcelas fixas = valor líquido')
  // Com IPCA de 4%: parcelas do cronograma travado (6.472,55 e 5.736,28).
  const projected = [[365, 6472.55], [732, 5736.28]]
  assert.deepEqual(flowsOf(r.rows[0].from, r.rows), projected)
  assert.ok(Math.abs(r.cet.projectedAnnualRate - oracleRate(10000, projected)) < 1e-9)
  assert.ok(r.cet.projectedAnnualRate > r.cet.fixedAnnualRate, 'IPCA positivo encarece o custo projetado')
  assert.deepEqual(r.cet.fixedComponents, ['J da TLP', 'spread BNDES', 'spread do agente']); assert.equal(r.cet.excludedIndex, 'IPCA')
})

test('TLP: a parte fixa não depende do IPCA; IPCA zero iguala as duas taxas', () => {
  const base = simulateTlpExigivel(tlpInput())
  for (const ipca of ['0', '2.5', '10', '-3']) {
    const d = tlpInput(); d.ipcaScenario.annualPct = ipca
    const r = simulateTlpExigivel(d); assert.equal(r.ok, true)
    assert.equal(r.cet.fixedAnnualRate, base.cet.fixedAnnualRate)
    if (ipca === '0') assert.ok(Math.abs(r.cet.projectedAnnualRate - r.cet.fixedAnnualRate) < 1e-12)
    if (Number(ipca) > 0) assert.ok(r.cet.projectedAnnualRate > r.cet.fixedAnnualRate)
    if (Number(ipca) < 0) assert.ok(r.cet.projectedAnnualRate < r.cet.fixedAnnualRate)
  }
})

test('TLP: carência e períodos fracionários mantêm valor presente = valor líquido', () => {
  const d = tlpInput(); d.principalCents = 12345678
  d.schedule.events = [{ date: '2027-01-15', businessDays: 66, amortize: false }, { date: '2027-04-15', businessDays: 61, amortize: true }, { date: '2027-07-15', businessDays: 63, amortize: true }, { date: '2027-10-15', businessDays: 66, amortize: true }]
  const r = simulateTlpExigivel(d); assert.equal(r.ok, true)
  const flows = flowsOf(d.releaseDate, r.rows)
  assert.ok(Math.abs(pv(r.cet.projectedAnnualRate, flows) - 123456.78) < 0.001)
  assert.ok(Math.abs(r.cet.projectedAnnualRate - oracleRate(123456.78, flows)) < 1e-9)
  // Recalcula a parte fixa à mão: juros = saldo × (1,10313^(DU/252) − 1), SAC sobre o principal.
  let balance = 12345678, remaining = 3; const fixed = []
  for (const event of d.schedule.events) {
    const interest = Math.round(balance * (1.10313 ** (event.businessDays / 252) - 1))
    const amortization = event.amortize ? Math.floor((2 * balance + remaining) / (2 * remaining)) : 0
    if (event.amortize) remaining--
    fixed.push([calendarDays(d.releaseDate, event.date), (interest + amortization) / 100]); balance -= amortization
  }
  assert.ok(Math.abs(r.cet.fixedAnnualRate - oracleRate(123456.78, fixed)) < 1e-9)
})

test('TLP: tarifa na liberação reduz o líquido, sobe o CET e não muda parcelas', () => {
  const base = simulateTlpExigivel(tlpInput())
  const d = tlpInput(); d.releaseFeeCents = 20000
  const r = simulateTlpExigivel(d); assert.equal(r.ok, true)
  assert.deepEqual(r.rows, base.rows); assert.deepEqual(r.totals, base.totals)
  assert.equal(r.cet.netReleaseCents, 980000); assert.equal(r.cet.releaseFeeCents, 20000)
  assert.ok(Math.abs(r.cet.fixedAnnualRate - oracleRate(9800, [[365, 6031.30], [732, 5515.65]])) < 1e-9)
  assert.ok(r.cet.fixedAnnualRate > base.cet.fixedAnnualRate)
  for (const [fee, code] of [[1000000, 'INVALID_FEE'], [1.5, 'INVALID_MONEY'], [-1, 'INVALID_MONEY'], [null, 'INVALID_MONEY']]) {
    const x = tlpInput(); x.releaseFeeCents = fee; const b = simulateTlpExigivel(x)
    assert.equal(b.ok, false); assert.equal(b.error.code, code); assert.equal(b.cet, null)
  }
})

test('TLP: parte fixa negativa não vira CET inventado', () => {
  const d = tlpInput(); d.j.annualPct = '-8'; d.spreads = { bndes: '1', agent: '2' }
  const r = simulateTlpExigivel(d); assert.equal(r.ok, true)
  assert.equal(r.cet.fixedAnnualRate, null)
  assert.ok(r.cet.projectedAnnualRate === null || r.cet.projectedAnnualRate >= 0)
})

test('LCD: CET da parte fixa usa LD1 + remunerações com Selic zero, recalculado à mão', () => {
  const r = simulateLcdCap(lcdInput()); assert.equal(r.ok, true)
  // Selic zero: saldo não corrige; juros fixos de 5% a.a. em 252 DU.
  const fixed = [[365, 550000], [732, 525000]]
  assert.ok(Math.abs(r.cet.fixedAnnualRate - oracleRate(1000000, fixed)) < 1e-9)
  assert.ok(Math.abs(pv(r.cet.fixedAnnualRate, fixed) - 1000000) < 0.001, 'valor presente = valor líquido')
  // Com Selic de 10%: parcelas travadas (605.000,00 e 635.250,00).
  const projected = [[365, 605000], [732, 635250]]
  assert.deepEqual(flowsOf(lcdInput().releaseDate, r.rows), projected)
  assert.ok(Math.abs(r.cet.projectedAnnualRate - oracleRate(1000000, projected)) < 1e-9)
  assert.ok(r.cet.projectedAnnualRate > r.cet.fixedAnnualRate, 'Selic positiva encarece o custo projetado')
  assert.equal(r.cet.excludedIndex, 'Selic')
})

test('LCD: parte fixa não depende da Selic; tarifa só altera o líquido', () => {
  const base = simulateLcdCap(lcdInput())
  for (const selic of ['0', '7.25', '13.75']) {
    const d = lcdInput(); d.selicScenario.annualPct = selic
    const r = simulateLcdCap(d); assert.equal(r.ok, true)
    assert.equal(r.cet.fixedAnnualRate, base.cet.fixedAnnualRate)
    if (selic === '0') assert.ok(Math.abs(r.cet.projectedAnnualRate - r.cet.fixedAnnualRate) < 1e-12)
    else assert.ok(r.cet.projectedAnnualRate > r.cet.fixedAnnualRate)
  }
  const d = lcdInput(); d.releaseFeeCents = 2200000
  const r = simulateLcdCap(d); assert.equal(r.ok, true)
  assert.deepEqual(r.rows, base.rows)
  assert.equal(r.cet.netReleaseCents, 97800000)
  assert.ok(Math.abs(r.cet.fixedAnnualRate - oracleRate(978000, [[365, 550000], [732, 525000]])) < 1e-9)
  d.releaseFeeCents = 100000000; const blocked = simulateLcdCap(d)
  assert.equal(blocked.ok, false); assert.equal(blocked.error.code, 'INVALID_FEE'); assert.equal(blocked.cet, null)
})

test('LCD: períodos mensais com carência mantêm valor presente = valor líquido nas duas taxas', () => {
  const d = lcdInput(); d.selicScenario.annualPct = '14'
  d.schedule.events = [{ date: '2026-11-16', businessDays: 21, amortize: false }, { date: '2026-12-15', businessDays: 21, amortize: true }, { date: '2027-01-15', businessDays: 23, amortize: true }]
  const r = simulateLcdCap(d); assert.equal(r.ok, true)
  assert.ok(Math.abs(pv(r.cet.projectedAnnualRate, flowsOf(d.releaseDate, r.rows)) - 1000000) < 0.001)
  let balance = 100000000, remaining = 2; const fixed = []
  for (const event of d.schedule.events) {
    const interest = Math.round(balance * (1.05 ** (event.businessDays / 252) - 1))
    const amortization = event.amortize ? (remaining === 1 ? balance : Math.floor((2 * balance + remaining) / (2 * remaining))) : 0
    if (event.amortize) remaining--
    fixed.push([calendarDays(d.releaseDate, event.date), (interest + amortization) / 100]); balance -= amortization
  }
  assert.ok(Math.abs(r.cet.fixedAnnualRate - oracleRate(1000000, fixed)) < 1e-9)
  assert.ok(r.cet.projectedAnnualRate > r.cet.fixedAnnualRate)
})
