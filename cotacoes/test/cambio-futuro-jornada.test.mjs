import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularCotacaoMesa, quantidadeCotacao, alterarVencimento } from '../src/cambioFuturoJornada.js'

const inicio = '2026-11-16'
const linha = (id = 1, vencimento = '2027-11-16') => ({
  id, vencimento, principal: 100000, juros: 11229.01,
  spotUsd: 5.916, futuroUsd: 6.5027, spotAlvo: 6.4933, futuroAlvo: 7.2529,
})

test('reconcilia principal, juros e liquidação USD da planilha; cruzamento é indicativo', () => {
  const r = calcularCotacaoMesa(inicio, [linha()])
  assert.equal(r.desembolso, 591600)
  assert.equal(r.linhas[0].comJuros, 111229.01)
  assert.equal(r.usd.totalComTravaBrl, 723288.88)
  assert.ok(Math.abs(r.usd.tirComTravaPct - (723288.88 / 591600 - 1) * 100) < .000001)
  assert.ok(r.linhas[0].equivalente > 101000 && r.linhas[0].equivalente < 102000)
  assert.ok(r.alvo.totalComTravaBrl > r.usd.totalComTravaBrl)
})

test('bullet independe de quantidade; parcelado admite um a cinco', () => {
  assert.equal(quantidadeCotacao('bullet', 5), 1)
  assert.equal(quantidadeCotacao('parcelado', 1), 1)
  assert.equal(quantidadeCotacao('parcelado', 5), 5)
})

test('fluxo de cinco vencimentos usa o valor recebido uma vez e não totaliza cotação parcial', () => {
  const linhas = Array.from({ length: 5 }, (_, i) => linha(i + 1, `2027-0${i + 1}-16`))
  const r = calcularCotacaoMesa(inicio, linhas)
  assert.equal(r.desembolso, 2958000)
  assert.equal(r.usd.totalComTravaBrl, 3616444.4)
  assert.ok(r.usd.tirComTravaPct > 0)
  linhas[4].futuroUsd = null
  const p = calcularCotacaoMesa(inicio, linhas)
  assert.equal(p.usd.totalComTravaBrl, null)
  assert.equal(p.usd.tirComTravaPct, null)
  assert.ok(p.alvo.totalComTravaBrl > 0)
})

test('não usa vencimento inválido nem custos ausentes como juros zero', () => {
  for (const l of [{ ...linha(), vencimento: inicio }, { ...linha(), juros: null }]) {
    const r = calcularCotacaoMesa(inicio, [l])
    assert.equal(r.desembolso, null)
    assert.equal(r.usd.totalComTravaBrl, null)
  }
  assert.ok(calcularCotacaoMesa(inicio, [{ ...linha(), juros: 0 }]).desembolso > 0)
})

test('alterar vencimento invalida somente a cotação daquele vencimento', () => {
  const anterior = linha()
  const alterada = alterarVencimento(anterior, '2027-10-01')
  assert.equal(alterada.principal, anterior.principal)
  assert.equal(alterada.juros, anterior.juros)
  for (const k of ['spotUsd','futuroUsd','spotAlvo','futuroAlvo','produtoUsd','produtoAlvo']) assert.equal(alterada[k], '')
  assert.equal(alterarVencimento(anterior, anterior.vencimento), anterior)
})
