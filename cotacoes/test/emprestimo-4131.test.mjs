import test from 'node:test'
import assert from 'node:assert/strict'
import { addMonthsIso, hedge4131, iofEntrada, irr, loan4131, unhedged4131 } from '../src/emprestimo4131.js'

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`)
// Pagamento único: 01/01/2026 a 01/01/2027 = 365 dias corridos.
const BULLET = { principal: 1e6, rate: 6, spot: 5, start: '2026-01-01', months: 12, freq: 0, irrf: 15, grossUp: true, flat: 0, guarantee: 0 }

test('datas · soma de meses mantém o dia e respeita o fim do mês', () => {
  assert.equal(addMonthsIso('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonthsIso('2026-11-11', 24), '2028-11-11')
  assert.equal(addMonthsIso('2028-02-29', 12), '2029-02-28')
})

test('IOF na entrada · 3,5% até 364 dias de prazo médio e zero acima', () => {
  assert.equal(iofEntrada(364), 3.5)
  assert.equal(iofEntrada(365), 0)
  const curto = loan4131({ ...BULLET, months: 6 })
  assert.equal(curto.avgTermDays, 181)
  assert.equal(curto.iofRate, 3.5)
  close(curto.netUsd, 965000, 1e-6)
  close(curto.netBrl, 4825000, 1e-6)
  assert.equal(loan4131(BULLET).iofRate, 0)
})

test('pagamento único · juros linear 360, gross-up do IR e custo all-in em fórmula fechada', () => {
  const r = loan4131(BULLET)
  assert.equal(r.ok, true)
  assert.equal(r.flows.length, 1)
  assert.equal(r.flows[0].days, 365)
  const juros = 1e6 * 0.06 * 365 / 360
  const ir = juros * 0.15 / 0.85
  close(r.flows[0].interest, juros, 1e-6)
  close(r.flows[0].irrf, ir, 1e-6)
  close(r.totals.usd, 1e6 + juros + ir, 1e-6)
  close(r.grossedRate, 6 / 0.85, 1e-12)
  // Um pagamento em exatamente 1 ano (365/365): all-in = total pago / líquido − 1.
  close(r.allIn, ((1e6 + juros + ir) / 1e6 - 1) * 100, 1e-7)
})

test('sem gross-up o tomador não paga IR; flat reduz o líquido e sobe o custo', () => {
  const semIr = loan4131({ ...BULLET, grossUp: false })
  assert.equal(semIr.flows[0].irrf, 0)
  close(semIr.grossedRate, 6, 1e-12)
  const flat = loan4131({ ...BULLET, grossUp: false, flat: 1 })
  close(flat.netUsd, 990000, 1e-6)
  const juros = 1e6 * 0.06 * 365 / 360
  close(flat.allIn, ((1e6 + juros) / 990000 - 1) * 100, 1e-7)
})

test('juros semestrais · quatro pagamentos, principal só no último, fiança por dias/360', () => {
  const r = loan4131({ ...BULLET, start: '2026-11-11', months: 24, freq: 6, guarantee: 1 })
  assert.deepEqual(r.flows.map((f) => f.date), ['2027-05-11', '2027-11-11', '2028-05-11', '2028-11-11'])
  assert.deepEqual(r.flows.map((f) => f.principal), [0, 0, 0, 1e6])
  assert.equal(r.flows.reduce((s, f) => s + f.days, 0), r.avgTermDays)
  assert.equal(r.flows.at(-1).dc, 731)
  close(r.flows[0].guarantee, 1e6 * 0.01 * 181 / 360, 1e-6)
  close(r.totals.interest, 1e6 * 0.06 * 731 / 360, 1e-6)
  // A taxa encontrada zera o fluxo.
  const y = r.allIn / 100
  close(r.flows.reduce((s, f) => s + f.usd / (1 + y) ** (f.dc / 365), 0), r.netUsd, 1e-3)
})

test('sem proteção · (1 + custo) = (1 + all-in em dólar) × (1 + variação do dólar)', () => {
  const loan = loan4131({ ...BULLET, start: '2026-11-11', months: 24, freq: 6 })
  for (const dep of [-10, 0, 5, 20]) {
    const u = unhedged4131(loan, dep)
    close(u.cost, ((1 + loan.allIn / 100) * (1 + dep / 100) - 1) * 100, 1e-7)
    close(u.fxEnd, 5 * (1 + dep / 100) ** (731 / 365), 1e-9)
  }
  close(unhedged4131(loan, 0).totalBrl, loan.totals.usd * 5, 1e-6)
})

test('proteção · câmbio a termo, custo prefixado e leitura em CDI no pagamento único', () => {
  const loan = loan4131(BULLET)
  const h = hedge4131(loan, { di: 14, cupom: 5, busDays: () => 252 })
  assert.equal(h.ok, true)
  const fwd = 5 * 1.14 / (1 + 0.05 * 365 / 360)
  close(h.flows[0].forward, fwd, 1e-12)
  close(h.flows[0].ndfRate, fwd, 1e-12)
  const pre = loan.totals.usd * fwd / loan.netBrl - 1
  close(h.ndf.pre, pre * 100, 1e-7)
  close(h.swap.pre, pre * 100, 1e-7)
  close(h.swap.spread, ((1 + pre) / 1.14 - 1) * 100, 1e-7)
  close(h.swap.pctCdi, ((1 + pre) ** (1 / 252) - 1) / (1.14 ** (1 / 252) - 1) * 100, 1e-6)
  close(h.ndf.totalBrl, loan.totals.usd * fwd, 1e-6)
  // 252 dias úteis em 365 corridos: o custo em dias corridos/365 coincide com o prefixado.
  close(h.ndf.cost365, h.ndf.pre, 1e-7)
})

test('proteção · spread do swap compõe com o custo; acréscimo do NDF encarece o termo', () => {
  const loan = loan4131({ ...BULLET, start: '2026-11-11', months: 24, freq: 6 })
  const base = hedge4131(loan, { di: 12.75, cupom: 5.2 })
  const cobrado = hedge4131(loan, { di: 12.75, cupom: 5.2, swapSpread: 0.5, ndfMarkup: 1 })
  close(1 + cobrado.swap.pre / 100, (1 + base.swap.pre / 100) * 1.005, 1e-9)
  cobrado.flows.forEach((f, i) => close(f.ndfRate, base.flows[i].forward * 1.01, 1e-12))
  assert.ok(cobrado.ndf.pre > base.ndf.pre)
  // Sem dias úteis informados, a estimativa é dias corridos × 252/365.
  close(base.flows.at(-1).du, 731 * 252 / 365, 1e-9)
  // Curvas iguais e sem acréscimos: swap e NDF saem do mesmo câmbio a termo.
  close(base.swap.pre, base.ndf.pre, 1e-9)
})

test('proteção · no ponto de equilíbrio, ficar sem proteção custa o mesmo que o NDF', () => {
  const loan = loan4131({ ...BULLET, start: '2026-11-11', months: 24, freq: 6, flat: 0.5 })
  const h = hedge4131(loan, { di: 12.75, cupom: 5.2, ndfMarkup: 0.3 })
  close(unhedged4131(loan, h.ndf.breakeven).cost, h.ndf.cost365, 1e-6)
})

test('irr · fluxo sem solução devolve nulo', () => {
  assert.equal(irr([{ v: 100, t: 0 }, { v: 50, t: 1 }]), null)
  close(irr([{ v: 100, t: 0 }, { v: -110, t: 1 }]), 0.1, 1e-12)
})

test('entradas inválidas são recusadas com mensagem', () => {
  assert.equal(loan4131({ ...BULLET, principal: 0 }).ok, false)
  assert.equal(loan4131({ ...BULLET, spot: 0 }).ok, false)
  assert.equal(loan4131({ ...BULLET, months: 1.5 }).ok, false)
  assert.equal(loan4131({ ...BULLET, months: 241 }).ok, false)
  assert.equal(loan4131({ ...BULLET, start: '' }).ok, false)
  assert.equal(loan4131({ ...BULLET, start: '2026-02-30' }).ok, false)
  assert.equal(loan4131({ ...BULLET, start: '0050-01-01' }).ok, false)
  assert.equal(loan4131({ ...BULLET, start: '2028-02-29' }).ok, true)
  assert.equal(loan4131({ ...BULLET, freq: 5 }).ok, false)
  assert.equal(loan4131({ ...BULLET, irrf: 100 }).ok, false)
  assert.equal(loan4131({ ...BULLET, flat: -1 }).ok, false)
  const loan = loan4131(BULLET)
  assert.equal(hedge4131(loan, { di: 0, cupom: 5 }).ok, false)
  assert.equal(hedge4131(loan, { di: 14, cupom: 5, swapSpread: -1 }).ok, false)
  assert.equal(hedge4131({ ok: false }, { di: 14, cupom: 5 }).ok, false)
  assert.equal(unhedged4131(loan, -100).ok, false)
})
