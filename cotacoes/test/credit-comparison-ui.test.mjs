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
import * as modalities from '../src/creditModalities.js'
import * as finimp from '../src/finimpComparison.js'
import * as money from '../src/moneyInput.js'
import * as loan from '../src/emprestimo.js'
import * as dates from '../src/contaGarantida.js'
import * as iof from '../src/iofRules.js'
const require = createRequire(import.meta.url)
const nodes = el => Array.isArray(el) ? el.flatMap(nodes) : el && typeof el === 'object' ? [el, ...nodes(el.props?.children)] : []
const text = el => Array.isArray(el) ? el.map(text).join('') : el && typeof el === 'object' ? text(el.props?.children) : typeof el === 'string' || typeof el === 'number' ? String(el) : ''
async function setup(t) {
  const deps = { react: React, './CreditComparison.css': {}, './creditComparison.js': model, './creditModalities.js': modalities, './finimpComparison.js': finimp, './moneyInput.js': money, './emprestimo.js': loan, './iofRules.js': iof, './contaGarantida.js': { ...dates, cgToday: () => '2026-11-10' }, './useDataFile.js': { useDataFile: () => ({ data: { cdi: [[Date.now() - 86400000, 12]] }, status: 'ready' }) } }
  for (const file of ['MoneyInput.jsx', 'CreditComparison.jsx']) {
    const { code } = await transform(await readFile(new URL('../src/' + file, import.meta.url), 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
    const module = { exports: {} }
    runInNewContext(code, { module, exports: module.exports, require: name => deps[name] ?? require(name) })
    deps['./' + file] = module.exports
  }
  const render = hookRenderer(() => deps['./CreditComparison.jsx'].default({ onBack: () => {} }))
  t.after(() => render.close()); await render.settle()
  const cards = () => nodes(render.value).filter(n => n.type?.name === 'ColumnCard')
  const card = i => cards()[i - 1]
  const button = label => nodes(render.value).find(n => n.type === 'button' && text(n).includes(label))
  const find = name => nodes(render.value).find(n => n.type?.name === name)
  return { render, cards, card, button, find, async change(i, values) { const c = card(i); c.props.set({ ...c.props.col, ...values }); await render.settle() } }
}
const clickCompare = async ui => { ui.button('Comparar modalidades').props.onClick(); await ui.render.settle() }

test('começa com duas comparações e deixa escolher de 2 a 5', async t => {
  const ui = await setup(t)
  assert.equal(ui.cards().length, 2)
  const counts = nodes(ui.render.value).filter(n => n.type === 'button' && /^[2-5]$/.test(text(n)))
  assert.deepEqual(counts.map(text), ['2', '3', '4', '5'])
  for (const n of [5, 3, 2]) { counts.find(b => text(b) === String(n)).props.onClick(); await ui.render.settle(); assert.equal(ui.cards().length, n) }
})
test('cada coluna aceita qualquer modalidade e mostra os campos dela', async t => {
  const ui = await setup(t)
  for (const { id } of modalities.MODALITIES) {
    await ui.change(1, modalities.newColumn(id))
    const html = renderToStaticMarkup(ui.card(1))
    assert.ok(html.includes(`credit-card-${id}`), id)
    assert.ok(html.includes('Parcela estimada'), id)
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(x => x[1])
    assert.equal(new Set(ids).size, ids.length, id)
    for (const match of html.matchAll(/for="([^"]+)"/g)) assert.ok(ids.includes(match[1]), match[1])
  }
  await ui.change(1, modalities.newColumn('bndes'))
  const html = renderToStaticMarkup(ui.card(1))
  for (const label of ['TFB', 'Custo financeiro', 'TAC', 'Porte da empresa', 'Spread do agente', 'Participação do BNDES', 'Garantia FGI', 'exemplos']) assert.ok(html.includes(label), label)
  await ui.change(1, modalities.newColumn('finimp'))
  const f = renderToStaticMarkup(ui.card(1))
  for (const label of ['Moeda', 'Flat', 'Câmbio', 'Prazo (dias)']) assert.ok(f.includes(label), label)
})
test('o cartão mostra parcela estimada e CET, ou o erro da coluna', async t => {
  const ui = await setup(t)
  assert.ok(ui.card(1).props.result.ok)
  assert.match(renderToStaticMarkup(ui.card(1)), /CET/)
  assert.doesNotMatch(renderToStaticMarkup(ui.card(1)), /CDI projetado/)
  const cdiCard = renderToStaticMarkup(ui.card(2))
  assert.match(cdiCard, /CET · parte fixa \(regra do BC\)/); assert.match(cdiCard, /Custo com CDI projetado/)
  assert.ok(ui.card(2).props.result.cet < ui.card(2).props.result.projectedCost)
  await ui.change(1, { rate: '' })
  assert.equal(ui.card(1).props.result.ok, false)
  assert.match(renderToStaticMarkup(ui.card(1)), /credit-card-error/)
  assert.equal(ui.card(2).props.result.ok, true)
})
test('o resultado só aparece ao comparar e some quando uma condição muda', async t => {
  const ui = await setup(t)
  assert.equal(ui.find('Results'), undefined)
  await clickCompare(ui)
  const html = renderToStaticMarkup(ui.find('Results'))
  for (const label of ['Valor líquido recebido', 'CET estimado · parte fixa (regra do BC)', 'Custo com CDI projetado · a.a. (não é CET)', 'art. 5º', 'Juros totais', 'IOF', 'Total desembolsado', 'Cobertura nominal', '1. Giro prefixado', '2. Giro pós-CDI']) assert.ok(html.includes(label), label)
  await ui.change(2, { cdiPercent: '110' })
  assert.equal(ui.find('Results'), undefined)
  assert.match(text(ui.render.value), /As condições mudaram/)
})
test('coluna inválida bloqueia a tabela e nomeia a comparação com problema', async t => {
  const ui = await setup(t)
  await ui.change(2, { modality: 'bndes' }); await ui.change(2, modalities.newColumn('bndes'))
  const shared = ui.find('SharedFields'); shared.props.set({ ...shared.props.shared, system: 'bullet' }); await ui.render.settle()
  await clickCompare(ui)
  const html = renderToStaticMarkup(ui.find('Results'))
  assert.ok(!html.includes('<table')); assert.match(html, /Comparação 2 · BNDES/)
  assert.equal(ui.button('Apresentar comparação').props.disabled, true)
})
test('cinco colunas geram tabela com cinco séries no gráfico', async t => {
  const ui = await setup(t)
  nodes(ui.render.value).find(n => n.type === 'button' && text(n) === '5').props.onClick(); await ui.render.settle()
  await ui.change(4, { fDays: '180' })
  await clickCompare(ui)
  const html = renderToStaticMarkup(ui.find('Results'))
  assert.equal([...html.matchAll(/<polyline /g)].length, 5)
  assert.equal([...html.matchAll(/<th scope="col">\d\. /g)].length, 5)
  assert.match(html, /menor CET/)
})
test('cenário do CDI só aparece com coluna indexada e muda só essa coluna', async t => {
  const ui = await setup(t)
  assert.ok(nodes(ui.render.value).some(n => n.type === 'h3' && text(n) === 'Cenários do CDI'))
  await ui.change(2, modalities.newColumn('giro-pre'))
  assert.ok(!nodes(ui.render.value).some(n => n.type === 'h3' && text(n) === 'Cenários do CDI'))
  await ui.change(2, modalities.newColumn('giro-cdi'))
  const before = ui.cards().map(c => c.props.result.cost)
  nodes(ui.render.value).find(n => n.type === 'button' && text(n) === 'Alta').props.onClick(); await ui.render.settle()
  const after = ui.cards().map(c => c.props.result.cost)
  assert.equal(after[0], before[0]); assert.ok(after[1] > before[1])
})
test('mesmo valor líquido iguala o líquido de todas as colunas', async t => {
  const ui = await setup(t)
  await ui.change(2, modalities.newColumn('bndes'))
  const box = nodes(ui.render.value).find(n => n.type === 'label' && text(n).includes('Comparar pelo mesmo valor líquido'))
  nodes(box).find(n => n.type === 'input').props.onChange({ target: { checked: true } }); await ui.render.settle()
  const nets = ui.cards().map(c => c.props.result.net.toFixed(2))
  assert.equal(new Set(nets).size, 1); assert.equal(nets[0], '500000.00')
})
test('apresentação exige conferência e guarda uma cópia do resultado', async t => {
  const ui = await setup(t)
  await clickCompare(ui)
  assert.equal(ui.button('Apresentar comparação').props.disabled, true)
  const confirm = nodes(ui.render.value).find(n => n.props?.className === 'credit-confirm')
  nodes(confirm).find(n => n.type === 'input').props.onChange({ target: { checked: true } }); await ui.render.settle()
  assert.equal(ui.button('Apresentar comparação').props.disabled, false)
  ui.button('Apresentar comparação').props.onClick(); await ui.render.settle()
  const captured = ui.find('Presentation').props.children.props.results[0].cost
  await ui.change(1, { rate: '3' })
  assert.equal(ui.find('Presentation').props.children.props.results[0].cost, captured)
  ui.find('Presentation').props.onClose(); await ui.render.settle()
  assert.equal(ui.find('Presentation'), undefined)
})
test('gráfico Bullet inclui ponto inicial zero e pagamento final', async t => {
  const ui = await setup(t)
  const shared = ui.find('SharedFields'); shared.props.set({ ...shared.props.shared, system: 'bullet' }); await ui.render.settle()
  await clickCompare(ui)
  const lines = [...renderToStaticMarkup(ui.find('Results')).matchAll(/<polyline points="([^"]+)"/g)]
  assert.equal(lines.length, 2)
  for (const line of lines) assert.equal(line[1].split(' ').length, 2)
})
