import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { hookRenderer } from './helpers/hooks.mjs'

const require = createRequire(import.meta.url)
const nodes = el => Array.isArray(el) ? el.flatMap(nodes) : el && typeof el === 'object' ? [el, ...nodes(el.props?.children)] : []
const text = el => Array.isArray(el) ? el.map(text).join(' ') : el && typeof el === 'object' ? text(el.props?.children) : el == null || typeof el === 'boolean' ? '' : String(el)
async function setup(t, overrides = {}) {
  const series = { C01: { points: [['2026-11-06', 11]] }, C02: { points: [['2026-11-06', 11.5]] }, C03: { points: [['2026-11-06', 10]] }, C04: { points: [['2026-11-06', 10.5]] }, TFB_36_90: { points: [['2026-11-06', 11]] }, TFB_60_90: { points: [['2026-11-06', 12]] }, TFB_84_90: { points: [['2026-11-06', 13]] }, ...overrides }
  const deps = { './ExpandablePanel.jsx': { __esModule: true, default: () => null }, './Roteiro.jsx': { step: (number, text) => `${number} ${text}` }, './BndesCompare.jsx': { __esModule: true, default: () => null }, './FinameComparisonLayout.css': {}, './BndesIcon.jsx': { __esModule: true, default: () => null }, react: React, './MoneyInput.jsx': { __esModule: true, default: () => null }, './Estado.jsx': { __esModule: true, default: () => null }, './useHolidays.js': { useHolidays: () => ({ ctx: {} }) }, './glossary.js': await import('../src/glossary.js'), './CalculatorHelp.jsx': { __esModule: true, default: () => null }, './useDataFile.js': { useDataFile: () => ({ status: 'ready', data: { series } }) }, './useMacro.js': { useMacro: () => ({ data: {} }) } }
  for (const name of ['moneyInput', 'emprestimo', 'bndes', 'finameMateriais', 'finamePosFixado', 'holidays', 'finameFunding', 'finameResumo', 'format', 'pracaContrato']) deps[`./${name}.js`] = await import(`../src/${name}.js`)
  const source = await readFile(new URL('../src/FinameMateriais.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  const navigation = []
  let calculation
  const finame = deps['./finameMateriais.js'], funding = deps['./finameFunding.js']
  deps['./finameMateriais.js'] = { ...finame, simular(params) {
    const result = finame.simular(params)
    if (!calculation.result && result.ok) calculation.result = result
    return result
  } }
  deps['./finameFunding.js'] = { ...funding,
    finameSimulationParams(input) {
      const params = funding.finameSimulationParams(input)
      calculation.conditions = { sistema: params.sistema, composicao: params.composicao, liberacao: params.liberacao, rate: { value: input.custoFinanceiro } }
      return params
    },
    compareFinamePair(...args) { return (calculation.comparison = funding.compareFinamePair(...args)) },
  }
  runInNewContext(code, { module, exports: module.exports, require: name => deps[name] ?? require(name) })
  const render = hookRenderer(() => {
    calculation = { result: null, comparison: null, conditions: {} }
    return module.exports.default({ onBack() {}, onFundingView: view => navigation.push(view) })
  })
  t.after(() => render.close())
  await render.settle()
  const field = id => nodes(render.value).find(node => node.props?.id === id)
  const hasResult = () => nodes(render.value).some(node => node.props?.className === 'fm-kpi')
  const change = async (id, value) => { field(id).props.onChange({ target: { value, checked: value } }); await render.settle() }
  const simulation = () => calculation
  const reset = async cost => { nodes(render.value).find(node => node.type === 'button' && text(node).replace(/\s+/g, ' ').trim() === `Usar cotação ${cost}`).props.onClick(); await render.settle() }
  return { render, field, hasResult, change, simulation, reset, navigation }
}

test('FINAME abre com premissas fixas, IOF zero e ECG sempre à vista', async t => {
  const { render, field, hasResult, change, simulation } = await setup(t)
  for (const id of ['fm-finame-eligible', 'fm-sis', 'fm-comp', 'fm-lib', 'fm-fgi-inc', 'fm-iof-fixo', 'fm-iof-diario']) assert.equal(field(id), undefined, id)
  assert.equal(hasResult(), true)
  assert.equal(field('fm-compare').props.checked, false)
  const initial = simulation()
  assert.equal(initial.conditions.sistema, 'sac')
  assert.equal(initial.conditions.composicao, 'capitalizada')
  assert.equal(initial.conditions.liberacao, 90)
  assert.equal(initial.result.iof, 0)
  assert.match(text(render.value), /FINAME/)
  assert.equal(field('fm-rate-tfb'), undefined)
  await change('fm-fgi', true)
  const withFgi = simulation().result
  assert.equal(withFgi.fgi.incorporado, false)
  assert.equal(withFgi.financiado, initial.result.financiado)
  assert.equal(withFgi.juros, initial.result.juros)
  assert.equal(withFgi.primeiraParcela, initial.result.primeiraParcela)
  assert.ok(Math.abs(withFgi.total - initial.result.total - withFgi.fgi.ecg) < 1e-6)
})

test('referências editáveis mudam as duas colunas e reset recupera a cotação', async t => {
  const { field, change, simulation, reset } = await setup(t)
  await change('fm-compare', true)
  assert.ok(field('fm-rate-tfc')); assert.ok(field('fm-rate-tfb'))
  const quoted = simulation().comparison
  assert.equal(quoted.ok, true)
  await change('fm-rate-tfc', '9,5')
  await change('fm-rate-tfb', '10,5')
  const manual = simulation().comparison
  assert.equal(manual.ok, true)
  for (let i = 0; i < 2; i++) assert.notEqual(manual.alternatives[i].result.total, quoted.alternatives[i].result.total)
  assert.equal(simulation().result.total, manual.alternatives[0].result.total)
  await reset('TFC'); await reset('TFB')
  assert.deepEqual(simulation().comparison, quoted)
  await change('fm-compare', false)
  assert.equal(field('fm-rate-tfb'), undefined)
  await change('fm-custo', 'tfb')
  assert.equal(field('fm-rate-tfc'), undefined)
  assert.ok(field('fm-rate-tfb'))
  assert.equal(simulation().conditions.liberacao, 90)
})

test('taxas vazias, negativas e acima de 100 invalidam; zero explícito calcula', async t => {
  const { field, hasResult, change, simulation } = await setup(t)
  for (const invalid of ['', '-1', '100,01', 'abc']) {
    await change('fm-rate-tfc', invalid)
    assert.equal(hasResult(), false, `taxa inválida: ${invalid}`)
  }
  await change('fm-rate-tfc', '0')
  assert.equal(hasResult(), true)
  assert.equal(simulation().conditions.rate.value, 0)
  await change('fm-compare', true)
  await change('fm-rate-tfb', '')
  assert.notEqual(simulation().comparison?.ok, true, 'comparação não usa cotação antiga quando campo está vazio')
  await change('fm-rate-tfb', '0')
  assert.equal(simulation().comparison.ok, true)
  assert.equal(field('fm-rate-tfb').props.value, '0')
})

test('trocar prazo ou porte descarta taxas manuais para não reaproveitar referência incompatível', async t => {
  const { change, simulation } = await setup(t)
  await change('fm-compare', true)
  await change('fm-rate-tfc', '5'); await change('fm-rate-tfb', '6')
  await change('fm-prazo', '72')
  assert.equal(simulation().conditions.rate.value, 10.5)
  await change('fm-prazo', '60')
  assert.equal(simulation().comparison.alternatives[1].rate.value, 12)
  await change('fm-rate-tfc', '5'); await change('fm-rate-tfb', '6')
  await change('fm-porte', '2')
  assert.equal(simulation().conditions.rate.value, 11)
  assert.equal(simulation().comparison.alternatives[1].rate.value, 12)
})

test('taxas manuais não liberam comparação entre datas nem faixas incompatíveis', async t => {
  const { change, simulation } = await setup(t, { TFB_60_90: { points: [['2026-11-05', 12]] } })
  await change('fm-compare', true)
  await change('fm-rate-tfc', '9'); await change('fm-rate-tfb', '9')
  assert.equal(simulation().comparison.ok, false)
  assert.match(simulation().comparison.error, /mesma data/)
  await change('fm-prazo', '36')
  await change('fm-rate-tfc', '9'); await change('fm-rate-tfb', '9')
  assert.equal(simulation().comparison.ok, false)
  assert.match(simulation().comparison.error, /mesma faixa/)
})

test('pós-fixados sem cotação nem Focus não calculam e a troca preserva as condições', async t => {
  const { field, hasResult, change, navigation } = await setup(t)
  field('fm-valor').props.onChange('600.000,00')
  await change('fm-prazo', '36'); await change('fm-car', '5')
  assert.equal(hasResult(), true)
  assert.ok(field('fm-calendario-hipotetico'))
  for (const cost of ['tlp', 'lcd', 'tfbd']) {
    await change('fm-custo', cost)
    assert.equal(hasResult(), false)
    assert.equal(field('fm-ipca'), undefined)
    assert.equal(field('fm-valor').props.value, '600.000,00')
    assert.equal(field('fm-prazo').props.value, '36')
    assert.equal(field('fm-car').props.value, '5')
    // Desde 19/11/2026 TLP, LCD e TFBD calculam nesta tela: sem cotação do painel nem Focus, não há resultado, mas o campo da taxa aparece.
    assert.ok(field(`fm-rate-${cost}`))
    assert.equal(navigation.length, 0)
    await change('fm-custo', 'tfc')
    assert.equal(hasResult(), true)
  }
})


test('Finame preserva campos, mantém a cotação sem logo e remove os botões de exportação', async t => {
  const h = await setup(t)
  for (const id of ['fm-valor', 'fm-part', 'fm-prazo', 'fm-car', 'fm-porte', 'fm-custo', 'fm-bndes', 'fm-agente', 'fm-tac', 'fm-rate-tfc', 'fm-per', 'fm-fgi']) assert.ok(h.field(id), id)
  const all = nodes(h.render.value)
  assert.equal(all.find(node => node.props?.className === 'fm-result-workspace').props.brand, undefined)
  assert.equal(all.some(node => node.props?.className === 'fm-print-actions'), false)
  assert.equal(h.field('fm-parcelas').props.open, undefined, 'parcelas recolhidas por padrão')
  assert.doesNotMatch(text(h.render.value), /Apresentar simulação|Imprimir PDF/)
  await h.change('fm-compare', true)
  assert.ok(h.simulation().comparison?.ok)
  await h.change('fm-rate-tfc', '9,5')
  assert.match(text(h.render.value), /Taxa manual/i)
  await h.change('fm-fgi', true)
  assert.ok(h.field('fm-fgipct'))
  assert.equal(h.simulation().result.fgi.incorporado, false)
  await h.change('fm-prazo', '36')
  assert.equal(h.simulation().comparison.ok, false)
  await h.change('fm-rate-tfc', '')
  assert.equal(h.simulation().result, null)
})

test('parcelas compactas comparam A e B pela mesma data sem recalcular valores', async t => {
  const { render, change, simulation } = await setup(t)
  await change('fm-compare', true)
  const alternatives = simulation().comparison.alternatives
  const panel = nodes(render.value).find(node => node.props?.id === 'fm-parcelas')
  assert.equal(panel.type, 'details')
  assert.equal(panel.props.open, undefined)
  assert.match(text(panel.props.children[0]), /Parcelas · opções lado a lado/)
  const table = nodes(panel).find(node => node.type === 'table')
  assert.match(text(table).replace(/\s+/g, ' '), /Opção A.*TFC.*Opção B.*TFB/)
  const body = nodes(table).find(node => node.type === 'tbody')
  const rows = nodes(body).filter(node => node.type === 'tr')
  const dates = [...new Set(alternatives.flatMap(item => item.result.parcelas.map(row => row.vencimento)))].sort()
  assert.equal(rows.length, dates.length)
  const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  rows.forEach((row, index) => {
    const cells = nodes(row).filter(node => node.type === 'td')
    assert.equal(cells.length, 2)
    alternatives.forEach((item, column) => assert.equal(text(cells[column]), brl(item.result.parcelas.find(p => p.vencimento === dates[index]).parcela)))
  })
  for (const title of ['Dados básicos da operação', 'Histórico dos indexadores', 'Memória completa do fluxo']) assert.ok(nodes(render.value).some(node => node.props?.title === title), title)
  // Na comparação, a composição do custo fica na tabela principal: o quadro separado não se repete.
  assert.equal(nodes(render.value).some(node => node.props?.title === 'Composição do resultado'), false)
})

test('cotação destaca taxa final e CET anual e mensal, reutilizando resultados', async t => {
  const { render, change, simulation } = await setup(t)
  const { nf, nbr5891 } = await import('../src/format.js')
  const pct = (value, decimals) => `${nf(nbr5891(value, decimals), decimals)}%`
  const row = label => nodes(render.value).find(node => node.type === 'tr' && nodes(node).some(child => child.type === 'th' && text(child).trim().startsWith(label)))
  const initial = simulation().result
  assert.ok(text(row('Taxa final')).includes(pct(initial.taxa, 2) + ' a.a.'))
  assert.ok(text(row('Taxa final')).includes(pct(initial.taxaMensal, 3) + ' a.m.'))
  const cetRow = text(row('CET estimado'))
  assert.match(cetRow, /a\.a\. · .*a\.m\./)
  // Mesmos valores mensais já presentes no detalhamento, agora no resumo.
  const cetDetail = nodes(render.value).find(node => node.props?.className === 'fm-kpi' && text(node).startsWith('CET estimado'))
  const monthly = cetRow.match(/· (.+? a\.m\.)/)[1]
  assert.ok(text(cetDetail).includes(monthly))
  await change('fm-compare', true)
  for (const alternative of simulation().comparison.alternatives) {
    assert.ok(text(row('Taxa final')).includes(pct(alternative.result.taxaMensal, 3) + ' a.m.'))
    assert.ok(text(row('Taxa final')).includes(pct(alternative.result.taxa, 2) + ' a.a.'))
  }
  assert.equal((text(row('CET estimado')).match(/a\.m\./g) || []).length, 2)
})
