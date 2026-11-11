import { resolveCreditIof } from './iofRules.js'
import { parseMoneyInput } from './moneyInput.js'
import { parseDecimal } from './emprestimo.js'
import { creditCet } from './creditComparison.js'
import { isBusinessDay } from './holidays.js'

export const CG_LEGAL_CHECKED_AT = '2026-11-05'
export const CG_PRESET_FROM = '2025-07-17'
export const CG_MAX_DAYS = 3660
// Res. CMN 4.881/2020, art. 6º (resumo do painel em educacao.js): rotativo calcula o CET com prazo de 30 dias e o limite pactuado.
export const CG_CET_DAYS = 30
export const CG_TAX_PROFILES = [
  { id: 'pj', label: 'Pessoa jurídica: referência geral', daily: 0.0082, additional: 0.38 },
  { id: 'simples', label: 'Simples/MEI: redução somente até R$ 30 mil', daily: 0.00274, additional: 0.38 },
]
export const CG_SOURCES = [
  { label: 'Decreto 6.306/2007 atualizado: art. 7º', url: 'https://www2.camara.leg.br/legin/fed/decret/2007/decreto-6306-14-dezembro-2007-566561-normaatualizada-pe.html' },
  { label: 'Receita Federal: orientação de julho de 2025', url: 'https://www.gov.br/fazenda/pt-br/canais_atendimento/imprensa/notas-a-imprensa/2025/julho/receita-federal-do-brasil-explica-como-ficam-os-pagamentos-do-iof-diante-do-novo-entendimento/' },
]
const DAY = 86400000, MAX_MONEY = 1e12
const validMoney = (n) => Number.isFinite(n) && n >= 0 && n <= MAX_MONEY
const validPercent = (n) => Number.isFinite(n) && n >= 0 && n <= 100
const fail = (error) => ({ ok: false, error })
export function cgDate(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const [y, m, d] = text.split('-').map(Number)
  if (y < 1900 || y > 2199) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null
}
export function cgAddDays(text, days) {
  const date = cgDate(text)
  if (!date || !Number.isInteger(days) || Math.abs(days) > CG_MAX_DAYS) return null
  const result = new Date(date.getTime() + days * DAY).toISOString().slice(0, 10)
  return cgDate(result) ? result : null
}
export function cgToday(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
export function cgInitialForm(today = cgToday()) {
  return {
    mode: 'single', start: today, end: cgAddDays(today, 10), duration: '10', dateMode: 'duration', amount: '',
    rate: '', rateBase: '30', conversion: 'proportional', dayCount: 'calendar', holidays: '',
    taxProfile: 'pj', eligible: false, operationValue: '', limit: '',
    status: 'performing', rows: [{ id: 'first', date: today, draw: '', payment: '' }],
  }
}

// The explicit daily close convention is a simulation, not a reconstruction of a bank ledger.
// All movements on one date are netted. No positive account balance or intraday overdraft is modeled.
export function simulateContaGarantida(input) {
  const { start, end, rate, rateBase, conversion, dayCount, events = [], holidays = [], settleAllAtEnd = false } = input
  const from = cgDate(start), to = cgDate(end)
  if (!from || !to || to < from || (to - from) / DAY > CG_MAX_DAYS) return fail('Informe datas válidas, em ordem, em um intervalo de até 3.660 dias.')
  if (!validPercent(rate) || ![1, 30, 360, 365, 252].includes(rateBase) || !['proportional', 'equivalent'].includes(conversion)) return fail('Confira a taxa e sua conversão diária.')
  if (!['calendar', 'business'].includes(dayCount)) return fail('Confira a contagem dos dias.')
  if (input.capitalization && input.capitalization !== 'separate') return fail('Este simulador não incorpora juros ou IOF ao saldo utilizado.')
  const tax = resolveCreditIof({ date: start, profile: input.taxProfile || 'pj', operationValue: input.taxProfile === 'simples' ? input.operationValue : Array.isArray(events) ? events.reduce((sum, event) => sum + (Number.isFinite(event.draw) ? event.draw : 0), 0) : 0, eligible: input.eligible })
  if (!tax.ok) return fail(tax.error)
  const iofDaily = tax.daily, iofAdditional = tax.additional
  if (!Array.isArray(holidays) || holidays.some(d => !cgDate(d))) return fail('Confira alíquotas e feriados.')
  if (!Array.isArray(events) || events.length > 500) return fail('Use até 500 lançamentos.')
  const byDate = new Map()
  for (const event of events) {
    if (!cgDate(event.date) || event.date < start || event.date > end || ![event.draw, event.payment].every(validMoney)) return fail('Há lançamento inválido ou fora do período.')
    if (event.charges != null && event.charges !== 0) return fail('Encargos não são incorporados ao saldo nesta simulação.')
    const total = byDate.get(event.date) || { draw: 0, payment: 0 }
    for (const key of ['draw', 'payment']) total[key] += event[key]
    if (!Object.values(total).every(validMoney)) return fail('Os lançamentos do dia excedem o limite de cálculo.')
    byDate.set(event.date, total)
  }
  const dailyRate = conversion === 'proportional' ? rate / 100 / rateBase : Math.expm1(Math.log1p(rate / 100) / rateBase)
  const nonworking = new Set(holidays), rows = [], months = new Map()
  let balance = 0
  const totals = { draw: 0, payment: 0, interest: 0, dailyIof: 0, additionalIof: 0, dailyBase: 0, additionalBase: 0, interestDays: 0 }
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) {
    const date = new Date(t).toISOString().slice(0, 10), month = date.slice(0, 7)
    const { draw = 0 } = byDate.get(date) || {}
    let { payment = 0 } = byDate.get(date) || {}
    const previousClose = balance
    if (settleAllAtEnd && date === end) payment = balance + draw
    if (payment > balance + draw + 0.0000001) return fail('Amortização em ' + date + ' supera o saldo utilizado. Não há saldo credor nesta simulação.')
    balance = Math.max(0, balance + draw - payment)
    const dow = new Date(t).getUTCDay()
    // Dias úteis: segunda a sexta, fora os feriados nacionais do calendário do painel e os feriados extras informados.
    const countsInterest = dayCount === 'calendar' || (dow !== 0 && dow !== 6 && !nonworking.has(date) && isBusinessDay(date, 'BR'))
    const interest = countsInterest ? balance * dailyRate : 0
    // User scope: interest and IOF are paid separately, never added to utilized principal.
    const additionalBase = Math.max(0, balance - previousClose)
    const dailyIof = balance * iofDaily / 100, additionalIof = additionalBase * iofAdditional / 100
    const row = { date, draw, payment, interest, countsInterest, balance, additionalBase, dailyIof, additionalIof }
    if (![balance, interest, dailyIof, additionalIof].every(validMoney)) return fail('O resultado excedeu o limite numérico. Reduza valores, taxa ou prazo.')
    if (input.taxProfile === 'simples' && balance > input.operationValue) return fail('O saldo utilizado supera o valor contratual declarado.')
    rows.push(row)
    const aggregate = months.get(month) || { month, days: 0, interest: 0, dailyBase: 0, additionalBase: 0, dailyIof: 0, additionalIof: 0 }
    aggregate.days++
    for (const key of ['interest', 'additionalBase', 'dailyIof', 'additionalIof']) aggregate[key] += row[key]
    aggregate.dailyBase += balance
    months.set(month, aggregate)
    for (const key of ['draw', 'payment', 'interest', 'additionalBase', 'dailyIof', 'additionalIof']) totals[key] += row[key]
    totals.dailyBase += balance
    if (countsInterest && balance > 0) totals.interestDays++
  }
  totals.iof = totals.dailyIof + totals.additionalIof
  totals.cost = totals.interest + totals.iof
  if (!Object.values(totals).every(n => Number.isFinite(n) && n <= Number.MAX_SAFE_INTEGER / 100)) return fail('O acumulado excedeu o limite de cálculo.')
  return { ok: true, rows, months: [...months.values()], totals, dailyRate, calendarDays: (to - from) / DAY, balance }
}

// CET regulatório da conta garantida (Res. CMN 4.881/2020, arts. 4º e 6º): o limite pactuado é liberado na data inicial e
// devolvido em 30 dias corridos. Juros e IOF saem do próprio simulador de saldo (mesma taxa, base, contagem de dias e
// enquadramento da tela). O IOF adicional (0,38%) é cobrado na utilização: sai do valor líquido na liberação. Juros e IOF
// diário, apurados dia a dia, entram no pagamento do 30º dia. Não há tarifas no motor.
export function contaGarantidaCet({ limit, start, rate, rateBase = 30, conversion = 'proportional', dayCount = 'calendar', holidays = [], taxProfile = 'pj', eligible = false, operationValue }) {
  if (!(Number.isFinite(limit) && limit > 0 && limit <= MAX_MONEY)) return fail('Informe o limite contratado, maior que zero.')
  const end = cgAddDays(start, CG_CET_DAYS)
  if (!end) return fail('Informe uma data inicial válida para o CET.')
  const sim = simulateContaGarantida({ start, end, rate, rateBase, conversion, dayCount, holidays, taxProfile, eligible,
    operationValue: taxProfile === 'simples' ? operationValue : limit, events: [{ date: start, draw: limit, payment: 0 }], settleAllAtEnd: true })
  if (!sim.ok) return fail(taxProfile === 'simples' && /valor contratual/.test(sim.error) ? 'O limite contratado supera o valor contratual declarado para o Simples/MEI.' : sim.error)
  const { interest, dailyIof, additionalIof, iof } = sim.totals
  const net = limit - additionalIof, payment = limit + interest + dailyIof
  const annual = creditCet(net, [{ days: CG_CET_DAYS, payment }])
  if (annual === null) return fail('Não foi possível calcular o CET deste fluxo.')
  return { ok: true, limit, net, start, end, days: CG_CET_DAYS, payment, interest, dailyIof, additionalIof, iof, annual, monthly: Math.expm1(Math.log1p(annual) / 12) }
}

export function parseContaGarantidaForm(form) {
  const errors = {}, warnings = [], params = {}
  const money = (key, value = form[key], optional = false) => {
    const parsed = parseMoneyInput(value, { optional })
    if (!parsed.ok || parsed.value > MAX_MONEY) { errors[key] = parsed.error || 'Use um valor de até R$ 1 trilhão.'; return null }
    return parsed.value
  }
  const decimal = (key) => {
    const n = parseDecimal(form[key])
    if (!validPercent(n)) errors[key] = 'Informe um percentual de 0 a 100. Campo vazio não é zero.'
    return n
  }
  if (!['single', 'ledger'].includes(form.mode)) errors.mode = 'Escolha o modo de simulação.'
  params.start = form.start
  if (!cgDate(form.start)) errors.start = 'Informe uma data real entre 1900 e 2199.'
  params.end = form.end
  if (form.mode === 'single' && form.dateMode === 'duration') {
    const days = /^\d+$/.test(form.duration) ? Number(form.duration) : -1
    if (days < 0 || days > CG_MAX_DAYS) errors.duration = 'Informe de 0 a 3.660 dias corridos.'
    params.end = cgAddDays(form.start, days)
  }
  if (!cgDate(params.end) || params.end < form.start || (cgDate(params.end) - cgDate(form.start)) / DAY > CG_MAX_DAYS) errors.end = 'Informe uma data final válida, não anterior à inicial, em até 3.660 dias.'
  params.rate = decimal('rate')
  params.rateBase = Number(form.rateBase)
  params.conversion = form.conversion
  params.dayCount = form.dayCount
  params.holidays = form.dayCount === 'business' && form.holidays.trim() ? form.holidays.trim().split(/[\s,;]+/) : []
  if (params.holidays.some(d => !cgDate(d))) errors.holidays = 'Use datas reais no formato AAAA-MM-DD, separadas por vírgula ou linha.'
  if (form.dayCount === 'business') warnings.push('Dias úteis = segunda a sexta, menos os feriados nacionais do calendário do painel e os feriados extras que você informou. Feriados locais do contrato precisam ser informados.')
  const profile = CG_TAX_PROFILES.find(p => p.id === form.taxProfile)
  if (!profile) errors.taxProfile = 'Escolha a referência de IOF.'
  params.taxProfile = form.taxProfile
  params.eligible = form.eligible
  params.operationValue = profile?.id === 'simples' ? money('operationValue') : form.mode === 'single' ? money('amount') : (form.rows || []).reduce((sum, row) => sum + (parseMoneyInput(row.draw, { optional: true }).value || 0), 0)
  const tax = resolveCreditIof({ date: form.start, profile: form.taxProfile, operationValue: params.operationValue, eligible: form.eligible })
  if (!tax.ok) errors.taxProfile = tax.error
  params.iofDaily = tax.ok ? tax.daily : undefined
  params.iofAdditional = tax.ok ? tax.additional : undefined
  if (params.end > CG_LEGAL_CHECKED_AT) warnings.push('Projeção mantém as alíquotas consultadas; não antecipa mudanças futuras na legislação.')
  if (form.status !== 'performing') errors.status = 'Esta versão só simula operação adimplente. Inadimplência, renegociação e principal contratualmente definido exigem regras próprias.'
  if (profile?.id === 'simples') {
    const operationValue = money('operationValue')
    if (!(operationValue > 0)) errors.operationValue = 'Informe o valor contratual total maior que zero. Acima de R$ 30 mil aplica-se a alíquota geral.'
    if (!form.eligible) errors.eligible = 'Confirme o enquadramento e a documentação com a instituição; saldo momentâneo de até R$ 30 mil não basta.'
  }
  params.events = []
  if (form.mode === 'single') {
    const amount = money('amount')
    params.events.push({ date: form.start, draw: amount, payment: 0 })
    params.settleAllAtEnd = true
  } else if (!Array.isArray(form.rows) || !form.rows.length || form.rows.length > 500) errors.rows = 'Inclua de 1 a 500 lançamentos.'
  else form.rows.forEach((row, i) => {
    const key = `row-${row.id || i}`
    if (!cgDate(row.date) || row.date < form.start || row.date > params.end) errors[`${key}-date`] = 'Data real, dentro do período da simulação.'
    params.events.push({ date: row.date, draw: money(`${key}-draw`, row.draw, true), payment: money(`${key}-payment`, row.payment, true) })
  })
  // Limite contratado: opcional. Vazio = sem CET; preenchido precisa ser maior que zero.
  const limitText = String(form.limit ?? '').trim()
  params.limit = limitText ? money('limit', limitText) : null
  if (limitText && params.limit !== null && !(params.limit > 0)) errors.limit = 'Informe um limite maior que zero ou deixe o campo vazio.'
  if (Object.keys(errors).length) return { errors, warnings, params, result: null, cet: null }
  const result = simulateContaGarantida(params)
  if (result.ok && profile?.id === 'simples' && result.rows.some(row => row.balance > money('operationValue'))) errors.operationValue = 'O principal utilizado supera o valor contratual declarado. Reveja a operação e o enquadramento.'
  if (result.ok && params.limit > 0 && result.rows.some(row => row.balance > params.limit + 0.0000001)) warnings.push('O saldo utilizado passa do limite contratado informado. Excesso de limite não é simulado.')
  const ok = !Object.keys(errors).length && result.ok
  const cet = ok && params.limit > 0 ? contaGarantidaCet({ ...params, limit: params.limit }) : null
  return { errors, warnings, params, result: Object.keys(errors).length ? null : result, cet }
}
