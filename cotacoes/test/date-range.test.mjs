import test from 'node:test'
import assert from 'node:assert/strict'
import { clamp, long, monthCells, outside, pair, preview, shift, shiftMonth, short, valid } from '../src/dateRange.js'

test('valida e formata datas e meses sem depender de fuso', () => {
  assert.equal(valid('2026-02-28', 'day'), true)
  assert.equal(valid('2026-02-31', 'day'), false)
  assert.equal(valid('2026-13', 'month'), false)
  assert.equal(valid('2026-10', 'month'), true)
  assert.equal(valid(undefined, 'day'), false)
  assert.equal(short('2026-10-05', 'day'), '05/10/26')
  assert.equal(short('2026-10', 'month'), 'out/26')
  assert.equal(short('x', 'day'), '—')
  assert.equal(long('2026-03-01', 'day'), '1 de março de 2026')
  assert.equal(long('2026-03', 'month'), 'março de 2026')
})

test('grade do mês começa no domingo e tem todos os dias', () => {
  const c = monthCells(2026, 9) // outubro/2026 começa numa quinta
  assert.deepEqual(c.slice(0, 5), [null, null, null, null, '2026-10-01'])
  assert.equal(c.filter(Boolean).length, 31)
  assert.equal(monthCells(2028, 1).filter(Boolean).length, 29)
})

test('navegação por dias e meses atravessa mês/ano e limita ao último dia', () => {
  assert.equal(shift('2026-12-31', 'day', 1), '2027-01-01')
  assert.equal(shift('2026-03-01', 'day', -1), '2026-02-28')
  assert.equal(shift('2026-01', 'month', -1), '2025-12')
  assert.equal(shift('2026-11', 'month', 3), '2027-02')
  assert.equal(shiftMonth('2026-01-31', 'day', 1), '2026-02-28')
  assert.equal(shiftMonth('2026-03-15', 'month', 0), '2026-03')
})

test('segundo clique ordena o par; pré-visualização acompanha o cursor', () => {
  assert.deepEqual(pair('2026-05-10', '2026-05-20'), ['2026-05-10', '2026-05-20'])
  assert.deepEqual(pair('2026-05-10', '2026-04-01'), ['2026-04-01', '2026-05-10'])
  assert.deepEqual(pair('2026-05-10', '2026-05-10'), ['2026-05-10', '2026-05-10'])
  assert.deepEqual(preview({ anchor: '2026-05-10', hover: '2026-05-02', start: 'a', end: 'b' }), ['2026-05-02', '2026-05-10'])
  assert.deepEqual(preview({ anchor: '2026-05-10', hover: null, start: 'a', end: 'b' }), ['2026-05-10', '2026-05-10'])
  assert.deepEqual(preview({ anchor: null, hover: null, start: 'a', end: 'b' }), ['a', 'b'])
})

test('limites mínimo e máximo', () => {
  assert.equal(outside('2026-01-01', '2026-02-01', '2026-03-01'), true)
  assert.equal(outside('2026-02-15', '2026-02-01', '2026-03-01'), false)
  assert.equal(outside('2026-02-15', undefined, undefined), false)
  assert.equal(clamp('2026-05-01', '2026-02-01', '2026-03-01'), '2026-03-01')
  assert.equal(clamp('2025-05-01', '2026-02-01', '2026-03-01'), '2026-02-01')
})

test('datas digitadas: aceita dd/mm/aaaa, dd/mm/aa, separadores e só dígitos; rejeita data impossível', async () => {
  const { parseTyped, maskTyped, typedText } = await import('../src/dateRange.js')
  assert.equal(parseTyped('30/10/2026', 'day'), '2026-10-30')
  assert.equal(parseTyped('5/1/26', 'day'), '2026-01-05')
  assert.equal(parseTyped('05-01-2026', 'day'), '2026-01-05')
  assert.equal(parseTyped('05.01.2026', 'day'), '2026-01-05')
  assert.equal(parseTyped('30102026', 'day'), '2026-10-30')
  assert.equal(parseTyped('31/02/2026', 'day'), null, 'fevereiro não tem 31')
  assert.equal(parseTyped('2026-10-30', 'day'), null)
  assert.equal(parseTyped('', 'day'), null)
  assert.equal(parseTyped('10/2026', 'month'), '2026-10')
  assert.equal(parseTyped('1/26', 'month'), '2026-01')
  assert.equal(parseTyped('13/2026', 'month'), null)
  assert.equal(maskTyped('3010', 'day'), '30/10')
  assert.equal(maskTyped('301020261', 'day'), '30/10/2026')
  assert.equal(maskTyped('102026', 'month'), '10/2026')
  assert.equal(maskTyped('30-10', 'day'), '30-10', 'com outro separador não mexe')
  assert.equal(typedText('2026-01-05', 'day'), '05/01/2026')
  assert.equal(typedText('2026-01', 'month'), '01/2026')
})

test('troca de página mantém foco no mês/ano exibido e respeita limites', async () => {
  const { navigateCalendarView } = await import('../src/dateRange.js')
  assert.deepEqual(navigateCalendarView('2026-01-31', '2026-01-31', 'day', 1), { view: '2026-02-28', focus: '2026-02-28' })
  assert.deepEqual(navigateCalendarView('2028-03-31', '2028-03-31', 'day', -1), { view: '2028-02-29', focus: '2028-02-29' })
  assert.deepEqual(navigateCalendarView('2026-10', '2026-12', 'month', 1), { view: '2027-10', focus: '2027-12' })
  assert.deepEqual(navigateCalendarView('2026-10', '2026-12', 'month', 1, '2025-01', '2027-03'), { view: '2027-03', focus: '2027-03' })
  assert.deepEqual(navigateCalendarView('2026-03-15', null, 'day', -1, '2026-03-01'), { view: '2026-03-01', focus: '2026-03-01' })
})
