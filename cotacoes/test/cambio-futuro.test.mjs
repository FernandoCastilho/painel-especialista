import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cambioMeta, fluxoMoeda, vencimentos } from '../src/cambioFuturo.js'

const near = (a, b, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`)

// Planilha de Fernando (19/11/2026), bloco CNH: 362 dias, 7,88% a.a., câmbio futuro 1,0058.
test('reproduz o bloco em yuan da planilha', () => {
  const f = fluxoMoeda({ valor: 667000, cotacao: 0.8814, taxa: 7.88, start: '2026-11-19', dates: ['2027-11-16'], futuros: [1.0058] })
  near(f.brl, 587893.80)
  near(f.linhas[0].juros, 52851.60)
  near(f.linhas[0].parcela, 719851.60)
  near(f.totalBrl, 724026.74)
  near(f.periodo, 23.16)
  // Anualizado em dias corridos/365: um pouco acima do período, porque o prazo é menor que um ano.
  near(f.tir, 23.37, 0.01)
})

test('dólar: juros lineares 360 e parcela em reais pelo câmbio futuro', () => {
  const f = fluxoMoeda({ valor: 100000, cotacao: 5.916, taxa: 11.2, start: '2026-11-13', dates: ['2027-11-09'], futuros: [6.5027] })
  near(f.brl, 591600)
  near(f.linhas[0].juros, 100000 * 0.112 * 361 / 360)
  near(f.totalBrl, f.linhas[0].parcela * 6.5027)
})

test('atingir meta devolve o câmbio que reproduz a TIR', () => {
  const base = { valor: 100000, cotacao: 5.916, taxa: 11.2, tac: 1000, start: '2026-11-13', dates: vencimentos('2026-11-13', '2028-11-13', 4).dates }
  const alvo = cambioMeta(fluxoMoeda(base), 20)
  const f = fluxoMoeda({ ...base, futuros: Array(4).fill(alvo) })
  near(f.tir, 20, 1e-6)
})

test('parcelas: amortização constante, juros sobre o saldo e TIR só com todos os câmbios', () => {
  const { dates } = vencimentos('2026-01-01', '2026-12-27', 2)
  assert.deepEqual(dates, ['2026-06-30', '2026-12-27'])
  const f = fluxoMoeda({ valor: 1000, cotacao: 5, taxa: 10, start: '2026-01-01', dates, futuros: [5.2] })
  assert.equal(f.completo, false)
  near(f.linhas[0].amort, 500)
  near(f.linhas[1].saldo, 500)
  near(f.linhas[1].juros, 500 * 0.1 * 180 / 360)
})

test('valida entradas', () => {
  assert.equal(vencimentos('2026-01-10', '2026-01-01', 1).ok, false)
  assert.equal(vencimentos('2026-01-01', '2026-01-03', 5).ok, false)
  assert.equal(fluxoMoeda({ valor: 100, cotacao: 0, taxa: 1, start: '2026-01-01', dates: ['2026-02-01'] }).ok, false)
  assert.equal(fluxoMoeda({ valor: 100, cotacao: 5, taxa: 1, tac: 600, start: '2026-01-01', dates: ['2026-02-01'] }).ok, false)
})
