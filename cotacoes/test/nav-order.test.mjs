import { APP_SECTIONS } from '../src/appSections.js'
import { SEARCH_SECTIONS } from '../src/globalSearch.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Nav.jsx importa JSX; lê o texto-fonte para travar a ordem do menu.
const src = readFileSync(new URL('../src/Nav.jsx', import.meta.url), 'utf8')
test('catálogo histórico preserva posições dos atalhos ao cadastrar a RPN', () => {
  const ids = APP_SECTIONS.map(section => section.id)
  assert.deepEqual(ids, ['resumo', 'juros', 'cenarios', 'noticias', 'bndes', 'setores', 'bancos', 'feriados', 'aprender', 'calculadora', 'podcast', 'rpn', 'apresentar', 'config']) // mesma ordem da barra do computador (DESK_TABS)
  assert.match(src, /desktop \? DESKTOP_PRIMARY : MOBILE_PRIMARY/)
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

test('Apresentar fica fora do menu (desde 18/11/2026), abre pelo comando e não vira destino da busca', () => {
  assert.ok(APP_SECTIONS.find(section => section.id === 'apresentar').oculto)
  assert.ok(DESK_TABS.find(section => section.id === 'apresentar').oculto)
  assert.equal(SEARCH_SECTIONS.apresentar, undefined) // a aba monta slides; o conteúdo buscável continua nas abas de origem
  assert.deepEqual(parseCommand('APRESENTAR'), { kind: 'tab', id: 'apresentar', sub: '' })
})

test('Calculadoras aparece no menu e mantém busca e acesso direto', () => {
  assert.ok(!APP_SECTIONS.find(section => section.id === 'calculadora').oculto)
  assert.ok(!DESK_TABS.find(section => section.id === 'calculadora').oculto)
  assert.equal(SEARCH_SECTIONS.calculadora, 'Calculadoras')
  assert.deepEqual(parseCommand('CALCULADORAS'), { kind: 'tab', id: 'calculadora', sub: '' })
})

import { DESKTOP_PRIMARY, MOBILE_PRIMARY, MORE_GROUPS, shortcutTitle } from '../src/navigationPriority.js'
test('prioridade aprovada separa visual de atalhos históricos', () => {
 assert.deepEqual(DESKTOP_PRIMARY, ['rpn','resumo','cenarios','juros','calculadora','setores','noticias','podcast'])
 assert.deepEqual(MOBILE_PRIMARY, ['resumo','cenarios','juros','calculadora','rpn','setores'])
 assert.deepEqual(MORE_GROUPS, [{label:'Acompanhar',ids:['noticias','podcast']},{label:'Consultar',ids:['bancos','feriados']},{label:'Aprender',ids:['aprender']}])
 assert.deepEqual(APP_SECTIONS.filter(t=>!t.oculto).slice(0,10).map(t=>shortcutTitle(t.id)),['Alt+1','Alt+2','Alt+3','Alt+4','Alt+5','Alt+6','Alt+7','Alt+8','Alt+9','Alt+0'])
 assert.deepEqual(parseCommand('BNDES'), {kind:'tab',id:'bndes',sub:''})
 assert.deepEqual(parseCommand('FINAME'), {kind:'tab',id:'calculadora',sub:'finame-materiais'})
 const calc=readFileSync(new URL('../src/Calculadora.jsx',import.meta.url),'utf8')
 assert.match(calc,/const CALCS = \[\s*\{ id: 'finame-materiais'/)
 assert.match(calc,/href="#bndes">Taxas BNDES/)
})

test('Juros fica imediatamente após Cenários em todas as telas, nunca duplicado em Mais', () => {
 for (const primary of [DESKTOP_PRIMARY, MOBILE_PRIMARY]) {
  assert.equal(primary[primary.indexOf('cenarios') + 1], 'juros')
  assert.equal(primary.filter(id => id === 'juros').length, 1)
  const secondary = MORE_GROUPS.flatMap(group => group.ids).filter(id => !primary.includes(id))
  assert.ok(!secondary.includes('juros'))
  const destinations = [...primary, ...secondary]
  assert.equal(new Set(destinations).size, destinations.length)
  for (const id of ['resumo','cenarios','juros','calculadora','rpn','setores','noticias','podcast','bancos','feriados','aprender']) assert.ok(destinations.includes(id), id)
 }
 assert.equal(shortcutTitle('juros'), 'Alt+2')
})

test('Calculadora RPN é destino principal distinto e não muda Alt+1 a Alt+0', () => {
  const rpn = APP_SECTIONS.find(section => section.id === 'rpn')
  assert.equal(rpn.label, 'Calculadora RPN')
  assert.equal(rpn.mobileLabel, 'RPN')
  assert.equal(DESKTOP_PRIMARY[0], 'rpn')
 assert.equal(MOBILE_PRIMARY[MOBILE_PRIMARY.indexOf('calculadora') + 1], 'rpn')
  assert.ok(!MORE_GROUPS.flatMap(x => x.ids).includes('rpn'))
  assert.equal(shortcutTitle('rpn'), undefined)
  assert.deepEqual(parseCommand('RPN'), { kind: 'tab', id: 'rpn', sub: '' })
  assert.deepEqual(parseCommand('CALCULADORAS'), { kind: 'tab', id: 'calculadora', sub: '' })
})

test('rótulos compactos mantêm os nomes acessíveis completos e a RPN como destino próprio', () => {
  assert.deepEqual(Object.fromEntries(APP_SECTIONS.filter(t => t.compactLabel).map(t => [t.id, t.compactLabel])),
    { resumo: 'Merc.', cenarios: 'Cen.', calculadora: 'Calc.' })
  assert.match(src, /aria-label=\{t\.id === 'rpn' \|\| \(!desktop && \(t\.mobileLabel \|\| t\.compactLabel\)\) \? \(t\.terminalLabel \|\| t\.label\) : undefined\}/)
  assert.match(src, /nav-label-compact" aria-hidden="true"/)
})
