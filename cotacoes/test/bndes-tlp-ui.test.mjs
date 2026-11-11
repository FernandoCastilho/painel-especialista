import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { hookRenderer } from './helpers/hooks.mjs'
import * as engine from '../src/bndesTlpExigivel.js'
import * as money from '../src/moneyInput.js'

const require = createRequire(import.meta.url)
const source = (await readFile(new URL('../src/BndesTlpExigivel.jsx', import.meta.url), 'utf8')).replace(/^import ['"].+\.css['"]\s*$/gm, '')
const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
const MoneyInput = () => null
const deps = { './MoneyInput.jsx': { __esModule: true, default: MoneyInput }, './CalculatorHelp.jsx': { __esModule: true, default: () => null }, './moneyInput.js': money, './bndesTlpExigivel.js': engine }
const module = { exports: {} }
runInNewContext(code, { module, exports: module.exports, require: name => deps[name] ?? require(name) })
const nodes = el => Array.isArray(el) ? el.flatMap(nodes) : el && typeof el === 'object' ? [el, ...nodes(el.props?.children)] : []
const text = el => Array.isArray(el) ? el.map(text).join('') : el && typeof el === 'object' ? text(el.props?.children) : typeof el === 'string' || typeof el === 'number' ? String(el) : ''
async function setup(t) {
  const render = hookRenderer(() => module.exports.default({ onBack() {} }))
  t.after(() => render.close()); await render.settle()
  const field = id => nodes(render.value).find(node => node.props?.id === 'tlp-' + id)
  const set = async (id, value) => { const node = field(id); node.props.onChange(node.type === MoneyInput ? value : { target: { value, checked: value } }); await render.settle() }
  const submit = async () => { nodes(render.value).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await render.settle() }
  const rows = () => nodes(render.value).filter(node => node.type === 'tbody').flatMap(node => nodes(node).filter(child => child.type === 'tr'))
  const ready = async () => {
    for (const [id, value] of Object.entries({ amount: '10.000,00', release: '2026-10-15', j: '5', jSource: 'Sintético', bndes: '2', agent: '3', ipca: '4', schedule: '2027-10-15;252;C\n2028-10-16;252;A', scheduleSource: 'Sintético' })) await set(id, value)
    for (const id of ['jConfirmed', 'scenarioConfirmed', 'scheduleConfirmed']) await set(id, true)
    await submit()
  }
  return { field, set, submit, ready, rows, text: () => text(render.value) }
}
test('TLP UI: vazio não calcula, carência não capitaliza IPCA, edição limpa resultado', async t => {
  const h = await setup(t); await h.submit(); assert.equal(h.rows().length, 0)
  await h.ready(); assert.equal(h.rows().length, 2)
  assert.match(text(h.rows()[0]), /10\.000,00/); assert.match(h.text(), /12\.945,10/)
  await h.set('agent', ''); assert.equal(h.rows().length, 0)
  await h.submit(); assert.match(h.text(), /Spread do agente/)
})
test('TLP UI: editar taxa/fonte/calendário revoga confirmação pertinente', async t => {
  const h = await setup(t); await h.ready()
  for (const [field, value, confirmation] of [['j', '6', 'jConfirmed'], ['jSource', 'Outra fonte', 'jConfirmed'], ['ipca', '-10', 'scenarioConfirmed'], ['scheduleSource', 'Outra fonte', 'scheduleConfirmed'], ['release', '2026-10-14', 'scheduleConfirmed'], ['schedule', '2027-10-15;252;A', 'scheduleConfirmed']]) {
    await h.set(confirmation, true); await h.set(field, value)
    assert.equal(h.field(confirmation).props.checked, false)
    assert.equal(h.rows().length, 0)
  }
})
test('TLP UI: IPCA negativo conserva desconto e entrada inválida não conserva cronograma', async t => {
  const h = await setup(t); await h.ready()
  for (const id of ['j', 'bndes', 'agent']) await h.set(id, '0')
  await h.set('ipca', '-10')
  for (const id of ['jConfirmed', 'scenarioConfirmed', 'scheduleConfirmed']) await h.set(id, true)
  await h.submit(); assert.equal(h.rows().length, 2); assert.match(h.text(), /8\.100,00/)
  await h.set('schedule', '2026-02-31;21;A'); await h.set('scheduleConfirmed', true); await h.submit()
  assert.equal(h.rows().length, 0); assert.match(h.text(), /Data civil inválida/)
})
test('TLP UI: mostra CET da parte fixa e custo com IPCA; tarifa opcional só muda o líquido', async t => {
  const h = await setup(t); await h.ready()
  assert.match(h.text(), /CET · parte fixa \(regra do BC\)[\s\S]*?10,28% a\.a\.J \+ spreads, sem IPCA · líquido R\$\s*10\.000,00/)
  assert.match(h.text(), /Custo com IPCA projetado[\s\S]*?14,69% a\.a\.IPCA de 4% a\.a\. no cenário/)
  await h.set('fee', '200,00'); await h.submit()
  assert.equal(h.rows().length, 2); assert.match(h.text(), /12\.945,10/)
  assert.match(h.text(), /líquido R\$\s*9\.800,00/)
  assert.doesNotMatch(h.text(), /10,28% a\.a\./)
  await h.set('fee', '1,2,3'); await h.submit(); assert.equal(h.rows().length, 0); assert.match(h.text(), /Tarifa na liberação: Use o formato brasileiro/)
})
