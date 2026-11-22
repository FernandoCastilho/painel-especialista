import assert from 'node:assert/strict'
import test from 'node:test'
import { simularParcelaCambial } from '../src/cambioFuturoParcela.js'
import { marketDate } from '../src/marketReturns.js'

const op = { parcelaUsd: 110_000, spotUsd: 5, taxaPct: 10, start: '2026-01-01', vencimento: '2026-12-27', spotMoeda: 6.25, futuroMoeda: 6.5 }
const close = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-8, `${value} ≠ ${expected}`)

test('EUR: converte a parcela pronta e recupera o principal sem contar juros duas vezes', () => {
  const r = simularParcelaCambial(op)
  assert.equal(r.ok, true)
  assert.equal(r.dias, 360)
  close(r.recebidoBrl, 500_000)
  close(r.parcelaMoeda, 88_000)
  close(r.pagamentoBrl, 572_000)
  close(r.tir, 100 * ((572_000 / 500_000) ** (365 / 360) - 1))
  close(r.recebidoBrl - r.pagamentoBrl / (1 + r.tir / 100) ** (360 / 365), 0)
})

test('CNH: mesma base da operação, só as cotações da mesa mudam', () => {
  const r = simularParcelaCambial({ ...op, spotMoeda: 0.75, futuroMoeda: 0.78 })
  close(r.recebidoBrl, 500_000)
  close(r.parcelaMoeda, 550_000 / 0.75)
  close(r.pagamentoBrl, 572_000)
  close(r.tir, simularParcelaCambial(op).tir)
})

test('cotação igual e taxa zero produzem TIR zero, e apreciação do real pode gerar TIR negativa', () => {
  for (const futuroMoeda of [6.25, 6.0]) {
    const r = simularParcelaCambial({ ...op, taxaPct: 0, futuroMoeda })
    close(r.tir, 100 * ((futuroMoeda / 6.25) ** (365 / 360) - 1))
  }
})

test('sem câmbio futuro preserva parcela convertida, mas não calcula pagamento em reais ou TIR', () => {
  for (const futuroMoeda of [null, NaN, 0, -1]) {
    const r = simularParcelaCambial({ ...op, futuroMoeda })
    assert.equal(r.parcelaMoeda, 88_000)
    assert.equal(r.pagamentoBrl, null)
    assert.equal(r.tir, null)
  }
})

test('datas inválidas, iguais ou passadas e entradas determinantes inválidas são rejeitadas', () => {
  for (const invalido of [{ vencimento: '2026-02-30' }, { vencimento: op.start }, { vencimento: '2025-12-31' }, { start: null },
    { spotUsd: 0 }, { spotMoeda: NaN }, { taxaPct: -0.1 }, { taxaPct: 101 }, { parcelaUsd: Infinity }]) {
    assert.equal(simularParcelaCambial({ ...op, ...invalido }).ok, false, JSON.stringify(invalido))
  }
})

test('preserva sinalização do limite da busca legada para fluxos muito curtos', () => {
  const r = simularParcelaCambial({ ...op, taxaPct: 0, vencimento: '2026-01-02' })
  assert.equal(r.ok, true)
  assert.ok(r.pagamentoBrl > 0)
  assert.equal(r.tir, null)
})

test('hoje respeita São Paulo na troca do dia UTC', () => {
  assert.equal(marketDate(new Date('2026-11-21T02:59:59Z')), '2026-11-20')
  assert.equal(marketDate(new Date('2026-11-21T03:00:00Z')), '2026-11-21')
})
