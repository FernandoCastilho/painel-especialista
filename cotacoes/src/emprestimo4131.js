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
import { growthAt } from './cdiFuturo.js'
import { interp } from './cupom.js'

const DAY = 864e5
const ms = (iso) => Date.parse(`${iso}T12:00:00Z`)
const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / DAY)

export const IRRF_OPTIONS = [
  { id: '15', rate: 15, label: '15% · regra geral' },
  { id: '25', rate: 25, label: '25% · país com tributação favorecida' },
  { id: '0', rate: 0, label: '0% · isenção ou tratado' },
]
export const FREQS = [
  { id: '3', months: 3, label: 'Trimestral' },
  { id: '6', months: 6, label: 'Semestral' },
  { id: '12', months: 12, label: 'Anual' },
  { id: '0', months: 0, label: 'No vencimento' },
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

// IOF-câmbio na entrada pelo prazo médio em dias corridos. Principal no vencimento: prazo médio = prazo total.
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

// Fluxo do empréstimo em dólar. Taxas em % (5,8 = 5,80%). `spot` em R$ por dólar.
export function loan4131({ principal, rate, spot, start, months, freq = 6, irrf = 15, grossUp = true, flat = 0, guarantee = 0, feesAbroad = false }) {
  if (!(principal > 0) || principal > MAX_PRINCIPAL) return fail('Informe o principal em dólar, maior que zero.')
  if (!(rate >= 0) || rate > 100) return fail('Informe a taxa em % ao ano, de 0 a 100.')
  if (!(spot > 0)) return fail('Informe o câmbio de entrada, maior que zero.')
  if (!validDate(start)) return fail('Informe uma data de desembolso válida, entre 2000 e 2100.')
  if (!Number.isInteger(months) || months < 1 || months > MAX_MONTHS) return fail(`Informe o prazo em meses, número inteiro de 1 a ${MAX_MONTHS}.`)
  if (![0, 3, 6, 12].includes(freq)) return fail('Escolha a frequência dos juros.')
  if (!(irrf >= 0) || irrf >= 100) return fail('Alíquota de IRRF inválida.')
  if (!(flat >= 0) || !(guarantee >= 0)) return fail('Flat e fiança não podem ser negativos.')

  const step = freq === 0 ? months : freq
  const dates = []
  for (let m = step; m < months; m += step) dates.push(addMonthsIso(start, m))
  const end = addMonthsIso(start, months)
  dates.push(end)

  const avgTermDays = daysBetween(start, end)
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
  dates.forEach((date, i) => {
    const days = daysBetween(prev, date)
    const interest = principal * (rate / 100) * days / 360
    const fee = principal * (guarantee / 100) * days / 360
    const tax = taxOn(interest) + (feesAbroad ? taxOn(fee) : 0)
    const amort = i === dates.length - 1 ? principal : 0
    const usd = interest + tax + fee + amort
    flows.push({ date, days, dc: daysBetween(start, date), interest, irrf: tax, guarantee: fee, principal: amort, usd })
    totals.interest += interest
    totals.irrf += tax
    totals.guarantee += fee
    totals.principal += amort
    totals.usd += usd
    prev = date
  })

  const allIn = irr([{ v: netUsd, t: 0 }, ...flows.map((f) => ({ v: -f.usd, t: f.dc / 365 }))])
  if (allIn == null) return fail('Não foi possível calcular o custo: revise os valores.')
  return {
    ok: true, principal, rate, spot, start, end, months, freq, irrf, grossUp, flat, guarantee, feesAbroad,
    avgTermDays, iofRate, flatUsd, iofUsd, flatIrUsd, netUsd, netBrl: netUsd * spot, flows, totals,
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

// Com proteção. Manual: `di` em % a.a. (252) e `cupom` em % a.a. linear (360), iguais para todos os prazos.
// Com `curve` (de `curveFactors`), cada pagamento usa o DI e o cupom do seu prazo.
// `busDays(inicio, data)` devolve dias úteis; sem ela, estimativa de dias corridos × 252/365.
// `swapSpread`: % a.a. (252) do banco no swap, composto. `ndfMarkup`: % acrescido pelo banco sobre a taxa a termo.
export function hedge4131(loan, { di, cupom, busDays, swapSpread = 0, ndfMarkup = 0, curve = null }) {
  if (!loan?.ok) return fail('Empréstimo inválido.')
  if (!curve && (!(di > 0) || di > 200)) return fail('Informe o DI pré em % ao ano, maior que zero.')
  if (!curve && (!(cupom > -50) || cupom > 200)) return fail('Informe o cupom cambial em % ao ano.')
  if (!(swapSpread >= 0) || !(ndfMarkup >= 0)) return fail('Os acréscimos do banco não podem ser negativos.')
  const du = (f) => (busDays ? busDays(loan.start, f.date) : f.dc * 252 / 365)
  const base = loan.flows.map((f) => {
    const n = du(f)
    const diFactor = curve ? curve.diFactorAt(n) : (1 + di / 100) ** (n / 252)
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
  const ndf = {
    pre: pre * 100,
    cost365: cost365 * 100,
    spread: spread * 100,
    pctCdi: pctCdi(pre),
    totalBrl: flows.reduce((sum, f) => sum + f.brl, 0),
    // Alta do dólar ao ano a partir da qual o NDF sai mais barato que ficar sem proteção.
    breakeven: ((1 + cost365) / (1 + loan.allIn / 100) - 1) * 100,
  }
  return { ok: true, source: curve ? 'curve' : 'manual', di: dAvg * 100, cupom: ccAvg * 100, swapSpread, ndfMarkup, flows, swap, ndf }
}
