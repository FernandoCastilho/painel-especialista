import assert from 'node:assert/strict'
import test from 'node:test'
import { resumoFundo } from '../src/investmentHistory.js'

test('a ficha usa as mesmas datas para fundo e CDI e compõe a variação do período', () => {
  const resumo = resumoFundo([
    ['2025-11-24', 65], ['2026-05-22', 75], ['2026-08-24', 80],
    ['2026-10-23', 100], ['2026-11-24', 110],
  ], [['2026-08-21', 92], ['2026-08-24', 95], ['2026-10-22', 99], ['2026-10-23', 100], ['2026-11-24', 101]])
  assert.deepEqual(resumo.map(linha => linha.meses), [1, 3, 6, 12])
  assert.equal(resumo[0].inicio, '2026-10-23')
  assert.equal(resumo[0].fim, '2026-11-24')
  assert.ok(Math.abs(resumo[0].fundo - 0.10) < 1e-10)
  assert.ok(Math.abs(resumo[0].cdi - (100 / 99 - 1)) < 1e-10)
  assert.equal(resumo[2].cdi, null)
  assert.ok(Math.abs(resumo[3].fundo - (110 / 65 - 1)) < 1e-10)
})

test('a ficha ajusta fim de mês e sinaliza cota inicial ausente ou distante', () => {
  const [fevereiro] = resumoFundo([['2024-02-29', 100], ['2024-03-31', 110]])
  assert.equal(fevereiro.inicio, '2024-02-29')
  const resumo = resumoFundo([
    ['2025-10-03', 80], ['2026-04-29', 90], ['2026-10-30', 100], ['2026-11-30', 120],
  ])
  assert.equal(resumo[0].inicio, '2026-10-30')
  assert.equal(resumo[1].fundo, null)
  assert.equal(resumo[2].fundo, null)
  assert.equal(resumo[3].fundo, null)
  assert.equal(resumo[0].cdi, null)
})

test('o CDI pode fechar no próximo dia útil sem a taxa da data final', () => {
  const cdi = [['2026-10-22', 100], ['2026-10-23', 101], ['2026-11-20', 102]]
  const [segunda] = resumoFundo([['2026-10-23', 100], ['2026-11-23', 103]], cdi)
  assert.ok(Math.abs(segunda.cdi - 0.02) < 1e-10)
  const [terca] = resumoFundo([['2026-10-23', 100], ['2026-11-24', 103]], cdi)
  assert.equal(terca.cdi, null)
})
