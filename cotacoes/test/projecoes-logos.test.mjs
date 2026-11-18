import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { INSTITUTIONS } from '../src/scenarios.js'

// Cada instituição das Projeções tem uma marca: bandeira do Brasil no Focus e um logotipo que existe em public/bank-logos.
test('projeções: todo banco tem logotipo local e o Focus usa a bandeira do Brasil', async () => {
  const src = await readFile(new URL('../src/Projecoes.jsx', import.meta.url), 'utf8')
  const mapa = Object.fromEntries([...src.matchAll(/'?([\wÀ-ú ]+?)'?: '([a-z]+)'/g)].map((m) => [m[1].trim(), m[2]]))
  for (const name of INSTITUTIONS.slice(1)) {
    assert.ok(mapa[name], `logotipo definido para ${name}`)
    await access(new URL(`../public/bank-logos/${mapa[name]}.png`, import.meta.url))
  }
  assert.match(src, /name === 'FOCUS'\s*\?\s*<Flag code="BRL"/)
  assert.match(src, /alt=""/, 'logotipo decorativo: o nome já está ao lado')
})
