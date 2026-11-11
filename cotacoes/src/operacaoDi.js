// Operação x DI: compara o fator de uma operação (pré, % do CDI ou CDI + spread) com o DI do mesmo período,
// projetado pela curva DI x pré da B3. Pagamento único no vencimento; sem IOF, IR nem tarifas.
// d1 e d2 são dias úteis contados da data-base da curva até o início e o vencimento (feriados nacionais).
import { growthAt } from './cdiFuturo.js'

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

export function compareWithDi({ value, kind, rate, unit = 'aa', pts, d1, d2 }) {
  if (!(Number.isFinite(value) && value > 0 && value <= MAX_VALUE)) return { ok: false, error: 'Informe um valor maior que zero.' }
  if (!RATE_KINDS.some((k) => k.id === kind)) return { ok: false, error: 'Escolha o tipo de taxa.' }
  if (!Number.isFinite(rate) || rate < 0) return { ok: false, error: 'Informe a taxa.' }
  if (kind === 'pct' && (rate <= 0 || rate > 1000)) return { ok: false, error: 'Informe o percentual do CDI entre 0,01% e 1.000%.' }
  if (kind !== 'pct' && rate > 1000) return { ok: false, error: 'Informe uma taxa de até 1.000%.' }
  if (kind === 'pre' && !PRE_UNITS.some((u) => u.id === unit)) return { ok: false, error: 'Escolha o período da taxa.' }
  if (!Number.isInteger(d1) || !Number.isInteger(d2) || d1 < 0) return { ok: false, error: 'Datas inválidas.' }
  const du = d2 - d1
  if (du < 1) return { ok: false, error: 'O vencimento precisa ter ao menos 1 dia útil depois do início.' }
  const g1 = growthAt(pts, d1)
  const g2 = growthAt(pts, d2)
  if (g1 == null || g2 == null) return { ok: false, error: 'O vencimento passa do último vértice da curva DI.' }

  const diFactor = g2 / g1
  const cdiAa = diFactor ** (252 / du) - 1
  const dailies = []
  let prev = g1
  for (let k = d1 + 1; k <= d2; k++) {
    const g = growthAt(pts, k)
    dailies.push(g / prev - 1)
    prev = g
  }

  const r = rate / 100
  let opFactor
  if (kind === 'pre') opFactor = unit === 'periodo' ? 1 + r : (1 + (unit === 'am' ? (1 + r) ** 12 - 1 : r)) ** (du / 252)
  else if (kind === 'pct') opFactor = pctFactor(dailies, r)
  else opFactor = diFactor * (1 + r) ** (du / 252)

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
