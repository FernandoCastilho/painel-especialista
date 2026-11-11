import test from 'node:test'
import assert from 'node:assert/strict'
import { compareWithDi } from '../src/operacaoDi.js'

// Curva plana: 14,00% a.a. em todos os vértices. DI diário constante = 1,14^(1/252) − 1.
const FLAT = [[21, 14], [126, 14], [252, 14], [504, 14]]
const day = 1.14 ** (1 / 252) - 1
const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`)

test('pré a.a. em base 252: fator e diferença contra o DI', () => {
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

test('pré a.m. vira ano por (1+am)^12; no período é usado como está', () => {
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
