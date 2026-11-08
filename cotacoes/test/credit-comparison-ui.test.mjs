import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { hookRenderer } from './helpers/hooks.mjs'
import * as model from '../src/creditComparison.js'
import * as money from '../src/moneyInput.js'
import * as loan from '../src/emprestimo.js'
import * as dates from '../src/contaGarantida.js'
import * as iof from '../src/iofRules.js'
const require = createRequire(import.meta.url)
const nodes = el => Array.isArray(el) ? el.flatMap(nodes) : el && typeof el === 'object' ? [el, ...nodes(el.props?.children)] : []
const text = el => Array.isArray(el) ? el.map(text).join('') : el && typeof el === 'object' ? text(el.props?.children) : typeof el === 'string' ? el : ''
async function setup(t) {
  const deps = { react: React, './CreditComparison.css': {}, './creditComparison.js': model, './moneyInput.js': money, './emprestimo.js': loan, './iofRules.js': iof, './contaGarantida.js': { ...dates, cgToday: () => '2026-11-08' }, './useDataFile.js': { useDataFile: () => ({ data: { cdi: [[Date.now() - 86400000, 12]] }, status: 'ready' }) } }
  for (const file of ['MoneyInput.jsx', 'CreditComparison.jsx']) {
    const { code } = await transform(await readFile(new URL('../src/' + file, import.meta.url), 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
    const module = { exports: {} }
    runInNewContext(code, { module, exports: module.exports, require: name => deps[name] ?? require(name) })
    deps['./' + file] = module.exports
  }
  let backs = 0
  const render = hookRenderer(() => deps['./CreditComparison.jsx'].default({ onBack: () => backs++ }))
  t.after(() => render.close()); await render.settle()
  const find = name => nodes(render.value).find(n => n.type?.name === name)
  const proposal = name => nodes(render.value).find(n => n.type?.name === 'Proposal' && n.props.name === name)
  const button = label => nodes(render.value).find(n => n.type === 'button' && text(n) === label)
  return { render, find, proposal, button, get backs() { return backs }, async change(name, values) { const p = proposal(name); p.props.set({ ...p.props.form, ...values }); await render.settle() } }
}
test('independent proposal edits recalculate only selected side and invalid inputs erase previous results', async t => {
  const ui = await setup(t), original = ui.find('Results').props.a.cost
  await ui.change('B', { rate: '2' })
  assert.equal(ui.find('Results').props.a.cost, original)
  assert.ok(ui.find('Results').props.b.cost > original)
  await ui.change('A', { value: '' })
  assert.equal(ui.find('Results').props.a.ok, false)
  const html = renderToStaticMarkup(ui.find('Results'))
  assert.ok(!html.includes('<table')); assert.match(html, /Operação A/)
  assert.equal(ui.button('Apresentar comparação').props.disabled, true)
})
test('proposal labels/IDs remain unique and support non-measurable guarantees', async t => {
  const ui = await setup(t)
  const html = ['A', 'B'].map(n => renderToStaticMarkup(ui.proposal(n))).join('')
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1])
  assert.equal(new Set(ids).size, ids.length)
  for (const match of html.matchAll(/for="([^"]+)"/g)) assert.ok(ids.includes(match[1]))
  await ui.change('A', { guarantee: 'Aval', guaranteeValue: '' })
  assert.equal(ui.find('Results').props.a.coverage, null)
})
test('CDI scenario changes preserve prefixado and manual blank blocks results', async t => {
  const ui = await setup(t), cost = ui.find('Results').props.a.cost
  await ui.change('B', { rateType: 'cdi', rate: '0,35' })
  const base = ui.find('Results').props.b.cost
  ui.button('Alta').props.onClick(); await ui.render.settle()
  assert.ok(ui.find('Results').props.b.cost > base); assert.equal(ui.find('Results').props.a.cost, cost)
  const manualLabel = nodes(ui.render.value).find(n => n.type === 'label' && text(n).includes('Informar referência manual'))
  nodes(manualLabel).find(n => n.type === 'input').props.onChange({ target: { checked: true } }); await ui.render.settle()
  assert.equal(ui.find('Results').props.b.ok, false)
})
test('presentation captures immutable result and requires declared cost check', async t => {
  const ui = await setup(t)
  assert.equal(ui.button('Apresentar comparação').props.disabled, true)
  const confirm = nodes(ui.render.value).find(n => n.props?.className === 'credit-confirm')
  nodes(confirm).find(n => n.type === 'input').props.onChange({ target: { checked: true } }); await ui.render.settle()
  assert.equal(ui.button('Apresentar comparação').props.disabled, false)
  ui.button('Apresentar comparação').props.onClick(); await ui.render.settle()
  const captured = ui.find('Presentation').props.children.props.a.cost
  await ui.change('A', { rate: '3' })
  assert.equal(ui.find('Presentation').props.children.props.a.cost, captured)
  assert.notEqual(ui.find('Results').props.a.cost, captured)
  ui.find('Presentation').props.onClose(); await ui.render.settle()
  assert.equal(ui.find('Presentation'), undefined)
})
test('edits invalidate cost confirmation and presentation includes all conditions', async t => {
  const ui = await setup(t)
  const confirm = nodes(ui.render.value).find(n => n.props?.className === 'credit-confirm')
  nodes(confirm).find(n => n.type === 'input').props.onChange({ target: { checked: true } }); await ui.render.settle()
  assert.equal(ui.button('Apresentar comparação').props.disabled, false)
  await ui.change('B', { rateType: 'cdi', rate: '0,35', cdiPercent: '120', system: 'sac', n: '36' })
  assert.equal(ui.button('Apresentar comparação').props.disabled, true)
  const html = renderToStaticMarkup(ui.find('Results'))
  for (const condition of ['120% do CDI', '0,35%', 'SAC', '36 pagamento(s)', 'Liberação / primeiro vencimento']) assert.ok(html.includes(condition), condition)
})
test('Bullet graph includes initial zero and final payment so it is visible', async t => {
  const ui = await setup(t)
  await ui.change('A', { system: 'bullet' }); await ui.change('B', { system: 'bullet' })
  const html = renderToStaticMarkup(ui.find('Results'))
  const lines = [...html.matchAll(/<polyline points="([^"]+)"/g)]
  assert.equal(lines.length, 2)
  for (const line of lines) assert.equal(line[1].split(' ').length, 2)
})
