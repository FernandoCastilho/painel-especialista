import test from 'node:test'
import assert from 'node:assert/strict'
import { curveFactors, hedge4131, loan4131 } from '../src/emprestimo4131.js'

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`)
// Pagamento único: 01/01/2026 a 01/01/2027 = 365 dias corridos.
const BULLET = { principal: 1e6, rate: 6, spot: 5, start: '2026-01-01', months: 12, freq: 0, irrf: 15, grossUp: true, flat: 0, guarantee: 0 }
const SEMI = { ...BULLET, start: '2026-11-11', months: 24, freq: 6 }
// DI plano em 14% a.a.; cupom subindo de 4% (6 meses) a 6% (3 anos), linear 360.
const DI = [[21, 14], [252, 14], [504, 14], [1260, 14]]
const CC = [[126, 4], [252, 5], [504, 5.5], [756, 6]]

test('comissões ao exterior · IR com gross-up sobre flat (na entrada) e fiança (em cada pagamento)', () => {
  const r = loan4131({ ...BULLET, flat: 1, guarantee: 1, feesAbroad: true })
  const juros = 1e6 * 0.06 * 365 / 360
  const fianca = 1e6 * 0.01 * 365 / 360
  close(r.flatIrUsd, 10000 * 0.15 / 0.85, 1e-6)
  close(r.netUsd, 1e6 - 10000 - 10000 * 0.15 / 0.85, 1e-6)
  close(r.flows[0].irrf, (juros + fianca) * 0.15 / 0.85, 1e-6)
  close(r.allIn, ((1e6 + (juros + fianca) / 0.85) / r.netUsd - 1) * 100, 1e-7)
  // Comissão paga no Brasil: IR só sobre os juros, como antes.
  const local = loan4131({ ...BULLET, flat: 1, guarantee: 1 })
  assert.equal(local.flatIrUsd, 0)
  close(local.flows[0].irrf, juros * 0.15 / 0.85, 1e-6)
  assert.ok(r.allIn > local.allIn)
  // Sem gross-up, o tomador não paga IR nem sobre a comissão.
  const credor = loan4131({ ...BULLET, flat: 1, guarantee: 1, feesAbroad: true, grossUp: false })
  assert.equal(credor.flatIrUsd, 0)
  assert.equal(credor.flows[0].irrf, 0)
})

test('swap · spread sobre o principal (sem custos de entrada) e custo total sobre o líquido', () => {
  const semCusto = hedge4131(loan4131(BULLET), { di: 14, cupom: 5, busDays: () => 252 })
  close(semCusto.swap.runSpread, semCusto.swap.spread, 1e-9)
  close(semCusto.swap.runPctCdi, semCusto.swap.pctCdi, 1e-9)
  const loan = loan4131({ ...BULLET, flat: 2 })
  const h = hedge4131(loan, { di: 14, cupom: 5, busDays: () => 252, swapSpread: 0.5 })
  const fwd = 5 * 1.14 / (1 + 0.05 * 365 / 360)
  const runPre = loan.totals.usd * fwd / (1e6 * 5) * 1.005 - 1
  const pre = loan.totals.usd * fwd / loan.netBrl * 1.005 - 1
  close(h.swap.runPre, runPre * 100, 1e-7)
  close(h.swap.runSpread, ((1 + runPre) / 1.14 - 1) * 100, 1e-7)
  close(h.swap.pre, pre * 100, 1e-7)
  close(h.swap.spread, ((1 + pre) / 1.14 - 1) * 100, 1e-7)
  assert.ok(h.swap.runSpread < h.swap.spread)
  // O spread do swap não muda com o flat: é o mesmo de uma operação sem flat.
  close(h.swap.runSpread, hedge4131(loan4131(BULLET), { di: 14, cupom: 5, busDays: () => 252, swapSpread: 0.5 }).swap.runSpread, 1e-7)
})

test('curvas · no pagamento único, a curva dá o mesmo que digitar o DI e o cupom do vencimento', () => {
  const loan = loan4131(BULLET)
  const curva = hedge4131(loan, { curve: curveFactors({ diPts: DI, ccPts: CC }), busDays: () => 252 })
  const manual = hedge4131(loan, { di: 14, cupom: 5, busDays: () => 252 })
  assert.equal(curva.ok, true)
  assert.equal(curva.source, 'curve')
  assert.equal(manual.source, 'manual')
  close(curva.di, 14, 1e-9)
  close(curva.cupom, 5, 1e-9)
  close(curva.flows[0].forward, manual.flows[0].forward, 1e-12)
  close(curva.swap.spread, manual.swap.spread, 1e-7)
  close(curva.ndf.pre, manual.ndf.pre, 1e-7)
})

test('curvas · cada pagamento usa o cupom do seu prazo; cupom mais baixo no curto encarece o termo', () => {
  const loan = loan4131(SEMI)
  const h = hedge4131(loan, { curve: curveFactors({ diPts: DI, ccPts: CC }) })
  const manual = hedge4131(loan, { di: h.di, cupom: h.cupom })
  h.flows.forEach((f) => {
    // Taxa do cupom no prazo do pagamento, por interpolação linear entre os vértices.
    const taxa = f.du <= 126 ? 4 : f.du <= 252 ? 4 + (f.du - 126) / 126 : f.du <= 504 ? 5 + 0.5 * (f.du - 252) / 252 : 5.5 + 0.5 * (f.du - 504) / 252
    close(f.forward, 5 * 1.14 ** (f.du / 252) / (1 + (taxa / 100) * f.dc / 360), 1e-10)
  })
  // No vencimento os dois coincidem; nos juros intermediários a curva usa cupom menor, logo termo maior.
  close(h.flows.at(-1).forward, manual.flows.at(-1).forward, 1e-9)
  assert.ok(h.flows[0].forward > manual.flows[0].forward)
  assert.ok(h.ndf.totalBrl > manual.ndf.totalBrl)
  // Com DI plano, o spread descontado pela curva é igual ao da fórmula (1 + custo) ÷ (1 + DI) − 1.
  close(h.ndf.spread, ((1 + h.ndf.pre / 100) / 1.14 - 1) * 100, 1e-6)
})

test('curvas · desembolso depois da data-base usa os fatores a termo', () => {
  const f = curveFactors({ diPts: DI, ccPts: CC, d0: 126, dc0: 182 })
  close(f.diFactorAt(126), 1.14 ** 0.5, 1e-12)
  // Cupom a termo: fator até 252 d.u. (5% em 365 dias) sobre o fator até 126 d.u. (4% em 182 dias).
  close(f.cupomFactorAt(126, 183), (1 + 0.05 * 365 / 360) / (1 + 0.04 * 182 / 360), 1e-12)
  // Antes do primeiro vértice vale a taxa dele.
  close(curveFactors({ diPts: DI, ccPts: CC }).cupomFactorAt(63, 91), 1 + 0.04 * 91 / 360, 1e-12)
})

test('curvas · prazo além do último vértice ou curva ausente é recusado, sem extrapolar', () => {
  const longo = loan4131({ ...SEMI, months: 48 })
  const fora = hedge4131(longo, { curve: curveFactors({ diPts: DI, ccPts: CC }) })
  assert.equal(fora.ok, false)
  assert.match(fora.error, /curvas do Painel/)
  assert.equal(hedge4131(loan4131(SEMI), { curve: curveFactors({ diPts: DI, ccPts: [] }) }).ok, false)
  assert.equal(hedge4131(loan4131(SEMI), { curve: curveFactors({ diPts: [], ccPts: CC }) }).ok, false)
  assert.equal(curveFactors({ diPts: DI, ccPts: CC }).cupomFactorAt(900, 1300), null)
})
