// Empréstimo externo (4131): principal em parcelas, carência, datas a cada 30 dias, euro e leitura no formato da cotação.
// Números fictícios, com resultado esperado em fórmula fechada ou somado à mão aqui, sem o código do painel.
import test from 'node:test'
import assert from 'node:assert/strict'
import { diDoPrazo, hedge4131, iofGiro4131, lerTaxasFuturas, loan4131, metaTaxa4131, taxa360 } from '../src/emprestimo4131.js'
import { condicoesE4, resumoE4 } from '../src/emprestimo4131Presentation.js'

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

test('prazo médio na fronteira · 364,7 dias conta como 364 e paga o IOF; 365,2 não paga', () => {
  // 23 parcelas mensais em dia fixo: a média exata depende do dia do desembolso.
  const base = { principal: 1.2e6, rate: 5.5, spot: 5.5, months: 23, freq: 1, amort: 'parcelas' }
  const abaixo = loan4131({ ...base, start: '2026-11-16' })
  close(abaixo.avgTermExact, abaixo.flows.reduce((s, f) => s + f.principal * f.dc, 0) / 1.2e6, 1e-9)
  assert.ok(abaixo.avgTermExact > 364.6 && abaixo.avgTermExact < 364.8, String(abaixo.avgTermExact))
  assert.equal(abaixo.avgTermDays, 364)
  assert.equal(abaixo.iofRate, 3.5)
  const acima = loan4131({ ...base, start: '2026-12-01' })
  assert.ok(acima.avgTermExact > 365 && acima.avgTermExact < 365.3, String(acima.avgTermExact))
  assert.equal(acima.avgTermDays, 365)
  assert.equal(acima.iofRate, 0)
  // Principal no vencimento: a média exata é o próprio prazo.
  assert.equal(loan4131(MENSAL).avgTermExact, 365)
})

test('datas a cada 30 dias · semestral: 180 dias por período e 12 meses somam 360, com IOF de 3,5%', () => {
  // 16/11/2026 é segunda. +180 dias cai no sábado 15/05/2027 e vai para segunda 17/05, que vira a âncora:
  // o segundo pagamento é 17/05 + 180 dias = 13/11/2027 (sábado), levado a segunda 15/11.
  const r = loan4131({ principal: 1e6, rate: 6, spot: 5, start: '2026-11-16', months: 12, freq: 6, calendar: '30d' })
  assert.deepEqual(r.flows.map((f) => [f.date, f.dc]), [['2027-05-17', 182], ['2027-11-15', 364]])
  assert.equal(r.iofRate, 3.5)
  // Pagamento único de 12 meses: 360 dias, IOF de 3,5%; em dia fixo, 365 dias e IOF zero.
  const unico = loan4131({ principal: 1e6, rate: 6, spot: 5, start: '2026-11-16', months: 12, freq: 0, calendar: '30d' })
  assert.equal(unico.flows[0].dc, 360)
  assert.equal(unico.iofRate, 3.5)
  assert.equal(loan4131({ principal: 1e6, rate: 6, spot: 5, start: '2026-11-16', months: 12, freq: 0 }).iofRate, 0)
})

test('prazo que não é múltiplo do período · a última parcela vence no fim do prazo, em intervalo mais curto', () => {
  const r = loan4131({ principal: 9e5, rate: 6, spot: 5, start: '2026-01-15', months: 7, freq: 3, amort: 'parcelas' })
  assert.deepEqual(r.flows.map((f) => f.date), ['2026-04-15', '2026-07-15', '2026-08-15'])
  r.flows.forEach((f) => close(f.principal, 3e5, 1e-6))
})

test('principal no vencimento · números iguais aos da versão de 11/11/2026, antes da ampliação', () => {
  // Valores gravados rodando a versão anterior do motor com as mesmas entradas.
  const loan = loan4131({ principal: 1e6, rate: 6, spot: 5, start: '2026-11-11', months: 24, freq: 6, irrf: 15, grossUp: true, flat: 0.5, guarantee: 0.3 })
  const h = hedge4131(loan, { di: 13, cupom: 5 })
  close(loan.allIn, 7.884716744192454, 1e-12)
  close(loan.totals.usd, 1149425, 1e-6)
  close(h.ndf.totalBrl, 6617669.360018991, 1e-6)
  close(h.ndf.pre, 16.157198353821734, 1e-11)
  close(h.swap.spread, 2.793980844090038, 1e-11)
  close(h.swap.runSpread, 2.5227315341467715, 1e-11)
})

test('atingir meta · a taxa encontrada leva o custo efetivo, o CDI + e o giro à meta', () => {
  // 36 parcelas mensais a cada 30 dias, IR já na taxa: o padrão da tela.
  const base = { principal: 2e6, spot: 5, start: '2026-11-16', months: 36, freq: 1, amort: 'parcelas', calendar: '30d', grossUp: false, flat: 0, guarantee: 0 }
  const protecao = { di: 13, cupom: 5 }
  for (const [kind, meta] of [['cetMes', 1.3], ['cetAno', 17], ['spread', 3], ['giroMes', 1.15]]) {
    const r = metaTaxa4131(base, protecao, kind, meta)
    assert.equal(r.ok, true, kind)
    // Conferência à parte: recalcula a operação com a taxa devolvida.
    const h = hedge4131(loan4131({ ...base, rate: r.rate }), protecao)
    close(h.ndf[kind], r.value, 1e-12)
    close(h.ndf[kind], meta, 1e-3)
    assert.equal(r.rate, Math.round(r.rate * 1e4) / 1e4, 'taxa com quatro casas')
  }
  // Meta mais alta pede taxa mais alta.
  assert.ok(metaTaxa4131(base, protecao, 'cetMes', 1.4).rate > metaTaxa4131(base, protecao, 'cetMes', 1.3).rate)
})

test('atingir meta · pagamento único confere com a conta fechada', () => {
  // Sem custos: total em reais = principal × (1 + taxa × dc/360) × câmbio a termo; a meta define a taxa.
  const base = { principal: 1e6, spot: 5, start: '2026-11-11', months: 6, freq: 0, grossUp: false, flat: 0, guarantee: 0 }
  const protecao = { di: 14, cupom: 5, busDays: () => 124 }
  const loan = loan4131({ ...base, rate: 0 })
  const termo = 5 * 1.14 ** (124 / 252) / (1 + 0.05 * 181 / 360)
  // Meta de 1,30% a.m.: fator total = 1,013^(181/30) sobre o líquido (com IOF de 3,5% na entrada).
  const fator = 1.013 ** (181 / 30) * loan.netBrl / (1e6 * termo)
  const taxa = (fator - 1) * 360 / 181 * 100
  const r = metaTaxa4131(base, protecao, 'cetMes', 1.3)
  close(r.rate, taxa, 1e-4)
})

test('atingir meta · meta fora do alcance e entradas inválidas são recusadas', () => {
  const base = { principal: 2e6, spot: 5, start: '2026-11-16', months: 36, freq: 1, amort: 'parcelas', calendar: '30d', grossUp: false }
  const protecao = { di: 13, cupom: 5 }
  // Com taxa zero o custo já é positivo (o câmbio a termo embute a diferença de juros): meta abaixo disso não existe.
  const minimo = hedge4131(loan4131({ ...base, rate: 0 }), protecao).ndf.cetMes
  assert.ok(minimo > 0)
  assert.match(metaTaxa4131(base, protecao, 'cetMes', minimo - 0.1).error, /Meta abaixo do mínimo/)
  assert.match(metaTaxa4131(base, protecao, 'cetMes', 50).error, /Meta acima/)
  assert.equal(metaTaxa4131(base, protecao, 'outra', 1.3).ok, false)
  assert.equal(metaTaxa4131(base, protecao, 'cetMes', NaN).ok, false)
  assert.equal(metaTaxa4131({ ...base, principal: 0 }, protecao, 'cetMes', 1.3).ok, false)
  assert.equal(metaTaxa4131(base, { di: 0, cupom: 5 }, 'cetMes', 1.3).ok, false)
})

test('resumo no formato de e-mail · condições na ordem da cotação e os três resultados', () => {
  const loan = loan4131({ currency: 'EUR', principal: 2e6, rate: 6, spot: 6, start: '2026-11-16', months: 36, freq: 1, amort: 'parcelas', calendar: '30d', grossUp: false })
  const hedge = hedge4131(loan, { di: 13, cupom: 3 })
  const condicoes = condicoesE4(loan)
  assert.deepEqual(condicoes.map(([rotulo]) => rotulo), ['Data da cotação', 'Produto', 'Valor de principal', 'Moeda', 'Cotação de partida', 'Taxa', 'Prazo', 'Principal', 'Juros', 'Prazo médio (DC)', 'Carência do principal', 'Tarifa de contratação', 'IOF-câmbio na entrada'])
  const mapa = Object.fromEntries(condicoes)
  assert.equal(mapa['Data da cotação'], '16/11/2026')
  assert.equal(mapa['Valor de principal'], 'R$ 12.000.000,00')
  assert.equal(mapa['Moeda'], 'Euro · € 2.000.000,00')
  assert.equal(mapa['Taxa'], 'Euro + 6,00% a.a.')
  assert.equal(Object.fromEntries(condicoesE4(loan4131({ currency: 'EUR', principal: 2e6, rate: 6.5412, spot: 6, start: '2026-11-16', months: 36, freq: 1, amort: 'parcelas', grossUp: false })))['Taxa'], 'Euro + 6,5412% a.a.')
  assert.equal(mapa['Prazo'], '36 meses')
  assert.equal(mapa['Principal'], 'Mensal · 36 parcelas')
  assert.equal(mapa['Juros'], 'Mensal')
  assert.equal(mapa['Prazo médio (DC)'], String(loan.avgTermDays))
  assert.equal(mapa['Carência do principal'], 'Sem carência')
  assert.equal(mapa['Tarifa de contratação'], 'R$ 0,00')
  const texto = resumoE4({ loan, hedge })
  const br = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  assert.ok(texto.startsWith('4131 com NDF · Condições da operação\nData da cotação: 16/11/2026\n'))
  assert.ok(texto.includes(`Custo efetivo total: taxa de juros prefixada em reais de ${br(hedge.ndf.cetMes)}% a.m. / ${br(hedge.ndf.cetAno)}% a.a. (equivalente a CDI + ${br(hedge.ndf.spread)}%), exp/360`))
  assert.ok(texto.includes(`Economia de IOF (R$): ${br(hedge.ndf.iofGiro)}`))
  assert.ok(texto.includes(`Taxa equivalente em capital de giro: ${br(hedge.ndf.giroMes)}% a.m. / ${br(hedge.ndf.giroAno)}% a.a., exp/360`))
  // Sem resultado, sem texto; IR somado à taxa aparece na condição.
  assert.equal(resumoE4({ loan, hedge: null }), '')
  assert.deepEqual(condicoesE4(null), [])
  assert.match(Object.fromEntries(condicoesE4(loan4131({ principal: 1e6, rate: 6, spot: 5, start: '2026-11-16', months: 12, freq: 6 })))['Taxa'], /IR somado à taxa/)
})

test('taxas futuras da mesa · cada parcela em reais é a parcela na moeda vezes a taxa colada', () => {
  // Três parcelas mensais em dia fixo, IR já na taxa; taxas futuras fictícias.
  const loan = loan4131({ principal: 9e5, rate: 6, spot: 5, start: '2026-11-11', months: 3, freq: 1, amort: 'parcelas', grossUp: false })
  const taxas = [5.03, 5.07, 5.11]
  const h = hedge4131(loan, { di: 14, forwards: taxas })
  assert.equal(h.ok, true)
  assert.equal(h.source, 'mesa')
  let total = 0
  h.flows.forEach((f, i) => { close(f.ndfRate, taxas[i], 1e-12); close(f.brl, loan.flows[i].usd * taxas[i], 1e-6); total += loan.flows[i].usd * taxas[i] })
  close(h.ndf.totalBrl, total, 1e-6)
  // O custo zera o fluxo em reais com as taxas coladas, por dias corridos/365.
  const y = (1 + h.ndf.cetMes / 100) ** (365 / 30) - 1
  close(h.flows.reduce((s, f) => s + f.brl / (1 + y) ** (f.dc / 365), 0), loan.netBrl, 1e-4)
  // O cupom devolvido é o implícito no vencimento: termo = à vista × fator do DI ÷ (1 + cupom × dc/360).
  const ultimo = h.flows.at(-1)
  close(5 * ultimo.diFactor / (1 + h.cupom / 100 * ultimo.dc / 360), 5.11, 1e-9)
  // O acréscimo do banco, se houver, entra por cima da taxa colada.
  close(hedge4131(loan, { di: 14, forwards: taxas, ndfMarkup: 1 }).flows[0].ndfRate, 5.03 * 1.01, 1e-12)
})

test('taxas futuras da mesa · com as mesmas taxas da estimativa, o resultado é o mesmo', () => {
  const loan = loan4131({ principal: 2e6, rate: 6, spot: 5, start: '2026-11-16', months: 12, freq: 1, amort: 'parcelas', calendar: '30d', grossUp: false })
  const estimado = hedge4131(loan, { di: 13, cupom: 5 })
  const colado = hedge4131(loan, { di: 13, forwards: estimado.flows.map((f) => f.forward) })
  close(colado.ndf.cetMes, estimado.ndf.cetMes, 1e-10)
  close(colado.ndf.spread, estimado.ndf.spread, 1e-10)
  close(colado.ndf.giroAno, estimado.ndf.giroAno, 1e-10)
  close(colado.cupom, estimado.cupom, 1e-9)
  // Atingir meta também vale com as taxas coladas.
  const forwards = estimado.flows.map((f) => f.forward)
  const meta = metaTaxa4131({ principal: 2e6, spot: 5, start: '2026-11-16', months: 12, freq: 1, amort: 'parcelas', calendar: '30d', grossUp: false }, { di: 13, forwards }, 'cetMes', 1.4)
  assert.equal(meta.ok, true)
  close(hedge4131(loan4131({ principal: 2e6, rate: meta.rate, spot: 5, start: '2026-11-16', months: 12, freq: 1, amort: 'parcelas', calendar: '30d', grossUp: false }), { di: 13, forwards }).ndf.cetMes, 1.4, 1e-3)
})

test('taxas futuras da mesa · quantidade errada, zero e texto são recusados', () => {
  const loan = loan4131({ principal: 9e5, rate: 6, spot: 5, start: '2026-11-11', months: 3, freq: 1, amort: 'parcelas', grossUp: false })
  assert.match(hedge4131(loan, { di: 14, forwards: [5.03, 5.07] }).error, /Informe 3 taxas futuras, uma por pagamento: vieram 2/)
  assert.equal(hedge4131(loan, { di: 14, forwards: [5.03, 0, 5.11] }).ok, false)
  assert.equal(hedge4131(loan, { di: 14, forwards: [5.03, NaN, 5.11] }).ok, false)
  assert.equal(hedge4131(loan, { di: 14, forwards: 'texto' }).ok, false)
  // Sem DI não há equivalente em CDI: continua obrigatório.
  assert.equal(hedge4131(loan, { di: 0, forwards: [5.03, 5.07, 5.11] }).ok, false)
  // Leitura do que foi colado: uma por linha, com vírgula ou ponto, tabulação ou ponto e vírgula.
  assert.deepEqual(lerTaxasFuturas('5,0300\n5,0700\n5,1100\n'), { rates: [5.03, 5.07, 5.11], bad: null })
  assert.deepEqual(lerTaxasFuturas(' 5.03\t5.07 ; 5,11 '), { rates: [5.03, 5.07, 5.11], bad: null })
  assert.deepEqual(lerTaxasFuturas(''), { rates: [], bad: null })
  assert.equal(lerTaxasFuturas('5,03\nR$5,07').bad, 'R$5,07')
  assert.equal(lerTaxasFuturas('5,03\n1.234,56').bad, '1.234,56')
})
