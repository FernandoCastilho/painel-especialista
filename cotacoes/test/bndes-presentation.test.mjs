import test from 'node:test'
import assert from 'node:assert/strict'
import { BNDES_PRESENTATION_NOTICE, buildBndesSlides, captureBndesPresentation, presentationStep } from '../src/bndesPresentation.js'
import { simular } from '../src/finameMateriais.js'
import { compareFinameFunding } from '../src/finameFunding.js'

const params = { valor: 500000, participacao: 100, prazo: 60, carencia: 12, custo: 'tfc', liberacao: 90, taxaBndes: 1.25, taxaAgente: 3, sistema: 'sac', periodicidade: 3, composicao: 'capitalizada', iof: { fixed: 0, daily: 0 } }
const quotes = { tfc: { data: '2026-11-06', valor: 12, codigo: 'C03' }, tfb: { data: '2026-11-06', valor: 13, codigo: 'TFB_60_90' } }
const input = () => ({ result: simular({ ...params, custoFinanceiro: 12 }), comparison: compareFinameFunding(params, quotes), conditions: { ...params, quote: { ...quotes.tfc }, iofConfirmed: true, retained: true, rulesDate: '2026-11-04' } })

test('congela resultado, cronograma, taxas, datas e alertas sem alterar origem', () => {
  const source = input(), original = structuredClone(source)
  const snapshot = captureBndesPresentation(source, 1794078000000)
  assert.ok(snapshot)
  assert.deepEqual(source, original)
  assert.equal(snapshot.conditions.retained, true)
  assert.equal(snapshot.conditions.quote.data, '2026-11-06')
  assert.equal(snapshot.conditions.liberacao, 90)
  assert.equal(snapshot.conditions.composicao, 'capitalizada')
  assert.equal(snapshot.notice, BNDES_PRESENTATION_NOTICE)
  source.result.total = 1
  source.result.parcelas[0].saldo = 1
  source.conditions.quote.valor = 99
  assert.equal(snapshot.result.total, original.result.total)
  assert.equal(snapshot.result.parcelas[0].saldo, original.result.parcelas[0].saldo)
  assert.equal(snapshot.conditions.quote.valor, 12)
  assert.throws(() => { snapshot.result.total = 2 }, TypeError)
})

test('bloqueia captura sem resultado, enquadramento ou referência; nunca inventa zero', () => {
  assert.equal(captureBndesPresentation({ ...input(), result: null }), null)
  const source = input(); source.conditions.iofConfirmed = false
  assert.equal(captureBndesPresentation(source), null)
  source.conditions.iofConfirmed = true; source.conditions.quote = null
  assert.equal(captureBndesPresentation(source), null)
  source.conditions.quote = { ...quotes.tfc, valor: NaN }
  assert.equal(captureBndesPresentation(source), null)
})

test('seleção de slides mantém resultado e limites; comparação exige duas alternativas válidas', () => {
  const snapshot = captureBndesPresentation(input(), 1794078000000)
  const deck = buildBndesSlides(snapshot, { title: '  Proposta ilustrativa  ', mode: 'compare', sections: [], textSize: 'xl' })
  assert.deepEqual(deck.slides, ['results', 'premises'])
  assert.equal(deck.title, 'Proposta ilustrativa')
  assert.equal(deck.textSize, 'xl')
  assert.equal(deck.snapshot, snapshot)
  const simple = captureBndesPresentation({ ...input(), comparison: { ok: false } })
  assert.equal(simple.alternatives.length, 0)
  assert.equal(buildBndesSlides(simple, { mode: 'compare' }), null)
  assert.equal(buildBndesSlides(simple, { textSize: 'invalid' }).textSize, 'normal')
  assert.equal(buildBndesSlides(null), null)
})

test('teclado navega com limites e não trata atalhos desconhecidos como avanço', () => {
  assert.equal(presentationStep(0, 'ArrowLeft', 5), 0)
  assert.equal(presentationStep(4, 'ArrowRight', 5), 4)
  assert.equal(presentationStep(2, 'PageDown', 5), 3)
  assert.equal(presentationStep(2, 'PageUp', 5), 1)
  assert.equal(presentationStep(2, 'Home', 5), 0)
  assert.equal(presentationStep(2, 'End', 5), 4)
  assert.equal(presentationStep(2, ' ', 5), 3)
  assert.equal(presentationStep(2, 'x', 5), 2)
})
