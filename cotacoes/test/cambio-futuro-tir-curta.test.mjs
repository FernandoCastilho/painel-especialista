import test from 'node:test'
import assert from 'node:assert/strict'
import { fluxoMoeda } from '../src/cambioFuturo.js'
import { simularParcelaCambial } from '../src/cambioFuturoParcela.js'

test('TIR de sete dias preserva dias/365 e sinais mesmo fora da faixa legada', () => {
  for (const future of [5.5, 4.5]) {
    const expected = Math.expm1(Math.log(future / 5) * 365 / 7) * 100
    const flow = fluxoMoeda({ valor: 1000, cotacao: 5, taxa: 0, start: '2026-01-01', dates: ['2026-01-08'], futuros: [future] })
    const single = simularParcelaCambial({ parcelaUsd: 1000, spotUsd: 5, taxaPct: 0, start: '2026-01-01', vencimento: '2026-01-08', spotMoeda: 5, futuroMoeda: future })
    for (const result of [flow, single]) {
      assert.equal(result.ok, true)
      assert.ok(Number.isFinite(result.tir), 'fluxo convencional válido não deixa a taxa vazia')
      assert.ok(Math.abs(result.tir / expected - 1) < 1e-10, `${result.tir} ≠ ${expected}`)
    }
    assert.ok(Math.abs(flow.liquido - flow.totalBrl / (1 + flow.tir / 100) ** (7 / 365)) < 1e-7)
    assert.ok(Math.abs(single.recebidoBrl - single.pagamentoBrl / (1 + single.tir / 100) ** (7 / 365)) < 1e-7)
  }
})