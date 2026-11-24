import { parseMoneyInput } from './moneyInput.js'
import { parseDecimal } from './emprestimo.js'
import { resolveCreditIof } from './iofRules.js'
import { creditCet, giroOperation } from './creditComparison.js'
import { nextBusinessDay, paymentCalendars } from './holidays.js'
import { PRACA_PADRAO, contractCalendars, pracaContrato } from './pracaContrato.js'

export const DISCOUNT_TERMS = Object.freeze([12, 24, 36, 48])
export const TITLE_FEE_MODES = Object.freeze([
  { id: 'total', label: 'Total por operação (R$)' },
  { id: 'unit', label: 'Custo unitário × quantidade de títulos' },
  { id: 'percent', label: 'Percentual do valor da operação' },
])
// Os campos vazios são decisões pendentes, nunca zeros implícitos.
export const DISCOUNT_INITIAL_FORM = Object.freeze({
  date: '2026-11-05', operationRate: '1,83',
  titleFeeMode: '', titleFeeTotal: '564,00', titleFeeUnit: '', titleFeePercent: '0,25',
  tac: '260,00',
  operations: '6', averageValue: '225.600,43', discountRate: '1,75',
  giroPrincipalMode: 'monthly', giroPrincipal: '', giroRate: '1,83', giroTac: '3.150,00',
  taxProfile: 'pj', eligible: false, giroTaxProfile: 'pj', giroEligible: false,
  convention: 'commercial30', praca: PRACA_PADRAO,
  // A tela abre pelo prazo médio (24/11/2026); 'titles' é o borderô título a título, com os grupos abaixo.
  titleMode: 'average', totalValue: '225.600,43', averageDays: '30', averageTicket: '7.520,00',
  titleRows: [{ value: '225.600,43', count: '30', dueDate: '2026-12-05' }],
})

const MAX_MONEY = Number.MAX_SAFE_INTEGER / 100
const money = (n, positive = false) => Number.isFinite(n) && n >= (positive ? Number.MIN_VALUE : 0) && n <= MAX_MONEY
const integer = (n, max) => Number.isSafeInteger(n) && n >= 1 && n <= max
const percent = (n, max = 100) => Number.isFinite(n) && n >= 0 && n <= max
const invalid = (error) => ({ ok: false, error })

export function parseDiscountDate(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const [year, month, day] = text.split('-').map(Number)
  if (year < 1900 || year > 9995) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null
}

// Sempre parte da data original: 31/jan → 28/fev → 31/mar, sem desvio de fuso.
export function discountDueDate(dateText, month) {
  const date = parseDiscountDate(dateText)
  if (!date || !integer(month, 48)) return null
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + month, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(date.getUTCDate(), last))
  return target.toISOString().slice(0, 10)
}

export function titleFee({ value, titles, feeMode, fee }) {
  if (!money(value, true) || !integer(titles, 1_000_000) || !money(fee) || !TITLE_FEE_MODES.some((mode) => mode.id === feeMode)) return invalid('Defina a forma e o valor da tarifa dos títulos.')
  if (feeMode === 'percent' && fee > 100) return invalid('A tarifa percentual deve ficar entre 0 e 100%.')
  const total = feeMode === 'total' ? fee : feeMode === 'unit' ? titles * fee : value * fee / 100
  return money(total) ? { ok: true, total } : invalid('A tarifa de títulos excede o limite de cálculo.')
}

// Borderô hipotético (premissas de Fernando, 24/11/2026): com valor total, prazo médio e ticket médio, monta um borderô
// plausível para a mesma conta título a título. Só gera a entrada: juros, IOF e CET continuam em discountOperation.
// - Quantidade de boletos = valor total ÷ ticket médio, arredondada (em centavos, para o meio exato subir sempre); o ticket
//   efetivo é valor total ÷ quantidade e só é igual ao digitado quando a divisão é exata.
// - Vencimentos espalhados por igual entre a metade e uma vez e meia do prazo médio (30 dias → de 15 a 45 dias).
// - Valores diferentes, de metade a uma vez e meia do ticket efetivo, em sequência fixa bem espalhada (sem sorteio: a
//   mesma entrada dá sempre o mesmo resultado). Cada valor aparece em dois boletos, um que vence antes e outro depois
//   do prazo médio: é esse espelho que faz o prazo médio fechar.
// Dias e valores são espelhados em torno do meio da lista; por isso o total e o prazo médio ponderado pelo valor
// fecham no que foi digitado. O ajuste de dia útil vem depois, na conta, e pode alongar um pouco o prazo médio.
// firstDays e lastDays devolvem os vencimentos de fato usados (com um boleto só, é o próprio prazo médio).
const HYPOTHETICAL_MAX_DAYS = 365
// Passo da sequência de valores: a razão áurea espalha os pontos entre −1 e 1 sem repetir nem formar faixas.
const HYPOTHETICAL_VALUE_STEP = (Math.sqrt(5) - 1) / 2
export function hypotheticalTitles({ value, averageDays, ticket, date }) {
  const release = parseDiscountDate(date)
  if (!release || !money(value, true) || !money(ticket, true) || !integer(averageDays, HYPOTHETICAL_MAX_DAYS)) return invalid('Confira a data, o valor total, o prazo médio e o ticket médio.')
  if (ticket > value) return invalid('O ticket médio não pode ser maior que o valor total.')
  const count = Math.round(Math.round(value * 100) / Math.round(ticket * 100))
  if (!integer(count, 1_000_000)) return invalid('O ticket médio gera mais de 1.000.000 de boletos. Informe um ticket maior.')
  const from = Math.max(1, Math.round(averageDays / 2)), to = 2 * averageDays - from
  const mirror = index => Math.min(index, count - 1 - index)
  const dayOf = index => {
    const near = mirror(index), days = near * 2 === count - 1 ? averageDays : Math.round(from + (to - from) * near / (count - 1))
    return index === near ? days : 2 * averageDays - days
  }
  const raw = index => 2 * ((mirror(index) + 1) * HYPOTHETICAL_VALUE_STEP % 1) - 1
  let mean = 0, spread = 0
  for (let index = 0; index < count; index++) mean += raw(index) / count
  for (let index = 0; index < count; index++) spread = Math.max(spread, Math.abs(raw(index) - mean))
  const weight = index => spread ? 1 + 0.5 * (raw(index) - mean) / spread : 1
  const unit = value / count, groups = new Map()
  let minValue = Infinity, maxValue = 0
  for (let index = 0; index < count; index++) {
    const days = dayOf(index), nominal = unit * weight(index), group = groups.get(days) ?? { value: 0, count: 0 }
    groups.set(days, { value: group.value + nominal, count: group.count + 1 })
    minValue = Math.min(minValue, nominal); maxValue = Math.max(maxValue, nominal)
  }
  const titleRows = [...groups].sort(([a], [b]) => a - b).map(([days, group]) => ({ ...group, dueDate: new Date(release.getTime() + days * 86400000).toISOString().slice(0, 10) }))
  const allDays = [...groups.keys()]
  return { ok: true, titleRows, titles: count, ticket: unit, minValue, maxValue, firstDays: Math.min(...allDays), lastDays: Math.max(...allDays) }
}

// Regras de 11/11/2026: título que vence em fim de semana, feriado nacional ou feriado da praça do contrato (`calendars`,
// padrão só 'BR') é pago no próximo dia útil; juros e IOF
// contam até essa data. CET (Res. CMN 4.881/2020, art. 4º): taxa anual que iguala o líquido liberado (nominal menos
// juros, IOF, TAC e tarifa de títulos) aos nominais recebidos em cada data de pagamento, em dias corridos/365.
export function discountOperation({ titleRows, date, rate, convention = 'commercial30', taxProfile = 'pj', eligible = false, feeMode, fee, tac, calendars = ['BR'] }) {
  const release = parseDiscountDate(date)
  const cals = contractCalendars(calendars)
  if (!cals) return invalid('Escolha a praça do contrato entre as praças disponíveis.')
  if (!release || !Array.isArray(titleRows) || !titleRows.length || titleRows.length > 500 || !percent(rate, 1000) || !['commercial30', 'rational30'].includes(convention)) return invalid('Confira a data, taxa, convenção e os títulos.')
  if (titleRows.some(row => !money(row.value, true) || !integer(row.count, 1000000) || !parseDiscountDate(row.dueDate) || row.dueDate <= date)) return invalid('Informe valor nominal total do grupo, quantidade e vencimento posterior à liberação para todos os títulos.')
  const value = titleRows.reduce((sum, row) => sum + row.value, 0)
  const titles = titleRows.reduce((sum, row) => sum + row.count, 0)
  const tax = resolveCreditIof({ date, profile: taxProfile, eligible, operationValue: value })
  if (!tax.ok) return tax
  const rows = titleRows.map(row => {
    const paymentDate = nextBusinessDay(row.dueDate, paymentCalendars(cals))
    const days = (parseDiscountDate(paymentDate) - release) / 86400000
    const interest = convention === 'commercial30' ? row.value * rate / 100 * days / 30 : row.value - row.value / (1 + rate / 100 * days / 30)
    const base = row.value - interest
    const dailyIof = base * tax.daily / 100 * Math.min(days, 365)
    const additionalIof = base * tax.additional / 100
    return { ...row, paymentDate, adjusted: paymentDate !== row.dueDate, days, interest, base, dailyIof, additionalIof, iof: dailyIof + additionalIof }
  })
  if (rows.some(row => !parseDiscountDate(row.paymentDate) || row.base <= 0 || !money(row.interest))) return invalid('A taxa e o prazo consomem o valor nominal de um título. Confira as condições.')
  const interest = rows.reduce((sum, row) => sum + row.interest, 0)
  const iofPaid = rows.reduce((sum, row) => sum + row.iof, 0)
  const base = rows.reduce((sum, row) => sum + row.base, 0)
  const tariff = titleFee({ value, titles, feeMode, fee })
  if (!tariff.ok) return tariff
  if (!money(tac)) return invalid('Informe TAC não negativa.')
  const costWithoutTitles = tac + interest + iofPaid
  const cost = costWithoutTitles + tariff.total
  if (!money(cost) || cost >= value) return invalid('O custo total deve ser menor que o valor bruto da operação.')
  const net = value - cost
  // Custo pelo prazo real: taxa anual do fluxo efetivo (nominal de cada título na data de pagamento). Não é o CET da norma.
  const termCost = creditCet(net, rows.map(row => ({ days: row.days, payment: row.value })))
  // CET (Res. CMN 4.881/2020, art. 6º, texto oficial conferido em 11/11/2026): operações de desconto usam o prazo de 30 dias e o
  // valor do limite pactuado. Sem campo de limite, o limite é o valor nominal da operação. Mesmas taxa, convenção, IOF e tarifas.
  const interest30 = convention === 'commercial30' ? value * rate / 100 : value - value / (1 + rate / 100)
  const base30 = value - interest30
  const iof30 = base30 * (tax.daily * 30 + tax.additional) / 100
  const net30 = value - interest30 - iof30 - tariff.total - tac
  const cet = net30 > 0 ? creditCet(net30, [{ days: 30, payment: value }]) : null
  // CET não mensurável (ex.: tarifas quase iguais ao líquido, acima de 1.000% a.a.) não invalida a operação: a tela mostra "Não mensurável".
  // Prazo médio ponderado pelo valor, em dias corridos até a data de pagamento. Só informativo.
  const averageDays = rows.reduce((sum, row) => sum + row.value * row.days, 0) / value
  return { ok: true, value, titles, averageDays, titleFee: tariff.total, tac, interest, iof: iofPaid, base, rows, tax, costWithoutTitles, cost, net, cet, termCost, cet30: { days: 30, interest: interest30, iof: iof30, net: net30 } }
}

// Giro Price no motor do Capital de Giro (giroOperation): juros por dias corridos entre vencimentos, (1 + i)^(dias/30);
// vencimentos mensais a partir do mês seguinte, no próximo dia útil; TAC e IOF descontados na liberação (o principal
// é financiado inteiro, o líquido recebido é menor) e CET da Res. CMN 4.881. Mantém os nomes usados pela tela.
export function discountGiro({ principal, months, rate, tac, date, taxProfile = 'pj', eligible = false, calendars = ['BR'] }) {
  const tax = resolveCreditIof({ date, profile: taxProfile, eligible, operationValue: principal })
  if (!tax.ok) return tax
  const firstDue = discountDueDate(date, 1)
  if (!money(principal, true) || !DISCOUNT_TERMS.includes(months) || !percent(rate, 1000) || !money(tac) || !firstDue) return invalid('Confira principal, prazo, data, taxa e TAC do giro.')
  const loan = giroOperation({ value: principal, n: months, rate, unit: 'am', system: 'price', start: date, firstDue, profile: taxProfile, eligible, fees: tac, calendars })
  if (!loan.ok) return loan
  const schedule = loan.rows.map(row => ({ month: row.number, dueDate: row.date, days: row.days, iofDays: Math.min(row.days, loan.tax.maxDays), amortization: row.originalAmortization, interest: row.interest, installment: row.payment, balance: row.balance }))
  const averageMonthlyOutflow = loan.total / months
  if (![loan.interest, loan.iof, loan.cost, loan.total, averageMonthlyOutflow].every((n) => money(n))) return invalid('Valores excedem o limite ou a precisão do cálculo.')
  return { ok: true, principal, months, rate, installment: loan.installment, interest: loan.interest, tac, dailyIof: loan.iofDaily, additionalIof: loan.iofFixed, iof: loan.iof, cost: loan.cost, total: loan.total, net: loan.net, cet: loan.cet, averageMonthlyOutflow, graceDays: loan.graceDays, schedule }
}

export function compareDiscount({ operation, averageValue, projectionRate, operations, giro }) {
  const actual = discountOperation(operation)
  if (!actual.ok) return actual
  if (!money(averageValue, true)) return invalid('Informe valor médio maior que zero.')
  const projected = discountOperation({ ...operation, rate: projectionRate, titleRows: operation.titleRows.map(row => ({ ...row, value: row.value * averageValue / actual.value })) })
  if (!actual.ok || !projected.ok) return invalid(actual.error || projected.error)
  if (!integer(operations, 100_000)) return invalid('Informe de 1 a 100.000 operações por mês, sem frações.')
  const monthly = Object.fromEntries(['value', 'titleFee', 'tac', 'interest', 'iof', 'cost', 'net'].map((key) => [key, projected[key] * operations]))
  if (Object.values(monthly).some((n) => !money(n))) return invalid('O volume mensal excede o limite de cálculo.')
  const annual = Object.fromEntries(Object.entries(monthly).map(([key, value]) => [key, value * 12]))
  if (!['monthly', 'manual'].includes(giro?.principalMode)) return invalid('Defina o principal do giro.')
  const principal = giro.principalMode === 'monthly' ? monthly.value : giro.principal
  const comparisons = DISCOUNT_TERMS.map((months) => {
    const loan = discountGiro({ ...giro, principal, months })
    const discountCost = monthly.cost * months
    return loan.ok ? { months, giro: loan, discountCost, savings: discountCost - loan.cost, difference: loan.cost - discountCost } : loan
  })
  if (comparisons.some((row) => !row.giro)) return invalid(comparisons.find((row) => !row.giro).error)
  if ([...Object.values(annual), ...comparisons.flatMap((row) => [row.discountCost, Math.abs(row.savings)])].some((n) => !money(n))) return invalid('Os totais excedem o limite de cálculo.')
  return { ok: true, operation: actual, projected, operations, annualOperations: operations * 12, monthly, annual, principal, comparisons }
}

// Parser único compartilhado pela tela e pelos testes de edição. Vazio não vira zero.
export function parseDiscountForm(form) {
  const errors = {}, parsed = {}
  const average = form.titleMode === 'average'
  for (const key of ['averageValue', 'tac', 'giroTac', ...(average ? ['totalValue', 'averageTicket'] : [])]) {
    const result = parseMoneyInput(form[key])
    if (!result.ok || (['averageValue', 'totalValue', 'averageTicket'].includes(key) && result.value <= 0)) errors[key] = result.error || 'Informe um valor maior que zero.'
    else parsed[key] = result.value
  }
  for (const [key, max] of [['operationRate', 1000], ['discountRate', 1000], ['giroRate', 1000]]) {
    const value = parseDecimal(form[key])
    if (value === null || value > max) errors[key] = `Informe uma taxa de 0 a ${max}%.`
    else parsed[key] = value
  }
  for (const [key, max] of [['operations', 100_000], ...(average ? [['averageDays', HYPOTHETICAL_MAX_DAYS]] : [])]) {
    const text = String(form[key] ?? '').trim(), value = /^\d+$/.test(text) ? Number(text) : null
    if (!integer(value, max)) errors[key] = key === 'averageDays' ? `Informe de 1 a ${max} dias.` : `Informe um inteiro de 1 a ${max.toLocaleString('pt-BR')}.`
    else parsed[key] = value
  }
  if (!parseDiscountDate(form.date)) errors.date = 'Informe uma data válida entre 1900 e 9995.'
  const feeKey = { total: 'titleFeeTotal', unit: 'titleFeeUnit', percent: 'titleFeePercent' }[form.titleFeeMode]
  if (!feeKey) errors.titleFeeMode = 'Escolha como a tarifa dos títulos é cobrada.'
  else if (form.titleFeeMode === 'percent') {
    const value = parseDecimal(form[feeKey])
    if (value === null || value > 100) errors[feeKey] = 'Informe um percentual de 0 a 100%.'
    else parsed.fee = value
  } else {
    const result = parseMoneyInput(form[feeKey])
    if (!result.ok) errors[feeKey] = result.error
    else parsed.fee = result.value
  }
  if (!['monthly', 'manual'].includes(form.giroPrincipalMode)) errors.giroPrincipalMode = 'Escolha a base do principal do giro.'
  else if (form.giroPrincipalMode === 'manual') {
    const result = parseMoneyInput(form.giroPrincipal)
    if (!result.ok || result.value <= 0) errors.giroPrincipal = result.error || 'Informe um principal maior que zero.'
    else parsed.giroPrincipal = result.value
  }
  // Por prazo médio, os títulos vêm do borderô hipotético; título a título, dos grupos digitados.
  const typed = ['totalValue', 'averageDays', 'averageTicket'].every(key => key in parsed)
  const hypothetical = average && typed ? hypotheticalTitles({ value: parsed.totalValue, averageDays: parsed.averageDays, ticket: parsed.averageTicket, date: form.date }) : null
  if (hypothetical && !hypothetical.ok && parseDiscountDate(form.date)) errors.averageTicket = hypothetical.error
  const titleRows = average ? hypothetical?.titleRows ?? [] : (form.titleRows || []).map((row, index) => {
    const value = parseMoneyInput(row.value)
    const count = /^\d+$/.test(String(row.count)) ? Number(row.count) : NaN
    if (!value.ok || value.value <= 0 || !integer(count, 1000000) || !parseDiscountDate(row.dueDate) || row.dueDate <= form.date) errors['titleRow' + index] = 'Preencha valor nominal total, quantidade inteira e vencimento posterior à operação.'
    return { value: value.value, count, dueDate: row.dueDate }
  })
  // Praça do contrato: feriados locais que adiam vencimentos dos títulos e das parcelas do giro. Ausente = só nacionais.
  const praca = pracaContrato(form.praca ?? PRACA_PADRAO)
  if (!praca) errors.praca = 'Escolha a praça do contrato entre as praças disponíveis.'
  const calendars = praca ? praca.calendars : ['BR']
  const operation = { titleRows, date: form.date, rate: parsed.operationRate, convention: form.convention, taxProfile: form.taxProfile, eligible: form.eligible, feeMode: form.titleFeeMode, fee: parsed.fee, tac: parsed.tac, calendars }
  const actual = discountOperation(operation)
  // Sem borderô hipotético, o aviso já está no campo que falta.
  if (!actual.ok && (!average || hypothetical?.ok)) errors.operation = actual.error
  const params = { operation, averageValue: parsed.averageValue, projectionRate: parsed.discountRate, operations: parsed.operations, giro: { principalMode: form.giroPrincipalMode, principal: parsed.giroPrincipal, rate: parsed.giroRate, tac: parsed.giroTac, date: form.date, taxProfile: form.giroTaxProfile, eligible: form.giroEligible, calendars } }
  const result = Object.keys(errors).length ? null : compareDiscount(params)
  // Aviso de prazo longo (24/11/2026): com boleto hipotético acima de 365 dias, o IOF diário para no teto e a estimativa
  // fica abaixo do IOF do mesmo valor em um título único no prazo médio digitado. A tela mostra essa diferença.
  const capped = hypothetical?.ok && actual.ok && actual.rows.some(row => row.days > 365)
  const single = capped ? discountOperation({ ...operation, titleRows: hypotheticalTitles({ value: parsed.totalValue, averageDays: parsed.averageDays, ticket: parsed.totalValue, date: form.date }).titleRows }) : null
  return { errors, parsed, params, operation: actual.ok ? actual : null, hypothetical: hypothetical?.ok ? hypothetical : null, singleTitleIof: single?.ok ? single.iof : null, result }
}
