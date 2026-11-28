import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { hookRenderer } from './helpers/hooks.mjs'
import * as model from '../src/alongamento.js'
import * as cgModel from '../src/contaGarantida.js'
import * as moneyModel from '../src/moneyInput.js'

const require = createRequire(import.meta.url)
const Help = ({ title }) => React.createElement('button', { type: 'button', 'aria-label': `Ajuda: ${title}`, 'aria-expanded': false }, '?')
const nodes = el => Array.isArray(el) ? el.flatMap(nodes) : el && typeof el === 'object' ? [el, ...nodes(el.props?.children)] : []
const textOf = el => Array.isArray(el) ? el.map(textOf).join('') : el && typeof el === 'object' ? el.type === Help ? '' : textOf(el.props?.children) : typeof el === 'string' || typeof el === 'number' ? String(el) : ''
async function setup(t) {
  const deps = { react: React, './alongamento.js': model, './contaGarantida.js': { ...cgModel, cgToday: () => '2026-11-06' }, './moneyInput.js': moneyModel, './numeroBr.js': await import('../src/numeroBr.js'), './ComparativoAlongamento.css': {}, './CalculatorHelp.jsx': Help, './FluxoPagamentos.jsx': () => null, './ReferenciaMercado.jsx': () => null, './EmailEnvelope.jsx': { EnvelopeEml: () => null }, './contaGarantidaEml.js': await import('../src/contaGarantidaEml.js'), './alongamentoFluxo.js': await import('../src/alongamentoFluxo.js') }
  for (const file of ['MoneyInput.jsx', 'ComparativoAlongamento.jsx']) {
    const source = await readFile(new URL('../src/' + file, import.meta.url), 'utf8')
    const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
    const module = { exports: {} }
    runInNewContext(code, { module, exports: module.exports, require: name => deps[name] ?? require(name) })
    deps['./' + file] = module.exports
  }
  const render = hookRenderer(() => deps['./ComparativoAlongamento.jsx'].default())
  t.after(() => render.close())
  await render.settle()
  return {
    render,
    text: () => textOf(render.value),
    field: (key, prefix = 'along') => nodes(render.value).find(node => node.props?.id === `${prefix}-${key}`),
    button: label => nodes(render.value).find(node => node.type === 'button' && (node.props['aria-label'] || textOf(node)) === label),
    async change(key, value, prefix = 'along') {
      const node = this.field(key, prefix); assert.ok(node, `${prefix}-${key}`)
      node.props.onChange(typeof node.type === 'function' ? value : { target: { value, checked: value } })
      await render.settle()
    },
    async click(label) { const node = this.button(label); assert.ok(node, label); assert.notEqual(node.props.disabled, true); node.props.onClick(); await render.settle() },
    async example(overrides = {}) { for (const [key, value] of Object.entries({ balance: '300.000,00', cgRate: '3', amount: '300.000,00', loanRate: '1,5', n: '36', ...overrides })) await this.change(key, value) },
  }
}

test('amortization choices fit compact labels and preserve the complete accessible explanation', async t => {
  const h = await setup(t)
  const options = nodes(h.field('system')).filter(node => node.type === 'option')
  assert.deepEqual(options.map(node => [node.props.value, textOf(node)]), [['price', 'Price — fixas'], ['sac', 'SAC — decrescentes']])
  for (const value of ['sac', 'price']) { await h.change('system', value); assert.equal(h.field('system').props.value, value) }
  const help = nodes(h.render.value).find(node => node.type === Help && node.props.title === 'Giro parcelado')
  assert.match(renderToStaticMarkup(help.props.children), /Price tem parcelas fixas; SAC tem amortização constante e parcelas decrescentes/)
})

test('comparativo inicia sem ofertas fictícias, sem resultado e com NCG opcional fechada', async t => {
  const h = await setup(t)
  for (const key of ['balance', 'cgRate', 'amount', 'loanRate', 'n', 'cashAvailable']) assert.equal(h.field(key).props.value, '', key)
  assert.equal(h.field('start').props.value, '2026-11-06')
  assert.doesNotMatch(h.text(), /Comparação no mesmo horizonte/)
  assert.match(h.text(), /Preencha os dados da conta garantida e da proposta/)
  assert.equal(h.field('balance').props['aria-invalid'], false)
  const ncg = nodes(h.render.value).find(node => String(node.props?.className || '').includes('along-ncg'))
  assert.equal(ncg.type, 'details')
  assert.notEqual(ncg.props.open, true)
  const warnings = nodes(h.render.value).filter(node => node.props?.className === 'cx-error')
  assert.equal(warnings.length, 0)
})

test('edição real mostra exemplo com IOF, desembolso e saldo devedor separados', async t => {
  const h = await setup(t)
  await h.example()
  assert.match(h.text(), /Comparação no mesmo horizonte/)
  assert.match(h.text(), /10\.845,72/)
  assert.match(h.text(), /Economia estimada de encargos/)
  assert.match(h.text(), /Variação do desembolso mensal/)
  assert.match(h.text(), /Dívida restante ao final/)
  assert.match(h.text(), /IOF \+ tarifa pagos no início/)
  assert.match(h.text(), /Capacidade de pagamento não avaliada/)
  const result = model.parseAlongamentoForm({ ...model.initialAlongamentoForm('2026-11-06'), balance: '300000', cgRate: '3', amount: '300000', loanRate: '1,5', n: '36' }).result
  const summary = nodes(h.render.value).find(node => node.props?.className === 'cx-matrix along-summary')
  const costRow = nodes(summary).find(node => node.type === 'tr' && textOf(node).startsWith('Custo financeiro total'))
  assert.match(textOf(costRow), new RegExp(result.baseline.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replaceAll('.', '\\.')))
})

test('quitação parcial preserva CG residual e caixa zero gera aviso de reutilização', async t => {
  const h = await setup(t)
  await h.example({ amount: '100000' })
  await h.change('cashAvailable', '0')
  assert.match(h.text(), /Comparação no mesmo horizonte/)
  assert.match(h.text(), /200\.000,00/)
  assert.match(h.text(), /Em pelo menos um mês faltam/)
  assert.match(h.text(), /Há risco de reutilizar o limite/)
  assert.match(h.text(), /Verifique também caixa para/)
  await h.change('cashAvailable', '50000')
  assert.match(h.text(), /cabem na sobra informada/)
})

test('invalidar valores remove resultado antigo e corrigir recupera a comparação', async t => {
  const h = await setup(t)
  await h.example()
  for (const [key, bad, fixed] of [['amount', '300000,01', '300000'], ['loanRate', '', '1,5'], ['balance', '300000.00', '300000'], ['start', '2026-02-30', '2026-11-06']]) {
    await h.change(key, bad)
    assert.doesNotMatch(h.text(), /Comparação no mesmo horizonte/, key)
    assert.equal(h.field(key).props['aria-invalid'], true, key)
    await h.change(key, fixed)
    assert.match(h.text(), /Comparação no mesmo horizonte/, key)
  }
})

test('NCG por saldos aceita negativo, zero explícito e independe de preencher a CG', async t => {
  const h = await setup(t)
  await h.change('receivables', '100000', 'ncg')
  await h.change('inventory', '50000', 'ncg')
  await h.change('payables', '200000', 'ncg')
  assert.match(h.text(), /NCG operacional estimada/)
  assert.match(h.text(), /-R\$\s*50\.000,00/)
  assert.doesNotMatch(h.text(), /Comparação no mesmo horizonte/)
  await h.example()
  await h.change('loanRate', '')
  assert.doesNotMatch(h.text(), /Comparação no mesmo horizonte/)
  assert.match(h.text(), /NCG operacional estimada/)
  await h.change('inventory', '', 'ncg')
  assert.doesNotMatch(h.text(), /NCG operacional estimada/)
  await h.change('inventory', '0', 'ncg')
  assert.match(h.text(), /-R\$\s*100\.000,00/)
})

test('NCG por prazos usa vendas, custo e compras próprios e preserva modos', async t => {
  const h = await setup(t)
  await h.change('receivables', '100', 'ncg')
  await h.change('inventory', '0', 'ncg')
  await h.change('payables', '0', 'ncg')
  await h.click('Estimar pelos prazos')
  assert.equal(h.field('receivables', 'ncg'), undefined)
  for (const [key, value] of Object.entries({ sales: '900000', pmr: '60', cost: '600000', pme: '45', purchases: '450000', pmp: '30' })) await h.change(key, value, 'ncg')
  assert.match(h.text(), /2\.250\.000,00/)
  assert.match(h.text(), /Ciclo financeiro: 75 dias/)
  assert.match(h.text(), /não define sozinho quanto contratar/)
  await h.change('pmp', '-1', 'ncg')
  assert.doesNotMatch(h.text(), /NCG operacional estimada/)
  assert.equal(h.field('pmp', 'ncg').props['aria-invalid'], true)
  await h.click('Saldos conhecidos')
  assert.equal(h.field('receivables', 'ncg').props.value, '100')
  assert.match(h.text(), /NCG operacional estimada/)
})

test('taxas e prazos rejeitam percentuais malformados sem mostrar resultados antigos', async t => {
  const h = await setup(t)
  await h.example()
  for (const bad of ['1%5', '%15', '3%%']) {
    await h.change('loanRate', bad)
    assert.doesNotMatch(h.text(), /Comparação no mesmo horizonte/, bad)
    await h.change('loanRate', '1,5%')
    assert.match(h.text(), /Comparação no mesmo horizonte/)
  }
  await h.click('Estimar pelos prazos')
  for (const [key, value] of Object.entries({ sales: '900000', pmr: '60', cost: '600000', pme: '45', purchases: '450000', pmp: '30' })) await h.change(key, value, 'ncg')
  assert.match(h.text(), /NCG operacional estimada/)
  for (const bad of ['1%5', '%15', '3%%', '30%']) {
    await h.change('pmr', bad, 'ncg')
    assert.doesNotMatch(h.text(), /NCG operacional estimada/, bad)
    assert.equal(h.field('pmr', 'ncg').props['aria-invalid'], true)
    await h.change('pmr', '60', 'ncg')
    assert.match(h.text(), /NCG operacional estimada/)
  }
})

test('IOF é automático, com enquadramento Simples confirmado e sem campo de alíquota', async t => {
  const h = await setup(t)
  for (const key of ['iof', 'iofDaily', 'iofAdditional', 'daily', 'additional']) assert.equal(h.field(key), undefined, key)
  await h.example({ balance: '25000', amount: '20000' })
  await h.change('profile', 'simples')
  assert.ok(h.field('operationValueCG'))
  assert.ok(h.field('eligible'))
  assert.doesNotMatch(h.text(), /Comparação no mesmo horizonte/)
  await h.change('operationValueCG', '100000')
  await h.change('eligible', true)
  assert.match(h.text(), /Comparação no mesmo horizonte/)
  await h.change('eligible', false)
  assert.doesNotMatch(h.text(), /Comparação no mesmo horizonte/)
})

test('carência mostra juros capitalizados sem saída mensal e paginação preserva dados', async t => {
  const h = await setup(t)
  await h.example({ graceMonths: '2' })
  const schedule = nodes(h.render.value).find(node => node.props?.className === 'cx-matrix along-schedule')
  const firstRow = nodes(schedule).filter(node => node.type === 'tr')[1]
  assert.match(textOf(firstRow), /Carência/)
  assert.match(textOf(firstRow), /4\.500,00/)
  assert.match(h.text(), /Página 1 de 4/)
  await h.click('Próxima')
  assert.match(h.text(), /Página 2 de 4/)
  await h.change('n', '2')
  assert.match(h.text(), /Página 1 de 1/)
})

test('estrutura renderizada mantém rótulos, cabeçalhos, IDs únicos e ajudas separadas', async t => {
  const h = await setup(t)
  await h.example()
  const html = renderToStaticMarkup(h.render.value)
  assert.match(html, /scope="col"/)
  assert.match(html, /scope="row"/)
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1])
  assert.equal(ids.length, new Set(ids).size)
  for (const id of [...html.matchAll(/\bfor="([^"]+)"/g)].map(m => m[1])) assert.ok(ids.includes(id), id)
  assert.doesNotMatch(h.text(), /Nos prazos, estimamos clientes/)
  const help = nodes(h.render.value).find(node => node.type === Help && node.props.title === 'Diagnóstico de capital de giro')
  assert.match(renderToStaticMarkup(help.props.children), /compras mensais ÷ 30/)
})
