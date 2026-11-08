import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSgs } from '../scripts/macro-lib.mjs'
import { parseIndexador } from '../scripts/indexadores-lib.mjs'
import { fillFromPrevious } from '../scripts/prev-lib.mjs'

test('missing source observations are rejected; genuine zero and negative rates remain valid', () => {
  const now = Date.parse('2026-11-08T12:00:00Z')
  for (const value of [null, undefined, '', '  ', false, true, [], {}, 'NaN', 'Infinity']) {
    const rows = [{ data: '01/11/2026', valor: value }]
    assert.deepEqual(parseSgs(rows), [], String(value))
    assert.equal(parseIndexador(rows, 30, now), null, String(value))
  }
  for (const value of [0, '0', -0.1, '-0.1', ' 1.5 ']) {
    const rows = [{ data: '01/11/2026', valor: value }]
    assert.equal(parseSgs(rows)[0][1], Number(value))
    assert.equal(parseIndexador(rows, 30, now).latest.value, Number(value))
  }
})

test('a missing new observation does not overwrite the last valid macro series', () => {
  const old = { generatedAt: 100, cdi: [[10, 13.65]] }
  const next = { generatedAt: 200, cdi: parseSgs([{ data: '01/11/2026', valor: null }]) }
  fillFromPrevious(next, old, ['cdi'])
  assert.deepEqual(next.cdi, old.cdi)
  assert.equal(next.stale.cdi, old.generatedAt)
})
