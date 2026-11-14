import test from 'node:test'
import assert from 'node:assert/strict'
import { finimpCotacao, irAjusteNdf, metaAllIn, prazosIguais } from '../src/finimpCotacao.js'

// Cotação de referência (planilha de FINIMP com NDF, uma parcela de 122 dias). Valores conferidos na planilha.
const base = { valor: 96235.10, spot: 5.5147, start: '2026-11-06', prazos: [122], allIn: 8.7093, externa: 5.4503, irrf: 25, tac: 0, forwards: [5.6522], ptax: [5.5147] }
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} x ${b}`)

test('reproduz a cotação de referência da planilha', () => {
  const r = finimpCotacao(base)
  assert.ok(r.ok)
  const x = r.rows[0]
  near(r.valorBrl, 530707.71, 0.005, 'valor em reais')
  assert.equal(x.vencimento, '2027-03-08')
  assert.equal(x.comExt, 1777.51)
  assert.equal(x.ir, 592.50)
  near(r.irRate, 1.8168, 0.00005, 'taxa do IR')
  near(r.localRate, 1.4422, 0.00005, 'taxa local')
  // A planilha mostra juros de 2.840,35: a all-in dela tem casas além das quatro exibidas (diferença de 1 centavo).
  near(x.juros, 2840.35, 0.011, 'juros total')
  near(x.parcela, 99075.45, 0.011, 'parcela na moeda')
  near(x.parcelaBrl, 559994.26, 0.07, 'parcela em reais')
  near(x.emprestimo, 546371.38, 0.07, 'empréstimo (1)')
  near(x.ajuste, -13622.87, 0.01, 'ajuste bruto (2)')
  assert.equal(x.ajusteLiq, x.ajuste)
  near(x.total, x.parcelaBrl, 1e-6, 'total (3) igual à parcela travada')
  near(r.iofGiro, 7325.89, 0.005, 'economia de IOF')
  assert.equal(r.tir.mes.toFixed(2), '1.33')
  assert.equal(r.giro.mes.toFixed(2), '0.99')
})

test('o total em reais não depende da PTAX do vencimento', () => {
  const a = finimpCotacao(base), b = finimpCotacao({ ...base, ptax: [6.2] })
  near(a.rows[0].total, b.rows[0].total, 1e-6, 'total')
  assert.ok(b.rows[0].ajuste > 0)
  near(b.rows[0].ajusteLiq, b.rows[0].ajuste * (1 - 0.225), 1e-6, 'IR de 22,5% no ajuste positivo')
})

test('parcelas: amortização constante, juros sobre o saldo e a última fecha o principal', () => {
  const r = finimpCotacao({ ...base, valor: 100000, prazos: prazosIguais(360, 3), forwards: [5.6, 5.7, 5.8] })
  assert.deepEqual(r.rows.map((x) => x.dias), [120, 240, 360])
  assert.deepEqual(r.rows.map((x) => x.amort), [33333.33, 33333.33, 33333.34])
  assert.deepEqual(r.rows.map((x) => x.saldo), [100000, 66666.67, 33333.34])
  near(r.rows[1].juros, 66666.67 * 0.087093 * 120 / 360, 0.006, 'juros da 2ª')
  assert.deepEqual(r.rows.map((x) => x.fwd), [5.6, 5.7, 5.8])
  near(r.rows[2].parcelaBrl, r.rows[2].parcela * 5.8, 1e-6, 'parcela em reais da 3ª')
})

test('TAC reduz o valor recebido e sobe a TIR', () => {
  assert.ok(finimpCotacao({ ...base, tac: 5000 }).tir.mes > finimpCotacao(base).tir.mes)
})

test('atingir meta acha a all-in da TIR pedida', () => {
  const m = metaAllIn(base, 'tir', 1.5)
  assert.ok(m.ok)
  near(m.value, 1.5, 0.0005, 'TIR obtida')
  near(finimpCotacao({ ...base, allIn: m.allIn }).tir.mes, 1.5, 0.0005, 'recalculada')
  const g = metaAllIn(base, 'giro', 1.2)
  assert.ok(g.ok)
  near(g.value, 1.2, 0.0005, 'giro')
  assert.equal(metaAllIn(base, 'tir', -5).ok, false)
})

test('comissão local negativa gera aviso e entradas inválidas são recusadas', () => {
  assert.ok(finimpCotacao({ ...base, allIn: 5 }).avisoLocal)
  assert.equal(finimpCotacao({ ...base, valor: 0 }).ok, false)
  assert.equal(finimpCotacao({ ...base, prazos: [100, 90] }).ok, false)
  assert.equal(finimpCotacao({ ...base, forwards: [] }).ok, false)
  assert.equal(finimpCotacao({ ...base, tac: 1e7 }).ok, false)
})

test('tabela regressiva do IR sobre o ajuste', () => {
  assert.deepEqual([180, 181, 360, 361, 720, 721].map(irAjusteNdf), [22.5, 20, 20, 17.5, 17.5, 15])
})
