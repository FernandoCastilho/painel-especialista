import test from 'node:test'
import assert from 'node:assert/strict'
import { compareFinameFunding } from '../src/finameFunding.js'
import { simular } from '../src/finameMateriais.js'

const input = { valor: 500000, participacao: 100, prazo: 60, carencia: 12, custo: 'tfc', liberacao: 90, taxaBndes: 1.25, taxaAgente: 3, sistema: 'sac', periodicidade: 3, composicao: 'capitalizada', iof: { fixed: 0, daily: 0 } }
const quotes = { tfc: { data: '2026-11-06', valor: 12 }, tfb: { data: '2026-11-06', valor: 13 } }

test('comparação reproduz os dois motores com entradas comuns, sem duplicar principal ou IOF', () => {
  const r = compareFinameFunding(input, quotes)
  assert.equal(r.ok, true)
  for (const alternative of r.alternatives) {
    const expected = simular({ ...input, custo: alternative.custo, custoFinanceiro: quotes[alternative.custo].valor })
    assert.deepEqual(alternative.result, expected)
    assert.equal(alternative.result.iof, 0)
    assert.equal(alternative.result.financiado, 500000)
    assert.ok(Math.abs(alternative.result.total - alternative.result.financiado - alternative.result.juros) < .01)
  }
  assert.ok(r.totalDifference > 0)
  assert.equal(r.totalDifference, r.alternatives[1].result.total - r.alternatives[0].result.total)
  const equal = compareFinameFunding(input, { ...quotes, tfb: quotes.tfc })
  assert.equal(equal.totalDifference, 0)
})

test('edição recalcula as duas alternativas e preserva os inputs da chamada', () => {
  const original = structuredClone(input)
  const base = compareFinameFunding(input, quotes)
  const doubled = compareFinameFunding({ ...input, valor: 1000000 }, quotes)
  for (let i = 0; i < 2; i++) assert.ok(Math.abs(doubled.alternatives[i].result.total - base.alternatives[i].result.total * 2) < .01)
  assert.deepEqual(input, original)
  assert.equal(compareFinameFunding({ ...input, valor: 0 }, quotes).ok, false)
})

test('bloqueia modalidades, prazos de referência, datas e liberações incompatíveis', () => {
  for (const custo of ['tlp', 'lcd', 'tfbd']) assert.equal(compareFinameFunding({ ...input, custo }, quotes).ok, false)
  for (const prazo of [36, 61, 84]) assert.equal(compareFinameFunding({ ...input, prazo }, quotes).ok, false)
  assert.equal(compareFinameFunding({ ...input, liberacao: 30 }, quotes).ok, false)
  assert.equal(compareFinameFunding(input, { ...quotes, tfb: { ...quotes.tfb, data: '2026-11-05' } }).ok, false)
  assert.equal(compareFinameFunding(input, { ...quotes, tfb: { valor: 13 } }).ok, false)
})

test('referência ausente, textual ou inválida não vira zero; zero explícito é aceito', () => {
  for (const valor of [null, undefined, '13', NaN, Infinity, -1, 101]) assert.equal(compareFinameFunding(input, { ...quotes, tfb: { ...quotes.tfb, valor } }).ok, false)
  assert.equal(compareFinameFunding(input, { ...quotes, tfb: { ...quotes.tfb, valor: 0 } }).ok, true)
})
