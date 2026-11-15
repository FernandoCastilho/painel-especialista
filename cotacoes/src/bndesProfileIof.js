// IOF das telas BNDES TLP exigível e Selic + LCD (Decreto 6.306/2007, art. 7º).
// Texto consolidado do Decreto 6.306/2007 (Câmara dos Deputados), conferido em 12/11/2026: a alíquota zero do art. 8º, IX
// cita a operação "efetuada com recursos da Agência Especial de Financiamento Industrial - FINAME"; a alíquota zero
// geral do BNDES (art. 8º, XXX) foi revogada pelo Decreto 8.511/2015. Outros incisos podem dar zero conforme o enquadramento
// (ex.: XV, agente de fundo ou programa de governo instituído por lei; XXVIII, bens de capital e itens da Lei 12.096/2009,
// pelos critérios do CMN). Sem enquadramento confirmado vale o art. 7º. Por isso as telas começam em PJ geral; zero é escolha
// do usuário quando a instituição confirmar o enquadramento (o painel não verifica). Chamada direta sem `iof` segue como
// zero só por compatibilidade dos exemplos de teste; as telas sempre enviam o perfil.
// PJ geral e Simples/MEI usam as alíquotas compartilhadas de resolveCreditIof.
// IOF diário: principal de cada amortização (sem correção por índice) × dias corridos da liberação ao vencimento, teto de 365 dias.
// IOF adicional: sobre o valor liberado. Tudo cobrado na liberação; não muda juros nem parcelas.
import { resolveCreditIof } from './iofRules.js'

export const BNDES_PROFILE_IOF_OPTIONS = Object.freeze([
  ['zero', 'Zero (FINAME ou outro enquadramento confirmado)'],
  ['pj', 'PJ geral'],
  ['simples', 'Simples/MEI'],
])
const DAY = 86400000
const RATE_UNITS = 10000000n // alíquota em % × 10^7: 0,0082% → 82.000; 0,38% → 3.800.000
const DIVISOR = 100n * RATE_UNITS
const halfUp = (numerator, denominator) => (2n * numerator + denominator) / (2n * denominator)
const days = (from, to) => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY

// Divisão do principal pelas amortizações, igual à regra SAC das duas telas, sem índice: o IOF incide sobre o principal.
export function principalByAmortization(principalCents, events) {
  let remaining = events.filter(event => event.amortize).length, balance = principalCents
  return events.map(event => {
    if (!event.amortize) return 0
    const amount = remaining === 1 ? balance : Math.floor((2 * balance + remaining) / (2 * remaining))
    remaining--; balance -= amount
    return amount
  })
}

// Devolve { ok: true, iof } ou { ok: false, code, message }. Valores em centavos, arredondados uma vez, meio centavo para cima.
export function bndesProfileIof({ iof, principalCents, releaseDate, events }) {
  const choice = iof === undefined ? { profile: 'zero' } : iof
  if (!choice || typeof choice !== 'object' || Array.isArray(choice) || !Object.keys(choice).every(key => ['profile', 'eligible'].includes(key)) || !BNDES_PROFILE_IOF_OPTIONS.some(([id]) => id === choice.profile))
    return { ok: false, code: 'INVALID_IOF', message: 'Escolha o IOF: zero (FINAME ou outro enquadramento confirmado), PJ geral ou Simples/MEI.' }
  if (choice.profile === 'zero') return { ok: true, iof: { profile: 'zero', dailyPct: 0, additionalPct: 0, maxDays: 365, additionalCents: 0, dailyCents: 0, totalCents: 0, bases: [] } }
  const tax = resolveCreditIof({ date: releaseDate, profile: choice.profile, operationValue: principalCents / 100, eligible: choice.eligible === true })
  if (!tax.ok) return { ok: false, code: 'IOF_NOT_RESOLVED', message: tax.error }
  const dailyUnits = BigInt(Math.round(tax.daily * 1e7)), additionalUnits = BigInt(Math.round(tax.additional * 1e7))
  const split = principalByAmortization(principalCents, events)
  const bases = events.map((event, index) => ({ date: event.date, principalCents: split[index], elapsedDays: days(releaseDate, event.date), cappedDays: Math.min(days(releaseDate, event.date), tax.maxDays) })).filter(base => base.principalCents > 0)
  const dailyNumerator = bases.reduce((sum, base) => sum + BigInt(base.principalCents) * BigInt(base.cappedDays) * dailyUnits, 0n)
  const dailyCents = Number(halfUp(dailyNumerator, DIVISOR))
  const additionalCents = Number(halfUp(BigInt(principalCents) * additionalUnits, DIVISOR))
  return { ok: true, iof: { profile: choice.profile, dailyPct: tax.daily, additionalPct: tax.additional, maxDays: tax.maxDays, additionalCents, dailyCents, totalCents: additionalCents + dailyCents, bases, source: tax.source } }
}
