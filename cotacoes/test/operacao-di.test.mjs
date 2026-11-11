import test from 'node:test'
import assert from 'node:assert/strict'
import { compareWithDi, creditVsDi } from '../src/operacaoDi.js'

// Curva plana: 14,00% a.a. em todos os vértices. DI diário constante = 1,14^(1/252) − 1.
const FLAT = [[21, 14], [126, 14], [252, 14], [504, 14]]
const day = 1.14 ** (1 / 252) - 1
const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`)

// compareWithDi é a visão Aplicação: convenção de renda fixa em dias úteis/252 (sem mudança em 11/11/2026).
test('aplicação · pré a.a. em base 252: fator e diferença contra o DI', () => {
  const r = compareWithDi({ value: 1e6, kind: 'pre', rate: 15, unit: 'aa', pts: FLAT, d1: 0, d2: 252 })
  assert.equal(r.ok, true)
  assert.equal(r.du, 252)
  close(r.cdiAa, 14, 1e-9)
  close(r.opAa, 15, 1e-9)
  close(r.interestOp, 150000, 1e-6)
  close(r.interestDi, 140000, 1e-6)
  close(r.diff, 10000, 1e-6)
  close(r.bps, 100, 1e-6)
  close(r.spreadEq, (1.15 / 1.14 - 1) * 100, 1e-9)
  // % do CDI equivalente: (1 + p·d)^252 = 1,15
  close(r.pctEq, ((1.15 ** (1 / 252)) - 1) / day * 100, 1e-6)
})

test('aplicação · pré a.m. vira ano por (1+am)^12; no período é usado como está', () => {
  const am = compareWithDi({ value: 100, kind: 'pre', rate: 1, unit: 'am', pts: FLAT, d1: 0, d2: 126 })
  close(am.opFactor, 1.01 ** (12 * 126 / 252), 1e-12)
  const per = compareWithDi({ value: 100, kind: 'pre', rate: 7, unit: 'periodo', pts: FLAT, d1: 0, d2: 126 })
  close(per.opFactor, 1.07, 1e-12)
})

test('% do CDI multiplica o DI de cada dia antes de acumular; 100% = DI', () => {
  const full = compareWithDi({ value: 1e6, kind: 'pct', rate: 100, pts: FLAT, d1: 0, d2: 252 })
  close(full.diff, 0, 1e-6)
  close(full.pctEq, 100, 1e-6)
  const r = compareWithDi({ value: 1e6, kind: 'pct', rate: 110, pts: FLAT, d1: 0, d2: 252 })
  close(r.opFactor, (1 + 1.1 * day) ** 252, 1e-12)
  close(r.pctEq, 110, 1e-6)
})

test('CDI + spread compõe o fator do DI com (1+s)^(du/252)', () => {
  const r = compareWithDi({ value: 1e6, kind: 'spread', rate: 2, pts: FLAT, d1: 0, d2: 126 })
  close(r.opFactor, 1.14 ** 0.5 * 1.02 ** 0.5, 1e-12)
  close(r.spreadEq, 2, 1e-9)
  close(r.opAa, (1.14 * 1.02 - 1) * 100, 1e-9)
})

test('início no futuro usa a taxa a termo entre os vértices', () => {
  // 10% até 126 d.u., 12% até 252 d.u. → termo = (1,12 / 1,10^0,5)^2 − 1
  const pts = [[126, 10], [252, 12]]
  const r = compareWithDi({ value: 1, kind: 'pct', rate: 100, pts, d1: 126, d2: 252 })
  close(r.cdiAa, ((1.12 / 1.1 ** 0.5) ** 2 - 1) * 100, 1e-9)
  close(r.diFactor, 1.12 / 1.1 ** 0.5, 1e-12)
})

test('entradas inválidas não geram resultado', () => {
  const base = { value: 1e6, kind: 'pre', rate: 15, unit: 'aa', pts: FLAT, d1: 0, d2: 252 }
  assert.equal(compareWithDi({ ...base, value: 0 }).ok, false)
  assert.equal(compareWithDi({ ...base, d2: 0 }).ok, false)
  assert.equal(compareWithDi({ ...base, d2: 600 }).ok, false)
  assert.equal(compareWithDi({ ...base, kind: 'pct', rate: 0 }).ok, false)
  assert.equal(compareWithDi({ ...base, rate: 1001 }).ok, false)
  assert.equal(compareWithDi({ ...base, unit: 'xx' }).ok, false)
  assert.equal(compareWithDi({ ...base, pts: null }).ok, false)
})

// ---------------------------------------------------------------------------------------------------------------
// Visão Crédito: regras de 11/11/2026 (Res. CMN 4.881/2020, juros por dias reais, vencimento no próximo dia útil).
// Recálculo independente: nenhuma função do repositório; feriados nacionais listados à mão; CET de pagamento único
// pela fórmula fechada (pagamento / líquido)^(365 / dias corridos) − 1.
const HOLIDAYS = new Set(['2026-11-15', '2026-11-20', '2026-12-25', '2027-01-01'])
const addDay = (iso) => new Date(Date.parse(`${iso}T00:00:00Z`) + 864e5).toISOString().slice(0, 10)
const weekday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay()
const useful = (iso) => weekday(iso) !== 0 && weekday(iso) !== 6 && !HOLIDAYS.has(iso)
// dias úteis em (de, até]
const usefulBetween = (from, to) => { let n = 0; for (let d = addDay(from); d <= to; d = addDay(d)) if (useful(d)) n++; return n }
const CAL = { base: '2026-11-11', start: '2026-11-11', end: '2027-01-01' } // 01/01/2027 é feriado (sexta)
const DUE = '2027-01-04' // segunda-feira seguinte
const DAYS = 54 // 19 em novembro + 31 em dezembro + 4 em janeiro
const DU = usefulBetween('2026-11-11', DUE)
const VALUE = 1e6
const FEES = 1000
const IOF = VALUE * 0.0038 + VALUE * 0.000082 * DAYS // PJ: 0,38% adicional + 0,0082% ao dia
const NET = VALUE - IOF - FEES
const cetOf = (payment) => (payment / NET) ** (365 / DAYS) - 1
const credit = (extra) => creditVsDi({ value: VALUE, pts: FLAT, fees: FEES, ...CAL, ...extra })

test('crédito · vencimento em feriado vai para o próximo dia útil; DI pelos dias úteis até lá', () => {
  assert.equal(DU, 35)
  const r = credit({ kind: 'pre', rate: 2, unit: 'am' })
  assert.equal(r.ok, true)
  assert.equal(r.due, DUE)
  assert.equal(r.dueShifted, true)
  assert.equal(r.days, DAYS)
  assert.equal(r.du, DU)
  close(r.diFactor, 1.14 ** (DU / 252), 1e-12)
  const same = credit({ kind: 'pre', rate: 2, unit: 'am', end: '2026-12-14' })
  assert.equal(same.due, '2026-12-14')
  assert.equal(same.dueShifted, false)
})

test('crédito · pré a.m. com juros por dias corridos, IOF e tarifas na liberação e CET 4.881', () => {
  const r = credit({ kind: 'pre', rate: 2, unit: 'am' })
  const payment = VALUE * 1.02 ** (DAYS / 30)
  close(r.opFactor, 1.02 ** (DAYS / 30), 1e-12)
  close(r.interestOp, payment - VALUE, 1e-6)
  close(r.iof, IOF, 1e-6)
  close(r.fees, FEES, 1e-9)
  close(r.net, NET, 1e-6)
  close(r.cet, cetOf(payment), 1e-9)
  assert.equal(r.cetLabel, 'CET')
  assert.equal(r.floating, false)
  assert.equal(r.projectedCost, null)
  // a convenção antiga (dias úteis/252 com (1+am)^12) daria outro fator: a visão crédito não a usa mais
  assert.ok(Math.abs(r.opFactor - 1.02 ** (12 * DU / 252)) > 1e-4)
})

test('crédito · pré a.a. vira a.m. composto; no período é usado como está', () => {
  const aa = credit({ kind: 'pre', rate: 15, unit: 'aa' })
  close(aa.opFactor, (1.15 ** (1 / 12)) ** (DAYS / 30), 1e-12)
  close(aa.cet, cetOf(VALUE * 1.15 ** (DAYS / 360)), 1e-9)
  const per = credit({ kind: 'pre', rate: 3, unit: 'periodo' })
  close(per.opFactor, 1.03, 1e-12)
  close(per.cet, cetOf(VALUE * 1.03), 1e-9)
})

test('crédito · CDI + spread: CET só da parte fixa (art. 5º) e custo com o CDI projetado à parte', () => {
  const r = credit({ kind: 'spread', rate: 2 })
  assert.equal(r.floating, true)
  assert.equal(r.cetLabel, 'CET · parte fixa (regra do BC)')
  assert.equal(r.projectedLabel, 'Custo com CDI projetado')
  // parte fixa: CDI zero, só o spread em dias úteis/252
  close(r.cet, cetOf(VALUE * 1.02 ** (DU / 252)), 1e-9)
  // projetado: DI da curva plana (14% a.a.) composto com o spread, nos mesmos dias úteis
  const projected = VALUE * 1.14 ** (DU / 252) * 1.02 ** (DU / 252)
  close(r.opFactor * VALUE, projected, 1e-6)
  close(r.projectedCost, cetOf(projected), 1e-9)
  close(r.net, NET, 1e-6)
})

test('crédito · % do CDI: parte fixa sem juros (só IOF e tarifas) e custo projetado com o CDI de cada dia útil', () => {
  const r = credit({ kind: 'pct', rate: 110 })
  close(r.cet, cetOf(VALUE), 1e-9)
  const daily = 1.14 ** (1 / 252) - 1
  const projected = VALUE * (1 + 1.1 * daily) ** DU
  close(r.opFactor * VALUE, projected, 1e-6)
  close(r.projectedCost, cetOf(projected), 1e-9)
})

test('crédito · Simples com até R$ 30 mil usa a alíquota diária reduzida; sem confirmação, recusa', () => {
  const base = { value: 30000, pts: FLAT, fees: 0, ...CAL, kind: 'pre', rate: 2, unit: 'am' }
  assert.equal(creditVsDi({ ...base, profile: 'simples' }).ok, false)
  const r = creditVsDi({ ...base, profile: 'simples', eligible: true })
  const iof = 30000 * 0.0038 + 30000 * 0.0000274 * DAYS
  close(r.iof, iof, 1e-6)
  close(r.cet, (30000 * 1.02 ** (DAYS / 30) / (30000 - iof)) ** (365 / DAYS) - 1, 1e-9)
})

test('crédito · entradas inválidas não geram resultado', () => {
  const ok = { kind: 'pre', rate: 2, unit: 'am' }
  assert.equal(credit({ ...ok, end: CAL.start }).ok, false)
  assert.equal(credit({ ...ok, start: '2026-11-10' }).ok, false) // antes da data-base da curva
  assert.equal(credit({ ...ok, fees: -1 }).ok, false)
  assert.equal(credit({ ...ok, fees: VALUE }).ok, false)
  assert.equal(credit({ ...ok, end: '2029-12-31' }).ok, false) // além do último vértice
  assert.equal(credit({ ...ok, pts: null }).ok, false)
})
