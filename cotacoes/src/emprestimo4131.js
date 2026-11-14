// Empréstimo externo direto (Lei 4.131/62; hoje Lei 14.286/2021 e Res. BCB 278/2022): custo all-in em dólar e três
// caminhos em reais: sem proteção, com swap para CDI e com NDF (termo de moeda sem entrega) em cada pagamento.
// Regras usadas (levantamento de 11/11/2026, ver docs/emprestimo-4131.md):
// - Juros: principal × taxa × dias corridos / 360 (linear), pagos na frequência escolhida; principal no vencimento.
// - IRRF sobre juros ao exterior: 15% (RIR/2018, art. 760). Se o tomador assume o imposto, a base é reajustada
//   (art. 786): IR = juros × alíquota / (1 − alíquota).
// - IOF-câmbio na entrada (Decreto 6.306/2007, art. 15-B): prazo médio até 364 dias, 3,5% (inc. XII); acima, zero (inc. XI).
// - Flat e IOF saem do valor recebido. Fiança/SBLC: % a.a. sobre o principal, dias corridos/360, paga com os juros.
// - Flat e fiança pagos ao exterior (`feesAbroad`): o mesmo IR dos juros incide sobre a comissão (art. 760 cita
//   comissões); com gross-up, o IR do flat sai na entrada e o da fiança é pago com ela.
// - Custo all-in em dólar: taxa que zera o fluxo, em dias corridos/365 (mesma convenção do CET do Painel).
// - Câmbio a termo teórico: à vista × fator do DI (du/252) ÷ fator do cupom (linear, dc/360). Com as curvas do Painel,
//   cada pagamento usa o DI e o cupom do seu prazo; no modo manual, um DI e um cupom para todos.
// - Swap: custo em reais (base 252) dos fluxos a termo, composto com o spread do banco. Duas leituras em CDI:
//   custo total (sobre o valor líquido, com flat e IOF) e spread do swap (sobre o principal, sem os custos de entrada).
// - NDF: cada pagamento em dólar travado na taxa a termo (com o acréscimo do banco); o custo fica prefixado em reais.
// Ampliação de 14/11/2026 (formato de cotação bancária de 4131 com NDF, ver docs/emprestimo-4131.md):
// - Moeda: dólar ou euro. A conta é a mesma; no euro, o "cupom" é o juro do euro usado no câmbio a termo.
// - Principal no vencimento ou em parcelas iguais (amortização constante), com carência em número de pagamentos.
//   Juros e fiança incidem sobre o saldo devedor. Prazo médio = soma(amortização × dias corridos) ÷ principal.
// - Datas: mesmo dia do mês (sem ajuste) ou a cada 30 dias corridos, no próximo dia útil. No segundo caso, o primeiro
//   pagamento ajustado vira a âncora dos demais.
// - Leitura no formato da cotação (NDF): taxa interna do fluxo em reais por dias corridos/365, lida ao mês como taxa de
//   30 dias e ao ano como 12 meses de 30 dias (exp/360).
// - Economia de IOF: IOF de crédito que um capital de giro em reais pagaria no mesmo cronograma de principal
//   (0,38% + 0,0082% ao dia sobre cada parcela, até 365 dias). Equivalente em giro: a mesma taxa interna com esse IOF
//   somado ao valor recebido.
import { growthAt } from './cdiFuturo.js'
import { interp } from './cupom.js'
import { IOF_PJ } from './emprestimo.js'

const DAY = 864e5
const ms = (iso) => Date.parse(`${iso}T12:00:00Z`)
const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / DAY)

export const IRRF_OPTIONS = [
  { id: '15', rate: 15, label: '15% · regra geral' },
  { id: '25', rate: 25, label: '25% · país com tributação favorecida' },
  { id: '0', rate: 0, label: '0% · isenção ou tratado' },
]
export const FREQS = [
  { id: '1', months: 1, label: 'Mensal' },
  { id: '3', months: 3, label: 'Trimestral' },
  { id: '6', months: 6, label: 'Semestral' },
  { id: '12', months: 12, label: 'Anual' },
  { id: '0', months: 0, label: 'No vencimento' },
]
export const MOEDAS = [
  { id: 'USD', sym: 'US$', nome: 'dólar', Nome: 'Dólar', juro: 'Cupom cambial' },
  { id: 'EUR', sym: '€', nome: 'euro', Nome: 'Euro', juro: 'Juro do euro' },
]
export const moedaOf = (id) => MOEDAS.find((m) => m.id === id) ?? MOEDAS[0]
export const AMORTS = [
  { id: 'bullet', label: 'No vencimento' },
  { id: 'parcelas', label: 'Em parcelas' },
]
export const CALENDARIOS = [
  { id: 'mes', label: 'Dia fixo' },
  { id: '30d', label: 'Cada 30 dias' },
]
export const IOF_SHORT_TERM = { rate: 3.5, maxDays: 364 }
export const IOF_SOURCE = 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/d6306compilado.htm'
export const MAX_PRINCIPAL = 1e12
export const MAX_MONTHS = 240

// Soma meses mantendo o dia; se o mês de destino for mais curto, usa o último dia dele.
export function addMonthsIso(iso, months) {
  const [y, m, d] = iso.split('-').map(Number)
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10)
}

const addDaysIso = (iso, n) => new Date(ms(iso) + n * DAY).toISOString().slice(0, 10)
// Sem calendário de feriados: só pula sábado e domingo.
const weekdayOnOrAfter = (iso) => { const w = new Date(ms(iso)).getUTCDay(); return w === 6 ? addDaysIso(iso, 2) : w === 0 ? addDaysIso(iso, 1) : iso }

// IOF-câmbio na entrada pelo prazo médio em dias corridos (inteiro, arredondado para baixo). Principal no vencimento: prazo médio = prazo total.
export function iofEntrada(avgTermDays) {
  return avgTermDays <= IOF_SHORT_TERM.maxDays ? IOF_SHORT_TERM.rate : 0
}

// Taxa que zera o fluxo [{ v, t }] (t em anos), na visão do tomador: entrada positiva, pagamentos negativos.
// Bisseção: o valor presente dos pagamentos encolhe quando a taxa sobe, então o saldo cresce com a taxa.
export function irr(flows) {
  const npv = (y) => flows.reduce((s, f) => s + f.v / (1 + y) ** f.t, 0)
  let lo = -0.99
  let hi = 10
  if (!(npv(lo) < 0) || !(npv(hi) > 0)) return null
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (npv(mid) < 0) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

const fail = (error) => ({ ok: false, error })
// Data real do calendário (30/02 não passa), entre 2000 e 2100.
const validDate = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') && !Number.isNaN(ms(iso)) && new Date(ms(iso)).toISOString().slice(0, 10) === iso && iso >= '2000-01-01' && iso <= '2100-12-31'

// Fluxo do empréstimo na moeda (dólar ou euro). Taxas em % (5,8 = 5,80%). `spot` em R$ por unidade da moeda.
// `amort`: 'bullet' (principal no vencimento) ou 'parcelas' (amortização constante); `grace`: pagamentos só de juros antes
// da primeira parcela de principal. `calendar`: 'mes' ou '30d'; `nextBusDay(iso)` devolve a própria data, se útil, ou o
// dia útil seguinte (sem ela, só fins de semana são pulados).
export function loan4131({ principal, rate, spot, start, months, freq = 6, irrf = 15, grossUp = true, flat = 0, guarantee = 0, feesAbroad = false, amort = 'bullet', grace = 0, calendar = 'mes', nextBusDay = weekdayOnOrAfter, currency = 'USD' }) {
  if (!MOEDAS.some((m) => m.id === currency)) return fail('Escolha a moeda.')
  if (!(principal > 0) || principal > MAX_PRINCIPAL) return fail(`Informe o principal em ${moedaOf(currency).nome}, maior que zero.`)
  if (!(rate >= 0) || rate > 100) return fail('Informe a taxa em % ao ano, de 0 a 100.')
  if (!(spot > 0)) return fail('Informe o câmbio de entrada, maior que zero.')
  if (!validDate(start)) return fail('Informe uma data de desembolso válida, entre 2000 e 2100.')
  if (!Number.isInteger(months) || months < 1 || months > MAX_MONTHS) return fail(`Informe o prazo em meses, número inteiro de 1 a ${MAX_MONTHS}.`)
  if (![0, 1, 3, 6, 12].includes(freq)) return fail('Escolha a frequência dos juros.')
  if (!AMORTS.some((a) => a.id === amort)) return fail('Escolha como o principal é pago.')
  if (!CALENDARIOS.some((c) => c.id === calendar)) return fail('Escolha a regra das datas.')
  if (!Number.isInteger(grace) || grace < 0) return fail('Informe a carência em número de pagamentos, inteiro.')
  if (!(irrf >= 0) || irrf >= 100) return fail('Alíquota de IRRF inválida.')
  if (!(flat >= 0) || !(guarantee >= 0)) return fail('Flat e fiança não podem ser negativos.')

  const step = freq === 0 ? months : freq
  const marks = []
  for (let m = step; m < months; m += step) marks.push(m)
  marks.push(months)
  let dates
  if (calendar === '30d') {
    const first = nextBusDay(addDaysIso(start, 30 * marks[0]))
    dates = marks.map((m) => nextBusDay(addDaysIso(first, 30 * (m - marks[0]))))
  } else dates = marks.map((m) => addMonthsIso(start, m))
  if (dates.some((d, i) => !validDate(d) || d <= (i ? dates[i - 1] : start))) return fail('Não foi possível montar as datas dos pagamentos: revise a data e o prazo.')
  const end = dates.at(-1)

  // Amortização constante depois da carência; a última parcela leva o saldo, para o total fechar no principal.
  const n = dates.length
  const split = amort === 'parcelas'
  if (split && grace >= n) return fail(`A carência de ${grace} pagamentos não deixa parcela de principal: são ${n} pagamentos no prazo.`)
  const parts = split ? n - grace : 1
  const amortAt = (i, balance) => (i === n - 1 ? balance : split && i >= grace ? principal / parts : 0)
  let weighted = 0
  let left = principal
  const schedule = dates.map((date, i) => {
    const pay = amortAt(i, left)
    const row = { date, dc: daysBetween(start, date), balance: left, principal: pay }
    weighted += pay * row.dc
    left -= pay
    return row
  })
  // Média exata (pode ter fração) e a que vale para a regra do IOF: inteira, arredondada para baixo (cobra na dúvida).
  const avgTermExact = split ? weighted / principal : daysBetween(start, end)
  const avgTermDays = split ? Math.floor(avgTermExact + 1e-9) : avgTermExact
  const iofRate = iofEntrada(avgTermDays)
  if (flat + iofRate >= 100) return fail('Flat e IOF consomem todo o valor: revise os percentuais.')
  const a = irrf / 100
  const flatUsd = principal * flat / 100
  const iofUsd = principal * iofRate / 100
  // IR do tomador sobre um valor pago ao exterior, com a base reajustada.
  const taxOn = (value) => (grossUp ? value * a / (1 - a) : 0)
  const flatIrUsd = feesAbroad ? taxOn(flatUsd) : 0
  const netUsd = principal - flatUsd - iofUsd - flatIrUsd
  if (!(netUsd > 0)) return fail('Flat, IOF e IR consomem todo o valor: revise os percentuais.')

  const flows = []
  const totals = { interest: 0, irrf: 0, guarantee: 0, principal: 0, usd: 0 }
  let prev = start
  schedule.forEach(({ date, dc, balance, principal: pay }) => {
    const days = daysBetween(prev, date)
    const interest = balance * (rate / 100) * days / 360
    const fee = balance * (guarantee / 100) * days / 360
    const tax = taxOn(interest) + (feesAbroad ? taxOn(fee) : 0)
    const usd = interest + tax + fee + pay
    flows.push({ date, days, dc, balance, interest, irrf: tax, guarantee: fee, principal: pay, usd })
    totals.interest += interest
    totals.irrf += tax
    totals.guarantee += fee
    totals.principal += pay
    totals.usd += usd
    prev = date
  })

  const allIn = irr([{ v: netUsd, t: 0 }, ...flows.map((f) => ({ v: -f.usd, t: f.dc / 365 }))])
  if (allIn == null) return fail('Não foi possível calcular o custo: revise os valores.')
  return {
    ok: true, currency, principal, rate, spot, start, end, months, freq, irrf, grossUp, flat, guarantee, feesAbroad, amort, grace: split ? grace : 0, calendar,
    avgTermDays, avgTermExact, iofRate, flatUsd, iofUsd, flatIrUsd, netUsd, netBrl: netUsd * spot, flows, totals,
    grossedRate: grossUp ? rate / (1 - a) : rate,
    allIn: allIn * 100,
  }
}

// Sem proteção: câmbio de cada pagamento = à vista × (1 + variação a.a.)^(dc/365). Custo em reais, dias corridos/365.
// Com variação constante, (1 + custo) = (1 + all-in em dólar) × (1 + variação).
export function unhedged4131(loan, fxChange) {
  if (!loan?.ok) return fail('Empréstimo inválido.')
  if (!(fxChange > -100)) return fail('Variação do dólar inválida.')
  const g = 1 + fxChange / 100
  const flows = loan.flows.map((f) => {
    const fx = loan.spot * g ** (f.dc / 365)
    return { ...f, fx, brl: f.usd * fx }
  })
  const cost = irr([{ v: loan.netBrl, t: 0 }, ...flows.map((f) => ({ v: -f.brl, t: f.dc / 365 }))])
  if (cost == null) return fail('Não foi possível calcular o custo neste cenário.')
  return { ok: true, fxChange, flows, fxEnd: flows.at(-1).fx, totalBrl: flows.reduce((s, f) => s + f.brl, 0), cost: cost * 100 }
}

// Fatores a partir das curvas do Painel (B3): DI x pré (`diPts`, [dias úteis, % a.a. base 252]) e cupom cambial
// (`ccPts`, [dias úteis, % a.a. linear 360]). `d0` e `dc0`: dias úteis e corridos da data-base da curva até o desembolso.
// DI: taxa a termo constante entre vértices (`growthAt`). Cupom: taxa linear interpolada entre vértices; antes do
// primeiro vértice vale a taxa dele. Além do último vértice de qualquer curva, devolve null (não extrapola).
export function curveFactors({ diPts, ccPts, d0 = 0, dc0 = 0 }) {
  const cc = (ccPts ?? []).filter(([x, r]) => x > 0 && Number.isFinite(r)).sort((a, b) => a[0] - b[0])
  const ccRate = (x) => (!cc.length ? null : x <= cc[0][0] ? cc[0][1] : interp(cc, x))
  const ccFromBase = (x, dc) => {
    if (x <= 0 || dc <= 0) return 1
    const rate = ccRate(x)
    return rate == null ? null : 1 + (rate / 100) * dc / 360
  }
  const g0 = growthAt(diPts, d0)
  const c0 = ccFromBase(d0, dc0)
  return {
    diFactorAt: (n) => { const g = growthAt(diPts, d0 + n); return g0 == null || g == null ? null : g / g0 },
    cupomFactorAt: (n, dc) => { const c = ccFromBase(d0 + n, dc0 + dc); return c0 == null || c == null || !(c0 > 0) ? null : c / c0 },
  }
}

// DI pré (% a.a., base 252) entre `d0` e `d0 + n` dias úteis da data-base da curva DI x pré; null fora da curva.
export function diDoPrazo(diPts, d0, n) {
  if (!(n > 0) || !(d0 >= 0)) return null
  const g0 = growthAt(diPts, d0)
  const g = growthAt(diPts, d0 + n)
  return g0 == null || g == null ? null : ((g / g0) ** (252 / n) - 1) * 100
}

// IOF de crédito que um capital de giro em reais pagaria no mesmo cronograma de principal (pessoa jurídica):
// adicional sobre o valor + alíquota diária sobre cada parcela de principal, limitada a 365 dias.
export function iofGiro4131(loan) {
  if (!loan?.ok) return null
  const daily = loan.flows.reduce((sum, f) => sum + f.principal * loan.spot * (IOF_PJ.daily / 100) * Math.min(f.dc, IOF_PJ.maxDays), 0)
  return loan.principal * loan.spot * IOF_PJ.fixed / 100 + daily
}

// Taxa interna em dias corridos/365 lida no formato da cotação: ao mês (30 dias) e ao ano (12 meses de 30 dias, exp/360).
export const taxa360 = (y) => ({ mes: ((1 + y) ** (30 / 365) - 1) * 100, ano: ((1 + y) ** (360 / 365) - 1) * 100 })

// Com proteção. Manual: `di` em % a.a. (252) e `cupom` em % a.a. linear (360), iguais para todos os prazos.
// Com `curve` (de `curveFactors`), cada pagamento usa o DI e o cupom do seu prazo.
// `busDays(inicio, data)` devolve dias úteis; sem ela, estimativa de dias corridos × 252/365.
// `swapSpread`: % a.a. (252) do banco no swap, composto. `ndfMarkup`: % acrescido pelo banco sobre a taxa a termo.
export function hedge4131(loan, { di, cupom, busDays, swapSpread = 0, ndfMarkup = 0, curve = null, forwards = null }) {
  if (!loan?.ok) return fail('Empréstimo inválido.')
  // `forwards`: taxas futuras da mesa, uma por pagamento, na ordem dos vencimentos. Com elas, o cupom não é usado: a
  // taxa futura de cada parcela é a informada, e o cupom devolvido é o implícito no vencimento. O DI continua valendo
  // para o equivalente em CDI e para o custo em base 252.
  const mesa = forwards != null
  if (mesa && (!Array.isArray(forwards) || forwards.length !== loan.flows.length)) return fail(`Informe ${loan.flows.length} ${loan.flows.length === 1 ? 'taxa futura' : 'taxas futuras'}, uma por pagamento: ${Array.isArray(forwards) ? `vieram ${forwards.length}` : 'lista inválida'}.`)
  // Posição por posição: lista com buraco também é recusada.
  if (mesa && Array.from(forwards).some((f) => !(f > 0) || !Number.isFinite(f))) return fail('As taxas futuras precisam ser números maiores que zero.')
  if (!curve && (!(di > 0) || di > 200)) return fail('Informe o DI pré em % ao ano, maior que zero.')
  if (!curve && !mesa && (!(cupom > -50) || cupom > 200)) return fail('Informe o cupom cambial em % ao ano.')
  if (!(swapSpread >= 0) || !(ndfMarkup >= 0)) return fail('Os acréscimos do banco não podem ser negativos.')
  const du = (f) => (busDays ? busDays(loan.start, f.date) : f.dc * 252 / 365)
  const base = loan.flows.map((f, i) => {
    const n = du(f)
    const diFactor = curve ? curve.diFactorAt(n) : (1 + di / 100) ** (n / 252)
    if (mesa) return { ...f, du: n, diFactor, ccFactor: loan.spot * diFactor / forwards[i], forward: forwards[i] }
    const ccFactor = curve ? curve.cupomFactorAt(n, f.dc) : 1 + (cupom / 100) * f.dc / 360
    return { ...f, du: n, diFactor, ccFactor, forward: diFactor > 0 && ccFactor > 0 ? loan.spot * diFactor / ccFactor : NaN }
  })
  if (base.some((f) => !(f.du > 0) || !(f.forward > 0))) return fail(curve ? 'As curvas do Painel não cobrem todas as datas desta operação: use DI e cupom manuais.' : 'Não foi possível calcular o câmbio a termo: revise datas, DI e cupom.')

  // DI e cupom médios até o vencimento: iguais aos informados no modo manual; tirados da curva no outro.
  const last = base.at(-1)
  const dAvg = last.diFactor ** (252 / last.du) - 1
  const ccAvg = (last.ccFactor - 1) * 360 / last.dc
  const daily = (1 + dAvg) ** (1 / 252) - 1
  if (!(daily > 0)) return fail('Não foi possível ler o DI do período.')
  const pctCdi = (pre) => ((1 + pre) ** (1 / 252) - 1) / daily * 100
  // Custo prefixado (base 252) e spread sobre o CDI: no spread, cada pagamento é descontado pelo DI do seu prazo.
  const preOf = (inflow, flows) => irr([{ v: inflow, t: 0 }, ...flows.map((f) => ({ v: -f.brl, t: f.du / 252 }))])
  const spreadOf = (inflow, flows) => irr([{ v: inflow, t: 0 }, ...flows.map((f) => ({ v: -f.brl / f.diFactor, t: f.du / 252 }))])

  // Swap: custo dos fluxos a termo teóricos, composto com o spread do banco.
  const theo = base.map((f) => ({ ...f, brl: f.usd * f.forward }))
  const k = 1 + swapSpread / 100
  const gross = loan.principal * loan.spot
  const [pre0, spread0, runPre0, runSpread0] = [preOf(loan.netBrl, theo), spreadOf(loan.netBrl, theo), preOf(gross, theo), spreadOf(gross, theo)]
  if ([pre0, spread0, runPre0, runSpread0].some((v) => v == null)) return fail('Não foi possível calcular o custo com proteção.')
  const swap = {
    // Custo total: sobre o valor líquido, com flat e IOF da entrada diluídos no prazo.
    pre: ((1 + pre0) * k - 1) * 100,
    spread: ((1 + spread0) * k - 1) * 100,
    pctCdi: pctCdi((1 + pre0) * k - 1),
    // Spread do swap: sobre o principal, sem os custos de entrada; é o número comparável com a cotação da mesa.
    runPre: ((1 + runPre0) * k - 1) * 100,
    runSpread: ((1 + runSpread0) * k - 1) * 100,
    runPctCdi: pctCdi((1 + runPre0) * k - 1),
  }

  // NDF: cada pagamento travado na taxa a termo com o acréscimo do banco.
  const flows = base.map((f) => {
    const ndfRate = f.forward * (1 + ndfMarkup / 100)
    return { ...f, ndfRate, brl: f.usd * ndfRate }
  })
  const pre = preOf(loan.netBrl, flows)
  const spread = spreadOf(loan.netBrl, flows)
  const cost365 = irr([{ v: loan.netBrl, t: 0 }, ...flows.map((f) => ({ v: -f.brl, t: f.dc / 365 }))])
  if (pre == null || spread == null || cost365 == null) return fail('Não foi possível calcular o custo com NDF.')
  // Formato da cotação: custo efetivo ao mês e ao ano (exp/360), economia de IOF e taxa equivalente em capital de giro.
  const iofGiro = iofGiro4131(loan)
  const giro365 = irr([{ v: loan.netBrl + iofGiro, t: 0 }, ...flows.map((f) => ({ v: -f.brl, t: f.dc / 365 }))])
  if (giro365 == null) return fail('Não foi possível calcular a taxa equivalente em capital de giro.')
  const cet = taxa360(cost365)
  const giro = taxa360(giro365)
  const ndf = {
    cetMes: cet.mes,
    cetAno: cet.ano,
    iofGiro,
    giroMes: giro.mes,
    giroAno: giro.ano,
    pre: pre * 100,
    cost365: cost365 * 100,
    spread: spread * 100,
    pctCdi: pctCdi(pre),
    totalBrl: flows.reduce((sum, f) => sum + f.brl, 0),
    // Alta do dólar ao ano a partir da qual o NDF sai mais barato que ficar sem proteção.
    breakeven: ((1 + cost365) / (1 + loan.allIn / 100) - 1) * 100,
  }
  return { ok: true, source: mesa ? 'mesa' : curve ? 'curve' : 'manual', di: dAvg * 100, cupom: ccAvg * 100, swapSpread, ndfMarkup, flows, swap, ndf }
}

// Atingir meta: taxa do contrato (% a.a.) que leva o resultado com NDF à meta informada, com o resto da operação igual.
// `kind`: 'cetMes' ou 'cetAno' (custo efetivo exp/360), 'spread' (equivalente em CDI +) ou 'giroMes' (equivalente em giro).
// O custo cresce com a taxa, então a busca é por bisseção entre 0% e 100% a.a. Devolve a taxa com quatro casas, que é
// como ela vai para o campo; por isso o resultado pode diferir da meta na quarta casa.
export const METAS = [
  { id: 'cetMes', label: 'Custo efetivo ao mês', unit: '% a.m.' },
  { id: 'cetAno', label: 'Custo efetivo ao ano', unit: '% a.a.' },
  { id: 'spread', label: 'Equivalente em CDI +', unit: '% a.a.' },
]
// Taxas futuras coladas da planilha ou do e-mail da mesa: uma por linha (ou separadas por espaço, tabulação ou ponto e
// vírgula), com vírgula ou ponto decimal. Devolve { rates, bad }: os números lidos e o primeiro trecho que não é número.
export function lerTaxasFuturas(text) {
  // Caracteres invisíveis de largura zero, comuns em texto copiado de e-mail, saem antes da leitura.
  const tokens = String(text ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').split(/[\s;]+/).filter(Boolean)
  const rates = []
  for (const token of tokens) {
    if (!/^\d+(?:[.,]\d+)?$/.test(token)) return { rates, bad: token }
    rates.push(Number(token.replace(',', '.')))
  }
  return { rates, bad: null }
}

export function metaTaxa4131(loanParams, hedgeParams, kind, target) {
  if (!['cetMes', 'cetAno', 'spread', 'giroMes'].includes(kind)) return fail('Escolha a meta.')
  if (!Number.isFinite(target)) return fail('Informe a meta em %.')
  const at = (rate) => {
    const loan = loan4131({ ...loanParams, rate })
    if (!loan.ok) return loan
    const hedge = hedge4131(loan, hedgeParams ?? {})
    return hedge.ok ? { ok: true, value: hedge.ndf[kind] } : hedge
  }
  const dec4 = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  const low = at(0)
  if (!low.ok) return low
  // Teto da busca: 100% a.a.; em operação muito curta com tarifa alta o custo passa do limite do motor, e o teto desce
  // até a conta fechar.
  let top = 100
  let high = at(top)
  while (!high.ok && top > 0.01) { top /= 2; high = at(top) }
  if (!high.ok) return fail('Meta fora do alcance desta operação.')
  if (target < low.value) return fail(`Meta abaixo do mínimo: com taxa zero, o resultado já é ${dec4(low.value)}%.`)
  if (target > high.value) return fail(top < 100 ? 'Meta fora do alcance desta operação.' : 'Meta acima do que uma taxa de 100% ao ano alcança.')
  let lo = 0
  let hi = top
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const r = at(mid)
    if (!r.ok) return r
    if (r.value < target) lo = mid
    else hi = mid
  }
  const rate = Math.round(((lo + hi) / 2) * 1e4) / 1e4
  const check = at(rate)
  return check.ok ? { ok: true, rate, value: check.value } : check
}
