// Aplicação financeira de pessoa jurídica (CDB e fundo de renda fixa) com a tributação pelo regime da empresa.
// Rendimento do DI projetado pela curva DI x pré da B3; dias úteis pelos feriados nacionais.
//
// Regras (pesquisa de 11/11/2026, aprovada por Fernando; ver docs/aplicacao-financeira-pj.md):
// - Simples Nacional: o IR retido na fonte é o imposto final (LC 123/2006, art. 13, § 1º, V). CDB: 22,5% / 20% / 17,5% / 15%
//   conforme o prazo. Fundo: come-cotas no último dia útil de maio e novembro (15% longo prazo, 20% curto prazo) e complemento no resgate.
// - Lucro Presumido: o rendimento entra inteiro na base de IRPJ e CSLL no resgate (Lei 9.430/1996, art. 25, II; IN RFB 1.700/2017,
//   art. 216, § 1º). IR retido e come-cotas são antecipação. PIS/Cofins cumulativo não incide sobre receita financeira.
// - Lucro Real: IRPJ e CSLL pelo regime de competência; PIS/Cofins de 0,65% + 4% sobre receita financeira até 31/12/2026
//   (Decreto 8.426/2015), dedutíveis da base do IRPJ/CSLL; a partir de 2027 a CBS não incide sobre rendimento financeiro
//   (LC 214/2025, art. 6º, V). Despesas do crédito (juros, IOF, tarifas) reduzem a base do IRPJ/CSLL.
// - IOF sobre o rendimento no resgate com menos de 30 dias (tabela regressiva do Decreto 6.306/2007).
// Simplificações declaradas: imposto do Lucro Real pago no fim de cada mês; imposto do Presumido no momento do resgate;
// resgate parcial leva principal e rendimento na mesma proporção; prejuízo fiscal não é considerado.
import { growthAt } from './cdiFuturo.js'
import { isBusinessDay } from './holidays.js'

export const REGIMES = [
  { id: 'real', label: 'Lucro Real' },
  { id: 'presumido', label: 'Lucro Presumido' },
  { id: 'simples', label: 'Simples Nacional' },
]
export const PRODUCTS = [
  { id: 'cdb-pos', label: 'CDB pós-fixado (% do CDI)' },
  { id: 'cdb-pre', label: 'CDB prefixado' },
  { id: 'fundo-lp', label: 'Fundo de renda fixa · longo prazo' },
  { id: 'fundo-cp', label: 'Fundo de renda fixa · curto prazo' },
]
export const PIS_COFINS = 0.0465
export const PIS_COFINS_END = '2026-12-31'
const IOF_TABLE = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3]

const DAY = 864e5
const ms = (iso) => Date.parse(`${iso}T12:00:00Z`)
const addDay = (iso) => new Date(ms(iso) + DAY).toISOString().slice(0, 10)
const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / DAY)

export function iofRate(days) {
  return days >= 1 && days < 30 ? IOF_TABLE[days - 1] / 100 : days < 1 ? 1 : 0
}
export function irRate(days, product) {
  if (product === 'fundo-cp') return days <= 180 ? 0.225 : 0.2
  return days <= 180 ? 0.225 : days <= 360 ? 0.2 : days <= 720 ? 0.175 : 0.15
}
// IRPJ (15% + adicional de 10%) e CSLL (9%) sobre o lucro.
export const incomeTaxRate = (adicional) => (adicional ? 0.34 : 0.24)
// Economia de imposto por real de despesa do crédito: só no Lucro Real.
export const expenseShield = (regime, adicional) => (regime === 'real' ? incomeTaxRate(adicional) : 0)

const isFund = (p) => p === 'fundo-lp' || p === 'fundo-cp'
const lastBusinessOfMonth = (iso, ctx) => {
  const [y, m] = iso.split('-').map(Number)
  let d = new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10)
  while (!isBusinessDay(d, 'BR', ctx)) d = new Date(ms(d) - DAY).toISOString().slice(0, 10)
  return d
}

function validate(p) {
  if (!REGIMES.some((r) => r.id === p.regime)) return 'Escolha o regime tributário da empresa.'
  if (!PRODUCTS.some((r) => r.id === p.product)) return 'Escolha o produto da aplicação.'
  if (!Number.isFinite(p.rate) || p.rate <= 0 || p.rate > 1000) return p.product === 'cdb-pre' ? 'Informe a taxa da aplicação (% a.a.).' : 'Informe o percentual do CDI da aplicação.'
  if (isFund(p.product) && !(Number.isFinite(p.adminFee) && p.adminFee >= 0 && p.adminFee < 20)) return 'Informe a taxa de administração do fundo (% a.a.).'
  if (!p.curveBase || !p.pts?.length) return 'A aplicação usa a curva DI, indisponível agora.'
  if (!p.start || p.start < p.curveBase) return `A curva DI começa em ${p.curveBase.split('-').reverse().join('/')}: a liberação precisa ser a partir dessa data.`
  return null
}

// Simulação dia a dia. `start` é a data da aplicação; `end` a do último movimento; `deposit` o valor aplicado;
// `moves` = [{ date, payment, expense }] saídas para pagar o crédito (expense = parte dedutível no Lucro Real).
export function simulateInvestment(p) {
  const error = validate(p)
  if (error) return { ok: false, error }
  const { regime, product, rate, adminFee = 0, adicional = true, pts, curveBase, start, ctx = {}, shift = 0 } = p
  const moves = [...(p.moves ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1))
  const end = p.end ?? moves.at(-1)?.date
  if (!end || end <= start) return { ok: false, error: 'O prazo da aplicação precisa terminar depois da liberação.' }
  const fund = isFund(product)
  const t = incomeTaxRate(adicional)
  const shield = expenseShield(regime, adicional)
  const fee = fund ? (1 + adminFee / 100) ** (1 / 252) : 1
  const ccRate = product === 'fundo-cp' ? 0.2 : 0.15
  const useCc = fund && regime === 'simples'

  // dias úteis desde a data-base da curva até a liberação
  let du = 0
  for (let d = addDay(curveBase); d <= start; d = addDay(d)) if (isBusinessDay(d, 'BR', ctx)) du++
  const maxDu = Math.max(...pts.map((x) => x[0]))

  let B = p.deposit // saldo
  let P = p.deposit // principal remanescente
  let CCP = 0 // come-cotas já pago sobre o saldo remanescente (Simples, fundo)
  let GC = 0 // rendimento bruto do saldo remanescente que já passou pelo come-cotas
  let GG = 0 // Lucro Real: rendimento bruto do saldo remanescente (o imposto mensal sai do saldo, não da base do IOF/IR retido)
  let accruedMonth = 0
  let accruedMonthPis = 0
  const totals = { gross: 0, tax: 0, pisCofins: 0, iof: 0, withheld: 0, shield: 0, withdrawn: 0, shortfall: 0 }
  if (shield && p.upfrontExpense > 0) { B += shield * p.upfrontExpense; P += shield * p.upfrontExpense; totals.shield += shield * p.upfrontExpense }

  // Resgate de `net` líquido (ou de todo o saldo quando `all`). Devolve o que saiu de fato.
  const withdraw = (date, net, all = false) => {
    if (B <= 0) { totals.shortfall += all ? 0 : net; return 0 }
    const days = daysBetween(start, date)
    const gainRatio = Math.max(0, (B + CCP - P) / B)
    let unit = 0 // imposto por real resgatado do saldo
    let iofUnit = 0
    let withheldUnit = 0
    if (regime === 'simples' || regime === 'presumido') {
      const iof = iofRate(days)
      iofUnit = gainRatio * iof
      const reg = irRate(days, product)
      withheldUnit = gainRatio * (1 - iof) * reg - (useCc ? CCP / B : 0)
      const final = regime === 'simples' ? reg : t
      unit = iofUnit + gainRatio * (1 - iof) * final - (useCc ? CCP / B : 0)
    } else {
      // Lucro Real: o imposto já foi pago por competência; o IR retido é antecipação compensada.
      // O IOF incide sobre o rendimento bruto e é despesa dedutível: devolve IRPJ/CSLL.
      const realGain = Math.min(1, GG / B)
      const iof = iofRate(days)
      iofUnit = realGain * iof
      unit = iofUnit * (1 - t)
      withheldUnit = realGain * (1 - iof) * irRate(days, product)
    }
    unit = Math.min(Math.max(unit, 0), 0.999)
    let W = all ? B : net / (1 - unit)
    if (W > B) { totals.shortfall += net - B * (1 - unit); W = B }
    const f = W / B
    const tax = W * unit
    totals.tax += tax - W * iofUnit
    totals.iof += W * iofUnit
    totals.withheld += W * withheldUnit
    totals.withdrawn += W - tax
    B -= W; P -= f * P; CCP -= f * CCP; GC -= f * GC; GG -= f * GG
    if (B < 1e-9) { B = 0; P = 0; CCP = 0; GC = 0; GG = 0 }
    return W - tax
  }

  let mi = 0
  const accrueTaxReal = () => {
    if (regime !== 'real') return
    const pis = accruedMonthPis * PIS_COFINS
    const irc = (accruedMonth - pis) * t
    totals.pisCofins += pis
    totals.tax += irc
    // sem saldo para pagar o imposto do mês: a diferença vira falta de caixa
    if (pis + irc > Math.max(B, 0)) totals.shortfall += pis + irc - Math.max(B, 0)
    B = Math.max(0, B - pis - irc)
    if (B === 0) GG = 0
    accruedMonth = 0; accruedMonthPis = 0
  }
  for (let d = addDay(start); d <= end; d = addDay(d)) {
    if (isBusinessDay(d, 'BR', ctx)) {
      du++
      if (du > maxDu) return { ok: false, error: 'O prazo passa do último vértice da curva DI.' }
      let daily = growthAt(pts, du) / growthAt(pts, du - 1) - 1
      if (shift) daily = Math.max(0, ((1 + daily) ** 252 + shift / 100) ** (1 / 252) - 1)
      const r = product === 'cdb-pre' ? (1 + rate / 100) ** (1 / 252) - 1 : (rate / 100) * daily
      const before = B
      if (B > 0) B = (B * (1 + r)) / fee
      const gain = B - before
      totals.gross += gain
      GG += gain
      accruedMonth += gain
      if (d <= PIS_COFINS_END) accruedMonthPis += gain
      if (useCc && (d.slice(5, 7) === '05' || d.slice(5, 7) === '11') && d === lastBusinessOfMonth(d, ctx) && B > 0) {
        const unrealized = B + CCP - P
        const cc = Math.max(0, (unrealized - GC) * ccRate)
        GC = unrealized
        B -= cc; CCP += cc; totals.withheld += cc; totals.tax += cc
      }
    }
    if (regime === 'real' && (d.slice(8) === lastDay(d) || d === end)) accrueTaxReal()
    while (mi < moves.length && moves[mi].date === d) {
      const mv = moves[mi++]
      if (shield && mv.expense > 0) { B += shield * mv.expense; P += shield * mv.expense; totals.shield += shield * mv.expense }
      withdraw(d, mv.payment)
    }
  }
  // Encerramento: resgata o que sobrou.
  const finalNet = B > 0 ? withdraw(end, 0, true) : 0
  const days = daysBetween(start, end)
  return {
    ok: true, start, end, days, deposit: p.deposit,
    gross: totals.gross, tax: totals.tax, pisCofins: totals.pisCofins, iof: totals.iof, withheld: totals.withheld,
    shield: totals.shield, shortfall: totals.shortfall, finalNet,
    leftover: finalNet - totals.shortfall,
    net: totals.gross - totals.tax - totals.pisCofins - totals.iof,
  }
}
const lastDay = (iso) => {
  const [y, m] = iso.split('-').map(Number)
  return String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')
}

// Aplicação isolada: valor aplicado do início ao fim, resgate único.
export function investmentAlone(p) {
  const r = simulateInvestment({ ...p, moves: [] })
  if (!r.ok) return r
  const years = r.days / 365
  const netRate = r.deposit > 0 && years > 0 ? ((1 + r.net / r.deposit) ** (1 / years) - 1) * 100 : null
  return { ...r, netRate }
}

// Crédito x caixa próprio: a empresa recebe o líquido do crédito, mantém essa quantia aplicada e resgata para pagar
// cada parcela. Sobra positiva no fim = tomar o crédito e manter o caixa aplicado rendeu mais do que usar o caixa próprio.
export function creditVsCash(credit, p) {
  if (!credit?.ok) return { ok: false, error: credit?.error ?? 'Operação inválida.' }
  // Despesa dedutível de cada parcela: juros e tarifas pagos; os juros capitalizados (carência) entram junto com a
  // amortização, então a diferença para o custo total é distribuída na proporção dos pagamentos.
  const direct = credit.rows.map((row) => Math.max(0, row.payment - (row.amortization ?? 0)))
  const periodic = Math.max(0, credit.rows.reduce((a, r) => a + r.payment, 0) - credit.value)
  const paidTotal = credit.rows.reduce((a, r) => a + r.payment, 0)
  const rest = Math.max(0, periodic - direct.reduce((a, b) => a + b, 0))
  const moves = credit.rows.map((row, i) => ({ date: row.date, payment: row.payment, expense: direct[i] + (paidTotal > 0 ? (rest * row.payment) / paidTotal : 0) }))
  return simulateInvestment({ ...p, start: credit.start, end: credit.lastDate, deposit: credit.net, moves, upfrontExpense: Math.max(0, credit.value - credit.net) })
}
