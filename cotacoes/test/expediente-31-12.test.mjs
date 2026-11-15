// 31/12 sem expediente bancário (regra confirmada por Fernando em 12/11/2026): vencimento passa para o próximo dia útil,
// mas a contagem de dias úteis do calendário BR (DU/252 de CDI, DI e TLP) não muda.
import test from 'node:test'
import assert from 'node:assert/strict'
import { busDaysIn, isBusinessDay, nextBusinessDay, paymentCalendars } from '../src/holidays.js'
import { creditOperation } from '../src/creditComparison.js'
import { discountOperation } from '../src/analiseDesconto.js'

test('31/12 não é dia útil para pagamento; 01/01 é feriado e 02-03/01/2027 caem no fim de semana', () => {
  assert.equal(isBusinessDay('2026-12-31', 'BANCO'), false)
  assert.equal(nextBusinessDay('2026-12-31', paymentCalendars(['BR'])), '2027-01-04')
  assert.equal(nextBusinessDay('2026-12-30', paymentCalendars(['BR'])), '2026-12-30')
  // Ano em que 31/12 cai em dia de semana e 02/01 também: 31/12/2027 (sexta) → 03/01/2028 (segunda).
  assert.equal(nextBusinessDay('2027-12-31', paymentCalendars(['BR'])), '2028-01-03')
})

test('a contagem de dias úteis do calendário BR continua contando 31/12', () => {
  assert.equal(isBusinessDay('2026-12-31', 'BR'), true)
  assert.equal(busDaysIn('2026-12-30', '2027-01-04', ['BR']), 2)
})

test('capital de giro: parcela que venceria em 31/12 é paga em 04/01/2027', () => {
  const r = creditOperation({ value: 10000, n: 2, rate: 2, system: 'price', start: '2026-11-30', firstDue: '2026-12-31' })
  assert.equal(r.ok, true, r.error)
  assert.deepEqual(r.rows.map(row => row.date), ['2027-01-04', '2027-02-01'])
  assert.equal(r.rows[0].days, 35)
})

test('desconto: título com vencimento em 31/12 é pago e conta dias até 04/01/2027', () => {
  const r = discountOperation({ date: '2026-12-01', titleRows: [{ value: 10000, count: 1, dueDate: '2026-12-31' }], rate: 2, feeMode: 'total', fee: 0, tac: 0 })
  assert.equal(r.ok, true, r.error)
  assert.equal(r.rows[0].paymentDate, '2027-01-04')
  assert.equal(r.rows[0].adjusted, true)
  assert.equal(r.rows[0].days, 34)
})
