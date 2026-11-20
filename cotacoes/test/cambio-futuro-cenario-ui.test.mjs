import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { hookRenderer } from './helpers/hooks.mjs'
import { simularParcelasCambiais } from '../src/cambioFuturoCenario.js'

const require = createRequire(import.meta.url)
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : []
const text = node => Array.isArray(node) ? node.map(text).join(' ') : node?.props ? text(node.props.children) : ['number', 'string'].includes(typeof node) ? String(node) : ''
const { code } = await transform(await readFile(new URL('../src/CambioFuturoCenario.jsx', import.meta.url), 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' })

async function setup(t, quote = {}) {
  const calls = []
  const deps = {
    './CalculatorStandard.css': {}, './CambioFuturo.css': {}, './CambioFuturoCenario.css': {},
    './CalcBack.jsx': () => null, './CalculatorHelp.jsx': () => null, './Flag.jsx': () => null,
    './HistoryChart.jsx': { Plot: () => null, useWidth: () => [null, 320] },
    './CambioFuturo.jsx': { ReferenciaMesa: () => null },
    './cdiDolar.js': await import('../src/cdiDolar.js'), './moneyInput.js': await import('../src/moneyInput.js'),
    './marketReturns.js': await import('../src/marketReturns.js'),
    './cambioFuturoSpot.js': { spotDayPlan: now => ({ now }) },
    './useHistory.js': { useCentralDaily: () => ({ status: 'error', data: null }) },
    './cambioFuturoMoedaCruzada.mjs': await import('../src/cambioFuturoMoedaCruzada.mjs'),
    './cambioFuturoCenario.js': { ...await import('../src/cambioFuturoCenario.js'), simularParcelasCambiais: input => { calls.push(input); return simularParcelasCambiais(input) } },
  }
  const DateFixture = class extends Date { static now() { return Date.parse('2026-11-20T02:30Z') } }
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, Date: DateFixture, window: { confirm: () => true }, require: name => deps[name] ?? require(name) })
  const ui = hookRenderer(() => module.exports.default({ onBack() {}, quotes: quote }))
  t.after(() => ui.close())
  await ui.settle()
  const find = pred => nodes(ui.value).find(pred)
  const field = id => find(n => n.type?.name === 'Input' && n.props.id === 'cf-c-' + id)?.props
  const change = async (id, value) => { field(id).change(value); await ui.settle() }
  const clickCount = async count => { find(n => n.type === 'button' && n.props.children === count).props.onClick(); await ui.settle() }
  const total = id => text(find(n => n.props.id === 'cf-c-' + id))
  return { ui, find, field, change, clickCount, total, calls, historico: module.exports.historicoCenario }
}

test('três parcelas independentes e totais nominais, sem preencher cenário com referência do mercado', async t => {
  const ui = await setup(t, { EUR: { bid: 6.551 } })
  assert.equal(ui.field('inicio').value, '2026-11-19', 'data inicial em São Paulo, não o dia UTC')
  assert.equal(ui.field('p1-cenario').value, '')
  const secondary = ui.find(n => n.props.className === 'cf-c-secondary')
  const legacy = nodes(secondary).find(n => n.type === 'a')
  assert.equal(legacy.props.href, '#calculadora/cambio-futuro/tir-usd')
  assert.equal(text(legacy), 'Simular TIR da parcela em USD')
  assert.match(text(ui.ui.value), /descontados os custos iniciais.*Custos de parcela são pagos no vencimento.*não estão na cotação nem no valor líquido/)
  await ui.clickCount(3)
  await ui.change('inicio', '2026-11-20')
  for (const [i, date, taxa] of [[1, '2027-05-20', '6,55'], [2, '2027-08-20', '6,60'], [3, '2027-11-20', '6,65']]) {
    await ui.change(`p${i}-data`, date)
    await ui.change(`p${i}-valor`, '10.000,00')
    await ui.change(`p${i}-trava`, taxa)
  }
  assert.match(ui.total('total-trava'), /198\.000,00/)
  assert.equal(ui.total('total-cenario'), '—')
  assert.equal(ui.total('diferenca'), '—')
  for (const [i, taxa] of [[1, '6,70'], [2, '6,80'], [3, '6,75']]) await ui.change(`p${i}-cenario`, taxa)
  assert.match(ui.total('total-cenario'), /202\.500,00/)
  assert.match(ui.total('diferenca'), /4\.500,00/)
  assert.match(text(ui.ui.value), /Economia neste cenário.*A trava dá previsibilidade/)
  assert.deepEqual(Array.from(ui.calls.at(-1).parcelas, p => p.id), ['p1', 'p2', 'p3'])
  assert.equal(nodes(ui.ui.value).filter(n => n.type === 'details').every(n => n.props.open === undefined), true)
  await ui.change('p2-data', '2027-08-21')
  assert.equal(ui.field('p2-cenario').value, '')
  assert.equal(ui.field('p2-trava').value, '')
  assert.equal(ui.field('p2-valor').value, '10.000,00')
  assert.equal(ui.field('p3-cenario').value, '6,75')
  assert.equal(ui.total('total-trava'), '—')
  await ui.clickCount(2)
  assert.equal(ui.field('p3-data'), undefined)
  await ui.clickCount(3)
  assert.equal(ui.field('p3-cenario').value, '')
  assert.equal(ui.field('p1-cenario').value, '6,70')
  await ui.clickCount(5)
  assert.equal(ui.field('p5-cenario').value, '')
})

test('mudança de moeda apaga valores e tarifas; tarifa inválida não vira zero', async t => {
  const ui = await setup(t)
  await ui.change('p1-data', '2027-05-20')
  await ui.change('p1-valor', '10.000')
  await ui.change('p1-trava', '6,55')
  await ui.change('p1-cenario', '6,65')
  await ui.change('p1-tarifa-trava', 'incorreto')
  assert.equal(ui.total('total-trava'), '—')
  assert.match(ui.total('total-cenario'), /66\.500,00/)
  assert.ok(ui.field('p1-tarifa-trava').error)
  await ui.change('p1-tarifa-trava', '50')
  assert.match(ui.total('total-trava'), /65\.550,00/)
  const select = ui.find(n => n.type === 'select')
  select.props.onChange({ target: { value: 'CNH' } })
  await ui.ui.settle()
  assert.equal(ui.field('p1-data').value, '2027-05-20')
  for (const key of ['valor', 'trava', 'cenario', 'tarifa-trava']) assert.equal(ui.field('p1-' + key).value, '')
  assert.match(ui.field('p1-valor').label, /CNH/)
  assert.equal(ui.total('total-trava'), '—')
})

test('gráfico aceita só série da moeda selecionada, dias encerrados, sem inventar pontos', async t => {
  const ui = await setup(t)
  const point = (t, bid) => ({ t: Date.parse(t + 'T15:00:00Z'), bid })
  const eur = [point('2026-08-25', 6.4), point('2026-11-07', 6.6), point('2026-11-19', 6.5), point('2026-11-20', 6.7), point('2026-11-18', 0)]
  const file = { source: 'AwesomeAPI', series: { EUR: { source: 'EUR', points: eur }, CNH: { source: 'CNY', points: [point('2026-11-18', .8)] } } }
  assert.deepEqual(Array.from(ui.historico(file, 'EUR', 30, '2026-11-20')), [eur[1], eur[2]])
  assert.deepEqual(Array.from(ui.historico(file, 'EUR', 90, '2026-11-20')), eur.slice(0, 3))
  assert.equal(ui.historico(file, 'CNH', 90, '2026-11-20').length, 0)
  assert.equal(ui.historico({ ...file, source: 'BCE' }, 'EUR', 90, '2026-11-20').length, 0)
})


test('exemplo só entra por ação explícita, fica rotulado e restaura rascunho sem perdas', async t => {
  const ui = await setup(t)
  const action = label => ui.find(n => n.type === 'button' && n.props['aria-label'] === label)
  const manual = '100,25'
  await ui.change('p1-data', '2028-02-10')
  await ui.change('p1-valor', manual)
  await ui.change('p1-trava', '8,60')
  assert.doesNotMatch(text(ui.ui.value), /Exemplo fictício/)
  assert.equal(action('Gerar exemplo fictício').props['aria-pressed'], false)
  action('Gerar exemplo fictício').props.onClick(); await ui.ui.settle()
  assert.equal(action('Sair do exemplo fictício').props['aria-pressed'], true)
  assert.match(text(ui.ui.value), /Exemplo fictício.*hipotéticos/)
  assert.equal(ui.field('p1-data').value, '2027-05-18')
  assert.match(ui.total('diferenca'), /4\.500,00/)
  await ui.change('p1-valor', '9.000')
  action('Sair do exemplo fictício').props.onClick(); await ui.ui.settle()
  assert.equal(ui.field('p1-data').value, '2028-02-10')
  assert.equal(ui.field('p1-valor').value, manual)
  assert.equal(ui.field('p1-trava').value, '8,60')
  assert.equal(ui.field('p2-data'), undefined)
  assert.doesNotMatch(text(ui.ui.value), /Exemplo fictício/)
})

test('USD padrão, EUR independente: hipotético não entra como trava; custos uma vez após confirmar pernas', async t => {
  const ui = await setup(t)
  const select = id => ui.find(n => n.type === 'select' && n.props.id === 'cf-c-' + id)
  const choose = async(id,value) => {select(id).props.onChange({target:{value}});await ui.ui.settle()}
  assert.equal(select('moeda').props.value,'USD')
  assert.equal(select('trava-moeda').props.value,'USD')
  await ui.change('p1-data','2027-05-20')
  await ui.change('p1-valor','10.000,00')
  await ui.change('p1-cenario','6,65')
  await choose('trava-moeda','EUR')
  assert.equal(ui.field('p1-valor').value,'10.000,00')
  await ui.change('p1-trava','7')
  await ui.change('p1-cross','0,9')
  await choose('p1-cross-status','cenario')
  assert.equal(ui.total('total-trava'),'—')
  assert.match(text(ui.ui.value),/Pagamento hipotético.*63\.000,00/)
  await choose('p1-cross-status','contratada')
  assert.equal(ui.total('total-trava'),'—')
  ui.find(n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({target:{checked:true}})
  await ui.ui.settle()
  assert.match(ui.total('total-trava'),/63\.000,00/)
  await ui.change('p1-tarifa-trava','90')
  assert.match(ui.total('total-trava'),/63\.090,00/)
  await ui.change('p1-valor','11.000,00')
  assert.equal(ui.total('total-trava'),'—')
})
