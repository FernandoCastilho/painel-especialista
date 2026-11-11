import { loanDates, monthlyRate, MAX_LOAN_MONEY } from './emprestimo.js'
import { resolveCreditIof } from './iofRules.js'
import { cgDate, cgAddDays } from './contaGarantida.js'
import { isBusinessDay, nextBusinessDay } from './holidays.js'

const fail = error => ({ ok: false, error })
const money = v => Number.isFinite(v) && v >= 0 && v <= MAX_LOAN_MONEY
const days = (a, b) => (cgDate(b) - cgDate(a)) / 86400000
// Dias úteis: segunda a sexta, menos os feriados nacionais (calendário do painel) e os feriados extras informados.
export function creditBusinessDays(from, to, holidays = [], national = true) {
  const excluded = new Set(holidays)
  let count = 0
  for (let d = cgDate(from); d < cgDate(to); d = new Date(+d + 86400000)) {
    const day = d.toISOString().slice(0, 10)
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !excluded.has(day) && (!national || isBusinessDay(day, 'BR'))) count++
  }
  return count
}
// Same conventional-flow ACT/365 log-rate bisection used by the BNDES declared-flow calculator.
export function creditCet(net, rows) {
  if (!(net > 0) || !rows.length || rows.some(r => !(r.days > 0) || !money(r.payment))) return null
  const pv = log => rows.reduce((sum, r) => sum + r.payment * Math.exp(-log * r.days / 365), 0)
  if (pv(0) < net - 1e-6) return null
  let lo = 0, hi = 1
  while (pv(hi) > net && hi < 700) hi = Math.min(700, hi * 2)
  if (pv(hi) > net) return null
  for (let i = 0; i < 180; i++) { const mid = (lo + hi) / 2; if (pv(mid) > net) lo = mid; else hi = mid }
  const rate = Math.expm1((lo + hi) / 2)
  // Acima de 1.000% a.a. o resultado deixa de ser informativo (ex.: tarifa quase igual ao valor): tratado como não mensurável.
  return Number.isFinite(rate) && rate <= 10 && Math.abs(pv(Math.log1p(rate)) - net) < 0.001 ? rate : null
}
export function creditOperation(p) {
  const { value, n, rate, unit = 'am', system, start, firstDue, profile = 'pj', eligible = false,
    rateType = 'fixed', cdi = 0, cdiPercent = 100, fees = 0, monthlyFees = 0, holidays = [], guaranteeValue = null } = p
  if (!money(value) || value <= 0 || !Number.isInteger(n) || n < 1 || n > 600) return fail('Informe valor positivo e de 1 a 600 parcelas.')
  if (!['price', 'sac', 'bullet'].includes(system) || !['fixed', 'cdi'].includes(rateType) || !['am', 'aa'].includes(unit)) return fail('Confira sistema e tipo de taxa.')
  if (![rate, cdi, cdiPercent].every(v => Number.isFinite(v) && v >= 0 && v <= 1000) || !money(fees) || !money(monthlyFees)) return fail('Confira taxas e encargos: valores vazios, negativos ou acima do limite não são aceitos.')
  if (guaranteeValue !== null && !money(guaranteeValue)) return fail('Confira o valor da garantia ou deixe-o vazio quando não mensurável.')
  if (!Array.isArray(holidays) || holidays.some(d => !cgDate(d))) return fail('Informe feriados como datas AAAA-MM-DD.')
  // Vencimento em dia não útil passa para o próximo dia útil (fins de semana, feriados nacionais e os extras informados).
  const extra = new Set(holidays)
  const nextUseful = day => { let d = nextBusinessDay(day, ['BR']); for (let k = 0; k < 40 && extra.has(d); k++) d = nextBusinessDay(cgAddDays(d, 1), ['BR']); return d }
  const raw = loanDates(start, firstDue, system === 'bullet' ? 1 : n)
  const dates = raw && raw.map(d => { const date = nextUseful(d.date); return { date, days: days(start, date) } })
  if (!dates || dates.at(-1).days > 22000) return fail('Informe datas reais, primeiro pagamento posterior à liberação e horizonte de até 60 anos.')
  const tax = resolveCreditIof({ date: start, profile, operationValue: value, eligible })
  if (!tax.ok) return fail(tax.error)
  const monthly = monthlyRate(rate, unit)
  const logFactor = (from, to) => rateType === 'fixed' ? Math.log1p(monthly) * days(from, to) / 30
    : (Math.log1p(Math.expm1(Math.log1p(cdi / 100) / 252) * cdiPercent / 100) + Math.log1p(monthly) * 12 / 252) * creditBusinessDays(from, to, holidays)
  // First due beyond 30 civil days is a capitalized grace period. Bullet uses its sole maturity instead.
  // Carência capitalizada só quando o 1º vencimento contratado passa de 30 dias. Dias a mais vindos do ajuste para dia útil
  // são cobrados na própria 1ª parcela (juros pelos dias reais do período), sem capitalizar no saldo.
  const graceDays = system === 'bullet' ? 0 : Math.max(0, Math.min(raw[0].days, dates[0].days) - 30)
  const graceEnd = cgAddDays(start, graceDays)
  const opening = value * Math.exp(logFactor(start, graceEnd))
  let prior = graceEnd
  const logs = dates.map(d => { const log = logFactor(prior, d.date); prior = d.date; return log })
  let cumulative = 0
  const discountSum = logs.reduce((sum, log) => { cumulative += log; return sum + Math.exp(-cumulative) }, 0)
  const installment = opening / discountSum
  let balance = opening, originalBalance = value, paid = 0, interestTotal = opening - value
  const rows = dates.map((d, k) => {
    const interest = balance * Math.expm1(logs[k])
    const amortization = k === dates.length - 1 ? balance : system === 'sac' ? opening / n : installment - interest
    const originalAmortization = k === dates.length - 1 ? originalBalance : amortization * value / opening
    balance -= amortization; originalBalance -= originalAmortization
    const payment = amortization + interest + monthlyFees
    interestTotal += interest; paid += payment
    return { ...d, number: k + 1, interest, amortization, originalAmortization, payment, balance: Math.max(0, balance), cumulative: paid }
  })
  if (!money(opening) || !money(paid) || rows.some(r => !money(r.payment) || r.amortization < -0.000001 || !money(r.interest))) return fail('Condições fora do limite numérico ou com amortização negativa. Reduza taxa, prazo ou carência.')
  const iofFixed = value * tax.additional / 100
  const iofDaily = rows.reduce((sum, r) => sum + r.originalAmortization * Math.min(r.days, tax.maxDays) * tax.daily / 100, 0)
  const iof = iofFixed + iofDaily, net = value - fees - iof
  if (!(net > 0)) return fail('IOF e encargos iniciais devem ser menores que o valor contratado.')
  const cet = creditCet(net, rows)
  if (cet === null) return fail('Não foi possível reconciliar o CET deste fluxo dentro da precisão necessária.')
  // Res. CMN 4.881/2020, art. 5º: taxa flutuante (CDI) não entra no CET regulatório. No pós-fixado, o CET regulatório é o
  // do mesmo contrato com CDI zero: só o spread, na mesma base de dias úteis/252, feriados e datas. `cet` continua sendo o
  // custo com o CDI projetado. No prefixado, os dois coincidem.
  let cetRegulatory = cet, regulatoryNet = net
  if (rateType === 'cdi' && cdi !== 0) {
    const fixedPart = creditOperation({ ...p, cdi: 0 })
    cetRegulatory = fixedPart.ok ? fixedPart.cet : null
    regulatoryNet = fixedPart.ok ? fixedPart.net : null
  }
  return { ok: true, value, net, rows, iof, iofFixed, iofDaily, fees, monthlyFees, tax, interest: interestTotal,
    total: paid + fees + iof, cost: paid - net, paid, cet, cetRegulatory, regulatoryNet, graceDays, capitalizedGrace: opening - value,
    coverage: guaranteeValue === null ? null : guaranteeValue / value * 100, guaranteeValue,
    maxPayment: Math.max(...rows.map(r => r.payment)), lastDate: rows.at(-1).date }
}
// Capital de Giro (calculadora própria): mesmo motor do Comparador. Juros prefixados por dias corridos entre vencimentos
// ((1 + taxa a.m.)^(dias/30)), vencimentos no próximo dia útil (feriados nacionais), IOF e TAC descontados na liberação e
// CET da Resolução CMN 4.881 (dias corridos/365). No Bullet, o pagamento único cai no último vencimento do calendário mensal.
export function giroOperation({ value, n, rate, unit = 'am', system, start, firstDue, profile = 'pj', eligible = false, fees = 0 }) {
  if (!['price', 'sac', 'bullet'].includes(system)) return fail('Escolha o sistema de amortização.')
  const due = system === 'bullet' ? loanDates(start, firstDue, n)?.at(-1)?.date : firstDue
  if (!due) return fail('Informe a liberação e o primeiro vencimento mensal posterior à liberação.')
  const r = creditOperation({ value, n, rate, unit, system, start, firstDue: due, profile, eligible, rateType: 'fixed', fees, monthlyFees: 0, holidays: [] })
  if (!r.ok) return r
  return { ...r, system, n, installment: system === 'bullet' ? null : r.rows[0].payment, last: system === 'sac' ? r.rows.at(-1).payment : null }
}

// Recalculate the actual operation, including the Simples R$30,000 tax boundary; never scale fees or flows.
export function equivalentCredit(p, target) {
  if (!money(target) || target <= 0) return fail('Informe o valor líquido comum, maior que zero.')
  // Within each IOF bracket, net = principal * (1 - IOF ratio) - initial fees.
  // Solve each bracket analytically, then generate and validate the entire actual flow.
  // A too-large upper probe must not reject an attainable smaller operation.
  const probes = p.profile === 'simples' ? [30000, 30001] : [1000]
  for (const value of probes) {
    const probe = creditOperation({ ...p, value, fees: 0, monthlyFees: 0 })
    if (!probe.ok) continue
    const candidate = (target + (p.fees ?? 0)) / (probe.net / value)
    if (!money(candidate)) continue
    const result = creditOperation({ ...p, value: candidate })
    if (result.ok && Math.abs(result.net - target) < 0.01) return result
  }
  return fail('Não foi possível reconciliar o líquido comum com estas condições e limites numéricos.')
}
export function creditMarketReference(macro, now = Date.now()) {
  const points = (macro?.cdi || []).filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(new Date(p[0]).getTime()) && Number.isFinite(p[1]) && p[1] >= 0 && p[1] <= 1000 && p[0] <= now).sort((a, b) => b[0] - a[0])
  if (!points.length) return null
  const [timestamp, value] = points[0]
  return { value, date: new Date(timestamp).toISOString().slice(0, 10), stale: !!macro?.stale?.cdi || now - timestamp > 7 * 86400000, source: 'B3 / BCB · SGS 4389' }
}
