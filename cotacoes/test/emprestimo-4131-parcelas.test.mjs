// Empréstimo externo (4131): principal em parcelas, carência, datas a cada 30 dias, euro e leitura no formato da cotação.
// Números fictícios, com resultado esperado em fórmula fechada ou somado à mão aqui, sem o código do painel.
import test from 'node:test'
import assert from 'node:assert/strict'
import { diDoPrazo, hedge4131, iofGiro4131, loan4131, taxa360 } from '../src/emprestimo4131.js'

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`)
const DAY = 864e5
const dc = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY)
// 12 pagamentos mensais a partir de 15/01/2026, sem IR do tomador e sem comissões.
const MENSAL = { principal: 1.2e6, rate: 6, spot: 5, start: '2026-01-15', months: 12, freq: 1, irrf: 15, grossUp: false, flat: 0, guarantee: 0 }
const DATAS_12 = ['2026-02-15', '2026-03-15', '2026-04-15', '2026-05-15', '2026-06-15', '2026-07-15', '2026-08-15', '2026-09-15', '2026-10-15', '2026-11-15', '2026-12-15', '2027-01-15']

test('parcelas iguais · amortização constante, juros sobre o saldo e total igual ao principal', () => {
  const r = loan4131({ ...MENSAL, amort: 'parcelas' })
  assert.equal(r.ok, true)
  assert.deepEqual(r.flows.map((f) => f.date), DATAS_12)
  let saldo = 1.2e6
  let anterior = MENSAL.start
  let juros = 0
  r.flows.forEach((f) => {
    const dias = dc(anterior, f.date)
    close(f.balance, saldo, 1e-6)
    close(f.principal, 1e5, 1e-6)
    close(f.interest, saldo * 0.06 * dias / 360, 1e-6)
    close(f.usd, 1e5 + saldo * 0.06 * dias / 360, 1e-6)
    juros += saldo * 0.06 * dias / 360
    saldo -= 1e5
    anterior = f.date
  })
  close(r.totals.principal, 1.2e6, 1e-6)
  close(r.totals.interest, juros, 1e-6)
  // Menos juros que no vencimento: o saldo cai a cada parcela.
  const bullet = loan4131(MENSAL)
  assert.ok(r.totals.interest < bullet.totals.interest)
  close(bullet.totals.interest, 1.2e6 * 0.06 * 365 / 360, 1e-6)
})

test('prazo médio · média dos dias corridos ponderada pela amortização, arredondada para baixo', () => {
  const r = loan4131({ ...MENSAL, amort: 'parcelas' })
  const media = DATAS_12.reduce((s, d) => s + dc(MENSAL.start, d), 0) / 12
  assert.equal(r.avgTermDays, Math.floor(media))
  // Principal no vencimento: o prazo médio continua sendo o prazo total.
  assert.equal(loan4131(MENSAL).avgTermDays, 365)
})

test('IOF-câmbio · parcelas encurtam o prazo médio e podem trazer o IOF de 3,5%', () => {
  // 18 meses no vencimento: prazo médio acima de 364 dias, IOF zero.
  const noFim = loan4131({ ...MENSAL, months: 18 })
  assert.equal(noFim.iofRate, 0)
  // Os mesmos 18 meses em parcelas mensais: prazo médio perto de 290 dias, IOF de 3,5%.
  const parcelado = loan4131({ ...MENSAL, months: 18, amort: 'parcelas' })
  assert.ok(parcelado.avgTermDays < 364, String(parcelado.avgTermDays))
  assert.equal(parcelado.iofRate, 3.5)
  close(parcelado.netUsd, 1.2e6 * (1 - 0.035), 1e-6)
  // 36 meses em parcelas: prazo médio acima de 364 dias, IOF zero.
  assert.equal(loan4131({ ...MENSAL, months: 36, amort: 'parcelas' }).iofRate, 0)
})

test('carência · pagamentos só de juros antes da primeira parcela de principal', () => {
  const r = loan4131({ ...MENSAL, amort: 'parcelas', grace: 3 })
  assert.equal(r.grace, 3)
  r.flows.slice(0, 3).forEach((f) => { assert.equal(f.principal, 0); close(f.balance, 1.2e6, 1e-6) })
  r.flows.slice(3).forEach((f) => close(f.principal, 1.2e6 / 9, 1e-6))
  close(r.totals.principal, 1.2e6, 1e-6)
  close(r.flows[3].interest, 1.2e6 * 0.06 * dc('2026-04-15', '2026-05-15') / 360, 1e-6)
  // Carência que não deixa parcela de principal é recusada; carência negativa ou quebrada também.
  assert.equal(loan4131({ ...MENSAL, amort: 'parcelas', grace: 12 }).ok, false)
  assert.equal(loan4131({ ...MENSAL, amort: 'parcelas', grace: -1 }).ok, false)
  assert.equal(loan4131({ ...MENSAL, amort: 'parcelas', grace: 1.5 }).ok, false)
  // No vencimento, a carência não muda nada.
  assert.equal(loan4131({ ...MENSAL, grace: 0 }).grace, 0)
})

test('datas a cada 30 dias · próximo dia útil, com o primeiro pagamento como âncora', () => {
  // 05/03/2027 é sexta. +30 dias cai no domingo 04/04: vai para segunda 05/04, que vira a âncora dos demais.
  const r = loan4131({ ...MENSAL, start: '2027-03-05', months: 4, calendar: '30d' })
  assert.deepEqual(r.flows.map((f) => f.date), ['2027-04-05', '2027-05-05', '2027-06-04', '2027-07-05'])
  assert.deepEqual(r.flows.map((f) => f.dc), [31, 61, 91, 122])
  assert.deepEqual(r.flows.map((f) => f.days), [31, 30, 30, 31])
  // Com feriado em 05/04, a âncora passa a 06/04; 05/06 é sábado e vai para 07/06.
  const feriado = (iso) => { let d = iso; while (d === '2027-04-05' || [0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay())) d = new Date(Date.parse(`${d}T12:00:00Z`) + DAY).toISOString().slice(0, 10); return d }
  const f = loan4131({ ...MENSAL, start: '2027-03-05', months: 3, calendar: '30d', nextBusDay: feriado })
  assert.deepEqual(f.flows.map((x) => x.date), ['2027-04-06', '2027-05-06', '2027-06-07'])
  // Trimestral: passos de 90 dias.
  const tri = loan4131({ ...MENSAL, start: '2027-03-05', months: 6, freq: 3, calendar: '30d' })
  assert.deepEqual(tri.flows.map((x) => x.dc), [90, 180])
  assert.equal(loan4131({ ...MENSAL, calendar: 'outro' }).ok, false)
})

test('formato da cotação · custo ao mês (30 dias) e ao ano (exp/360) em fórmula fechada', () => {
  // Pagamento único em 181 dias corridos, 124 dias úteis informados.
  const loan = loan4131({ principal: 1e6, rate: 6, spot: 5, start: '2026-11-11', months: 6, freq: 0, irrf: 15, grossUp: true, flat: 1, guarantee: 0 })
  const h = hedge4131(loan, { di: 14, cupom: 5, busDays: () => 124 })
  const total = loan.totals.usd * (5 * 1.14 ** (124 / 252) / (1 + 0.05 * 181 / 360))
  close(h.ndf.totalBrl, total, 1e-6)
  const liquido = 1e6 * (1 - 0.01 - 0.035) * 5
  close(loan.netBrl, liquido, 1e-6)
  close(h.ndf.cetMes, ((total / liquido) ** (30 / 181) - 1) * 100, 1e-7)
  close(h.ndf.cetAno, ((total / liquido) ** (360 / 181) - 1) * 100, 1e-7)
  // O ano é o mês composto 12 vezes.
  close((1 + h.ndf.cetMes / 100) ** 12, 1 + h.ndf.cetAno / 100, 1e-12)
  // E os dois saem da mesma taxa interna em dias corridos/365.
  close(taxa360(h.ndf.cost365 / 100).mes, h.ndf.cetMes, 1e-12)
})

test('economia de IOF e equivalente em giro · pagamento único em fórmula fechada', () => {
  const loan = loan4131({ principal: 1e6, rate: 6, spot: 5, start: '2026-11-11', months: 6, freq: 0, irrf: 15, grossUp: true, flat: 0, guarantee: 0 })
  const h = hedge4131(loan, { di: 14, cupom: 5, busDays: () => 124 })
  // Giro de R$ 5 milhões por 181 dias: 0,38% + 0,0082% ao dia.
  const iof = 5e6 * (0.38 + 0.0082 * 181) / 100
  close(iofGiro4131(loan), iof, 1e-6)
  close(h.ndf.iofGiro, iof, 1e-6)
  const total = h.ndf.totalBrl
  close(h.ndf.giroMes, ((total / (loan.netBrl + iof)) ** (30 / 181) - 1) * 100, 1e-7)
  close(h.ndf.giroAno, ((total / (loan.netBrl + iof)) ** (360 / 181) - 1) * 100, 1e-7)
  // Com IOF a favor, a taxa de giro equivalente fica abaixo do custo efetivo.
  assert.ok(h.ndf.giroAno < h.ndf.cetAno)
})

test('economia de IOF · parcelas: alíquota diária por parcela, limitada a 365 dias', () => {
  // 24 parcelas mensais de 50.000 na moeda, câmbio 5: 250.000 reais por parcela.
  const loan = loan4131({ ...MENSAL, months: 24, amort: 'parcelas' })
  let esperado = 1.2e6 * 5 * 0.38 / 100
  loan.flows.forEach((f) => { esperado += 5e4 * 5 * 0.0082 / 100 * Math.min(f.dc, 365) })
  close(iofGiro4131(loan), esperado, 1e-6)
  // Parcelas depois de um ano pagam o teto: 250.000 × 0,0082% × 365.
  const tardias = loan.flows.filter((f) => f.dc > 365).length
  assert.equal(tardias, 12)
  // Teto geral: nunca passa de 0,38% + 365 × 0,0082% do valor.
  assert.ok(iofGiro4131(loan) < 1.2e6 * 5 * (0.38 + 365 * 0.0082) / 100)
  assert.equal(iofGiro4131({ ok: false }), null)
})

test('formato da cotação · parcelas: a taxa zera o fluxo em reais por dias corridos/365', () => {
  const loan = loan4131({ ...MENSAL, months: 24, amort: 'parcelas', flat: 0.5 })
  const h = hedge4131(loan, { di: 13, cupom: 5 })
  const y = (1 + h.ndf.cetMes / 100) ** (365 / 30) - 1
  const vp = h.flows.reduce((s, f) => s + f.brl / (1 + y) ** (f.dc / 365), 0)
  close(vp, loan.netBrl, 1e-4)
  const g = (1 + h.ndf.giroMes / 100) ** (365 / 30) - 1
  const vpGiro = h.flows.reduce((s, f) => s + f.brl / (1 + g) ** (f.dc / 365), 0)
  close(vpGiro, loan.netBrl + h.ndf.iofGiro, 1e-4)
})

test('euro · mesma conta do dólar, com a moeda guardada no resultado', () => {
  const usd = loan4131({ ...MENSAL, amort: 'parcelas' })
  const eur = loan4131({ ...MENSAL, amort: 'parcelas', currency: 'EUR' })
  assert.equal(usd.currency, 'USD')
  assert.equal(eur.currency, 'EUR')
  close(eur.allIn, usd.allIn, 1e-12)
  close(eur.totals.usd, usd.totals.usd, 1e-9)
  assert.equal(loan4131({ ...MENSAL, currency: 'GBP' }).ok, false)
  assert.match(loan4131({ ...MENSAL, currency: 'EUR', principal: 0 }).error, /euro/)
})

test('principal no vencimento · padrão não muda com as opções novas', () => {
  const antes = loan4131({ principal: 1e6, rate: 6, spot: 5, start: '2026-11-11', months: 24, freq: 6 })
  const depois = loan4131({ principal: 1e6, rate: 6, spot: 5, start: '2026-11-11', months: 24, freq: 6, amort: 'bullet', grace: 0, calendar: 'mes', currency: 'USD' })
  assert.deepEqual(depois, antes)
  antes.flows.forEach((f, i) => { assert.equal(f.balance, 1e6); assert.equal(f.principal, i === antes.flows.length - 1 ? 1e6 : 0) })
  assert.equal(antes.avgTermDays, dc('2026-11-11', '2028-11-11'))
  // Juros mensais com principal no vencimento: 24 pagamentos.
  assert.equal(loan4131({ principal: 1e6, rate: 6, spot: 5, start: '2026-11-11', months: 24, freq: 1 }).flows.length, 24)
})

test('DI do prazo · lido da curva DI x pré, a termo quando o desembolso é depois da data-base', () => {
  const plana = [[21, 14], [252, 14], [504, 14]]
  close(diDoPrazo(plana, 0, 252), 14, 1e-9)
  close(diDoPrazo(plana, 5, 100), 14, 1e-9)
  // Curva 10% em 1 ano e 12% em 2 anos: o segundo ano sai a 1,12² ÷ 1,10 − 1.
  const curva = [[252, 10], [504, 12]]
  close(diDoPrazo(curva, 252, 252), (1.12 ** 2 / 1.10 - 1) * 100, 1e-9)
  close(diDoPrazo(curva, 0, 504), 12, 1e-9)
  // Fora da curva ou sem prazo: sem taxa.
  assert.equal(diDoPrazo(curva, 0, 505), null)
  assert.equal(diDoPrazo(curva, 0, 0), null)
  assert.equal(diDoPrazo([], 0, 100), null)
})
