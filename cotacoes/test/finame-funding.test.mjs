import assert from 'node:assert/strict'
import test from 'node:test'
import { finameFundingAnnualRate, finameFundingOption } from '../src/finameFunding.js'

test('LCD usa a projeção própria e não trata LD1 ou índice 143 como taxa completa', () => {
  const lcd = finameFundingOption('lcd')
  assert.equal(lcd.mode, 'dedicated')
  assert.equal(lcd.calculatorId, 'bndes-selic-lcd')
  for (const id of ['lcd', 'LD1', '143']) {
    assert.equal(finameFundingAnnualRate(id, { lcd: -0.11, LD1: -0.11, 143: 1.256392, tlp: 6 }), null)
  }
})

test('TFBD não calcula com cotação 604 nem reutiliza taxa anterior ao trocar de modalidade', () => {
  const quotes = { tfc: 13, tfb: 14, tlp: 6, tfbd: 5, 604: 5.5 }
  assert.equal(finameFundingAnnualRate('tfc', quotes), 13)
  assert.equal(finameFundingAnnualRate('tfbd', quotes), null)
  assert.equal(finameFundingAnnualRate('604', quotes), null)
  assert.equal(finameFundingOption('tfbd').mode, 'unavailable')
  assert.deepEqual(finameFundingOption('tfbd').referenceCodes, ['TD1', 'TD2', 'TD3', '604'])
})

test('perfis existentes aceitam zero explícito e recusam ausência, string e taxa inválida', () => {
  for (const id of ['tfc', 'tfb']) {
    assert.equal(finameFundingAnnualRate(id, { [id]: 0 }), 0)
    assert.equal(finameFundingAnnualRate(id, { [id]: 6.5 }), 6.5)
    for (const value of [null, undefined, '', '6.5', NaN, Infinity, -1, 101]) {
      assert.equal(finameFundingAnnualRate(id, { [id]: value }), null)
    }
  }
})


test('TLP exigível tem motor próprio e nunca reutiliza o cronograma capitalizado', () => {
  assert.equal(finameFundingOption('tlp').mode, 'dedicated')
  assert.equal(finameFundingOption('tlp').calculatorId, 'bndes-tlp-exigivel')
  assert.equal(finameFundingAnnualRate('tlp', { tlp: 8.12 }), null)
})

import { compareFinameFunding, resolveFinameRate, finameSimulationParams } from '../src/finameFunding.js'
import { simular } from '../src/finameMateriais.js'
const params = { valor: 500000, participacao: 100, prazo: 60, carencia: 12, custo: 'tfc', custoFinanceiro: 12, liberacao: 90, taxaBndes: 1.25, taxaAgente: 3, periodicidade: 3, tac: 2600 }
const quotes = { tfc: { valor: 12, data: '2026-11-06', codigo: 'C03' }, tfb: { valor: 13, data: '2026-11-06', codigo: 'TFB_60_90' } }

test('premissas da tela fixam SAC, taxa capitalizada, 90 dias e ECG à vista sem afetar o motor compartilhado', () => {
  const fixed = finameSimulationParams({ ...params, sistema: 'price', composicao: 'somada', liberacao: 30, iof: { fixed: 1, daily: 1 }, fgi: { percentual: 80, incorporar: true, periodos: 60 } })
  assert.equal(fixed.sistema, 'sac')
  assert.equal(fixed.composicao, 'capitalizada')
  assert.equal(fixed.liberacao, 90)
  assert.deepEqual(fixed.iof, { fixed: 0, daily: 0 })
  assert.equal(fixed.fgi.incorporar, false)
  const withFgi = simular(fixed), withoutFgi = simular({ ...fixed, fgi: null })
  assert.ok(withFgi.ok && withoutFgi.ok)
  assert.equal(withFgi.financiado, withFgi.liberado)
  assert.equal(withFgi.financiado, withoutFgi.financiado)
  assert.equal(withFgi.juros, withoutFgi.juros)
  assert.equal(withFgi.primeiraParcela, withoutFgi.primeiraParcela)
  assert.ok(Math.abs(withFgi.total - withoutFgi.total - withFgi.fgi.ecg) < .005)
  assert.ok(Math.abs(withFgi.taxa - ((1.12 * 1.0125 * 1.03) - 1) * 100) < 1e-10)
})

test('taxa manual valida vazio, limites e zero explícito sem substituir a cotação', () => {
  const original = structuredClone(quotes)
  assert.equal(resolveFinameRate('tfc', quotes.tfc).value, 12)
  assert.equal(resolveFinameRate('tfc', quotes.tfc, '0').value, 0)
  assert.equal(resolveFinameRate('tfc', quotes.tfc, '11,5001').value, 11.5001)
  assert.equal(resolveFinameRate('tfb', null, '9').value, 9)
  for (const value of ['', ' ', '-1', '101', 'NaN', 'Infinity', 'abc']) assert.equal(resolveFinameRate('tfc', quotes.tfc, value).value, null, value)
  assert.equal(resolveFinameRate('tfc', quotes.tfc, null).manual, false)
  assert.deepEqual(quotes, original)
})

test('comparação usa taxas adotadas e preserva cotações, datas e os bloqueios da fonte', () => {
  const fixed = finameSimulationParams(params), original = structuredClone(quotes)
  const comparison = compareFinameFunding(fixed, quotes, { tfc: '10', tfb: '11' })
  assert.ok(comparison.ok)
  assert.deepEqual(comparison.alternatives.map(item => item.rate.value), [10, 11])
  assert.deepEqual(comparison.alternatives.map(item => item.quote.valor), [12, 13])
  assert.equal(comparison.alternatives[0].result.total, simular({ ...fixed, custoFinanceiro: 10 }).total)
  assert.deepEqual(quotes, original)
  assert.equal(compareFinameFunding(fixed, quotes, { tfc: '' }).ok, false)
  assert.equal(compareFinameFunding(fixed, quotes, { tfc: '0', tfb: '0' }).ok, true)
  assert.equal(compareFinameFunding({ ...fixed, prazo: 36 }, quotes, { tfc: '10', tfb: '11' }).ok, false)
  assert.equal(compareFinameFunding(fixed, { ...quotes, tfb: { ...quotes.tfb, data: '2026-11-05' } }, { tfc: '10', tfb: '11' }).ok, false)
  assert.equal(compareFinameFunding({ ...fixed, liberacao: 30 }, quotes).ok, false)
})
