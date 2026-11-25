import test from 'node:test'
import assert from 'node:assert/strict'
import { numeroPt, cdb, fundo, acoes, cotasCvm } from '../src/investimentos.js'

test('entrada pt-BR: rejeita ponto sem vírgula, sem adivinhar escala', () => {
  for (const v of ['1.234', '12.3', '1e4', '-3']) assert.ok(Number.isNaN(numeroPt(v)))
  assert.equal(numeroPt('1,234'), 1.234)
  assert.equal(numeroPt('1.234,56'), 1234.56)
  assert.equal(numeroPt('1234'), 1234)
  assert.equal(numeroPt('', true), 0)
})
test('CDB: 100% da curva e composição diária a 110%, sem extrapolar', () => {
  const p = { principal: 10000, dataBase: '2026-11-23', vencimento: '2026-11-25', vertices: [[2, 12]] }
  const r = cdb({ ...p, percentual: 100 })
  assert.equal(r.dias, 2)
  assert.ok(Math.abs(r.final - 10000 * 1.12 ** (2 / 252)) < 1e-8)
  const x = cdb({ ...p, percentual: 110 })
  assert.ok(Math.abs(x.final - 10000 * (1 + 1.1 * (1.12 ** (1 / 252) - 1)) ** 2) < 1e-8)
  assert.equal(cdb({ ...p, percentual: 100, vencimento: '2026-11-26' }).ok, false)
  assert.equal(cdb({ ...p, percentual: 100, vencimento: '2026-11-31' }).ok, false)
  assert.equal(cdb({ ...p, percentual: 100, vencimento: '2026-11-28' }).ok, false)
  assert.equal(cdb({ ...p, percentual: 100, vertices: [[2, 12], [2, 13]] }).ok, false)
})
test('fundos: variação de cota; ações: proventos e custos iniciais', () => {
  assert.equal(fundo(10000, 40, 42).final, 10500)
  assert.equal(fundo(10000, 0, 42).ok, false)
  const a = acoes({ quantidade: 10, compra: 10, venda: 9, proventos: 2, custos: 5 })
  assert.equal(a.final, 110); assert.equal(a.ganho, 5); assert.equal(a.retorno, 5 / 105)
  assert.equal(acoes({ quantidade: 1, compra: 10, venda: 0, proventos: 0, custos: 0 }).retorno, -1)
  assert.equal(acoes({ quantidade: 1.5, compra: 10, venda: 0, proventos: 0, custos: 0 }).ok, false)
})
test('CVM: seleciona CNPJ e subclasse exatos e não une série legada', () => {
  const csv='CNPJ_FUNDO_CLASSE;ID_SUBCLASSE;DT_COMPTC;VL_QUOTA\n00.017.024/0001-53;;2026-11-19;45.567871\n00.017.024/0001-53;X;2026-11-14;9\n00.017.024/0001-53;;2026-11-03;45.360755300000'
  const alvo={tipo:'classe',cnpj:'00.017.024/0001-53',sub:''}
  assert.deepEqual(cotasCvm([csv],alvo),[['2026-11-03',45.3607553],['2026-11-19',45.567871]])
  const legado='CNPJ_FUNDO;DT_COMPTC;VL_QUOTA\n00.017.024/0001-53;2026-11-03;70'
  assert.deepEqual(cotasCvm([legado,csv],alvo),cotasCvm([csv],alvo))
  assert.throws(() => cotasCvm([csv + '\n00.017.024/0001-53;;2026-11-03;42'],alvo),/conflitantes/)
})
