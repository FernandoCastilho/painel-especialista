import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { hookRenderer } from './helpers/hooks.mjs'
import { createRpnEngine } from '../src/rpnEngine.mjs'
import { rpnKeyFromEvent } from '../src/rpnKeyboard.mjs'

const require = createRequire(import.meta.url)
const source = await readFile(new URL('../src/RpnCalculator.jsx', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []

function setup(t, create) {
  const module = { exports: {} }
  const deps = { react: { ...React, useId: () => 'rpn-test' }, './RpnCalculator.css': {}, './rpnEngine.mjs': { createRpnEngine: create }, './rpnKeyboard.mjs': { rpnKeyFromEvent } }
  runInNewContext(code, { module, exports: module.exports, require: path => deps[path] ?? require(path) })
  const render = hookRenderer(() => module.exports.default())
  t.after(() => render.close())
  return { render, panel: () => render.value, buttons: () => nodes(render.value).filter(n => n.type === 'button'),
    find: pred => nodes(render.value).find(pred) }
}
const event = (key, extra = {}) => ({ key, prevented: false, preventDefault() { this.prevented = true }, ...extra })

test('mapeamento só aceita teclas de cálculo, respeita composição e ativação nativa', () => {
  for (const [key, id] of [['0', '0'], [',', 'decimal'], ['.', 'decimal'], ['Enter', 'enter'], ['=', 'enter'], ['+', 'add'],
    ['-', 'subtract'], ['*', 'multiply'], ['/', 'divide'], ['%', 'percent'], ['^', 'power'], ['Backspace', 'backspace'], ['Delete', 'clearAll']]) assert.equal(rpnKeyFromEvent(event(key)), id)
  for (const e of [event('Tab'), event(' '), event('Escape'), event('1', { altKey: true }), event('+', { ctrlKey: true }),
    event('-', { metaKey: true }), event('7', { nativeEvent: { isComposing: true } }), event('8', { target: { closest: () => ({}) } }),
    event('Enter', { target: { closest: selector => selector === 'button' ? {} : null } })]) assert.equal(rpnKeyFromEvent(e), null)
})

test('tela envia chaves exatas ao motor e renderiza o retorno sem refazer contas', async t => {
  const calls = []
  const x = { display: '120,50', stack: [120.5, 30, 2, 1], message: 'Teste local', settings: { paymentTiming: 'begin' },
    finance: { n: 2, pv: -5 }, cashFlows: [-5, 10] }
  const ui = setup(t, () => ({ snapshot: () => ({ display: '—' }), press: key => { calls.push(key); return x } }))
  await ui.render.settle()
  assert.equal(ui.panel().props.tabIndex, 0)
  const heading = ui.find(n => n.type === 'h1')
  assert.equal(heading.props.children, 'Calculadora RPN')
  assert.equal(ui.panel().props['aria-labelledby'], heading.props.id)
  const physical = event('2')
  ui.panel().props.onKeyDown(physical)
  assert.equal(physical.prevented, true)
  await ui.render.settle()
  assert.equal(ui.find(n => n.type === 'output').props.children, x.display)
  assert.equal(ui.find(n => n.props?.role === 'status').props.children, x.message)
  const button = label => ui.buttons().find(b => (b.props['aria-label'] ?? b.props.children) === label)
  assert.equal(button('Início do período').props['aria-pressed'], true)
  for (const name of ['Enter: separar os números', 'Guardar: Número de períodos', 'Calcular: Valor presente',
    'Fim do período', 'Raiz quadrada', 'Potência: Y elevado a X', 'Adicionar X', 'Repetir último fluxo', 'Calcular VPL', 'Calcular TIR', 'Limpar fluxo']) {
    button(name).props.onClick()
    await ui.render.settle()
  }
  const nearby = ui.find(n => n.props?.role === 'group' && n.props['aria-label'] === 'Fluxo de caixa')
  const feedback = nodes(nearby).find(n => n.type === 'span' && n.props.children === x.message)
  assert.ok(feedback, 'mensagem financeira aparece perto dos botões usados')
  assert.deepEqual(calls, ['2', 'enter', 'store:n', 'solve:pv', 'timing:end', 'sqrt', 'power', 'cash:add', 'cash:repeat', 'cash:npv', 'cash:irr', 'cash:clear'])
})

test('falha inesperada não mantém resultado antigo nem aceita novas operações', async t => {
  let calls = 0
  const ui = setup(t, () => ({ snapshot: () => ({ display: '99' }), press: () => { calls++; throw new Error('fixture') } }))
  await ui.render.settle()
  ui.panel().props.onKeyDown(event('1'))
  await ui.render.settle()
  assert.equal(ui.find(n => n.type === 'output').props.children, '—')
  assert.match(ui.find(n => n.props?.role === 'status').props.children, /Não foi possível/)
  assert.ok(ui.buttons().every(b => b.props.disabled))
  const e = event('2')
  ui.panel().props.onKeyDown(e)
  assert.equal(e.prevented, false)
  assert.equal(calls, 1)
})


test('teclado e botões funcionam com o motor real na mesma sessão', async t => {
  const ui = setup(t, createRpnEngine)
  await ui.render.settle()
  const visor = () => ui.find(n => n.type === 'output').props.children
  const key = async key => { ui.panel().props.onKeyDown(event(key)); await ui.render.settle() }
  const click = async name => {
    ui.buttons().find(b => (b.props['aria-label'] ?? b.props.children) === name).props.onClick()
    await ui.render.settle()
  }
  for (const symbol of ['2', 'Enter', '3', '+']) await key(symbol)
  assert.match(visor(), /^5(?:,0+)?$/)
  await click('Guardar: Número de períodos')
  await key('0')
  await click('Guardar: Taxa por período (%)')
  for (const symbol of ['1', '0', '0']) await key(symbol)
  await click('Trocar sinal')
  await click('Guardar: Valor presente')
  await key('0')
  await click('Guardar: Pagamento periódico')
  await click('Calcular: Valor futuro')
  assert.match(visor(), /^100(?:,0+)?$/)
  const finance = ui.find(n => n.props?.['aria-label'] === 'Funções financeiras')
  assert.ok(nodes(finance).some(n => n.type === 'strong' && n.props.children?.[0] === 'Visor atual: '))
})
