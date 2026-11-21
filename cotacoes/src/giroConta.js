// Conta do Capital de Giro com as opções de 21/11/2026 (autorizadas por Fernando): periodicidade, juros pagos na carência,
// Fee em % e parcela flex. É a mesma regra do giroOperation (creditComparison.js), que continua servindo o Comparador e a
// Análise de desconto sem mudança. Com as opções padrão (mensal, juros da carência somados ao saldo, sem flex) o resultado é
// idêntico, centavo a centavo, ao do giroOperation: test/giro-conta.test.mjs compara centenas de operações sorteadas.
// As regras exatas e casos de referência estão em docs/giro-conta-ajustes-2026-11-21.md.
import { monthlyRate, MAX_LOAN_MONEY } from './emprestimo.js'
import { resolveCreditIof } from './iofRules.js'
import { cgDate, cgAddDays } from './contaGarantida.js'
import { nextBusinessDay, paymentCalendars } from './holidays.js'
import { contractCalendars } from './pracaContrato.js'
import { creditCet } from './creditComparison.js'

export const PERIODICIDADES = Object.freeze([
  { id: 1, label: 'Mensal' }, { id: 2, label: 'Bimestral' }, { id: 3, label: 'Trimestral' },
  { id: 4, label: 'Quadrimestral' }, { id: 6, label: 'Semestral' },
])

const fail = error => ({ ok: false, error })
const money = v => Number.isFinite(v) && v >= 0 && v <= MAX_LOAN_MONEY
const days = (a, b) => (cgDate(b) - cgDate(a)) / 86400000
// Mesmo arredondamento em centavos do giroOperation.
export const roundReais = amount => {
  const cents = Math.abs(amount) * 100
  return Math.sign(amount) * Math.round(cents + cents * Number.EPSILON) / 100
}
const dmy = iso => iso.split('-').reverse().join('/')
const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Fee em %: percentual sobre o valor solicitado, arredondado a centavos. Daí em diante é igual ao Fee em R$.
export const giroFee = (value, percent) => roundReais(value * percent / 100)

// Parcelas = (prazo − carência) / periodicidade, que precisa ser inteiro. Sem isso, explica os prazos possíveis mais próximos.
export function giroParcelas(term, grace, periodicidade) {
  const span = term - grace
  if (span % periodicidade === 0) return { ok: true, n: span / periodicidade }
  const label = PERIODICIDADES.find(item => item.id === periodicidade)?.label.toLowerCase() ?? ''
  const below = term - span % periodicidade, above = below + periodicidade
  const options = [below > grace ? below : null, above <= 600 ? above : null].filter(Boolean).map(t => `${t}`).join(' ou ')
  return { ok: false, error: `No pagamento ${label}, prazo menos carência precisa ser múltiplo de ${periodicidade} meses.${options ? ` Com ${grace} ${grace === 1 ? 'mês' : 'meses'} de carência, use prazo de ${options} meses.` : ''}` }
}

// Mesmo dia do mês, `months` meses antes ou depois (no fim do mês, o último dia). Igual ao loanDates de emprestimo.js.
function shiftMonths(text, months) {
  const from = cgDate(text)
  if (!from) return null
  const absolute = from.getUTCFullYear() * 12 + from.getUTCMonth() + months
  const year = Math.floor(absolute / 12), monthIndex = absolute - year * 12
  if (year < 1 || year > 9999) return null
  const month = new Date(0)
  month.setUTCFullYear(year, monthIndex, 1)
  const end = new Date(month)
  end.setUTCMonth(monthIndex + 1, 0)
  month.setUTCDate(Math.min(from.getUTCDate(), end.getUTCDate()))
  return month.toISOString().slice(0, 10)
}
// Vencimentos a cada `p` meses a partir do primeiro. Com p = 1 é exatamente o loanDates de emprestimo.js.
function periodDates(start, firstDue, n, p) {
  const parse = text => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text ?? '')) return null
    const d = new Date(`${text}T00:00:00Z`)
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === text ? d : null
  }
  const from = parse(start), first = parse(firstDue)
  if (!from || !first || first <= from || !Number.isInteger(n) || n < 1 || n > 600) return null
  const dates = []
  for (let k = 0; k < n; k++) {
    const absoluteMonth = first.getUTCFullYear() * 12 + first.getUTCMonth() + k * p
    const year = Math.floor(absoluteMonth / 12), monthIndex = absoluteMonth % 12
    if (year > 9999) return null
    const month = new Date(0)
    month.setUTCFullYear(year, monthIndex, 1)
    const end = new Date(month)
    end.setUTCMonth(monthIndex + 1, 0)
    month.setUTCDate(Math.min(first.getUTCDate(), end.getUTCDate()))
    dates.push({ date: month.toISOString().slice(0, 10), days: (month - from) / 86400000 })
  }
  return dates
}

// Mesma entrada do giroOperation, mais: periodicidade (1, 2, 3, 4 ou 6 meses), jurosNaCarencia (true: juros pagos na
// carência) e flex ({ [nº da parcela]: { date?, payment? } }: parcelas ajustadas pelo usuário).
export function giroConta({ value, n, rate, unit = 'am', system, start, firstDue, profile = 'pj', eligible = false, fees = 0,
  financedFees = 0, financeIof = false, calendars = ['BR'], periodicidade = 1, jurosNaCarencia = false, flex = null }) {
  if (!['price', 'sac', 'bullet'].includes(system)) return fail('Escolha o sistema de amortização.')
  if (!money(value) || value <= 0 || !money(fees) || !money(financedFees)) return fail('Confira o valor solicitado e as despesas.')
  const bullet = system === 'bullet'
  // No Bullet a periodicidade não se aplica: pagamento único no fim.
  const p = bullet ? 1 : periodicidade
  if (!PERIODICIDADES.some(item => item.id === p)) return fail('Escolha a periodicidade: mensal, bimestral, trimestral, quadrimestral ou semestral.')
  const adjusted = flex && Object.keys(flex).length > 0 ? flex : null
  if (adjusted && bullet) return fail('No Bullet o pagamento é único: não há parcelas para ajustar.')
  const due = bullet ? periodDates(start, firstDue, n, 1)?.at(-1)?.date : firstDue
  if (!due) return fail('Informe a liberação e o primeiro vencimento mensal posterior à liberação.')
  const principal = value + financedFees
  const r = simulate({ value: principal, n, rate, unit, system, start, firstDue: due, profile, eligible, fees, calendars,
    p, graceInterest: !!jurosNaCarencia && !bullet, flex: adjusted }, { requested: value, financeIof })
  if (!r.ok) return r
  const firstInstallment = r.rows.find(row => !row.juros)
  return { ...r, value, financedBalance: roundReais(principal + (financeIof ? r.iof : 0)), financedFees, financeIof, system, n,
    installment: bullet ? null : firstInstallment.payment, last: system === 'sac' ? r.rows.at(-1).payment : null }
}

// Cópia do simulateCredit de creditComparison.js no caminho do Giro (prefixado, centavos, sem tarifa mensal nem feriados
// extras), generalizada para a periodicidade, os juros na carência e o flex.
function simulate(q, { requested, financeIof }) {
  const { value, n, rate, unit, system, start, firstDue, profile, eligible, fees, calendars, p, graceInterest, flex } = q
  if (!money(value) || value <= 0 || !Number.isInteger(n) || n < 1 || n > 600) return fail('Informe valor positivo e de 1 a 600 parcelas.')
  if (!['am', 'aa'].includes(unit)) return fail('Confira sistema e tipo de taxa.')
  if (!(Number.isFinite(rate) && rate >= 0 && rate <= 1000) || !money(fees)) return fail('Confira taxas e encargos: valores vazios, negativos ou acima do limite não são aceitos.')
  const cals = contractCalendars(calendars)
  if (!cals) return fail('Escolha a praça do contrato entre as praças disponíveis.')
  // Vencimento em dia não útil passa para o próximo dia útil (fins de semana, feriados nacionais e da praça).
  const payCals = paymentCalendars(cals)
  const nextUseful = day => nextBusinessDay(day, payCals)
  const raw = periodDates(start, firstDue, system === 'bullet' ? 1 : n, p)
  const dates = raw && raw.map(d => { const date = nextUseful(d.date); return { date, days: days(start, date) } })
  if (!dates || dates.at(-1).days > 22000) return fail('Informe datas reais, primeiro pagamento posterior à liberação e horizonte de até 60 anos.')
  // Juros pagos na carência: a cada p meses desde a liberação, e um último no fim da carência (um período antes do 1º vencimento).
  let graceDates = []
  if (graceInterest) {
    const end = shiftMonths(raw[0].date, -p)
    if (end && end > start) {
      const list = []
      for (let j = 1; j <= 600; j++) { const d = shiftMonths(start, j * p); if (!d || d >= end) break; list.push(d) }
      list.push(end)
      for (const d of list) {
        const date = nextUseful(d)
        if (date < dates[0].date && date !== graceDates.at(-1)?.date) graceDates.push({ date, days: days(start, date), juros: true })
      }
    }
  }
  const resolveTax = operationValue => resolveCreditIof({ date: start, profile, operationValue, eligible })
  let tax = resolveTax(value)
  if (!tax.ok) return fail(tax.error)
  const monthly = monthlyRate(rate, unit)
  const logFactor = (from, to) => Math.log1p(monthly) * days(from, to) / 30
  // Carência capitalizada: dias do 1º período além de 30 × p (no mensal, além de 30, como hoje). Com juros pagos na carência
  // não há capitalização: os juros de cada período são pagos nas linhas de juros.
  const graceDays = system === 'bullet' || graceDates.length ? 0 : Math.max(0, Math.min(raw[0].days, dates[0].days) - 30 * p)
  const graceEnd = cgAddDays(start, graceDays)
  let prior = graceDates.length ? graceDates.at(-1).date : graceEnd
  const logs = dates.map(d => { const log = logFactor(prior, d.date); prior = d.date; return log })
  prior = start
  const graceLogs = graceDates.map(d => { const log = logFactor(prior, d.date); prior = d.date; return log })

  // Como no giroOperation: arredonda-se o principal acumulado por vencimento, na distribuição teórica de Price, SAC e Bullet.
  let remainingDiscountSum = 0
  const afterPayment = []
  if (system === 'price') {
    for (let k = logs.length - 1; k >= 0; k--) {
      afterPayment[k] = remainingDiscountSum
      remainingDiscountSum = (1 + remainingDiscountSum) * Math.exp(-logs[k])
    }
  }
  const amortizationFractions = dates.map((_, k) => {
    if (k === dates.length - 1) return 1
    return system === 'sac' ? (k + 1) / n : 1 - afterPayment[k] / remainingDiscountSum
  })

  const schedule = principal => {
    const opening = roundReais(principal * Math.exp(logFactor(start, graceEnd)))
    let balance = opening, originalBalance = principal, paid = 0, interestTotal = roundReais(opening - principal)
    const graceRows = graceDates.map((d, j) => {
      const interest = roundReais(balance * Math.expm1(graceLogs[j]))
      interestTotal = roundReais(interestTotal + interest)
      paid = roundReais(paid + interest)
      return { date: d.date, days: d.days, number: j + 1, interest, amortization: 0, originalAmortization: 0, payment: interest, balance, cumulative: paid, juros: true }
    })
    let rows = graceRows.concat(dates.map((d, k) => {
      const interest = roundReais(balance * Math.expm1(logs[k]))
      const last = k === dates.length - 1
      const fraction = amortizationFractions[k]
      const amortization = last ? balance : roundReais(roundReais(opening * fraction) - (opening - balance))
      balance = roundReais(balance - amortization)
      const originalAmortization = last ? originalBalance : roundReais(roundReais(principal * fraction) - (principal - originalBalance))
      originalBalance = roundReais(originalBalance - originalAmortization)
      // "+ 0" como no simulateCredit (tarifa mensal zero): mantém o mesmo resultado, inclusive o sinal do zero.
      const payment = roundReais(amortization + interest + 0)
      interestTotal = roundReais(interestTotal + interest)
      paid = roundReais(paid + payment)
      return { ...d, number: graceRows.length + k + 1, interest, amortization, originalAmortization, payment, balance: Math.max(0, balance), cumulative: paid }
    }))
    let earlyEnd = null
    if (flex) {
      const adjusted = applyFlex(rows, flex, { opening, principal, system, graceEnd, logFactor, nextUseful, start })
      if (!adjusted.ok) return adjusted
      rows = adjusted.rows; earlyEnd = adjusted.earlyEnd
      paid = 0; interestTotal = roundReais(opening - principal)
      for (const row of rows) {
        interestTotal = roundReais(interestTotal + row.interest)
        paid = roundReais(paid + row.payment)
        row.cumulative = paid
      }
    }
    if (!money(opening) || !money(paid) || rows.some(r => !money(r.payment) || r.amortization < -0.000001 || !money(r.interest))) {
      return fail('Condições fora do limite numérico ou com amortização negativa. Reduza taxa, prazo ou carência.')
    }
    return { ok: true, opening, rows, paid, interestTotal, earlyEnd }
  }

  let principal = value
  let flow, iofFixed, iofDaily, iof
  for (let step = 0; step < 24; step++) {
    if (!money(principal)) return fail('O valor financiado excede o limite da simulação.')
    tax = resolveTax(principal)
    flow = schedule(principal)
    if (!flow.ok) return flow
    iofFixed = principal * tax.additional / 100
    iofDaily = flow.rows.reduce((sum, row) => sum + row.originalAmortization * Math.min(row.days, tax.maxDays) * tax.daily / 100, 0)
    iof = roundReais(iofFixed + iofDaily)
    const next = roundReais(value + iof)
    if (!financeIof || next === principal) break
    if (step === 23) return fail('Não foi possível fechar o saldo financiado e o IOF em centavos.')
    principal = next
  }
  const { opening, rows, paid, interestTotal, earlyEnd } = flow
  const upfrontIof = financeIof ? 0 : iof
  const net = roundReais(requested - fees - upfrontIof)
  if (!(net > 0)) return fail('IOF e encargos iniciais devem ser menores que o valor contratado.')
  const cet = creditCet(net, rows)
  if (cet === null) return fail('Não foi possível reconciliar o CET deste fluxo dentro da precisão necessária.')
  return { ok: true, value, net, rows, iof, iofFixed, iofDaily, fees, monthlyFees: 0, tax, interest: interestTotal,
    total: roundReais(paid + fees + upfrontIof), cost: roundReais(paid - net), paid, cet, cetRegulatory: cet, regulatoryNet: net, graceDays,
    capitalizedGrace: roundReais(opening - principal), coverage: null, guaranteeValue: null,
    maxPayment: Math.max(...rows.map(r => r.payment)), lastDate: rows.at(-1).date, ...(earlyEnd ? { earlyEnd } : {}) }
}

// Parcela flex (decisão de Fernando, 21/11/2026). As parcelas antes da primeira ajustada não mudam. Depois dela, as não
// ajustadas são recalculadas juntas para zerar o saldo no último vencimento: no Price com um mesmo pagamento, no SAC com uma
// mesma amortização. Linhas só de juros (carência) continuam só de juros. Parcela ajustada só na data mantém a amortização.
function applyFlex(base, flex, { opening, principal, system, graceEnd, logFactor, nextUseful, start }) {
  const count = base.length
  const fixed = base.map(row => flex[row.number] ?? null)
  const f = fixed.findIndex(Boolean)
  if (f < 0) return { ok: true, rows: base, earlyEnd: null }
  for (let k = f; k < count; k++) {
    const item = fixed[k]
    if (!item) continue
    if (item.date != null && !cgDate(item.date)) return fail(`Parcela ${base[k].number}: informe uma data válida.`)
    if (item.payment != null && !money(item.payment)) return fail(`Parcela ${base[k].number}: informe um valor válido.`)
  }
  const dates = base.map((row, k) => fixed[k]?.date ? nextUseful(fixed[k].date) : row.date)
  for (let k = f; k < count; k++) {
    if (!fixed[k]?.date) continue
    const before = k ? dates[k - 1] : graceEnd, after = dates[k + 1]
    if (!(dates[k] > before) || (after && !(dates[k] < after))) {
      return fail(`Parcela ${base[k].number}: o vencimento precisa ficar entre ${dmy(before)} e ${after ? dmy(after) : 'o fim'}${dates[k] !== fixed[k].date ? ` (${dmy(fixed[k].date)} passa para o dia útil ${dmy(dates[k])})` : ''}.`)
    }
  }
  if (days(start, dates.at(-1)) > 22000) return fail('Informe datas reais e horizonte de até 60 anos.')
  const growth = dates.map((date, k) => Math.expm1(logFactor(k ? dates[k - 1] : graceEnd, date)))
  const kind = base.map((row, k) => {
    if (k < f) return 'before'
    if (fixed[k]?.payment != null) return 'pay'
    if (fixed[k]) return 'keep'
    return row.juros ? 'juros' : 'free'
  })
  const opened = f ? base[f - 1].balance : opening
  const price = system === 'price'
  // Saldo final sem arredondar, em função do pagamento (Price) ou da amortização (SAC) comum às parcelas livres: é linear.
  const finalBalance = x => {
    let balance = opened
    for (let k = f; k < count; k++) {
      const interest = balance * growth[k]
      const amortization = kind[k] === 'pay' ? fixed[k].payment - interest : kind[k] === 'keep' ? base[k].amortization
        : kind[k] === 'free' ? (price ? x - interest : x) : 0
      balance -= amortization
    }
    return balance
  }
  const freeCount = kind.filter(item => item === 'free').length
  let common = null
  if (freeCount) {
    const at0 = finalBalance(0), at1 = finalBalance(1)
    common = roundReais(at0 / (at0 - at1))
  }
  const run = early => {
    const rows = base.slice(0, f).map(row => ({ ...row }))
    let balance = opened, negative = false, earlyEnd = null
    for (let k = f; k < count; k++) {
      const last = k === count - 1
      const interest = roundReais(balance * growth[k])
      let amortization = 0
      if (kind[k] === 'pay') {
        if (fixed[k].payment < interest) return { error: `Parcela ${base[k].number}: o valor não cobre os juros do período (${brl(interest)}).` }
        amortization = roundReais(fixed[k].payment - interest)
      } else if (kind[k] === 'keep') amortization = base[k].amortization
      else if (kind[k] === 'free') amortization = early ? 0 : price ? roundReais(common - interest) : common
      if (amortization < 0) negative = true
      if (last) amortization = balance
      else if (amortization >= balance && balance > 0) { amortization = balance; earlyEnd = { number: base[k].number, date: dates[k] } }
      balance = roundReais(balance - amortization)
      const row = { date: dates[k], days: days(start, dates[k]), number: base[k].number, interest, amortization, originalAmortization: 0,
        payment: roundReais(amortization + interest + 0), balance: Math.max(0, balance), cumulative: 0 }
      if (base[k].juros && amortization === 0) row.juros = true
      if (fixed[k]) row.fixed = true
      rows.push(row)
      if (earlyEnd) break
    }
    return { rows, negative, earlyEnd }
  }
  let outcome = run(false)
  if (outcome.error) return fail(outcome.error)
  if (outcome.negative) {
    // Os valores fixados quitam o saldo antes das parcelas livres: elas ficam só com os juros até a quitação.
    outcome = run(true)
    if (outcome.error) return fail(outcome.error)
    if (!outcome.earlyEnd) return fail('Com estes valores fixados, as parcelas seguintes ficariam menores que os juros do período. Reduza os valores fixados.')
  }
  const rows = outcome.rows
  // Sem parcela livre depois da primeira ajustada, a última fecha o saldo: se ela tem valor fixado, ele precisa bater.
  const lastRow = rows.at(-1), lastFixed = fixed[rows.length - 1]
  if (!freeCount && !outcome.earlyEnd && lastFixed?.payment != null && Math.abs(lastRow.payment - lastFixed.payment) >= 0.005) {
    return fail(`Com as parcelas fixadas, o saldo não fecha: a parcela ${lastRow.number} precisaria ser de ${brl(lastRow.payment)}. Deixe uma parcela sem valor fixado ou ajuste os valores.`)
  }
  // IOF: o principal (sem juros capitalizados) acompanha, em proporção, o que o fluxo ajustado amortiza.
  let originalLeft = principal
  for (let k = 0; k < f; k++) originalLeft = roundReais(originalLeft - base[k].originalAmortization)
  let cumulative = 0
  for (let k = f; k < rows.length; k++) {
    const row = rows[k]
    if (k === rows.length - 1) { row.originalAmortization = roundReais(originalLeft - cumulative); break }
    const reached = roundReais(originalLeft * (opened - row.balance) / opened)
    row.originalAmortization = roundReais(reached - cumulative)
    cumulative = reached
  }
  return { ok: true, rows, earlyEnd: outcome.earlyEnd }
}
