import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { loan, monthlyRate } from '../src/emprestimo.js'
import { createDraftStore, newFinimpDraft } from '../src/calculatorDraft.js'
import { validateFinimpInputs } from '../src/finimpInputs.js'
import { parseIpcaProjection, validIpcaProjection, simular } from '../src/finameMateriais.js'
import { calendarYearCovered, holidayMap, isBusinessDay } from '../src/holidays.js'
import { activityNeedsReview } from '../src/marketContext.js'
import { CONCEITOS, conexoesDe, CONEXAO } from '../src/educacao.js'

test('Giro mantém continuidade para taxa zero, mensal e anual equivalente', () => {
  for (const unit of ['am', 'aa']) {
    const rate = unit === 'am' ? 1e-12 : Math.expm1(12 * Math.log1p(1e-14)) * 100
    const r = loan({ start: '2026-01-01', firstDue: '2026-02-01', value: 100000, n: 12, rate, unit, system: 'price', iof: { fixed: 0, daily: 0 } })
    assert.equal(r.ok, true)
    assert.ok(Math.abs(r.installment - 100000 / 12) < 0.000001)
    assert.ok(Math.abs(r.interest) < 0.00001)
  }
  assert.ok(monthlyRate(1e-15, 'aa') > 0)
})

test('Giro não declara sucesso com infinito e conserva o teto do IOF em limites extremos', () => {
  const overflow = loan({ start: '2026-01-01', firstDue: '2026-02-01', value: 100000, n: 600, rate: 1000, unit: 'am', system: 'bullet' })
  assert.equal(overflow.ok, false); assert.match(overflow.error, /limite numérico/)
  assert.equal(loan({ start: '2026-01-01', firstDue: '2026-02-01', value: Infinity, n: 12, rate: 2, system: 'sac' }).ok, false)
  for (const system of ['price', 'sac', 'bullet']) for (const rate of [0, 1e-12, 2, 1000]) for (const n of [1, 12, 600]) {
    const r = loan({ start: '2026-01-01', firstDue: '2026-02-01', value: 100000, n, rate, system })
    if (!r.ok) { assert.ok(r.error); continue }
    for (const field of ['total', 'interest', 'iof', 'iofFixed', 'iofDaily']) assert.ok(Number.isFinite(r[field]), `${system}/${rate}/${n}/${field}`)
    assert.ok(r.iof >= 380 - 1e-6 && r.iof <= 3373 + 1e-6)
  }
})

test('Rascunho em memória preserva condições ao trocar assinantes e limpa explicitamente', () => {
  const store = createDraftStore(newFinimpDraft)
  let notifications = 0
  const leave = store.subscribe(() => notifications++)
  store.update({ principalText: '1000000', currency: 'EUR', useTac: true, goalMode: 'target', targetText: '40000', goalTerm: 11 })
  store.update({ competitor: { annualRate: '6', flatRate: '1', tac: '1000' }, itau: { annualRate: '5,5', flatRate: '1,5', tac: '0' } })
  const before = store.getSnapshot()
  leave()
  const returnToCalculator = store.subscribe(() => notifications++)
  assert.deepEqual(store.getSnapshot(), before)
  assert.equal(store.getSnapshot().goalTerm, 11)
  store.reset()
  assert.deepEqual(store.getSnapshot(), newFinimpDraft())
  assert.equal(notifications, 3)
  returnToCalculator()
})

test('FINIMP associa erro ao campo, aceita custo zero e mantém os doze prazos fixos', () => {
  const draft = newFinimpDraft()
  let r = validateFinimpInputs(draft)
  assert.equal(r.conditionsReady, false)
  assert.ok(r.errors['fi-principal'] && r.errors['fi-a-rate'] && r.errors['fi-b-flat'])
  Object.assign(draft, { principalText: '100000', competitor: { annualRate: '0', flatRate: '0', tac: '0' }, itau: { annualRate: '0', flatRate: '0', tac: '0' } })
  r = validateFinimpInputs(draft)
  assert.equal(r.conditionsReady, true); assert.deepEqual(r.errors, {})
  draft.principalText = '0'; draft.useTac = true; draft.competitor.tac = '-1'
  r = validateFinimpInputs(draft)
  assert.ok(r.errors['fi-principal'] && r.errors['fi-a-tac'])
  draft.principalText = '100000'; draft.competitor.tac = '0'; draft.goalMode = 'target'; draft.targetText = ''
  r = validateFinimpInputs(draft)
  assert.deepEqual(r.days, [30,60,90,120,150,180,210,240,270,300,330,360]); assert.ok(Object.isFrozen(r.days)); assert.ok(r.errors['fi-target'])
})

test('Finame TLPCAP explícita valida o domínio da projeção IPCA, incluindo deflação', () => {
  const base = { valor: 100000, prazo: 12, custo: 'tlp', perfilTlp: 'tlpcap', custoFinanceiro: 7, taxaBndes: 1.25, taxaAgente: 3 }
  for (const value of [-50, -0.5, 0, 100]) {
    assert.equal(validIpcaProjection(parseIpcaProjection(String(value).replace('.', ','))), true)
    assert.equal(simular({ ...base, ipca: value }).ok, true)
  }
  for (const value of [-50.01, 100.01, 200, NaN, Infinity]) {
    assert.equal(validIpcaProjection(value), false)
    assert.equal(simular({ ...base, ipca: value }).ok, false)
  }
})

test('B3 e calendário civil têm escopos distintos e não extrapolam ano sem conferência', () => {
  for (const d of ['2026-12-24', '2026-12-31']) {
    assert.equal(holidayMap('B3', 2026).has(d), true)
    assert.equal(holidayMap('CIVBR', 2026).has(d), false)
  }
  assert.equal(isBusinessDay('2026-07-09', 'B3'), true)
  assert.equal(holidayMap('CIVBR', 2026).has('2026-06-04'), false)
  assert.equal(holidayMap('CWB', 2026).has('2026-06-04'), true)
  assert.equal(calendarYearCovered('B3', 2028), false)
  assert.equal(holidayMap('B3', 2028).size, 0)
  assert.equal(calendarYearCovered('CN', 2027, {}), false)
  assert.equal(calendarYearCovered('PRE', 2026), false)
})

test('Conferência vencida independe da consulta e do stale legado', () => {
  const item = { checkedAt: '2026-11-05T12:00:00Z', nextReviewAt: '2026-11-06T12:00:00Z', stale: false }
  assert.equal(activityNeedsReview(item, Date.parse('2026-11-05T15:00:00Z')), false)
  assert.equal(activityNeedsReview(item, Date.parse('2026-11-06T12:00:00Z')), true)
  assert.equal(activityNeedsReview({ checkedAt: '2026-10-23T12:00:00Z', stale: false }, Date.parse('2026-11-05T15:00:00Z')), true)
  assert.equal(activityNeedsReview({}, Date.parse('2026-11-05T15:00:00Z')), true)
  assert.equal(activityNeedsReview({ checkedAt: item.checkedAt, nextReviewAt: '2026-12-01T12:00:00Z' }, Date.parse('2026-11-12T12:00:00Z')), true)
  assert.equal(activityNeedsReview({ ...item, nextReleaseAt: '2026-11-05T15:00:00Z' }, Date.parse('2026-11-05T15:00:00Z')), true)
})

test('Atividade mantém ponta, fonte, competência e restrição de licença coerentes', async () => {
  const data = JSON.parse(await readFile(new URL('../public/market-indicators.json', import.meta.url)))
  const history = JSON.parse(await readFile(new URL('../public/indicator-history.json', import.meta.url)))
  const expected = { caged: [121305, '2026-09'], 'unemployment-br': [5.2, 'jul–set/2026'], 'ism-manufacturing': [55.5, '2026-10'], 'ism-services': [54.5, '2026-10'], 'payroll-us': [29000, '2026-09'] }
  for (const [id, [value, period]] of Object.entries(expected)) {
    const item = data.indicators.find(i => i.id === id), series = history.series.find(s => s.id === id)
    assert.equal(item.value, value); assert.equal(item.period, period)
    assert.ok(Date.parse(item.nextReviewAt) > Date.parse(item.checkedAt))
    if (id === 'payroll-us') {
      assert.equal(activityNeedsReview(item, Date.parse(item.nextReleaseAt) - 1), false)
      assert.equal(activityNeedsReview(item, Date.parse(item.nextReleaseAt)), true)
      assert.equal(new URL(item.nextReleaseSourceUrl).hostname, 'www.bls.gov')
    }
    if (id.startsWith('ism')) { assert.equal(series.status, 'license-required'); assert.deepEqual(series.points, []) }
    else { assert.equal(series.points.at(-1).value, value); assert.equal(series.points.at(-1).period, '2026-09') }
  }
})

test('Conceitos corrigidos distinguem risco, prazo e finalidade dos pesos', () => {
  const euribor = CONCEITOS.find(c => c.id === 'euribor'), nc = CONCEITOS.find(c => c.id === 'nota-comercial'), icbr = CONCEITOS.find(c => c.id === 'ic-br')
  assert.match(conexoesDe('sofr').find(c => c.id === 'euribor').porque, /não garantido/)
  assert.match(CONEXAO.itens.find(c => c.id === 'euribor').texto, /não é uma taxa sem risco/)
  assert.match(nc.frase, /escritural/); assert.doesNotMatch(nc.frase, /curto prazo/)
  assert.doesNotMatch(conexoesDe('nota-comercial').map(c => c.porque).join(' '), /por pouco tempo|necessariamente.*curto/i)
  assert.match(icbr.crianca.join(' '), /inflação doméstica/)
  for (const c of [euribor, nc, icbr]) assert.ok(c.fontes.length && c.revisadoEm)
})
