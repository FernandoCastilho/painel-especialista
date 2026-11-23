import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { APP_SECTIONS } from '../src/appSections.js'

test('menus exibem nomes sem numeração e preservam ordem e navegação', async () => {
  const top = await readFile(new URL('../src/TopBar.jsx', import.meta.url), 'utf8')
  const nav = await readFile(new URL('../src/Nav.jsx', import.meta.url), 'utf8')
  assert.ok(nav)
  assert.doesNotMatch(nav, /<i\b|>\s*\{i\s*\+\s*1\}/)
  assert.match(nav, /t\.terminalLabel \|\| t\.label/)
  assert.match(nav, /onTab\(t\.id\)/)
  assert.deepEqual(APP_SECTIONS.filter(t => !t.oculto).map(t => t.id), ['resumo', 'juros', 'cenarios', 'noticias', 'bndes', 'setores', 'bancos', 'feriados', 'aprender', 'calculadora', 'podcast', 'rpn', 'ma'])
  // O pedido é visual: atalhos existentes continuam disponíveis.
  assert.match(top, /e\.altKey/)
})
