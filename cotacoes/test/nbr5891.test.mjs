import test from 'node:test'
import assert from 'node:assert/strict'
import { nbr5891, cetPct } from '../src/format.js'

// ABNT NBR 5891, exigida pela Res. CMN 4.881/2020, art. 4º, parágrafo único, II, para divulgar o CET com duas casas.
test('NBR 5891: abaixo de meia unidade descarta, acima soma 1, exatamente meia unidade deixa a última casa par', () => {
  assert.equal(nbr5891(21.8657), 21.87)          // excedente maior que meia unidade
  assert.equal(nbr5891(21.8649), 21.86)          // menor que meia unidade
  assert.equal(nbr5891(2.125), 2.12)             // 5 seguido de zeros, anterior par: mantém
  assert.equal(nbr5891(2.135), 2.14)             // 5 seguido de zeros, anterior ímpar: soma 1
  assert.equal(nbr5891(2.1251), 2.13)            // 5 seguido de algarismo diferente de zero: soma 1
  assert.equal(nbr5891(40.665), 40.66); assert.equal(nbr5891(40.675), 40.68)
  assert.equal(cetPct(41.4549), '41,45'); assert.equal(cetPct(41.455), '41,46')
  assert.ok(Number.isNaN(nbr5891(NaN)))
})
