import test from 'node:test'
import assert from 'node:assert/strict'
import { marcasValor } from '../src/chartMarcas.js'

const xs = (n, w = 600) => Array.from({ length: n }, (_, i) => (i / (n - 1)) * w)

test('rótulos marcam último, primeiro, pico e vale', () => {
  const vals = [10, 12, 15, 13, 9, 11, 14]
  const m = marcasValor(vals, xs(vals.length))
  const idx = m.map((k) => k.i)
  for (const i of [0, 2, 4, 6]) assert.ok(idx.includes(i), `faltou o ponto ${i}`)
  assert.equal(m.find((k) => k.i === 4).vale, true)
  assert.equal(m.find((k) => k.i === 2).vale, false)
})

test('linha sem virada ganha pontos do meio, até quatro rótulos', () => {
  const vals = Array.from({ length: 50 }, (_, i) => 15 - i * 0.03)
  const m = marcasValor(vals, xs(50))
  assert.equal(m.length, 4)
  assert.deepEqual([m[0].i, m.at(-1).i], [0, 49])
})

test('rótulos não encavalam nem repetem valor', () => {
  const vals = Array.from({ length: 200 }, (_, i) => Math.sin(i / 3))
  const x = xs(200, 300)
  const m = marcasValor(vals, x)
  assert.ok(m.length <= 6)
  for (let k = 1; k < m.length; k++) assert.ok(x[m[k].i] - x[m[k - 1].i] >= 64)
  assert.equal(new Set(m.map((k) => vals[k.i])).size, m.length)
  assert.deepEqual(marcasValor([], []), [])
  assert.deepEqual(marcasValor([5, 5, 5], xs(3)).map((k) => k.i), [2])
})
