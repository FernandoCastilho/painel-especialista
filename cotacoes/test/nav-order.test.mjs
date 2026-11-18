import { APP_SECTIONS } from '../src/appSections.js'
import { SEARCH_SECTIONS } from '../src/globalSearch.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Nav.jsx importa JSX; lê o texto-fonte para travar a ordem do menu.
const src = readFileSync(new URL('../src/Nav.jsx', import.meta.url), 'utf8')
test('menu: Mercado hoje, Juros, Cenários e depois as demais; barra do celular com as 4 primeiras', () => {
  const ids = APP_SECTIONS.map(section => section.id)
  assert.deepEqual(ids, ['resumo', 'juros', 'cenarios', 'noticias', 'bndes', 'setores', 'bancos', 'feriados', 'aprender', 'calculadora', 'apresentar', 'config']) // mesma ordem da barra do computador (DESK_TABS)
  assert.match(src, /const PRIMARY = \['resumo', 'juros', 'cenarios', 'noticias'\]/)
})

import { DESK_TABS, parseCommand } from '../src/terminal.js'
test('menu do celular e da barra do computador seguem a mesma ordem', () => {
  const ids = APP_SECTIONS.map(section => section.id)
  assert.deepEqual(ids, DESK_TABS.map((t) => t.id))
})

test('Configurações fica fora do menu (oculta), mas a rota continua', async () => {
  const { DESK_TABS } = await import('../src/terminal.js')
  assert.equal(DESK_TABS.find((t) => t.id === 'config').oculto, true)
  assert.equal(APP_SECTIONS.find(section => section.id === 'config').oculto, true)
  assert.equal(SEARCH_SECTIONS.config, undefined)
  assert.equal(SEARCH_SECTIONS.resumo, 'Mercado hoje')
  assert.equal(DESK_TABS[0].label, 'Mercado')
  assert.match(src, /TABS\.filter\(\(t\) => !t\.oculto\)/)
})

test('Apresentar fica fora do menu por enquanto (de novo desde 18/11/2026), abre pelo comando e não vira destino da busca', () => {
  assert.equal(APP_SECTIONS.find(section => section.id === 'apresentar').oculto, true)
  assert.equal(DESK_TABS.find(section => section.id === 'apresentar').oculto, true)
  assert.equal(SEARCH_SECTIONS.apresentar, undefined) // a aba monta slides; o conteúdo buscável continua nas abas de origem
  assert.deepEqual(parseCommand('APRESENTAR'), { kind: 'tab', id: 'apresentar', sub: '' })
})

test('Calculadoras aparece no menu e mantém busca e acesso direto', () => {
  assert.ok(!APP_SECTIONS.find(section => section.id === 'calculadora').oculto)
  assert.ok(!DESK_TABS.find(section => section.id === 'calculadora').oculto)
  assert.equal(SEARCH_SECTIONS.calculadora, 'Calculadoras')
  assert.deepEqual(parseCommand('CALCULADORAS'), { kind: 'tab', id: 'calculadora', sub: '' })
})
