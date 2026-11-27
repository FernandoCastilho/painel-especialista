import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dataColada, lerTabelaMesa, numeroColado } from '../src/cambioFuturoColar.js'
import { calcularFluxoCambio } from '../src/cambioFuturoFluxo.js'

// Trecho A10:H13 da planilha de Fernando (foto de 26/11/2026), como o Excel copia: tabulação, vírgula decimal, ponto de milhar.
const FOTO = [
  '91\t22/02/2027\t25.000,00\t100.000,00\t1.553,77\t517,92\t497,31\t27.569,01',
  '182\t24/05/2027\t25.000,00\t75.000,00\t1.165,33\t388,44\t372,99\t26.926,75',
  '273\t23/08/2027\t25.000,00\t50.000,00\t776,89\t258,96\t248,66\t26.284,50',
  '361\t19/11/2027\t25.000,00\t25.000,00\t375,64\t125,21\t120,23\t25.621,08',
].join('\r\n') + '\r\n'
const BULLET = '361\t09/11/2027\t100.000,00\t100.000,00\t6.676,59\t2.225,57\t2.326,85\t111.229,01'

test('tabela da foto: preenche início, valor, prazos, amortizações e as taxas do cabeçalho', () => {
  const r = lerTabelaMesa(FOTO)
  assert.equal(r.ok, true)
  assert.equal(r.inicio, '2026-11-23')
  assert.equal(r.valorUsd, 100000)
  assert.deepEqual(r.taxas, { externa: 6.1468, ir: 2.0489, local: 1.9674 }) // as do cabeçalho da planilha
  assert.deepEqual(r.parcelas, [91, 182, 273, 361].map(prazo => ({ prazo, amortizacao: 25000 })))
  assert.deepEqual(r.avisos, [])
  // Refeita pela calculadora, a tabela dá as mesmas parcelas da foto.
  const calc = calcularFluxoCambio({ inicio: r.inicio, valorUsd: r.valorUsd, spot: 5.916, taxas: r.taxas, parcelas: r.parcelas })
  assert.deepEqual(calc.linhas.map(l => l.parcela), [27569.01, 26926.75, 26284.50, 25621.08])
})

test('bullet: taxas da planilha e início 13/11/2026', () => {
  const r = lerTabelaMesa('Prazo\tVencimento\tAmortização em USD\n' + BULLET)
  assert.equal(r.ok, true)
  assert.equal(r.inicio, '2026-11-13')
  assert.deepEqual(r.taxas, { externa: 6.6581, ir: 2.2194, local: 2.3204 })
  assert.deepEqual(r.parcelas, [{ prazo: 361, amortizacao: 100000 }])
  assert.deepEqual(r.avisos, [])
})

test('aceita ponto e vírgula, ponto decimal e falta da coluna Parcela', () => {
  const r = lerTabelaMesa('361;09/11/2027;100000.00;100000.00;6676.59;2225.57;2326.85')
  assert.equal(r.ok, true)
  assert.equal(r.taxas.externa, 6.6581)
})

test('avisa quando o colado não bate e recusa o que não dá para usar', () => {
  const errado = lerTabelaMesa(FOTO.replace('1.553,77', '1.600,00').replace('24/05/2027', '25/05/2027'))
  assert.equal(errado.ok, true)
  assert.ok(errado.avisos.some(a => /Linha 2: o vencimento/.test(a)))
  assert.ok(errado.avisos.some(a => /comissão externa colada/.test(a)))
  assert.ok(errado.avisos.some(a => /Linha 1: a parcela colada/.test(a)))
  assert.match(lerTabelaMesa('').erro, /Cole as linhas/)
  assert.match(lerTabelaMesa('Prazo\tVencimento').erro, /Cole as linhas/)
  assert.match(lerTabelaMesa('91,0\t22/02/2027\t1\t1\t0\t0\t0').erro, /prazo "91,0"/)
  assert.equal(lerTabelaMesa('361\t09/11/2027\t100.000,00\t100.000,00\t6.676,59\t2.225,57\t-\t108.902,16').taxas.local, 0)
  assert.match(lerTabelaMesa('361\t09/11/2027\t100.000,00').erro, /7 colunas/)
  assert.match(lerTabelaMesa('182\t24/05/2027\t1\t1\t0\t0\t0\n91\t22/02/2027\t1\t1\t0\t0\t0').erro, /crescentes/)
  assert.match(lerTabelaMesa('91\t31/02/2027\t1\t1\t0\t0\t0').erro, /vencimento/)
  assert.match(lerTabelaMesa(FOTO.replace('25.000,00\t100.000,00', '20.000,00\t100.000,00')).erro, /soma das amortizações/)
  assert.match(lerTabelaMesa(Array.from({ length: 13 }, (_, i) => `${i + 1}\t01/01/2027\t1\t1\t0\t0\t0`).join('\n')).erro, /até 12/)
})

test('números e datas no formato do Excel', () => {
  assert.equal(numeroColado('1.553,77'), 1553.77)
  assert.equal(numeroColado('100.000'), 100000)
  assert.equal(numeroColado('25000.00'), 25000)
  assert.equal(numeroColado(' US$ 1.000,5 '), 1000.5)
  assert.ok(Number.isNaN(numeroColado('abc')))
  assert.ok(Number.isNaN(numeroColado('0.500'))) // não vira 500
  assert.equal(numeroColado('-'), 0) // zero contábil do Excel
  assert.equal(dataColada('9/11/2027'), '2027-11-09')
  assert.equal(dataColada('2027-11-09'), '2027-11-09')
  assert.equal(dataColada('31/02/2027'), null)
})
