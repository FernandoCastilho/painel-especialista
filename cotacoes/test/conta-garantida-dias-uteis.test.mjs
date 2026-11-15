// Conta Garantida em dias úteis: feriados nacionais do calendário do painel + feriados extras digitados.
// Recálculo independente: feriados listados à mão e contagem feita aqui, sem usar holidays.js nem o motor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateContaGarantida, parseContaGarantidaForm, cgInitialForm } from '../src/contaGarantida.js'

const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`)
// Feriados nacionais conferidos à mão no calendário civil: 20/11/2026 (Consciência Negra, sexta),
// 25/12/2026 (Natal, sexta), 01/01/2027 (sexta), 08 e 09/02/2027 (Carnaval, segunda e terça; Páscoa em 28/03/2027).
const NATIONAL = new Set(['2026-11-20', '2026-12-25', '2027-01-01', '2027-02-08', '2027-02-09'])
function handInterestDays(start, end, extra = []) {
  const skip = new Set([...NATIONAL, ...extra])
  let count = 0
  // Saldo positivo do início até a véspera da quitação (a quitação acontece no início da data final).
  for (let t = Date.parse(start + 'T00:00:00Z'); t < Date.parse(end + 'T00:00:00Z'); t += 86400000) {
    const iso = new Date(t).toISOString().slice(0, 10), dow = new Date(t).getUTCDay()
    if (dow !== 0 && dow !== 6 && !skip.has(iso)) count++
  }
  return count
}
const single = (start, end, holidays = []) => simulateContaGarantida({ start, end, rate: 3, rateBase: 30, conversion: 'proportional', dayCount: 'business', holidays, events: [{ date: start, draw: 100000, payment: 0 }], settleAllAtEnd: true })

test('dias úteis descontam o feriado nacional de 20/11 sem digitação', () => {
  // 18/11/2026 (quarta) a 23/11/2026: saldo nos dias 18 a 22. Úteis: 18 e 19 (20 é feriado; 21 e 22, fim de semana).
  const r = single('2026-11-18', '2026-11-23')
  assert.equal(handInterestDays('2026-11-18', '2026-11-23'), 2)
  assert.equal(r.totals.interestDays, 2)
  close(r.totals.interest, 100000 * 0.03 / 30 * 2) // R$ 200; na regra antiga eram 3 dias, R$ 300.
  // IOF segue em dias corridos: 5 dias de saldo, 0,0082% ao dia, mais 0,38% de adicional.
  close(r.totals.dailyIof, 100000 * 0.000082 * 5); close(r.totals.additionalIof, 380)
  assert.deepEqual(r.rows.filter(row => row.balance > 0).map(row => [row.date, row.countsInterest]), [['2026-11-18', true], ['2026-11-19', true], ['2026-11-20', false], ['2026-11-21', false], ['2026-11-22', false]])
})

test('Carnaval nacional sai sozinho e o feriado extra digitado continua valendo', () => {
  // 05/02/2027 (sexta) a 12/02/2027: úteis 05, 10 e 11 (08 e 09 são Carnaval).
  const auto = single('2027-02-05', '2027-02-12')
  assert.equal(handInterestDays('2027-02-05', '2027-02-12'), 3)
  assert.equal(auto.totals.interestDays, 3); close(auto.totals.interest, 300)
  // Feriado local extra em 10/02/2027: mais um dia sem juros.
  const extra = single('2027-02-05', '2027-02-12', ['2027-02-10'])
  assert.equal(handInterestDays('2027-02-05', '2027-02-12', ['2027-02-10']), 2)
  assert.equal(extra.totals.interestDays, 2); close(extra.totals.interest, 200)
  // Digitar um feriado nacional não desconta duas vezes.
  assert.equal(single('2027-02-05', '2027-02-12', ['2027-02-08']).totals.interestDays, 3)
})

test('fim de ano: Natal e Confraternização saem; dias corridos não mudam', () => {
  const r = single('2026-12-21', '2027-01-05')
  assert.equal(handInterestDays('2026-12-21', '2027-01-05'), 9)
  assert.equal(r.totals.interestDays, 9); close(r.totals.interest, 900)
  const calendar = simulateContaGarantida({ start: '2026-12-21', end: '2027-01-05', rate: 3, rateBase: 30, conversion: 'proportional', dayCount: 'calendar', events: [{ date: '2026-12-21', draw: 100000, payment: 0 }], settleAllAtEnd: true })
  assert.equal(calendar.totals.interestDays, 15); close(calendar.totals.interest, 1500)
  close(calendar.totals.dailyIof, r.totals.dailyIof)
})

test('formulário e CET de 30 dias usam o calendário nacional', () => {
  const form = { ...cgInitialForm('2026-11-18'), amount: '100.000,00', rate: '3', duration: '5', dayCount: 'business', limit: '100.000,00' }
  const parsed = parseContaGarantidaForm(form)
  assert.deepEqual(parsed.errors, {})
  close(parsed.result.totals.interest, 200)
  assert.ok(parsed.warnings.some(w => /feriados nacionais do calendário do painel/.test(w)))
  // CET: 18/11 a 18/12/2026, 30 dias corridos. Úteis com juros (18/11 a 17/12) contados à mão, sem 20/11.
  const days = handInterestDays('2026-11-18', '2026-12-18')
  assert.equal(days, 21)
  const payment = 100000 + 100000 * 0.03 / 30 * days + 100000 * 0.000082 * 30
  close(parsed.cet.payment, payment, 1e-6)
  close(parsed.cet.annual, Math.pow(payment / (100000 - 380), 365 / 30) - 1, 1e-9)
})
