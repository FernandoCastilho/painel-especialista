import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { hookRenderer } from './helpers/hooks.mjs'
import * as model from '../src/contaGarantida.js'

const require = createRequire(import.meta.url)
const CalculatorHelp = ({ title, label }) => React.createElement('button', { type: 'button', 'aria-label': `Ajuda: ${title || label}`, 'aria-expanded': false }, '?')
const nodes = el => Array.isArray(el) ? el.flatMap(nodes) : el && typeof el === 'object' ? [el, ...nodes(el.props?.children)] : []
const textOf = el => Array.isArray(el) ? el.map(textOf).join('') : el && typeof el === 'object' ? el.type === CalculatorHelp || String(el.props?.className ?? '').split(/\s+/).includes('sr-only') ? '' : textOf(el.props?.children) : typeof el === 'string' || typeof el === 'number' ? String(el) : ''
async function setup(t) {
  const deps = { react: React, './ComparativoAlongamento.jsx': () => null, './contaGarantida.js': { ...model, cgInitialForm: () => model.cgInitialForm('2026-11-05') }, './ContaGarantida.css': {}, './CalculatorHelp.jsx': CalculatorHelp }
  for (const file of ['MoneyInput.jsx', 'ContaGarantida.jsx']) {
    const source = await readFile(new URL('../src/' + file, import.meta.url), 'utf8')
    const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
    const module = { exports: {} }
    runInNewContext(code, { module, exports: module.exports, require: name => deps[name] ?? (name === './moneyInput.js' ? { formatMoneyText: value => value } : require(name)) })
    deps['./' + file] = module.exports
  }
  let back = 0
  const render = hookRenderer(() => deps['./ContaGarantida.jsx'].default({ onBack: () => back++ }))
  t.after(() => render.close())
  await render.settle()
  return {
    render,
    text: () => textOf(render.value),
    get back() { return back },
    fields: () => nodes(render.value).filter(node => node.props?.id),
    field: id => nodes(render.value).find(node => node.props?.id === 'cg-' + id),
    button: text => nodes(render.value).find(node => node.type === 'button' && (node.props['aria-label'] || textOf(node)) === text),
    async change(id, value) { const node = this.field(id); assert.ok(node, id); node.props.onChange(typeof node.type === 'function' ? value : { target: { value, checked: value } }); await render.settle() },
    async click(text) { const node = this.button(text); assert.ok(node, text); assert.notEqual(node.props.disabled, true); node.props.onClick(); await render.settle() },
  }
}

test('inicia sem valores presumidos, taxa vazia impede resultado e não oferece capitalização', async t => {
  const h = await setup(t)
  assert.equal(h.field('rate').props.value, '')
  assert.equal(h.field('amount').props.value, '')
  assert.equal(h.field('capitalization'), undefined)
  assert.doesNotMatch(h.text(), /Resultado estimado do período/)
  assert.match(h.text(), /Estimativa para operação adimplente e rotativa/)
  assert.match(h.text(), /Não é extrato nem cotação bancária/)
  assert.match(h.text(), /O CET aparece quando você informa o limite contratado/)
  assert.equal(h.field('limit').props.value, '')
  const help = nodes(h.render.value).find(node => node.type === CalculatorHelp && node.props.title === 'Conta Garantida')
  assert.match(renderToStaticMarkup(help.props.children), /Juros e IOF são pagos à parte, nunca incorporados ao saldo/)
  assert.doesNotMatch(h.text(), /Juros e IOF são pagos à parte, nunca incorporados ao saldo/)
  assert.equal(h.button('Utilização única').props['aria-pressed'], true)
  await h.change('amount', '100.000')
  await h.change('rate', '3')
  assert.match(h.text(), /Resultado estimado do período/)
  assert.match(h.text(), /1\.462,00/)
  await h.change('rate', '')
  assert.doesNotMatch(h.text(), /Resultado estimado do período/)
})

test('trocar modos, editar, adicionar/remover repetidamente e voltar sem efeitos externos', async t => {
  const h = await setup(t)
  await h.change('amount', '100.000')
  await h.change('rate', '3')
  await h.click('Lançamentos por dia')
  assert.equal(h.field('amount'), undefined)
  await h.change('row-first-draw', '10.000')
  await h.click('+ Adicionar lançamento')
  await h.change('row-entry-1-draw', '5.000')
  await h.click('+ Adicionar lançamento')
  await h.change('row-entry-2-payment', '15.000')
  assert.match(h.text(), /Resultado estimado do período/)
  await h.click('Remover lançamento 2')
  assert.match(h.text(), /supera o saldo utilizado/)
  assert.doesNotMatch(h.text(), /Resultado estimado do período/)
  await h.click('Remover lançamento 2')
  assert.equal(h.button('Remover lançamento 1').props.disabled, true)
  await h.click('Utilização única')
  assert.equal(h.field('amount').props.value, '100.000')
  assert.match(h.text(), /1\.462,00/)
  await h.click('‹ Calculadoras')
  assert.equal(h.back, 1)
})

test('prazo por data, erros inline, feriados e IOF automático operam sem resultados antigos', async t => {
  const h = await setup(t)
  await h.change('amount', '1000')
  await h.change('rate', '3')
  await h.change('dateMode', 'end')
  await h.change('end', '2026-11-04')
  assert.equal(h.field('end').props['aria-invalid'], true)
  assert.doesNotMatch(h.text(), /Resultado estimado do período/)
  await h.change('end', '2026-11-15')
  await h.change('dayCount', 'business')
  assert.ok(h.field('holidays'))
  await h.change('holidays', '2026-02-30')
  assert.equal(h.field('holidays').props['aria-invalid'], true)
  assert.doesNotMatch(h.text(), /Resultado estimado do período/)
  await h.change('holidays', '2026-11-09')
  await h.change('taxProfile', 'manual')
  assert.equal(h.field('iofDaily'), undefined)
  assert.equal(h.field('iofAdditional'), undefined)
  assert.doesNotMatch(h.text(), /Resultado estimado do período/)
  await h.change('taxProfile', 'pj')
  assert.match(h.text(), /Resultado estimado do período/)
})

test('Simples exige confirmação e a validação continua rejeitando operação não suportada', async t => {
  const h = await setup(t)
  await h.change('amount', '1000')
  await h.change('rate', '0')
  await h.change('taxProfile', 'simples')
  assert.doesNotMatch(h.text(), /Resultado estimado do período/)
  await h.change('operationValue', '30000')
  await h.change('eligible', true)
  assert.match(h.text(), /Resultado estimado do período/)
  const unsupported = model.parseContaGarantidaForm({ ...model.cgInitialForm('2026-11-05'), amount: '1000', rate: '0', status: 'unsupported' })
  assert.equal(unsupported.result, null)
  assert.match(unsupported.errors.status, /regras próprias/)
})

test('taxa mensal simplificada preserva os encargos de 2% por 10 dias e o enquadramento de IOF', async t => {
  const h = await setup(t)
  for (const id of ['status', 'rateBase', 'conversion']) assert.equal(h.field(id), undefined, id)
  const rateLabel = nodes(h.render.value).find(node => node.type === 'label' && node.props.htmlFor === 'cg-rate')
  assert.equal(textOf(rateLabel), 'Taxa do contrato (% a.m.)')
  assert.equal(h.field('taxProfile').props.value, 'pj')
  assert.equal(h.field('taxProfile').props.children.length, model.CG_TAX_PROFILES.length)
  await h.change('amount', '100.000')
  await h.change('rate', '2')
  await h.change('duration', '10')
  assert.equal(h.field('rate').props.value, '2')
  const original = model.parseContaGarantidaForm({ ...model.cgInitialForm('2026-11-05'), amount: '100.000', rate: '2', duration: '10', rateBase: '30', conversion: 'proportional', status: 'performing' })
  assert.equal(original.result.ok, true)
  const kpis = nodes(h.render.value).find(node => node.props?.className === 'cg-kpis')
  const actual = nodes(kpis).filter(node => node.type === 'b').map(textOf)
  const brl = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  assert.deepEqual(actual, [original.result.totals.interest, original.result.totals.dailyIof, original.result.totals.additionalIof, original.result.totals.cost, original.result.balance, original.result.totals.draw].map(brl))
  assert.equal(actual[0], brl(666.67))
  assert.equal(actual[1], brl(82))
  assert.equal(actual[2], brl(380))
  assert.equal(actual[3], brl(1128.67))
  await h.change('taxProfile', 'simples')
  assert.ok(h.field('operationValue'))
  assert.ok(h.field('eligible'))
  assert.doesNotMatch(h.text(), /Resultado estimado do período/)
})

test('paginação diária e estrutura acessível renderizada sem navegador', async t => {
  const h = await setup(t)
  await h.change('amount', '1000')
  await h.change('rate', '1')
  await h.change('duration', '70')
  assert.match(h.text(), /Página 1 de 3/)
  assert.equal(h.button('Anterior').props.disabled, true)
  await h.click('Próxima')
  await h.click('Próxima')
  assert.match(h.text(), /Página 3 de 3/)
  assert.equal(h.button('Próxima').props.disabled, true)
  await h.change('duration', '10')
  assert.match(h.text(), /Página 1 de 1/)
  const html = renderToStaticMarkup(h.render.value)
  assert.match(html, /aria-label="Tabela diária, role horizontalmente/)
  assert.match(html, /scope="col"/)
  assert.match(html, /scope="row"/)
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1])
  assert.equal(ids.length, new Set(ids).size)
  for (const id of [...html.matchAll(/\bfor="([^"]+)"/g)].map(m => m[1])) assert.ok(ids.includes(id), `label ${id} deve apontar para controle`)
})

test('rota e documento de busca apontam à calculadora certa', async () => {
  const source = await readFile(new URL('../src/Calculadora.jsx', import.meta.url), 'utf8')
  assert.match(source, /id: 'conta-garantida', title: 'Conta Garantida'/)
  assert.match(source, /view === 'conta-garantida'.*<ContaGarantida/)
  const { buildSearchIndex } = await import('../scripts/build-search-index.mjs')
  const index = await buildSearchIndex()
  const entry = index.documents.find(d => d.id === 'page:ContaGarantida.jsx')
  assert.equal(entry.route, 'calculadora/conta-garantida')
  assert.match(entry.body, /amortiza/i)
})

test('CET do art. 6º: sem limite pede o limite; com limite mostra 30 dias ao ano e ao mês, com aviso de conferir a norma', async t => {
  const h = await setup(t)
  await h.change('amount', '100.000')
  await h.change('rate', '3')
  assert.match(h.text(), /Sem CET: informe o limite contratado/)
  assert.doesNotMatch(h.text(), /CET \(art\. 6º · 30 dias sobre o limite\)/)
  await h.change('limit', '100.000')
  // Recálculo independente: limite 100.000 menos IOF adicional de 0,38% na liberação; no 30º dia volta 100.000 + juros 3% × 30/30 + IOF 0,0082% × 30.
  const payment = 100000 + 3000 + 100000 * 0.000082 * 30
  const expected = Math.pow(payment / (100000 - 380), 365 / 30) - 1
  const pct = n => (n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  assert.match(h.text(), /CET \(art\. 6º · 30 dias sobre o limite\)/)
  assert.ok(h.text().includes(`${pct(expected)}% a.a.`), pct(expected))
  assert.ok(h.text().includes(`${pct(Math.pow(1 + expected, 1 / 12) - 1)}% a.m.`))
  assert.equal(pct(expected), '54,49')
  assert.match(h.text(), /Confira no texto da Resolução CMN 4\.881\/2020/)
  // O limite não muda o resultado do período.
  assert.match(h.text(), /1\.462,00/)
  await h.change('limit', '0')
  assert.equal(h.field('limit').props['aria-invalid'], true)
  assert.doesNotMatch(h.text(), /Resultado estimado do período/)
  await h.change('limit', '')
  assert.match(h.text(), /Sem CET: informe o limite contratado/)
})
