import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { hookRenderer } from './helpers/hooks.mjs'

const require = createRequire(import.meta.url)
const nodes = el => Array.isArray(el) ? el.flatMap(nodes) : el?.props ? [el, ...nodes(el.props.children)] : []
const text = el => Array.isArray(el) ? el.map(text).join('') : el?.props ? text(el.props.children) : typeof el === 'string' ? el : ''

test('entrada em etapas, moedas distintas e TIR por moeda com vencimentos independentes', async t => {
  const deps = {
    './CalculatorStandard.css': {}, './CambioFuturo.css': {},
    './CalculatorHelp.jsx': () => null, './CalcBack.jsx': () => null,
    './moneyInput.js': await import('../src/moneyInput.js'),
    './cdiDolar.js': await import('../src/cdiDolar.js'),
    './cambioFuturo.js': await import('../src/cambioFuturo.js'),
    './cambioFuturoInput.js': await import('../src/cambioFuturoInput.js'),
  }
  const module = { exports: {} }
  const { code } = await transform(await readFile(new URL('../src/CambioFuturo.jsx', import.meta.url), 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  runInNewContext(code, { module, exports: module.exports, require: name => deps[name] ?? require(name) })
  const ui = hookRenderer(() => module.exports.default({ onBack() {} }))
  t.after(() => ui.close())
  await ui.settle()
  const id = name => nodes(ui.value).find(n => n.props.id === name)
  const set = async (name, value) => { id(name).props.onChange({ target: { value } }); await ui.settle() }
  const headings = () => nodes(ui.value).filter(n => n.type === 'h3').map(text)
  assert.deepEqual(headings(), ['1. Operação', 'Resultado em reais'])
  for (const [name, value] of Object.entries({ quantidade: '2', usd: '100.000', taxa: '11,20', parcelas: '2', start: '2026-11-20', 'moeda-0': 'EUR' })) await set('cf-' + name, value)
  assert.ok(id('cf-USD-spot'), 'USD/BRL de referência aparece quando não há quadro USD')
  const usdAlready = nodes(id('cf-moeda-1')).find(n => n.type === 'option' && n.props.value === 'EUR')
  assert.equal(usdAlready.props.disabled, true)
  await set('cf-USD-spot', '5,40')
  await set('cf-EUR-spot', '6,00')
  assert.match(id('cf-principal-0').props.value, /90\.000,00/)
  await set('cf-moeda-1', 'USD')
  assert.equal(nodes(ui.value).filter(n => n.props.id === 'cf-USD-spot').length, 1)
  for (const [name, value] of Object.entries({ 'EUR-data-0': '2027-02-15', 'EUR-data-1': '2027-10-14', 'USD-data-0': '2027-03-15', 'EUR-futuro-0': '6,20' })) await set('cf-' + name, value)
  assert.match(text(ui.value), /Preencha todos os câmbios futuros/)
  await set('cf-EUR-futuro-1', '6,35')
  assert.match(text(ui.value), /TIR em reais \(% a\.a\.\): [\d,]+%/)
  assert.equal(id('cf-USD-data-0').props.value, '2027-03-15')
  await set('cf-quantidade', '1')
  assert.equal(id('cf-USD-data-0'), undefined)
  assert.match(text(ui.value), /TIR em reais \(% a\.a\.\): [\d,]+%/)
  await set('cf-EUR-data-0', '2027-10-14')
  assert.equal(id('cf-EUR-futuro-0').props.value, '')
  assert.match(text(ui.value), /vencimentos devem ser crescentes/)
  await set('cf-EUR-data-1', '2027-02-15')
  assert.equal(id('cf-EUR-futuro-1').props.value, '')
  assert.doesNotMatch(text(ui.value), /TIR em reais \(% a\.a\.\): [\d,]+%/)
  await set('cf-EUR-data-0', '2027-01-15')
  await set('cf-EUR-futuro-0', '6,10')
  await set('cf-EUR-futuro-1', '6,30')
  await set('cf-parcelas', '1')
  id('cf-parcelas').props.onBlur({ target: { value: '1' } })
  await ui.settle()
  await set('cf-parcelas', '2')
  assert.equal(id('cf-EUR-data-1').props.value, '')
  assert.equal(id('cf-EUR-futuro-1').props.value, '')
  assert.doesNotMatch(text(ui.value), /TIR em reais \(% a\.a\.\): [\d,]+%/)
  await set('cf-parcelas', '1e1')
  assert.match(text(ui.value), /número inteiro/)
  assert.equal(id('cf-EUR-data-0'), undefined)

})
