import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import * as educacao from '../src/educacao.js'
import { hookRenderer } from './helpers/hooks.mjs'

const require = createRequire(import.meta.url)
const nodes = el => Array.isArray(el) ? el.flatMap(nodes) : el && typeof el === 'object' ? [el, ...nodes(el.props?.children)] : []
const textOf = el => Array.isArray(el) ? el.map(textOf).join('') : el && typeof el === 'object' ? textOf(el.props?.children) : typeof el === 'string' || typeof el === 'number' ? String(el) : ''

async function setup(t, initialView = 'conceitos') {
  const source = await readFile(new URL('../src/Aprender.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  const passthrough = ({ children }) => React.createElement('div', {}, children)
  runInNewContext(code, { module, exports: module.exports, require: name => {
    if (name === 'react') return { ...React, useMemo: fn => fn() }
    if (name === './educacao.js') return educacao
    if (name === './IcmsStDiagram.jsx') return { __esModule: true, default: () => null }
    if (name === './Aprender.css') return {}
    if (name === './Avisos.jsx') return { Aviso: passthrough }
    if (name === './TerminalDesk.jsx') return { Panel: passthrough }
    if (name === './Help.jsx') return { default: passthrough }
    if (name === './KnowledgeMap.jsx') return { __esModule: true, default: () => React.createElement('div', { 'data-test': 'knowledge-map' }) }
    return require(name)
  } })
  let view = initialView
  const destinations = []
  const render = hookRenderer(() => module.exports.default({ view, goto: (...args) => destinations.push(args) }))
  t.after(() => render.close())
  await render.settle()
  return {
    render, destinations,
    groups: () => nodes(render.value).filter(node => node.type === 'details' && node.props.className === 'learn-group'),
    button: label => nodes(render.value).find(node => node.type === 'button' && (node.props['aria-label'] || textOf(node)) === label),
    async click(label) { const button = this.button(label); assert.ok(button, label); assert.notEqual(button.props.disabled, true); button.props.onClick(); await render.settle() },
    async search(value) { nodes(render.value).find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value } }); await render.settle() },
    async toggle(topic, open) { const group = this.groups().find(node => node.key === topic); assert.ok(group, topic); group.props.onToggle({ currentTarget: { open } }); await render.settle() },
    async choose(id) { view = id; render.render(); await render.settle() },
  }
}

test('categorias começam recolhidas e expandem individualmente ou em conjunto', async t => {
  const h = await setup(t)
  assert.equal(h.groups().length, educacao.porTopico(educacao.CONCEITOS).length)
  assert.ok(h.groups().every(group => !group.props.open))
  assert.equal(h.button('Recolher todas').props.disabled, true)
  await h.toggle('Tributos e trabalho', true)
  assert.deepEqual(h.groups().filter(group => group.props.open).map(group => group.key), ['Tributos e trabalho'])
  await h.click('Expandir todas')
  assert.ok(h.groups().every(group => group.props.open))
  assert.equal(h.button('Expandir todas').props.disabled, true)
  await h.click('Recolher todas')
  assert.ok(h.groups().every(group => !group.props.open))
})

test('busca abre os grupos pertinentes e limpar restaura a seleção de categorias', async t => {
  const h = await setup(t)
  await h.toggle('Juros e câmbio', true)
  await h.search('dividendos')
  assert.deepEqual(h.groups().map(group => group.key), ['Tributos e trabalho'])
  assert.ok(h.groups().every(group => group.props.open))
  await h.click('Recolher todas')
  assert.ok(h.groups().every(group => !group.props.open))
  await h.search('split payment')
  assert.ok(h.groups().every(group => group.props.open))
  await h.click('Limpar busca')
  assert.equal(h.groups().length, educacao.porTopico(educacao.CONCEITOS).length)
  assert.deepEqual(h.groups().filter(group => group.props.open).map(group => group.key), ['Juros e câmbio'])
  await h.search('palavra-inexistente-xyz')
  assert.equal(h.groups().length, 0)
  assert.equal(h.button('Expandir todas'), undefined)
})

test('acesso direto e mudança de conceito abrem a categoria correta; links mantêm o destino', async t => {
  const h = await setup(t, 'dividendos')
  assert.deepEqual(h.groups().filter(group => group.props.open).map(group => group.key), ['Tributos e trabalho'])
  await h.click('Recolher todas')
  await h.choose('sofr')
  assert.deepEqual(h.groups().filter(group => group.props.open).map(group => group.key), ['Juros e câmbio'])
  const dividendButton = nodes(h.render.value).find(node => node.type === 'button' && textOf(node.props.children?.[0]) === 'Dividendos e distribuição de lucros')
  assert.ok(dividendButton)
  dividendButton.props.onClick()
  assert.deepEqual(h.destinations, [['aprender', 'dividendos']])
})
