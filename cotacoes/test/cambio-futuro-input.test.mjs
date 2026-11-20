import test from 'node:test'
import assert from 'node:assert/strict'
import { contarParcelasCf, montarFluxoCf, principalCf, validarVencimentosCf } from '../src/cambioFuturoInput.js'
import { fluxoMoeda, cambioMeta } from '../src/cambioFuturo.js'

const op = { usd: '100.000,00', taxa: '11,20', parcelas: '2', start: '2026-11-20' }
const dados = { cotacao: '6,00', tac: '500,00', dates: ['2027-02-15', '2027-10-14'], futuros: ['6,20', '6,35'] }
test('datas informadas são usadas sem redistribuição e validadas contra desembolso', () => {
  assert.equal(validarVencimentosCf(op.start, dados.dates, 2).ok, true)
  for (const dates of [['2027-02-30', '2027-10-14'], ['2027-02-15'], [op.start, '2027-02-15'], ['2027-02-15', '2027-02-15'], [...dados.dates].reverse()]) {
    assert.equal(validarVencimentosCf(op.start, dates, 2).ok, false)
  }
  assert.equal(validarVencimentosCf(op.start, dados.dates, 61).ok, false)
  assert.equal(validarVencimentosCf(op.start, dados.dates, 2.5).ok, false)
  for (const raw of ['1e1', '0x2', '2.0']) {
    assert.ok(Number.isNaN(contarParcelasCf(raw)))
    assert.equal(montarFluxoCf({ ...op, parcelas: raw }, 'EUR', 5.4, dados).ok, false)
  }
})

test('empréstimo USD é convertido pelo mesmo valor inicial em reais; cotação é obrigatória para outra moeda', () => {
  assert.equal(principalCf(100000, 5.4, 'EUR', 6), 90000)
  assert.equal(principalCf(100000, 5.4, 'CNH', 0.9), 600000)
  assert.equal(principalCf(100000, NaN, 'USD', 5.4), 100000)
  assert.equal(principalCf(100000, NaN, 'EUR', 6), null)
  assert.equal(principalCf(100000, 5.4, 'EUR', 0), null)
})

test('fluxo passa taxa, TAC, datas e câmbios manuais inalterados ao motor', () => {
  const f = montarFluxoCf(op, 'EUR', 5.4, dados)
  assert.deepEqual(f, fluxoMoeda({ valor: 90000, cotacao: 6, taxa: 11.2, tac: 500, start: op.start, dates: dados.dates, futuros: [6.2, 6.35] }))
  assert.deepEqual(f.linhas.map(l => l.saldo), [90000, 45000])
  assert.ok(Number.isFinite(f.tir))
  assert.equal(montarFluxoCf(op, 'EUR', 5.4, { ...dados, futuros: ['6,20', '0'] }).tir, undefined)
  assert.equal(montarFluxoCf(op, 'EUR', 5.4, { ...dados, tac: 'texto' }).ok, false)
  const meta = cambioMeta(f, 20)
  const atingida = montarFluxoCf(op, 'EUR', 5.4, { ...dados, futuros: [String(meta), String(meta)] })
  assert.ok(Math.abs(atingida.tir - 20) < 1e-6)
})

test('USD e TAC usam milhares brasileiros sem alterar cotação e taxa', () => {
  const f = montarFluxoCf({ ...op, usd: '100.000' }, 'EUR', 5.4, { ...dados, tac: '1.000', cotacao: '6.0000' })
  assert.equal(f.valor, 90000)
  assert.equal(f.tac, 1000)
  assert.equal(f.cotacao, 6)
  assert.equal(f.taxa, 11.2)
})
