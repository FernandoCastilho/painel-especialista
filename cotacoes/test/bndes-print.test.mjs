import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { captureBndesPrint, BNDES_PRINT_NOTICE } from '../src/bndesPrint.js'
import { simular, vencimentoDia15 } from '../src/finameMateriais.js'
import { compareFinameFunding, finameSimulationParams } from '../src/finameFunding.js'

const params = finameSimulationParams({ valor: 2000000, participacao: 80, prazo: 60, carencia: 12, custo: 'tfc', custoFinanceiro: 12, taxaBndes: 1.25, taxaAgente: 3, periodicidade: 3, tac: 2600, fgi: { percentual: 80, periodos: 60, incorporar: false } })
const quotes = { tfc: { data: '2026-11-06', valor: 12, codigo: 'C03' }, tfb: { data: '2026-11-06', valor: 13, codigo: 'TFB_60_90' } }
const input = (compareRequested = true) => ({ result: simular(params), comparison: compareFinameFunding(params, quotes), conditions: { ...params, quote: quotes.tfc, rate: { value: 12, manual: false }, finameEligible: true, porte: 'MPME · demais regiões', periodicidade: 'Trimestral', retained: true, rulesDate: '2026-11-04' }, compareRequested, releaseDate: new Date(2026, 10, 10, 12), holidayCtx: {} })

test('PDF congela todos os meses das duas alternativas e não recalcula valores', () => {
  const original = input(), before = structuredClone(original)
  const snapshot = captureBndesPrint(original, 1794078000000)
  assert.ok(snapshot)
  assert.deepEqual(original, before)
  assert.equal(snapshot.choices.length, 2)
  assert.equal(snapshot.notice, BNDES_PRINT_NOTICE)
  assert.equal(snapshot.releaseDate, '2026-11-10')
  for (const [i, choice] of snapshot.choices.entries()) {
    assert.equal(choice.schedule.length, 60)
    assert.deepEqual(choice.result, original.comparison.alternatives[i].result)
    assert.equal(choice.schedule.filter(row => row.carencia).length, 12)
    for (const row of choice.schedule) {
      assert.equal(row.pago, choice.result.parcelas[row.mes - 1].pago)
      assert.equal(row.date.split('-').reverse().join('/'), vencimentoDia15(original.releaseDate, row.mes, {}).toLocaleDateString('pt-BR'))
    }
    assert.equal(choice.schedule.at(-1).saldo, 0)
    assert.equal(choice.upfront, choice.result.tac + choice.result.fgi.ecg + choice.result.iofFixo)
    assert.ok(Math.abs(choice.schedule.reduce((sum, row) => sum + row.pago, 0) + choice.upfront - choice.result.total) < .005)
  }
  original.result.total = 0
  assert.notEqual(snapshot.result.total, 0)
  assert.throws(() => { snapshot.choices[0].schedule[0].pago = 1 }, TypeError)
})

test('comparação inválida não vira relatório simples silenciosamente; modo simples é explícito', () => {
  const source = input(); source.comparison = { ok: false, error: 'Datas diferentes' }
  assert.equal(captureBndesPrint(source), null)
  source.compareRequested = false
  assert.equal(captureBndesPrint(source).choices.length, 1)
  const selected = input(false)
  assert.equal(captureBndesPrint(selected).choices.length, 1, 'não imprime alternativa não solicitada')
})

test('PDF recusa resultado incompleto, cronograma truncado ou número inválido', () => {
  for (const edit of [source => { source.result = null }, source => { source.releaseDate = new Date(NaN) }, source => { source.result.parcelas.pop() }, source => { source.result.parcelas[0].pago = NaN }, source => { source.result.ultimaParcela = Infinity }, source => { source.result.fgi.ecg = NaN }]) {
    const source = input(false); edit(source); assert.equal(captureBndesPrint(source), null)
  }
  const source = input(); source.comparison.alternatives[1].result.parcelas.pop(); assert.equal(captureBndesPrint(source), null)
})

test('taxas manuais e fontes indisponíveis são explícitas; guarda alerta de referência retida', () => {
  const source = input(false)
  source.conditions.quote = null
  source.conditions.rate = { value: 12, manual: true }
  const snapshot = captureBndesPrint(source)
  assert.ok(snapshot)
  assert.equal(snapshot.choices[0].quote, null)
  assert.equal(snapshot.choices[0].rate.manual, true)
  assert.equal(snapshot.conditions.retained, true)
  assert.equal(snapshot.result.fgi.incorporado, false)
  assert.equal(snapshot.result.financiado, snapshot.result.liberado)
})

test('84 meses, sem carência, taxa zero e sem FGI não omitem parcelas', () => {
  const source = input(false)
  const changed = { ...params, prazo: 84, carencia: 0, custoFinanceiro: 0, taxaBndes: 0, taxaAgente: 0, fgi: null, tac: 0 }
  source.result = simular(changed)
  source.conditions = { ...source.conditions, ...changed, periodicidade: 'Trimestral', rate: { value: 0, manual: true } }
  const snapshot = captureBndesPrint(source)
  assert.ok(snapshot)
  assert.equal(snapshot.choices[0].schedule.length, 84)
  assert.equal(snapshot.choices[0].schedule.at(-1).saldo, 0)
  assert.equal(snapshot.choices[0].upfront, 0)
})

const require = createRequire(import.meta.url)
async function documentComponent() {
  const { code } = await transform(await readFile(new URL('../src/BndesPrint.jsx', import.meta.url), 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  const deps = { './format.js': await import('../src/format.js'), './bndesPrint.js': { captureBndesPrint }, './BndesPrint.css': {}, './BndesIcon.jsx': { __esModule: true, default: () => null } }
  runInNewContext(code, { module, exports: module.exports, require: name => deps[name] ?? require(name) })
  return module.exports.BndesPrintDocument
}
test('documento renderizado leva operação, avisos e 120 linhas sem elipses ou valores inventados', async () => {
  const Document = await documentComponent(), snapshot = captureBndesPrint(input())
  const html = renderToStaticMarkup(React.createElement(Document, { snapshot }))
  assert.equal((html.match(/class="bnprint-schedule"/g) || []).length, 2)
  assert.equal((html.match(/scope="row">60</g) || []).length, 2)
  assert.equal((html.match(/scope="row">1 \*</g) || []).length, 2)
  for (const label of ['Dados da operação', 'Comparação de resultados', 'Premissas e limites', 'Cronograma completo', 'Simulador independente', 'Não constitui proposta', 'Não é documento emitido pelo BNDES', 'Referência retida', 'ECG do FGI à vista', 'Liberação hipotética']) assert.ok(html.includes(label), label)
  assert.doesNotMatch(html, /NaN|undefined|Infinity|<img|\.\.\./)
  // Premissas e limites fecham o documento, depois de todos os cronogramas (pedido de 11/11/2026).
  assert.ok(html.indexOf('class="bnprint-premises"') > html.lastIndexOf('class="bnprint-schedule"'), 'premissas depois do último cronograma')
  assert.ok(html.indexOf('</article>') - html.indexOf('class="bnprint-premises"') < html.slice(html.indexOf('class="bnprint-premises"')).length + 1 && !/bnprint-(schedule|comparison|facts)/.test(html.slice(html.indexOf('class="bnprint-premises"') + 10)), 'nada além das premissas até o fim')
  const source = input(false); source.conditions.quote = null; source.conditions.rate.manual = true
  const manual = renderToStaticMarkup(React.createElement(Document, { snapshot: captureBndesPrint(source) }))
  assert.match(manual, /TAXA MANUAL/)
  assert.match(manual, /Cotação publicada indisponível/)
  const noGrace = input(false); noGrace.conditions.carencia = 0; noGrace.result = simular({ ...params, carencia: 0 }); noGrace.conditions = { ...noGrace.conditions, carencia: 0 }
  const noGraceHtml = renderToStaticMarkup(React.createElement(Document, { snapshot: captureBndesPrint(noGrace) }))
  assert.doesNotMatch(noGraceHtml, /Há cobranças anteriores de juros durante a carência/)
})
