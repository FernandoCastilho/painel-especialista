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
  const Presentation = () => null
  const deps = { './BndesPresentation.jsx': { __esModule: true, default: Presentation }, react: React, './MoneyInput.jsx': { __esModule: true, default: () => null }, './Estado.jsx': { __esModule: true, default: () => null }, './useHolidays.js': { useHolidays: () => ({ ctx: {} }) }, './glossary.js': await import('../src/glossary.js'), './CalculatorHelp.jsx': { __esModule: true, default: () => null }, './useDataFile.js': { useDataFile: () => ({ status: 'ready', data: { series } }) }, './useMacro.js': { useMacro: () => ({ data: {} }) } }
  for (const name of ['moneyInput', 'emprestimo', 'bndes', 'finameMateriais', 'finameFunding', 'finameResumo', 'format']) deps[`./${name}.js`] = await import(`../src/${name}.js`)
  const source = await readFile(new URL('../src/FinameMateriais.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, require: name => deps[name] ?? require(name) })
  const navigation = []
  const render = hookRenderer(() => module.exports.default({ onBack() {}, onFundingView: view => navigation.push(view) }))
  t.after(() => render.close())
  await render.settle()
  const field = id => nodes(render.value).find(node => node.props?.id === id)
  const hasResult = () => nodes(render.value).some(node => node.props?.className === 'fm-kpi')
  const change = async (id, value) => { field(id).props.onChange({ target: { value, checked: value } }); await render.settle() }
  const presentation = () => nodes(render.value).find(node => node.type === Presentation).props
  const reset = async cost => { nodes(render.value).find(node => node.type === 'button' && text(node).replace(/\s+/g, ' ').trim() === `Usar cotação ${cost}`).props.onClick(); await render.settle() }
  return { render, field, hasResult, change, presentation, reset, navigation }
}

test('FINAME abre com premissas fixas, IOF zero e ECG sempre à vista', async t => {
  const { render, field, hasResult, change, presentation } = await setup(t)
  for (const id of ['fm-finame-eligible', 'fm-sis', 'fm-comp', 'fm-lib', 'fm-fgi-inc', 'fm-iof-fixo', 'fm-iof-diario']) assert.equal(field(id), undefined, id)
  assert.equal(hasResult(), true)
  assert.equal(field('fm-compare').props.checked, false)
  const initial = presentation()
  assert.equal(initial.conditions.sistema, 'sac')
  assert.equal(initial.conditions.composicao, 'capitalizada')
  assert.equal(initial.conditions.liberacao, 90)
  assert.equal(initial.result.iof, 0)
  assert.match(text(render.value), /FINAME/)
  assert.equal(field('fm-rate-tfb'), undefined)
  await change('fm-fgi', true)
  const withFgi = presentation().result
  assert.equal(withFgi.fgi.incorporado, false)
  assert.equal(withFgi.financiado, initial.result.financiado)
  assert.equal(withFgi.juros, initial.result.juros)
  assert.equal(withFgi.primeiraParcela, initial.result.primeiraParcela)
  assert.ok(Math.abs(withFgi.total - initial.result.total - withFgi.fgi.ecg) < 1e-6)
})

test('referências editáveis mudam as duas colunas e reset recupera a cotação', async t => {
  const { field, change, presentation, reset } = await setup(t)
  await change('fm-compare', true)
  assert.ok(field('fm-rate-tfc')); assert.ok(field('fm-rate-tfb'))
  const quoted = presentation().comparison
  assert.equal(quoted.ok, true)
  await change('fm-rate-tfc', '9,5')
  await change('fm-rate-tfb', '10,5')
  const manual = presentation().comparison
  assert.equal(manual.ok, true)
  for (let i = 0; i < 2; i++) assert.notEqual(manual.alternatives[i].result.total, quoted.alternatives[i].result.total)
  assert.equal(presentation().result.total, manual.alternatives[0].result.total)
  await reset('TFC'); await reset('TFB')
  assert.deepEqual(presentation().comparison, quoted)
  await change('fm-compare', false)
  assert.equal(field('fm-rate-tfb'), undefined)
  await change('fm-custo', 'tfb')
  assert.equal(field('fm-rate-tfc'), undefined)
  assert.ok(field('fm-rate-tfb'))
  assert.equal(presentation().conditions.liberacao, 90)
})

test('taxas vazias, negativas e acima de 100 invalidam; zero explícito calcula', async t => {
  const { field, hasResult, change, presentation } = await setup(t)
  for (const invalid of ['', '-1', '100,01', 'abc']) {
    await change('fm-rate-tfc', invalid)
    assert.equal(hasResult(), false, `taxa inválida: ${invalid}`)
  }
  await change('fm-rate-tfc', '0')
  assert.equal(hasResult(), true)
  assert.equal(presentation().conditions.rate.value, 0)
  await change('fm-compare', true)
  await change('fm-rate-tfb', '')
  assert.notEqual(presentation().comparison?.ok, true, 'comparação não usa cotação antiga quando campo está vazio')
  await change('fm-rate-tfb', '0')
  assert.equal(presentation().comparison.ok, true)
  assert.equal(field('fm-rate-tfb').props.value, '0')
})

test('trocar prazo ou porte descarta taxas manuais para não reaproveitar referência incompatível', async t => {
  const { change, presentation } = await setup(t)
  await change('fm-compare', true)
  await change('fm-rate-tfc', '5'); await change('fm-rate-tfb', '6')
  await change('fm-prazo', '72')
  assert.equal(presentation().conditions.rate.value, 10.5)
  await change('fm-prazo', '60')
  assert.equal(presentation().comparison.alternatives[1].rate.value, 12)
  await change('fm-rate-tfc', '5'); await change('fm-rate-tfb', '6')
  await change('fm-porte', '2')
  assert.equal(presentation().conditions.rate.value, 11)
  assert.equal(presentation().comparison.alternatives[1].rate.value, 12)
})

test('taxas manuais não liberam comparação entre datas nem faixas incompatíveis', async t => {
  const { change, presentation } = await setup(t, { TFB_60_90: { points: [['2026-11-05', 12]] } })
  await change('fm-compare', true)
  await change('fm-rate-tfc', '9'); await change('fm-rate-tfb', '9')
  assert.equal(presentation().comparison.ok, false)
  assert.match(presentation().comparison.error, /mesma data/)
  await change('fm-prazo', '36')
  await change('fm-rate-tfc', '9'); await change('fm-rate-tfb', '9')
  assert.equal(presentation().comparison.ok, false)
  assert.match(presentation().comparison.error, /mesma faixa/)
})

test('perfis próprios bloqueiam resultado mensal e retorno preserva condições sem confirmação', async t => {
  const { render, field, hasResult, change, navigation } = await setup(t)
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
    if (cost === 'tlp') {
      const link = nodes(render.value).find(node => node.props?.href === '#calculadora/bndes-tlp-exigivel')
      assert.ok(link)
      let prevented = false
      link.props.onClick({ preventDefault() { prevented = true } })
      assert.equal(prevented, true)
      assert.deepEqual(navigation, ['bndes-tlp-exigivel'])
    }
    await change('fm-custo', 'tfc')
    assert.equal(hasResult(), true)
  }
})
