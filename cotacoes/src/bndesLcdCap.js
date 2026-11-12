// Modalidade LCDCAP isolada. Não reutiliza nem altera regras de Finame, TFC ou TLP.
// Projeção explícita: cenário de Selic informado, nunca o índice 143 como taxa anual.
import { creditCet } from './creditComparison.js'
import { bndesProfileIof } from './bndesProfileIof.js'
export const LCDCAP_SOURCE = 'https://www.bndes.gov.br/sbn/BNDES_online/Arquivos/04-22Cir13-Anexo-IV-Condicoes-a-Serem-Observadas-na-Contratacao.pdf'
export const LCDCAP_PROFILE = Object.freeze({ id: 'lcdcap', version: '2026-06-24', section: '5', basis: 252, selicCode: '143', lcdCode: 'LD1', status: 'projection-not-contract-validated' })
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
function scaledPct(value) { const [whole, fraction = ''] = value.split('.'); return BigInt(whole + fraction.padEnd(12, '0')) }
function rationalCents(cents, numerator, denominator) {
  const product = BigInt(cents) * numerator
  return money(Number((2n * product + denominator) / (2n * denominator)), 'Resultado racional')
}
function validDate(value) { try { date(value); return true } catch { return false } }
const weekday = value => ![0, 6].includes(new Date(date(value)).getUTCDay())
function weekdayCount(from, to) {
  let count = 0
  for (let t = date(from); t < date(to); t += DAY) if (![0, 6].includes(new Date(t).getUTCDay())) count++
  return count
}

// Última vigência publicada até a contratação; não reprecifica contrato já fixado.
export function lcdQuoteAt(data, contractDate, asOf) {
  try { date(contractDate); date(asOf) } catch { return null }
  const source = data?.series?.LD1?.source
  if (data?.series?.LD1?.sourceValidated !== true || !text(source)) return null
  const coverage = data.series.LD1.referenceCoverageThrough
  if (coverage != null && (!validDate(coverage) || contractDate > coverage)) return null
  const points = data?.series?.LD1?.points
  if (!Array.isArray(points) || contractDate > asOf) return null
  const eligible = points.filter(p => Array.isArray(p) && p.length === 2 && validDate(p[0]) && p[0] <= contractDate && Number.isFinite(p[1]) && p[1] > -100 && p[1] <= 100)
  eligible.sort((a, b) => a[0].localeCompare(b[0]))
  const last = eligible.at(-1)
  return last ? { code: 'LD1', date: last[0], annualPct: String(last[1]), source, retainedSince: data?.stale?.LD1 ?? null } : null
}

// Contrato informa as datas ajustadas e DU de cada período. C = apenas juros;
// A = amortização do saldo corrigido / número de amortizações restantes.
export function parseLcdSchedule(value) {
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

// Fluxo projetado para um cenário de Selic (texto % a.a.) e o componente fixo já validado.
// Usado no fluxo do cenário e no recálculo com Selic zero para o CET regulatório.
function projectRows(principal, events, releaseDate, selicText, fixedAnnualPct, fixedRateScaled) {
  const annualSelic = Number(selicText)
  let remaining = events.filter(event => event.amortize).length
  let balance = principal, totalInterest = 0, totalSelic = 0, totalAmortization = 0, totalPayments = 0
  let previousDate = releaseDate
  const rows = events.map((event, index) => {
    const openingCents = balance
    const selicFactor = (1 + annualSelic / 100) ** (event.businessDays / 252)
    const fixedGrowth = Math.expm1(Math.log1p(fixedAnnualPct / 100) * (event.businessDays / 252))
    const fixedFactor = 1 + fixedGrowth
    const correctedCents = event.businessDays === 252 ? rationalCents(openingCents, 100000000000000n + scaledPct(selicText), 100000000000000n) : roundCents(openingCents * selicFactor)
    const capitalizedSelicCents = correctedCents - openingCents
    const interestCents = event.businessDays === 252 ? rationalCents(correctedCents, fixedRateScaled, 100000000000000n) : roundCents(correctedCents * fixedGrowth, correctedCents * Math.max(1, fixedFactor))
    const amortizationCents = event.amortize ? (remaining === 1 ? correctedCents : Math.floor((2 * correctedCents + remaining) / (2 * remaining))) : 0
    if (event.amortize) remaining--
    balance = correctedCents - amortizationCents
    const paymentCents = money(amortizationCents + interestCents, 'Pagamento')
    totalInterest += interestCents; totalSelic += capitalizedSelicCents; totalAmortization += amortizationCents; totalPayments += paymentCents
    const row = { number: index + 1, from: previousDate, date: event.date, businessDays: event.businessDays, phase: event.amortize ? 'amortization' : 'grace', openingCents, selicFactor, capitalizedSelicCents, correctedCents, fixedFactor, interestCents, amortizationCents, paymentCents, closingCents: balance }
    previousDate = event.date
    return row
  })
  return { rows, balance, totalInterest, totalSelic, totalAmortization, totalPayments }
}

// CET (Res. CMN 4.881/2020, art. 4º): taxa anual que iguala o valor líquido liberado ao valor presente
// dos pagamentos, em dias corridos/365 desde a liberação. Devolve decimal ou null.
function flowCet(netCents, releaseDate, rows) {
  return creditCet(netCents / 100, rows.map(row => ({ days: (date(row.date) - date(releaseDate)) / DAY, payment: row.paymentCents / 100 })))
}

export function simulateLcdCap(input) {
  try {
    fields(input, ['mode', 'principalCents', 'releaseFeeCents', 'contractDate', 'releaseDate', 'ld1', 'spreads', 'selicScenario', 'schedule', 'iof'], 'Operação')
    need(input.mode === 'projection', 'UNSUPPORTED_MODE', 'Somente projeção com Selic informada está habilitada; o índice 143 não substitui a série diária exigida no cálculo contratual.')
    const principal = money(input.principalCents, 'Principal', 1)
    // Tarifa opcional paga na liberação: só reduz o valor líquido do CET; não altera juros nem parcelas.
    const releaseFee = input.releaseFeeCents === undefined ? 0 : money(input.releaseFeeCents, 'Tarifa na liberação')
    need(releaseFee < principal, 'INVALID_FEE', 'A tarifa na liberação precisa ser menor que o valor liberado.')
    date(input.contractDate); date(input.releaseDate)
    need(input.contractDate <= input.releaseDate, 'DATE_ORDER', 'A contratação não pode ser posterior à liberação.')
    need(weekday(input.releaseDate), 'NON_BUSINESS_DATE', 'Informe a data útil da liberação; sábado e domingo não são aceitos.')
    fields(input.ld1, ['annualPct', 'fixingDate', 'source', 'confirmed'], 'Sobretaxa LCD')
    date(input.ld1.fixingDate)
    need(input.ld1.fixingDate <= input.contractDate, 'LCD_FIXING_DATE', 'A referência LD1 não pode ser posterior à contratação. Confirme a vigência aplicável no contrato.')
    need(input.ld1.confirmed === true && text(input.ld1.source), 'LCD_NOT_CONFIRMED', 'Confirme a sobretaxa LCD fixada para o contrato e sua fonte.')
    pct(input.ld1.annualPct, 'LD1', true)
    fields(input.spreads, ['bndes', 'intermediation', 'agent'], 'Remunerações anuais')
    const spreads = Object.fromEntries(Object.entries(input.spreads).map(([key, value]) => [key, pct(value, key)]))
    need(['bndes', 'intermediation', 'agent'].every(key => key in spreads), 'MISSING_SPREAD', 'Informe as três remunerações, inclusive zero quando aplicável.')
    const fixedRateTexts = [input.ld1.annualPct, input.spreads.bndes, input.spreads.intermediation, input.spreads.agent]
    const fixedRateScaled = fixedRateTexts.reduce((sum, value) => sum + scaledPct(value), 0n)
    const fixedAnnualPct = Number(fixedRateScaled) / 1e12
    need(fixedAnnualPct >= 0 && fixedAnnualPct <= 100, 'RATE_LIMIT', 'LD1 negativa é permitida. Uma soma total exigível negativa ou acima de 100% precisa de regra própria e não é calculada por esta versão.')
    fields(input.selicScenario, ['annualPct', 'acknowledged'], 'Cenário Selic')
    need(input.selicScenario.acknowledged === true, 'SCENARIO_NOT_CONFIRMED', 'Confirme que a Selic informada é hipótese constante, não cotação futura oficial.')
    const annualSelic = pct(input.selicScenario.annualPct, 'Cenário Selic')
    fields(input.schedule, ['events', 'source', 'confirmed'], 'Cronograma')
    need(input.schedule.confirmed === true && text(input.schedule.source), 'SCHEDULE_NOT_CONFIRMED', 'Informe a origem do cronograma e confirme datas ajustadas, dias úteis e periodicidades contratuais.')
    const events = input.schedule.events
    need(Array.isArray(events) && events.length > 0 && events.length <= 600, 'MISSING_SCHEDULE', 'Informe de 1 a 600 eventos do cronograma completo.')
    let previousDate = input.releaseDate, amortizing = false
    for (const event of events) {
      fields(event, ['date', 'businessDays', 'amortize'], 'Evento')
      const days = (date(event.date) - date(previousDate)) / DAY
      need(days > 0 && days <= 400, 'DATE_ORDER', 'Datas devem ser crescentes e o período não pode superar o limite técnico de 400 dias.')
      need(weekday(event.date), 'NON_BUSINESS_DATE', 'Vencimento em sábado ou domingo: informe a data útil já ajustada conforme o contrato.')
      need(Number.isSafeInteger(event.businessDays) && event.businessDays >= 1 && event.businessDays <= weekdayCount(previousDate, event.date), 'INVALID_BUSINESS_DAYS', 'Dias úteis devem ser inteiros positivos e não superar a contagem de segunda a sexta do período; feriados ainda dependem da sua conferência.')
      need(typeof event.amortize === 'boolean', 'INVALID_EVENT', 'Indique se cada cobrança contém amortização.')
      need(!amortizing || event.amortize, 'GRACE_AFTER_AMORTIZATION', 'Não pode haver retorno à carência após início das amortizações.')
      amortizing ||= event.amortize
      previousDate = event.date
    }
    const amortizations = events.filter(event => event.amortize).length
    need(amortizations > 0 && principal >= amortizations, 'INCOMPLETE_SCHEDULE', 'O cronograma precisa terminar com amortização integral, com principal suficiente para cada amortização.')
    const { rows, balance, totalInterest, totalSelic, totalAmortization, totalPayments } = projectRows(principal, events, input.releaseDate, input.selicScenario.annualPct, fixedAnnualPct, fixedRateScaled)
    // CET regulatório (art. 5º): Selic fica fora; LD1 e remunerações são fixadas no contrato e entram.
    // Mesmas datas, mesmos DU e mesma base 252 dos juros; só a Selic vai a zero.
    let fixedRows = null, fixedUnavailable = null
    try { fixedRows = projectRows(principal, events, input.releaseDate, '0', fixedAnnualPct, fixedRateScaled).rows } catch (e) { if (!(e instanceof InputError)) throw e; fixedUnavailable = e.message }
    // IOF (Decreto 6.306/2007, art. 7º): cobrado todo na liberação; só reduz o valor líquido do CET, nas duas linhas.
    // Base diária = principal de cada amortização, sem a Selic capitalizada.
    const tax = bndesProfileIof({ iof: input.iof, principalCents: principal, releaseDate: input.releaseDate, events })
    need(tax.ok, tax.code, tax.message)
    const iof = tax.iof
    need(releaseFee + iof.totalCents < principal, 'INVALID_FEE', 'Tarifa e IOF na liberação precisam ser menores que o valor liberado.')
    const netReleaseCents = principal - releaseFee - iof.totalCents
    const fixedAnnualRate = fixedRows ? flowCet(netReleaseCents, input.releaseDate, fixedRows) : null
    const projectedAnnualRate = flowCet(netReleaseCents, input.releaseDate, rows)
    const cet = { method: 'CMN 4.881/2020, art. 4º · dias corridos/365 desde a liberação', netReleaseCents, releaseFeeCents: releaseFee, iofCents: iof.totalCents, fixedComponents: ['LD1', 'remuneração BNDES', 'intermediação', 'remuneração do agente'], excludedIndex: 'Selic', fixedAnnualRate, projectedAnnualRate, fixedUnavailable }
    need([totalInterest, totalSelic, totalAmortization, totalPayments].every(value => Number.isSafeInteger(value) && value <= MAX_CENTS), 'MONEY_OVERFLOW', 'Totais fora do limite técnico.')
    return { ok: true, status: LCDCAP_PROFILE.status, profile: LCDCAP_PROFILE, source: LCDCAP_SOURCE, fixedAnnualPct, annualSelicScenarioPct: annualSelic, rows, iof, totals: { principalCents: principal, capitalizedSelicCents: totalSelic, interestCents: totalInterest, amortizationCents: totalAmortization, paymentCents: totalPayments, closingCents: balance }, cet, error: null, warnings: [
      'Projeção de Selic constante informada pelo usuário. Não representa taxas futuras oficiais nem conferência contratual.',
      'A Selic é capitalizada no saldo; remunerações e LD1 são exigíveis nas cobranças. A soma das remunerações com LD1 é fixada para toda a simulação, em base 252.',
      'Datas, dias úteis, carência e amortizações são entradas do cronograma informado; não há calendário bancário certificado nem ajuste automático de vencimentos.',
      'CET pela Res. CMN 4.881/2020: sem Selic (art. 5º), em dias corridos/365. IOF e tarifa saem do valor líquido na liberação; sem seguros ou outras despesas. Arredondamentos de projeção em centavos não certificam a memória contratual.',
      iof.profile === 'zero' ? 'IOF zero: só vale com recursos da FINAME (Decreto 6.306/2007, art. 8º, IX); a alíquota zero geral do BNDES foi revogada em 2015 (Decreto 8.511). O painel não verifica o enquadramento: confirme com a instituição.' : 'IOF: diário sobre o principal de cada amortização (sem a Selic capitalizada), em dias corridos desde a liberação, com teto de 365 dias, mais o adicional sobre o valor. Tudo cobrado na liberação.',
      'A série 143 é exibida como índice histórico, não como percentual anual nem como substituto exato do produto diário da Selic.'
    ] }
  } catch (e) { if (!(e instanceof InputError)) throw e; return { ok: false, status: 'blocked', rows: [], iof: null, totals: null, cet: null, error: { code: e.code, message: e.message } } }
}
