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

async function setup(t, quote = {}, navigator) {
  const calls = []
  const deps = {
    './CalculatorStandard.css': {}, './CambioFuturo.css': {}, './CambioFuturoCenario.css': {},
    './CalcBack.jsx': () => null, './CalculatorHelp.jsx': () => null, './Flag.jsx': () => null,
    './HistoryChart.jsx': { Plot: () => null, useWidth: () => [null, 320] },
    './ReferenciaMesa.jsx': () => null,
    './cdiDolar.js': await import('../src/cdiDolar.js'), './moneyInput.js': await import('../src/moneyInput.js'),
    './marketReturns.js': await import('../src/marketReturns.js'),
    './cambioFuturoSpot.js': { spotDayPlan: now => ({ now }) },
    './useHistory.js': { useCentralDaily: () => ({ status: 'error', data: null }) },
    './cambioFuturoMoedaCruzada.mjs': await import('../src/cambioFuturoMoedaCruzada.mjs'),
    './cambioFuturoCenario.js': { ...await import('../src/cambioFuturoCenario.js'), simularParcelasCambiais: input => { calls.push(input); return simularParcelasCambiais(input) } },
  }
  const DateFixture = class extends Date { static now() { return Date.parse('2026-11-20T02:30Z') } }
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, Date: DateFixture, window: { confirm: () => true }, navigator, require: name => deps[name] ?? require(name) })
  const ui = hookRenderer(() => module.exports.default({ onBack() {}, quotes: quote }))
  t.after(() => ui.close())
  await ui.settle()
  const find = pred => nodes(ui.value).find(pred)
  const field = id => find(n => n.type?.name === 'Input' && n.props.id === 'cf-c-' + id)?.props
  const change = async (id, value) => { field(id).change(value); await ui.settle() }
  const clickCount = async count => { find(n => n.type === 'button' && n.props.children === count).props.onClick(); await ui.settle() }
  const total = id => text(find(n => n.props.id === 'cf-c-' + id))
  return { ui, find, field, change, clickCount, total, calls, historico: module.exports.historicoCenario, components: module.exports, comparado: module.exports.historicoComparado }
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
  assert.match(text(ui.ui.value), /Economia neste cenário/)
  assert.match(ui.find(n => n.type?.name === 'ResumoCliente').props.resumo.aviso, /A trava dá previsibilidade/)
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
  assert.equal(ui.find(n => n.type === 'select' && n.props.id === 'cf-c-moeda').props.value, 'USD')
  assert.equal(ui.find(n => n.type === 'select' && n.props.id === 'cf-c-trava-moeda').props.value, 'CNH')
  for (const i of [1, 2, 3]) assert.equal(ui.field(`p${i}-valor`).value, '100.000,00')
  assert.match(ui.total('total-trava'), /1\.987\.200,00/)
  assert.match(ui.total('total-cenario'), /2\.025\.000,00/)
  assert.match(ui.total('diferenca'), /37\.800,00/)
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
  assert.match(text(ui.ui.value).replace(/\s+/g, ' '), /1\. Converter USD em EUR.*2\. Converter EUR em reais.*Comparação opcional/)
  assert.equal(ui.field('p1-data').compact, false)
  assert.equal(ui.field('p1-valor').compact, false)
  const details = ui.find(n => n.type === 'details' && text(n).includes('Ver detalhes por parcela'))
  assert.equal(details.props.open, undefined)
  assert.ok(nodes(details).some(n => n.props['aria-label'] === 'Resultado cruzado da parcela 1'))
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

test('valores monetários formatam ao sair do campo sem alterar o dado usado no cálculo', async t => {
  const { components } = await setup(t)
  const observed = []
  const render = (value, extra = {}) => hookRenderer(() =>
    components.Input({ id: 'money', label: 'Valor', money: true, value, change: v => observed.push(v), ...extra }))
  const view = render('100000')
  t.after(() => view.close())
  const input = () => nodes(view.value).find(n => n.type === 'input').props
  await view.settle()
  assert.equal(input().value, '100.000,00')
  input().onFocus(); await view.settle()
  assert.equal(input().value, '100000')
  input().onBlur(); await view.settle()
  assert.equal(input().value, '100.000,00')
  assert.deepEqual(observed, [], 'formatar não dispara mudança de valor nem reconfirmações')
  const grande = render('90000000000000,01')
  t.after(() => grande.close())
  await grande.settle()
  assert.equal(nodes(grande.value).find(n => n.type === 'input').props.value, '90.000.000.000.000,01', 'o texto não arredonda os centavos digitados')
  const invalid = render('10,001')
  t.after(() => invalid.close())
  await invalid.settle()
  assert.equal(nodes(invalid.value).find(n => n.type === 'input').props.value, '10,001')
  const rate = render('6,55325', { money: false })
  t.after(() => rate.close())
  await rate.settle()
  assert.equal(nodes(rate.value).find(n => n.type === 'input').props.value, '6,55325')
})

test('resumo ao cliente descreve economia, custo, empate e falta de cotação sem prometer', async t => {
  const { components } = await setup(t)
  const make = (com, sem, dif, extra = {}) => components.resumoClienteCambio({ result: {
    totalComTravaBrl: com, totalSemTravaBrl: sem, diferencaBrl: dif,
  }, code: 'USD', hedge: 'USD', count: 3, exemplo: false, ...extra })
  const economia = make(1980000, 2025000, 45000, { exemplo: true })
  assert.match(economia.texto, /^Exemplo fictício/)
  assert.match(economia.texto, /3 parcelas em USD/)
  assert.match(economia.texto, /a trava reduziria o total em R\$\s45\.000,00/)
  assert.match(economia.texto, /Total com trava: R\$\s1\.980\.000,00/)
  assert.match(economia.texto, /Total sem trava no cenário: R\$\s2\.025\.000,00/)
  assert.match(economia.texto, /não garante economia/)
  assert.match(make(700, 666, -34).texto, /custaria R\$\s34,00 a mais/)
  assert.match(make(666, 666, 0).texto, /seriam iguais/)
  assert.match(make(666, null, null).texto, /Falta completar o cenário sem trava/)
  const cruzado = make(null, 666, null, { hedge: 'CNH' })
  assert.match(cruzado.texto, /revise os dados da trava e confirme as duas cotações/)
  assert.match(cruzado.texto, /Total com trava: não calculado/)
  assert.doesNotMatch(cruzado.texto, /a trava reduziria/)
  assert.equal(make(null, null, null), null)
})

test('copiar leva a explicação e os totais juntos; falha deixa texto selecionável', async t => {
  const copied = []
  const navigator = { clipboard: { writeText: async value => { copied.push(value) } } }
  const { components } = await setup(t, {}, navigator)
  const resumo = components.resumoClienteCambio({ result: {
    totalComTravaBrl: 655000, totalSemTravaBrl: 670000, diferencaBrl: 15000,
  }, code: 'USD', hedge: 'USD', count: 1 })
  const view = hookRenderer(() => components.ResumoCliente({ resumo }))
  t.after(() => view.close())
  await view.settle()
  const click = () => nodes(view.value).find(n => n.type === 'button').props.onClick()
  await click(); await view.settle()
  assert.deepEqual(copied, [resumo.texto])
  assert.match(text(view.value), /Resumo copiado/)
  navigator.clipboard.writeText = async () => { throw new Error('Bloqueado') }
  await click(); await view.settle()
  assert.match(text(view.value), /Não foi possível copiar automaticamente/)
  const field = nodes(view.value).find(n => n.type === 'textarea').props
  assert.equal(field.readOnly, true)
  assert.equal(field.value, resumo.texto)
})

test('comparação parte de 100 nas duas curvas e usa apenas datas em comum em Brasília', async t => {
  const ui = await setup(t)
  const p = (day, bid) => ({ t: Date.parse(day), bid })
  const usd = [p('2026-11-10T19:00Z', 5), p('2026-11-11T19:00Z', 5.50), p('2026-11-13T19:00Z', 5.75)]
  const cnh = [p('2026-11-11T22:00Z', 0.80), p('2026-11-12T22:00Z', 0.81), p('2026-11-14T01:00Z', 0.84)]
  const result = Array.from(ui.comparado(usd, cnh))
  assert.deepEqual(result.map(p => p.data), ['2026-11-11', '2026-11-13'])
  assert.equal(result[0].operacaoIndice, 100)
  assert.equal(result[0].travaIndice, 100)
  assert.ok(Math.abs(result[1].operacaoIndice - 104.5454545454) < 1e-8)
  assert.ok(Math.abs(result[1].travaIndice - 105) < 1e-8)
  assert.equal(result[1].trava, 0.84)
  assert.equal(ui.comparado(usd, cnh.slice(1)).length, 0, 'uma data em comum não cria comparação')
})
