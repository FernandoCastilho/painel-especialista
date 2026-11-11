// Operação x DI: compara o fator de uma operação (pré, % do CDI ou CDI + spread) com o DI do mesmo período,
// projetado pela curva DI x pré da B3. Pagamento único no vencimento.
// - Aplicação (`compareWithDi`): convenção de mercado de renda fixa, tudo em dias úteis/252; sem IR, IOF nem tarifas.
// - Crédito (`creditVsDi`): regras das calculadoras de crédito aprovadas em 11/11/2026 (mesmo motor do Capital de Giro e
//   do Comparador): vencimento em dia não útil passa para o próximo dia útil; prefixado por dias corridos
//   ((1 + taxa a.m.)^(dias/30)); CDI em dias úteis/252 com feriados nacionais; IOF e tarifas descontados na liberação;
//   CET da Res. CMN 4.881/2020 (art. 4º, dias corridos/365) e, no pós-fixado, CET só da parte fixa (art. 5º) com o
//   custo com o CDI projetado à parte.
// d1 e d2 são dias úteis contados da data-base da curva até o início e o vencimento (feriados nacionais).
import { growthAt } from './cdiFuturo.js'
import { creditCet, creditOperation } from './creditComparison.js'
import { busDaysIn, nextBusinessDay } from './holidays.js'

export const RATE_KINDS = [
  { id: 'pre', label: 'Pré', hint: 'Taxa fixa. Ao ano em base 252 dias úteis, ao mês (convertida por (1 + taxa)^12) ou já para o período inteiro.' },
  { id: 'pct', label: '% do CDI', hint: 'Percentual aplicado ao DI de cada dia útil, como na metodologia da B3. Ex.: 105% do CDI.' },
  { id: 'spread', label: 'CDI + spread', hint: 'DI do período mais uma taxa fixa ao ano em base 252, compostos. Ex.: CDI + 2,00% a.a.' },
]
export const PRE_UNITS = [
  { id: 'aa', label: 'a.a.' },
  { id: 'am', label: 'a.m.' },
  { id: 'periodo', label: 'no período' },
]
export const MAX_VALUE = 1e12

// Fator da operação com % do CDI: produto, dia útil a dia útil, de (1 + p × DI do dia). DI do dia vem da curva.
function pctFactor(dailies, p) {
  let f = 1
  for (const d of dailies) f *= 1 + p * d
  return f
}

// Percentual do CDI que daria o mesmo fator (bisseção; o fator cresce com o percentual).
function solvePct(dailies, target) {
  if (!(target > 0)) return null
  let lo = 0
  let hi = 1
  while (pctFactor(dailies, hi) < target) {
    hi *= 2
    if (hi > 1e4) return null
  }
  if (pctFactor(dailies, lo) > target) return null
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (pctFactor(dailies, mid) < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

const fail = (error) => ({ ok: false, error })
function checkInput({ value, kind, rate, unit }) {
  if (!(Number.isFinite(value) && value > 0 && value <= MAX_VALUE)) return 'Informe um valor maior que zero.'
  if (!RATE_KINDS.some((k) => k.id === kind)) return 'Escolha o tipo de taxa.'
  if (!Number.isFinite(rate) || rate < 0) return 'Informe a taxa.'
  if (kind === 'pct' && (rate <= 0 || rate > 1000)) return 'Informe o percentual do CDI entre 0,01% e 1.000%.'
  if (kind !== 'pct' && rate > 1000) return 'Informe uma taxa de até 1.000%.'
  if (kind === 'pre' && !PRE_UNITS.some((u) => u.id === unit)) return 'Escolha o período da taxa.'
  return null
}

// Fator do DI entre d1 e d2 dias úteis e o DI de cada dia útil do período, pela curva.
function diPath(pts, d1, d2) {
  if (!Number.isInteger(d1) || !Number.isInteger(d2) || d1 < 0) return fail('Datas inválidas.')
  const du = d2 - d1
  if (du < 1) return fail('O vencimento precisa ter ao menos 1 dia útil depois do início.')
  const g1 = growthAt(pts, d1)
  const g2 = growthAt(pts, d2)
  if (g1 == null || g2 == null) return fail('O vencimento passa do último vértice da curva DI.')
  const dailies = []
  let prev = g1
  for (let k = d1 + 1; k <= d2; k++) {
    const g = growthAt(pts, k)
    dailies.push(g / prev - 1)
    prev = g
  }
  return { ok: true, du, diFactor: g2 / g1, dailies }
}

// Taxas, juros e equivalentes da operação contra o DI, a partir dos dois fatores do período.
function summary(value, du, diFactor, opFactor, dailies) {
  const cdiAa = diFactor ** (252 / du) - 1
  const opAa = opFactor ** (252 / du) - 1
  const interestOp = value * (opFactor - 1)
  const interestDi = value * (diFactor - 1)
  const pctEq = solvePct(dailies, opFactor)
  const spreadEq = (opFactor / diFactor) ** (252 / du) - 1
  return {
    ok: true,
    du,
    diFactor,
    opFactor,
    cdiAa: cdiAa * 100,
    cdiPeriod: (diFactor - 1) * 100,
    opAa: opAa * 100,
    opPeriod: (opFactor - 1) * 100,
    interestOp,
    interestDi,
    diff: interestOp - interestDi,
    bps: (opAa - cdiAa) * 1e4,
    pctEq: pctEq == null ? null : pctEq * 100,
    spreadEq: spreadEq * 100,
    finalOp: value * opFactor,
    finalDi: value * diFactor,
  }
}

// Aplicação: convenção de renda fixa, em dias úteis/252 (pré a.m. convertido para o ano por (1 + taxa)^12).
export function compareWithDi({ value, kind, rate, unit = 'aa', pts, d1, d2 }) {
  const error = checkInput({ value, kind, rate, unit })
  if (error) return fail(error)
  const path = diPath(pts, d1, d2)
  if (!path.ok) return path
  const { du, diFactor, dailies } = path
  const r = rate / 100
  let opFactor
  if (kind === 'pre') opFactor = unit === 'periodo' ? 1 + r : (1 + (unit === 'am' ? (1 + r) ** 12 - 1 : r)) ** (du / 252)
  else if (kind === 'pct') opFactor = pctFactor(dailies, r)
  else opFactor = diFactor * (1 + r) ** (du / 252)
  return summary(value, du, diFactor, opFactor, dailies)
}

const DAY = 864e5
const calendarDays = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY)
const isIso = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`))

// Crédito: pagamento único (bullet) no vencimento, pelo mesmo motor do Capital de Giro e do Comparador.
// `base` é a data-base da curva; `start` a liberação; `end` o vencimento contratado (ajustado para o próximo dia útil).
export function creditVsDi({ value, kind, rate, unit = 'aa', pts, base, start, end, fees = 0, profile = 'pj', eligible = false, ctx = {} }) {
  const error = checkInput({ value, kind, rate, unit })
  if (error) return fail(error)
  if (!isIso(base) || !isIso(start) || !isIso(end)) return fail('Datas inválidas.')
  if (start < base) return fail('A liberação precisa ser a partir da data-base da curva.')
  if (end <= start) return fail('O vencimento precisa ser depois da liberação.')
  if (!(Number.isFinite(fees) && fees >= 0 && fees < value)) return fail('Informe as tarifas em R$ (zero se não houver), menores que o valor.')
  const due = nextBusinessDay(end, ['BR'], ctx)
  // O DI e o CDI da operação começam a correr no primeiro dia útil a partir da liberação, como os dias úteis do motor de crédito.
  const path = diPath(pts, busDaysIn(base, nextBusinessDay(start, ['BR'], ctx), ['BR'], ctx), busDaysIn(base, due, ['BR'], ctx))
  if (!path.ok) return path
  const { du, diFactor, dailies } = path
  const days = calendarDays(start, due)
  const common = { value, n: 1, system: 'bullet', start, firstDue: end, profile, eligible, fees, monthlyFees: 0, holidays: [] }
  let op
  if (kind === 'pre') {
    // No período: a taxa vira a taxa ao mês equivalente pelos dias corridos até o vencimento ajustado, o que devolve 1 + taxa.
    const am = unit === 'periodo' ? Math.expm1(Math.log1p(rate / 100) * 30 / days) * 100 : rate
    op = creditOperation({ ...common, rateType: 'fixed', rate: am, unit: unit === 'aa' ? 'aa' : 'am' })
  } else {
    // Art. 5º: CET regulatório com o CDI zerado (só a parte fixa); o fator projetado vem da curva.
    op = creditOperation({ ...common, rateType: 'cdi', cdi: 0, cdiPercent: kind === 'pct' ? rate : 100, rate: kind === 'spread' ? rate : 0, unit: 'aa' })
  }
  if (!op.ok) return op
  const row = op.rows[0]
  if (row.date !== due) return fail('Não foi possível alinhar o vencimento ao calendário de dias úteis.')
  const floating = kind !== 'pre'
  const r = rate / 100
  const opFactor = !floating ? row.payment / value : kind === 'pct' ? pctFactor(dailies, r) : diFactor * (1 + r) ** (du / 252)
  const payment = value * opFactor
  const projectedCost = floating ? creditCet(op.net, [{ days, payment }]) : null
  return {
    ...summary(value, du, diFactor, opFactor, dailies),
    due, dueShifted: due !== end, days, iof: op.iof, iofFixed: op.iofFixed, iofDaily: op.iofDaily, fees: op.fees, net: op.net,
    payment, cet: op.cet, floating, cetLabel: floating ? 'CET · parte fixa (regra do BC)' : 'CET',
    projectedCost, projectedLabel: floating ? 'Custo com CDI projetado' : null,
  }
}
