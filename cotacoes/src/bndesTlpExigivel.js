// TLP exigível, seção 1. NÃO é TLPCAP (seção 2).
import { creditCet } from './creditComparison.js'
export const TLP_EXIGIVEL_SOURCE = 'https://www.bndes.gov.br/sbn/BNDES_online/Arquivos/04-22Cir13-Anexo-IV-Condicoes-a-Serem-Observadas-na-Contratacao.pdf'
export const TLP_EXIGIVEL_PROFILE = Object.freeze({ id: 'tlp-exigivel', section: '1', basis: 252, status: 'projection-not-contract-validated' })
const DAY = 86400000
const MAX_CENTS = 1000000000000 // Limite técnico, não limite comercial.
class InputError extends Error { constructor(code, message) { super(message); this.code = code } }
const need = (ok, code, message) => { if (!ok) throw new InputError(code, message) }
const text = value => typeof value === 'string' && value.trim().length > 0
function fields(value, allowed, label) {
  need(value && typeof value === 'object' && !Array.isArray(value), 'MISSING_INPUT', `${label}: dados obrigatórios.`)
  need(Object.keys(value).every(key => allowed.includes(key)), 'UNSUPPORTED_FIELD', `${label}: campo não suportado. Não acrescente encargos sem regra própria.`)
}
function date(value) {
  need(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'INVALID_DATE', 'Informe todas as datas em AAAA-MM-DD.')
  const t = Date.parse(`${value}T00:00:00Z`)
  need(Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '2199-12-31', 'INVALID_DATE', 'Data civil inválida.')
  return t
}
function pct(value, label, signed = false) {
  need(typeof value === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(value) && Number(value) <= 100 && (signed ? Number(value) > -100 : Number(value) >= 0), 'INVALID_RATE', `${label}: informe percentual ${signed ? "maior que −100 e até 100" : "não negativo até 100"} como texto, com até 12 casas. Limite técnico, não regra comercial.`)
  return Number(value)
}
function money(value, label, minimum = 0) {
  need(Number.isSafeInteger(value) && value >= minimum && value <= MAX_CENTS, 'INVALID_MONEY', `${label}: valor fora do limite técnico ou não expresso em centavos.`)
  return value
}
function roundCents(value, scale = value) {
  need(Number.isFinite(value) && value >= 0 && value <= MAX_CENTS, 'MONEY_OVERFLOW', 'Saldo/encargo fora do limite técnico.')
  // Erros de ponto flutuante junto ao meio centavo não podem decidir o arredondamento.
  const fraction = value - Math.floor(value)
  need(Math.abs(fraction - 0.5) > Math.max(1e-7, Number.EPSILON * Math.max(1, value, scale) * 16), 'ROUNDING_UNCERTAIN', 'Resultado próximo de meio centavo. A precisão contratual deve ser conferida antes de calcular.')
  return Math.round(value)
}
const weekday = value => ![0, 6].includes(new Date(date(value)).getUTCDay())
function weekdayCount(from, to) {
  let count = 0
  for (let t = date(from); t < date(to); t += DAY) if (![0, 6].includes(new Date(t).getUTCDay())) count++
  return count
}


export function parseTlpSchedule(value) {
  try {
    need(text(value), 'MISSING_SCHEDULE', 'Informe o cronograma: data; dias úteis; C (carência) ou A (amortização).')
    const lines = value.trim().split(/\r?\n/)
    need(lines.length <= 600, 'SCHEDULE_TOO_LONG', 'Limite técnico: 600 cobranças.')
    const events = lines.map((line, i) => {
      const parts = line.split(';').map(part => part.trim())
      need(parts.length === 3 && /^\d+$/.test(parts[1]) && ['A', 'C'].includes(parts[2].toUpperCase()), 'INVALID_SCHEDULE', `Linha ${i + 1}: use data; dias úteis; C ou A.`)
      date(parts[0])
      return { date: parts[0], businessDays: Number(parts[1]), amortize: parts[2].toUpperCase() === 'A' }
    })
    return { ok: true, events, error: null }
  } catch (e) { if (!(e instanceof InputError)) throw e; return { ok: false, events: [], error: { code: e.code, message: e.message } } }
}

// Decimal racional apenas para períodos de 252 DU: evita erro binário em meio centavo.
const SCALE = 100000000000000n
function rateInteger(value) {
  const negative = value.startsWith('-')
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.')
  return BigInt(whole + fraction.padEnd(12, '0')) * (negative ? -1n : 1n)
}
function annualInterest(cents, rates) {
  const denominator = SCALE ** BigInt(rates.length)
  const numerator = rates.reduce((product, rate) => product * (SCALE + rateInteger(rate)), 1n) - denominator
  const product = BigInt(cents) * numerator
  const magnitude = product < 0n ? -product : product
  return Number((magnitude * 2n + denominator) / (denominator * 2n)) * (product < 0n ? -1 : 1)
}

// Fluxo de juros e amortização para um conjunto de taxas em texto (% a.a.): IPCA, J, spread BNDES, spread do agente.
// Usado no fluxo projetado e no recálculo só com a parte fixa (IPCA zero) para o CET.
function projectRows(principal, events, releaseDate, rateTexts) {
  const [ipca, j, bndes, agent] = rateTexts.map(Number)
  let remaining = events.filter(event => event.amortize).length
  let balance = principal, totalInterest = 0, totalAmortization = 0, totalPayments = 0, totalReduction = 0
  let previousDate = releaseDate
  const rows = events.map((event, index) => {
    const openingCents = balance, fraction = event.businessDays / 252
    const ipcaFactor = (1 + ipca / 100) ** fraction
    const jFactor = (1 + j / 100) ** fraction
    const spreadFactor = (1 + bndes / 100) ** fraction * (1 + agent / 100) ** fraction
    // log1p/expm1 evitam cancelamento para taxas pequenas; fatores publicados são informativos.
    const growth = Math.expm1([ipca, j, bndes, agent].reduce((sum, rate) => sum + Math.log1p(rate / 100), 0) * fraction)
    const interestFactor = 1 + growth
    const roundedInterest = event.businessDays === 252
      ? annualInterest(openingCents, rateTexts)
      : Math.sign(growth) * roundCents(Math.abs(openingCents * growth), openingCents * Math.max(1, interestFactor))
    // Arredondamento a zero não conserva sinal negativo; valores negativos reais permanecem.
    const interestCents = roundedInterest === 0 ? 0 : roundedInterest
    money(Math.abs(interestCents), 'Juros')
    const amortizationCents = event.amortize ? Math.floor((2 * balance + remaining) / (2 * remaining)) : 0
    if (event.amortize) remaining--
    const dueCents = amortizationCents + interestCents
    const paymentCents = money(Math.max(0, dueCents), 'Pagamento')
    // Se juros negativos excedem amortização, remanescente reduz principal. Na carência, todo negativo reduz principal.
    const negativeInterestPrincipalReductionCents = Math.max(0, -dueCents)
    balance = money(openingCents - amortizationCents - negativeInterestPrincipalReductionCents, 'Saldo')
    totalInterest += interestCents; totalAmortization += amortizationCents; totalPayments += paymentCents; totalReduction += negativeInterestPrincipalReductionCents
    const row = { number: index + 1, from: previousDate, date: event.date, businessDays: event.businessDays, phase: event.amortize ? 'amortization' : 'grace', openingCents, ipcaFactor, jFactor, spreadFactor, interestFactor, interestCents, amortizationCents, negativeInterestPrincipalReductionCents, paymentCents, closingCents: balance }
    previousDate = event.date
    return row
  })
  return { rows, balance, totalInterest, totalAmortization, totalPayments, totalReduction }
}

// CET (Res. CMN 4.881/2020, art. 4º): taxa anual que iguala o valor líquido liberado ao valor presente
// dos pagamentos, em dias corridos/365 desde a liberação. Devolve decimal ou null.
function flowCet(netCents, releaseDate, rows) {
  return creditCet(netCents / 100, rows.map(row => ({ days: (date(row.date) - date(releaseDate)) / DAY, payment: row.paymentCents / 100 })))
}

export function simulateTlpExigivel(input) {
  try {
    fields(input, ['mode', 'principalCents', 'releaseFeeCents', 'releaseDate', 'j', 'spreads', 'ipcaScenario', 'schedule'], 'Operação')
    need(input.mode === 'projection', 'UNSUPPORTED_MODE', 'Somente projeção de IPCA constante. Cálculo histórico exige índices mensais defasados, aniversário no dia 15, calendário e precisão contratual não disponíveis neste motor.')
    const principal = money(input.principalCents, 'Principal', 1)
    // Tarifa opcional paga na liberação: só reduz o valor líquido do CET; não altera juros nem parcelas.
    const releaseFee = input.releaseFeeCents === undefined ? 0 : money(input.releaseFeeCents, 'Tarifa na liberação')
    need(releaseFee < principal, 'INVALID_FEE', 'A tarifa na liberação precisa ser menor que o principal.')
    date(input.releaseDate)
    need(weekday(input.releaseDate), 'NON_BUSINESS_DATE', 'Informe uma data útil de liberação.')
    fields(input.j, ['annualPct', 'source', 'confirmed'], 'J da TLP')
    need(input.j.confirmed === true && text(input.j.source), 'J_NOT_CONFIRMED', 'Informe e confirme J aplicável à contratação, já ajustado, e sua fonte.')
    pct(input.j.annualPct, 'J da TLP', true)
    fields(input.spreads, ['bndes', 'agent'], 'Spreads')
    pct(input.spreads.bndes, 'Spread BNDES (incluindo intermediação quando aplicável)')
    pct(input.spreads.agent, 'Spread do agente')
    fields(input.ipcaScenario, ['annualPct', 'acknowledged'], 'Cenário IPCA')
    need(input.ipcaScenario.acknowledged === true, 'SCENARIO_NOT_CONFIRMED', 'Confirme que o IPCA anual constante é apenas uma hipótese de projeção.')
    const ipca = pct(input.ipcaScenario.annualPct, 'IPCA projetado', true)
    fields(input.schedule, ['events', 'source', 'confirmed'], 'Cronograma')
    need(input.schedule.confirmed === true && text(input.schedule.source), 'SCHEDULE_NOT_CONFIRMED', 'Informe e confirme a origem das datas ajustadas, dias úteis e vencimentos do cronograma.')
    const events = input.schedule.events
    need(Array.isArray(events) && events.length > 0 && events.length <= 600, 'MISSING_SCHEDULE', 'Informe de 1 a 600 vencimentos de juros, com ou sem amortização.')
    let previousDate = input.releaseDate, amortizing = false
    for (const event of events) {
      fields(event, ['date', 'businessDays', 'amortize'], 'Vencimento')
      const days = (date(event.date) - date(previousDate)) / DAY
      need(days > 0 && days <= 400, 'DATE_ORDER', 'Datas crescentes; limite técnico de 400 dias por período.')
      need(weekday(event.date), 'NON_BUSINESS_DATE', 'Informe o vencimento em dia útil já ajustado no cronograma.')
      need(Number.isSafeInteger(event.businessDays) && event.businessDays >= 1 && event.businessDays <= weekdayCount(previousDate, event.date), 'INVALID_BUSINESS_DAYS', 'DU deve ser inteiro positivo e não superar os dias de segunda a sexta; feriados dependem de conferência externa.')
      need(typeof event.amortize === 'boolean', 'INVALID_EVENT', 'Indique carência ou amortização em cada vencimento.')
      need(!amortizing || event.amortize, 'GRACE_AFTER_AMORTIZATION', 'Retorno à carência não suportado.')
      amortizing ||= event.amortize
      previousDate = event.date
    }
    const amortizations = events.filter(event => event.amortize).length
    need(amortizations > 0 && principal >= amortizations, 'INCOMPLETE_SCHEDULE', 'Informe amortização integral e principal de pelo menos um centavo por amortização.')
    const rateTexts = [input.ipcaScenario.annualPct, input.j.annualPct, input.spreads.bndes, input.spreads.agent]
    const { rows, balance, totalInterest, totalAmortization, totalPayments, totalReduction } = projectRows(principal, events, input.releaseDate, rateTexts)
    // CET regulatório (art. 5º): IPCA fica fora; J da TLP e spreads são fixados no contrato e entram.
    // Mesmas datas, mesmos DU e mesma base 252 dos juros; só o IPCA vai a zero.
    let fixedRows = null, fixedUnavailable = null
    try { fixedRows = projectRows(principal, events, input.releaseDate, ['0', ...rateTexts.slice(1)]).rows } catch (e) { if (!(e instanceof InputError)) throw e; fixedUnavailable = e.message }
    const netReleaseCents = principal - releaseFee
    const fixedAnnualRate = fixedRows ? flowCet(netReleaseCents, input.releaseDate, fixedRows) : null
    const projectedAnnualRate = flowCet(netReleaseCents, input.releaseDate, rows)
    const cet = { method: 'CMN 4.881/2020, art. 4º · dias corridos/365 desde a liberação', netReleaseCents, releaseFeeCents: releaseFee, fixedComponents: ['J da TLP', 'spread BNDES', 'spread do agente'], excludedIndex: 'IPCA', fixedAnnualRate, projectedAnnualRate, fixedUnavailable }
    need([totalInterest, totalAmortization, totalPayments, totalReduction].every(value => Number.isSafeInteger(value) && Math.abs(value) <= MAX_CENTS), 'MONEY_OVERFLOW', 'Totais fora do limite técnico.')
    return { ok: true, status: TLP_EXIGIVEL_PROFILE.status, profile: TLP_EXIGIVEL_PROFILE, source: TLP_EXIGIVEL_SOURCE, annualIpcaScenarioPct: ipca, rows, totals: { principalCents: principal, interestCents: totalInterest, amortizationCents: totalAmortization, negativeInterestPrincipalReductionCents: totalReduction, paymentCents: totalPayments, closingCents: balance }, cet, error: null, warnings: [
      'Estimativa: IPCA anual constante em base DU/252. Não reproduz índices mensais defasados e aniversário no dia 15 do cálculo contratual.',
      'TLP exigível: IPCA, J, spread BNDES e spread do agente compõem juros cobrados nos vencimentos; IPCA positivo não aumenta o principal.',
      'SAC sobre saldo remanescente, com juros exigíveis em cada evento informado. Juros negativos reduzem prestação e, se excedentes, o principal.',
      'Calendário, feriados e periodicidades devem ser conferidos no contrato. Não há ajuste automático de datas, eventos extraordinários ou Price.',
      'CET pela Res. CMN 4.881/2020: sem IPCA (art. 5º), em dias corridos/365. Sem IOF; tarifa só se informada. Juros seguem DU/252.',
      'Precisão de projeção em centavos; não implementa a truncagem contratual de todos os intermediários em 16 casas. Não usar como memória contratual.'
    ] }
  } catch (e) { if (!(e instanceof InputError)) throw e; return { ok: false, status: 'blocked', rows: [], totals: null, cet: null, error: { code: e.code, message: e.message } } }
}
