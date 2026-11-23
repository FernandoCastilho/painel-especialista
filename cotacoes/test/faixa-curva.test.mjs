// Regra do Fernando (23/11/2026): o gráfico de juros termina no prazo da operação ("se é 48, é 48; se é 12, é 12").
import test from 'node:test'
import assert from 'node:assert/strict'
import { faixaDaCurva, mesesDoPrazoEmDias } from '../src/faixaCurva.js'

test('o fim do gráfico é o prazo digitado', () => {
  assert.deepEqual(faixaDaCurva(48), { de: 12, ate: 48, propria: true })
  assert.deepEqual(faixaDaCurva(12), { de: 0, ate: 12, propria: true })
  assert.deepEqual(faixaDaCurva(84), { de: 12, ate: 84, propria: true })
})

test('prazo em dias vira meses arredondados para cima, no mínimo 1', () => {
  assert.equal(mesesDoPrazoEmDias(10), 1)
  assert.equal(mesesDoPrazoEmDias(30), 1)
  assert.equal(mesesDoPrazoEmDias(31), 2)
  assert.equal(mesesDoPrazoEmDias(365), 13)
  assert.equal(mesesDoPrazoEmDias(0), undefined)
  assert.equal(mesesDoPrazoEmDias(Number.NaN), undefined)
})
