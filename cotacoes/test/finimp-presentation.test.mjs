import test from 'node:test'
import { withCalcBack } from './helpers/calcBack.mjs'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { hookRenderer } from './helpers/hooks.mjs'
import * as comparison from '../src/finimpComparison.js'
import * as inputs from '../src/finimpInputs.js'
import * as draft from '../src/calculatorDraft.js'
import * as presentation from '../src/finimpPresentation.js'
import * as loan from '../src/emprestimo.js'
import * as help from '../src/finimpHelpContent.js'

const require = createRequire(import.meta.url)
// Isolate product state tests from the expansion shell; dialog behavior has separate tests.
const panelStub = ({ title, children }) => React.createElement('section', null, React.createElement('h3', null, title), children)

const source = await readFile(new URL('../src/FinimpComparacao.jsx', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
const module = { exports: {} }
const dependencies = {
  react: { ...React, useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
  './finimpComparison.js': comparison,
  './finimpInputs.js': inputs,
  './calculatorDraft.js': draft,
  './finimpPresentation.js': presentation,
  './emprestimo.js': loan,
  './finimpHelpContent.js': help,
  './MoneyInput.jsx': () => null,
  './FinimpHelp.jsx': () => null,
  './FinimpComparacao.css': {},
  './CalcPattern-finimp.css': {},
}
runInNewContext(code, { module, exports: module.exports, require: withCalcBack(name => (name === './ExpandablePanel.jsx' ? panelStub : name === './CalculatorStandard.css' ? {} : dependencies[name]) ?? require(name)) })
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]
const findAll = (tree, predicate) => nodes(tree).filter(predicate)
const find = (tree, predicate) => findAll(tree, predicate)[0]
const text = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children)
const field = (tree, id) => find(tree, node => node.props?.id === id)
const bodyRows = tree => find(tree, node => node.type === 'tbody').props.children
const fixture = () => {
  draft.finimpDraftStore.reset()
  draft.finimpDraftStore.update({
    principalText: '100000',
    competitor: { annualRate: '6', flatRate: '1', tac: '0' },
    itau: { annualRate: '8', flatRate: '0,5', tac: '0' },
  })
  return hookRenderer(() => module.exports.default({ onBack() {} }))
}

test('FINIMP apresenta taxas e delta com duas casas e conserva sinais menores que a precisão visual', () => {
  for (const [value, expected] of [[0, '0,00%'], [6, '6,00%'], [1.1666667, '1,17%'], [6.1234567, '6,12%']]) {
    assert.equal(presentation.formatFinimpPercent(value), expected)
  }
  for (const [value, expected] of [[0, '0,00 p.p.'], [0.5, '+0,50 p.p.'], [-0.333333, '-0,33 p.p.'], [0.00000005, '+ < 0,01 p.p.'], [-0.00000005, '− < 0,01 p.p.']]) {
    assert.equal(presentation.formatFinimpDelta(value), expected)
  }
})

test('FINIMP remove indicação automática de vencedor e mantém os 24 resultados', () => {
  const renderer = fixture(), tree = renderer.render(), rows = bodyRows(tree)
  assert.equal(rows.length, 12)
  assert.doesNotMatch(text(tree), /Instituição 2 com (?:menor|maior) custo|Custos iguais/)
  for (const [index, row] of rows.entries()) {
    const result = comparison.compareFinimp({ principal: 100000, days: comparison.FINIMP_TERMS[index], competitor: { annualRate: 6, flatRate: 1 }, itau: { annualRate: 8, flatRate: 0.5 } })
    const costs = findAll(row, node => node.props?.className === 'fi-cost')
    for (const [column, key] of ['competitor', 'itau'].entries()) {
      assert.equal(text(costs[column]), result[key].cost.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' }))
    }
    const percentages = findAll(row, node => node.type === 'td' && /%$/.test(text(node)))
    assert.equal(percentages.length, 2)
    percentages.forEach(node => assert.match(text(node), /^\d+,\d{2}%$/))
  }
})

test('seleção por clique ou botão de prazo destaca somente a linha escolhida sem modificar cálculos nem meta', () => {
  const renderer = fixture()
  let tree = renderer.render(), before = text(find(tree, node => node.type === 'tbody'))
  const snapshot = draft.finimpDraftStore.getSnapshot()
  bodyRows(tree)[3].props.onClick()
  tree = renderer.render()
  assert.equal(bodyRows(tree)[3].props.className, 'fi-row-selected')
  assert.equal(findAll(tree, node => node.type === 'button' && node.props['aria-pressed'] === true).length, 1)
  const button = find(bodyRows(tree)[7], node => node.type === 'button')
  assert.equal(button.props.type, 'button', 'botão nativo oferece Enter/Espaço sem interceptação de teclado')
  assert.equal(button.props['aria-label'], 'Selecionar prazo de 240 dias')
  assert.equal(button.props.onKeyDown, undefined)
  button.props.onClick()
  tree = renderer.render()
  assert.equal(bodyRows(tree)[3].props.className, undefined)
  assert.equal(bodyRows(tree)[7].props.className, 'fi-row-selected')
  find(bodyRows(tree)[7], node => node.type === 'button').props.onClick()
  tree = renderer.render()
  assert.equal(findAll(tree, node => node.props?.className === 'fi-row-selected').length, 1)
  assert.equal(text(find(tree, node => node.type === 'tbody')), before)
  assert.equal(draft.finimpDraftStore.getSnapshot(), snapshot)
  draft.finimpDraftStore.update({ useTac: true, currency: 'EUR' })
  tree = renderer.render()
  assert.equal(bodyRows(tree)[7].props.className, 'fi-row-selected', 'seleção sobrevive à alteração de colunas e moeda')
  find(tree, node => node.type === 'button' && text(node) === 'Nova simulação').props.onClick()
  tree = renderer.render()
  assert.equal(findAll(tree, node => node.props?.className === 'fi-row-selected').length, 0)
  assert.deepEqual(draft.finimpDraftStore.getSnapshot(), draft.newFinimpDraft())
})

test('campos de taxas formatam só a apresentação; foco e blur preservam toda a precisão interna', () => {
  const renderer = fixture()
  draft.finimpDraftStore.update({ competitor: { annualRate: '6,1234567', flatRate: '0,1234567', tac: '0' } })
  const snapshot = draft.finimpDraftStore.getSnapshot()
  let tree = renderer.render()
  assert.equal(field(tree, 'fi-a-rate').props.value, '6,12')
  assert.equal(field(tree, 'fi-a-flat').props.value, '0,12')
  const before = text(find(tree, node => node.type === 'tbody'))
  field(tree, 'fi-a-rate').props.onFocus()
  tree = renderer.render()
  assert.equal(field(tree, 'fi-a-rate').props.value, '6,1234567')
  field(tree, 'fi-a-rate').props.onBlur()
  tree = renderer.render()
  assert.equal(field(tree, 'fi-a-rate').props.value, '6,12')
  assert.equal(draft.finimpDraftStore.getSnapshot(), snapshot)
  assert.equal(text(find(tree, node => node.type === 'tbody')), before)
  field(tree, 'fi-a-rate').props.onChange({ target: { value: 'inválido' } })
  tree = renderer.render()
  assert.equal(field(tree, 'fi-a-rate').props.value, 'inválido')
  assert.equal(field(tree, 'fi-a-rate').props['aria-invalid'], true)
})

test('aplicar a meta usa a taxa completa, embora o campo desfocado mostre duas casas', () => {
  const renderer = fixture()
  draft.finimpDraftStore.update({ principalText: '123456,78', competitor: { annualRate: '6,1234567', flatRate: '0,1234567', tac: '0' } })
  const parsed = inputs.validateFinimpInputs(draft.finimpDraftStore.getSnapshot())
  const target = comparison.finimpCost({ ...parsed.competitor, principal: parsed.principal, days: 180 }).cost
  const expected = comparison.solveFinimpRate({ principal: parsed.principal, days: 180, flatRate: parsed.itau.flatRate, tac: 0, targetCost: target })
  let tree = renderer.render()
  find(tree, node => node.type === 'button' && text(node) === 'Aplicar taxa à Instituição 2').props.onClick()
  tree = renderer.render()
  const applied = inputs.validateFinimpInputs(draft.finimpDraftStore.getSnapshot())
  assert.equal(applied.itau.annualRate, expected.annualRate)
  assert.notEqual(applied.itau.annualRate, Number(expected.annualRate.toFixed(2)))
  assert.equal(field(tree, 'fi-b-rate').props.value, presentation.formatFinimpRate(expected.annualRate))
  assert.ok(Math.abs(comparison.finimpCost({ ...applied.itau, principal: applied.principal, days: 180 }).cost - target) < 1e-9)
})

test('TAC permanece em reais nos campos e na tabela, com câmbio explícito somente para principal estrangeiro', () => {
  const renderer = fixture()
  let tree = renderer.render()
  assert.equal(field(tree, 'fi-principal').props.prefix, 'USD')
  assert.equal(field(tree, 'fi-tac-fx'), undefined)
  assert.equal(field(tree, 'fi-a-tac'), undefined)
  draft.finimpDraftStore.update({ useTac: true, tacFxText: '5,432109876', competitor: { annualRate: '6', flatRate: '1', tac: '1234,56' }, itau: { annualRate: '8', flatRate: '0,5', tac: '654,32' } })
  tree = renderer.render()
  assert.equal(text(find(tree, node => node.type === 'label' && node.props.htmlFor === 'fi-tac-fx')), 'Câmbio da TAC (R$ por USD)')
  assert.equal(field(tree, 'fi-tac-fx').props.value, '5,432109876')
  for (const id of ['fi-a-tac', 'fi-b-tac']) {
    assert.equal(field(tree, id).props.prefix, 'R$')
    assert.equal(text(find(tree, node => node.type === 'label' && node.props.htmlFor === id)), 'TAC à vista (R$)')
  }
  assert.equal(findAll(tree, node => node.type === 'th' && text(node) === 'TAC à vista (R$)').length, 2)
  assert.match(text(bodyRows(tree)[0]), /R\$\s*1\.234,56/)
  assert.match(text(bodyRows(tree)[0]), /R\$\s*654,32/)
  const parsed = inputs.validateFinimpInputs(draft.finimpDraftStore.getSnapshot())
  const expected = comparison.compareFinimp({ principal: parsed.principal, days: 30, competitor: parsed.competitor, itau: parsed.itau })
  const costs = findAll(bodyRows(tree)[0], node => node.props?.className === 'fi-cost')
  for (const [column, key] of ['competitor', 'itau'].entries()) assert.equal(text(costs[column]), expected[key].cost.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' }))
  const original = draft.finimpDraftStore.getSnapshot()
  field(tree, 'fi-currency').props.onChange({ target: { value: 'EUR' } })
  tree = renderer.render()
  assert.equal(field(tree, 'fi-principal').props.prefix, 'EUR')
  assert.equal(field(tree, 'fi-a-tac').props.prefix, 'R$')
  assert.equal(field(tree, 'fi-a-tac').props.value, original.competitor.tac)
  assert.equal(field(tree, 'fi-tac-fx').props.value, '', 'a troca de moeda exige confirmar uma nova cotação')
  assert.equal(text(find(tree, node => node.type === 'label' && node.props.htmlFor === 'fi-tac-fx')), 'Câmbio da TAC (R$ por EUR)')
  field(tree, 'fi-currency').props.onChange({ target: { value: 'BRL' } })
  tree = renderer.render()
  assert.equal(field(tree, 'fi-tac-fx'), undefined)
  assert.equal(field(tree, 'fi-a-tac').props.value, original.competitor.tac)
  assert.equal(draft.finimpDraftStore.getSnapshot().tacFxText, '')
  find(tree, node => node.type === 'button' && text(node) === 'Nova simulação').props.onClick()
  assert.deepEqual(draft.finimpDraftStore.getSnapshot(), draft.newFinimpDraft())
  assert.equal(draft.finimpDraftStore.getSnapshot().tacFxText, '')
})

test('câmbio ausente bloqueia TAC positiva e associa erro ao campo sem afetar TAC zero ou excluída', () => {
  const renderer = fixture()
  draft.finimpDraftStore.update({ useTac: true, competitor: { annualRate: '6', flatRate: '1', tac: '1000' } })
  let tree = renderer.render()
  assert.equal(inputs.validateFinimpInputs(draft.finimpDraftStore.getSnapshot()).conditionsReady, false)
  field(tree, 'fi-tac-fx').props.onBlur()
  tree = renderer.render()
  assert.equal(field(tree, 'fi-tac-fx').props['aria-invalid'], true)
  assert.equal(field(tree, 'fi-tac-fx').props['aria-describedby'], 'fi-tac-fx-err')
  assert.equal(field(tree, 'fi-tac-fx-err').props.role, 'alert')
  draft.finimpDraftStore.update({ competitor: { annualRate: '6', flatRate: '1', tac: '0' }, tacFxText: 'inválido' })
  tree = renderer.render()
  assert.equal(inputs.validateFinimpInputs(draft.finimpDraftStore.getSnapshot()).conditionsReady, true)
  assert.equal(field(tree, 'fi-tac-fx').props['aria-invalid'], false)
  draft.finimpDraftStore.update({ useTac: false, competitor: { annualRate: '6', flatRate: '1', tac: '-1' } })
  tree = renderer.render()
  assert.equal(field(tree, 'fi-tac-fx'), undefined)
  assert.equal(inputs.validateFinimpInputs(draft.finimpDraftStore.getSnapshot()).conditionsReady, true)
})

test('aplicar meta de custo inclui a TAC em reais convertida com a precisão completa do câmbio', () => {
  const renderer = fixture()
  draft.finimpDraftStore.update({ useTac: true, tacFxText: '5,123456789', competitor: { annualRate: '6,1234567', flatRate: '0,1234567', tac: '1234,56' }, itau: { annualRate: '8', flatRate: '0,5', tac: '765,43' } })
  const parsed = inputs.validateFinimpInputs(draft.finimpDraftStore.getSnapshot())
  const target = comparison.finimpCost({ ...parsed.competitor, principal: parsed.principal, days: 180 }).cost
  const expected = comparison.solveFinimpRate({ principal: parsed.principal, days: 180, flatRate: parsed.itau.flatRate, tac: parsed.itau.tac, targetCost: target })
  let tree = renderer.render()
  find(tree, node => node.type === 'button' && text(node) === 'Aplicar taxa à Instituição 2').props.onClick()
  tree = renderer.render()
  const applied = inputs.validateFinimpInputs(draft.finimpDraftStore.getSnapshot())
  assert.equal(applied.itau.annualRate, expected.annualRate)
  assert.equal(applied.itau.tacBrl, 765.43)
  assert.equal(field(tree, 'fi-b-tac').props.value, '765,43')
  assert.ok(Math.abs(comparison.finimpCost({ ...applied.itau, principal: applied.principal, days: 180 }).cost - target) < 1e-9)
})

test('FINIMP inclui iene e yuan offshore sem converter o principal ou perder a TAC em reais', () => {
  const renderer = fixture()
  let tree = renderer.render()
  const currencies = nodes(field(tree, 'fi-currency')).filter(node => node.type === 'option').map(node => text(node))
  assert.deepEqual(currencies, ['USD', 'EUR', 'JPY', 'CNH', 'BRL'])
  draft.finimpDraftStore.update({ useTac: true, tacFxText: '5', competitor: { annualRate: '6', flatRate: '1', tac: '1200' } })
  for (const [currency, fx] of [['JPY', '0,03488'], ['CNH', '0,8258']]) {
    tree = renderer.render()
    field(tree, 'fi-currency').props.onChange({ target: { value: currency } })
    tree = renderer.render()
    assert.equal(field(tree, 'fi-principal').props.prefix, currency)
    assert.equal(field(tree, 'fi-principal').props.value, '100000')
    assert.equal(field(tree, 'fi-a-tac').props.prefix, 'R$')
    assert.equal(field(tree, 'fi-a-tac').props.value, '1200')
    assert.equal(field(tree, 'fi-tac-fx').props.value, '')
    assert.equal(inputs.validateFinimpInputs(draft.finimpDraftStore.getSnapshot()).conditionsReady, false)
    field(tree, 'fi-tac-fx').props.onChange({ target: { value: fx } })
    tree = renderer.render()
    const parsed = inputs.validateFinimpInputs(draft.finimpDraftStore.getSnapshot())
    assert.equal(parsed.conditionsReady, true)
    const expected = comparison.finimpCost({ ...parsed.competitor, principal: parsed.principal, days: 180 }).cost
    const cost = findAll(bodyRows(tree)[5], node => node.props?.className === 'fi-cost')[0]
    assert.equal(text(cost), expected.toLocaleString('pt-BR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }
})

test('linhas compactas e seleção estilizam todas as células, inclusive prazo fixo, sem depender de hover', async () => {
  const css = await readFile(new URL('../src/FinimpComparacao.css', import.meta.url), 'utf8')
  assert.match(css, /\.fi \.fi-compare tbody th,\.fi \.fi-compare tbody td\{padding:4px 8px/)
  assert.match(css, /tr\.fi-row-selected>th,\.fi \.fi-compare tbody tr\.fi-row-selected>td\{background:/)
  assert.match(css, /\.fi-row-select:focus-visible\{outline:/)
})

test('valores monetários têm colunas expansíveis e rolagem, sem quebra nem largura fixa que cause sobreposição', async () => {
  const css = await readFile(new URL('../src/FinimpComparacao.css', import.meta.url), 'utf8')
  assert.match(css, /\.fi-scroll table\{table-layout:auto\}/)
  assert.doesNotMatch(css, /table-layout:fixed/)
  assert.match(css, /\.fi-compare tbody td:not\(\[colspan\]\),\.fi-compare tbody td:not\(\[colspan\]\) strong\{white-space:nowrap;overflow-wrap:normal;word-break:normal\}/)
  assert.match(css, /\.fi-scroll\{overflow-x:auto;max-width:100%/)
  assert.match(css, /\.fi-compare tbody td\[colspan\]\{white-space:normal;overflow-wrap:anywhere\}/)
  const renderer = fixture()
  draft.finimpDraftStore.update({ principalText: '12345678901234,56', currency: 'BRL', useTac: true })
  assert.equal(inputs.validateFinimpInputs(draft.finimpDraftStore.getSnapshot()).conditionsReady, true)
  const tree = renderer.render(), lastRow = bodyRows(tree).at(-1)
  assert.match(text(lastRow), /864\.197\.523\.086,42/)
  assert.match(text(lastRow), /1\.049\.382\.706\.604,94/)
  const region = find(tree, node => node.props?.className === 'fi-scroll')
  assert.equal(region.props.tabIndex, 0)
  assert.equal(region.props.role, 'region')
  assert.ok(region.props['aria-label'])
})
