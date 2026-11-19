import test from 'node:test'
import assert from 'node:assert/strict'
import { lmDefaults, lmSanitize, lmSchedule, lmLoad, lmSave, lmClear, LM_KEY } from '../src/linhaMestra.js'
import { addMonths } from '../src/creditModalities.js'

test('padrão da linha mestra: R$ 1.000.000,00 em 24 meses, sem carência, Price, praça nacional', () => {
  assert.deepEqual(lmDefaults('2026-11-19'), { value: '1.000.000,00', term: '24', grace: '0', system: 'price', start: '2026-11-19', praca: 'BR' })
})

test('só aceita valores no formato de cada campo; data passada volta para hoje', () => {
  const today = '2026-11-19'
  assert.deepEqual(lmSanitize({ value: '250.000,00', term: '36', grace: '6', system: 'sac', start: '2026-12-01', praca: 'BR' }, today),
    { value: '250.000,00', term: '36', grace: '6', system: 'sac', start: '2026-12-01', praca: 'BR' })
  const bad = lmSanitize({ value: '<b>1</b>', term: 'x', grace: '-1', system: 'outro', start: '2026-11-18', praca: 'ZZ' }, today)
  assert.deepEqual(bad, lmDefaults(today))
  assert.deepEqual(lmSanitize(null, today), lmDefaults(today))
})

test('guarda na sessão do navegador e limpa', () => {
  const mem = new Map()
  globalThis.sessionStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) }
  try {
    lmSave({ ...lmDefaults('2026-11-19'), value: '500.000,00', term: '12' })
    assert.ok(mem.has(LM_KEY))
    assert.equal(lmLoad('2026-11-19').value, '500.000,00')
    assert.equal(lmLoad('2026-11-19').term, '12')
    lmClear()
    assert.deepEqual(lmLoad('2026-11-19'), lmDefaults('2026-11-19'))
    globalThis.sessionStorage = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') }, removeItem: () => {} }
    assert.deepEqual(lmLoad('2026-11-19'), lmDefaults('2026-11-19'))
    assert.doesNotThrow(() => lmSave(lmDefaults('2026-11-19')))
  } finally { delete globalThis.sessionStorage }
})

test('regra do Comparador: parcelas = prazo − carência; 1º vencimento após carência + 1 mês; bullet no fim', () => {
  assert.deepEqual(lmSchedule({ term: '24', grace: '6', system: 'price' }), { ok: true, n: 18, dueMonths: 7, term: 24, grace: 6 })
  assert.deepEqual(lmSchedule({ term: '24', grace: '0', system: 'sac' }), { ok: true, n: 24, dueMonths: 1, term: 24, grace: 0 })
  assert.deepEqual(lmSchedule({ term: '24', grace: '', system: 'price' }), { ok: true, n: 24, dueMonths: 1, term: 24, grace: 0 })
  assert.deepEqual(lmSchedule({ term: '12', grace: '3', system: 'bullet' }), { ok: true, n: 1, dueMonths: 12, term: 12, grace: 0 })
  assert.equal(lmSchedule({ term: '6', grace: '6', system: 'price' }).ok, false)
  assert.equal(lmSchedule({ term: '', grace: '0', system: 'price' }).ok, false)
  assert.equal(lmSchedule({ term: '601', grace: '0', system: 'price' }).ok, false)
  // Mesmo 1º vencimento que o Comparador calcula (creditModalities.giroLike).
  assert.equal(addMonths('2026-01-31', lmSchedule({ term: '24', grace: '0', system: 'price' }).dueMonths), '2026-02-28')
})
