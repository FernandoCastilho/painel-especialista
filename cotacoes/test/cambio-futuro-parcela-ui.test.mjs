import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { hookRenderer } from './helpers/hooks.mjs'

const require = createRequire(import.meta.url)
const nodes = el => Array.isArray(el) ? el.flatMap(nodes) : el?.props ? [el, ...nodes(el.props.children)] : []
const text = el => Array.isArray(el) ? el.map(text).join(' ') : el?.props ? text(el.props.children) : typeof el === 'string' ? el : ''

test('parcela única: formulário da mesa só em CNH/EUR e resultado independente por moeda', async t => {
  const calls = []
  let dia = '2026-11-20'
  const deps = {
    './CalculatorStandard.css': {}, './CambioFuturo.css': {},
    './CalculatorHelp.jsx': () => null, './CalcBack.jsx': () => null,
    './cdiDolar.js': await import('../src/cdiDolar.js'),
    './moneyInput.js': await import('../src/moneyInput.js'),
    './marketReturns.js': { marketDate: () => dia },
    './cambioFuturoParcela.js': { simularParcelaCambial(args) {
      calls.push(args)
      return { ok: true, tir: args.futuroMoeda == null ? null : 12.34, parcelaMoeda: 3698.25, pagamentoBrl: args.futuroMoeda == null ? null : 4500, recebidoBrl: 4000 }
    } },
  }
  const module = { exports: {} }
  const { code } = await transform(await readFile(new URL('../src/CambioFuturo.jsx', import.meta.url), 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  runInNewContext(code, { module, exports: module.exports, require: name => deps[name] ?? require(name) })
  const ui = hookRenderer(() => module.exports.default({ onBack() {} }))
  t.after(() => ui.close())
  await ui.settle()
  const field = id => nodes(ui.value).find(n => n.props.id === id && n.type?.name === 'Campo')
  const change = async (id, value) => { field('cf-' + id).props.onChange(value); await ui.settle() }
  assert.deepEqual(nodes(ui.value).filter(n => n.type?.name === 'Campo').map(n => n.props.id), [
    'cf-valor', 'cf-vencimento', 'cf-cotacao', 'cf-taxa', 'cf-CNH-cotacao', 'cf-CNH-futuro', 'cf-EUR-cotacao', 'cf-EUR-futuro',
  ])
  assert.doesNotMatch(text(ui.value), /Fluxo de caixa por vencimento|Vencimento final/)
  assert.match(text(ui.value), /Data-base da simulação:\s+20\/11\/2026/)
  assert.equal(calls.length, 0)
  for (const [id, value] of Object.entries({ valor: '100.000', vencimento: '2027-03-25', cotacao: '5,50', taxa: '10,00', 'EUR-cotacao': '6,00', 'EUR-futuro': '6,25' })) await change(id, value)
  assert.equal(calls.length, 2)
  assert.equal(calls[0].futuroMoeda, undefined)
  assert.deepEqual({ ...calls[1] }, { parcelaUsd: 100000, spotUsd: 5.5, taxaPct: 10, start: '2026-11-20', vencimento: '2027-03-25', spotMoeda: 6, futuroMoeda: 6.25 })
  const resultado = id => nodes(ui.value).find(n => n.type === 'section' && n.props['aria-labelledby'] === 'cf-resultado-' + id)
  assert.match(text(resultado('EUR')), /25\/03\/2027.*3\.698,25.*12,34%/)
  assert.doesNotMatch(text(resultado('CNH')), /12,34%/)
  await change('EUR-futuro', '0')
  assert.match(field('cf-EUR-futuro').props.erro, /maior que zero/)
  assert.doesNotMatch(text(resultado('EUR')), /12,34%/)
  assert.match(text(resultado('EUR')), /3\.698,25/)
  await change('vencimento', '2027-04-25')
  assert.equal(field('cf-EUR-futuro').props.value, '')
  assert.equal(field('cf-EUR-cotacao').props.value, '6,00')
  assert.doesNotMatch(text(resultado('EUR')), /12,34%/)
  await change('EUR-futuro', '6,25')
  assert.match(text(resultado('EUR')), /12,34%/)
  dia = '2026-11-21'
  await change('valor', '105.000')
  assert.match(text(ui.value), /A data-base mudou/)
  for (const id of ['cf-cotacao', 'cf-EUR-cotacao', 'cf-EUR-futuro']) assert.equal(field(id).props.value, '')
  assert.equal(field('cf-valor').props.value, '105.000')
  assert.doesNotMatch(text(resultado('EUR')), /12,34%/)
  await change('EUR-cotacao', '6,10')
  await change('cotacao', '5,55')
  assert.equal(field('cf-EUR-futuro').props.value, '')
  assert.doesNotMatch(text(resultado('EUR')), /12,34%/)
  await change('EUR-futuro', '6,35')
  assert.match(text(resultado('EUR')), /12,34%/)
  assert.equal(calls.at(-1).start, '2026-11-21')
})
