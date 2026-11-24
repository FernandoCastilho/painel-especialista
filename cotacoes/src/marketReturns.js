// Calendar boundaries are civil dates in São Paulo, independent of the device zone.
const marketDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
export const marketDate = t => marketDateFormatter.format(new Date(t))
const dayNumber = d => Date.parse(d + 'T12:00:00Z') / 864e5

export function accumulatedReturns(file, code, now = Date.now()) {
  if (!Number.isFinite(new Date(now).getTime())) return { month: null, year: null }
  return accumulatedReturnsForDay(file, code, marketDate(now))
}

export function accumulatedReturnsForDay(file, code, today) {
  const empty = { month: null, year: null }
  const series = file?.series?.[code]
  if (file?.source !== 'AwesomeAPI' || series?.source !== code || !Array.isArray(series.points)) return empty
  const monthStart = today.slice(0, 7) + '-01', yearStart = today.slice(0, 4) + '-01-01'
  const daily = new Map()
  const valid = series.points.filter(p => Number.isFinite(p?.t) && Number.isFinite(new Date(p.t).getTime()) && Number.isFinite(p.bid) && p.bid > 0)
  for (const p of valid.sort((a, b) => a.t - b.t)) {
    const date = marketDate(p.t)
    // The current daily bar can still change: use only completed civil days.
    if (date < today) daily.set(date, { date, bid: p.bid })
  }
  const points = [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)), end = points.at(-1)
  const calculate = start => {
    const base = points.filter(p => p.date < start).at(-1)
    // Seven civil days is a conservative coverage guard, not a market-calendar claim.
    if (!base || !end || end.date < start || dayNumber(start) - dayNumber(base.date) > 7 || dayNumber(today) - dayNumber(end.date) > 7) return null
    return { value: (end.bid / base.bid - 1) * 100, baseDate: base.date, endDate: end.date, base: base.bid, end: end.bid }
  }
  return { month: calculate(monthStart), year: calculate(yearStart) }
}

// Boletins da PTAX do Banco Central: Abertura, Intermediário (vários) e Fechamento. Qualquer um é uma PTAX oficial; o tipo e o horário vão ao lado do valor.
const PTAX_KINDS = /^(abertura|intermedi[aá]ri[oa]|fechamento( ptax)?)$/i
export function ptaxLabel(ptax) {
  if (!ptax) return ''
  if (ptax.cross) return 'ref. cruz.'
  if (/^fechamento/i.test(ptax.kind)) return `fech. ${ptax.date.split('-').reverse().slice(0, 2).join('/')}`
  const hm = /\d{2}:\d{2}/.exec(ptax.at ?? '')?.[0]
  return `${/^abertura/i.test(ptax.kind) ? 'abert.' : 'interm.'}${hm ? ` ${hm}` : ''}`
}
export function compatiblePtax(code, quote, ptax, now = Date.now()) {
  if (!['USD', 'EUR', 'JPY'].includes(code) || quote?.fallback || (quote?.source && quote.source !== code)) return null
  if (!Number.isFinite(ptax?.sell) || ptax.sell <= 0 || !PTAX_KINDS.test(ptax.kind ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(ptax.date || '')) return null
  const d = new Date(ptax.date + 'T12:00:00Z')
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === ptax.date && ptax.date <= marketDate(now) ? ptax : null
}

// Não existe PTAX oficial do yuan: referência cruzada = PTAX do dólar (venda) ÷ USD/CNH do instante do boletim, lido do intraday (AwesomeAPI).
// Sem amostras das duas pontas a até 15 min do boletim, não há valor (nunca usa cotação de outro horário).
const nearest = (points, t) => points.reduce((best, p) => (Math.abs(p.t - t) < Math.abs((best?.t ?? Infinity) - t) ? p : best), null) ?? null
export function cnhPtaxCross(ptaxUsd, usdPoints, cnhPoints, maxGapMs = 15 * 60000) {
  const at = Date.parse(String(ptaxUsd?.at ?? '').replace(' ', 'T') + '-03:00')
  if (!Number.isFinite(at) || !(ptaxUsd?.sell > 0)) return null
  const usd = nearest(usdPoints ?? [], at), cnh = nearest(cnhPoints ?? [], at)
  if (!usd || !cnh || Math.abs(usd.t - at) > maxGapMs || Math.abs(cnh.t - at) > maxGapMs || !(usd.bid > 0) || !(cnh.bid > 0)) return null
  return { ...ptaxUsd, sell: ptaxUsd.sell / (usd.bid / cnh.bid), cross: true }
}

// Destaques da tabela de câmbio: 🔥 na moeda que mais subiu no mês e 🛡️ na que menos subiu.
// Só marca com duas ou mais moedas com acumulado do mês e quando a maior e a menor são diferentes.
export function destaquesMes(returns) {
  const vals = Object.entries(returns ?? {}).filter(([, r]) => Number.isFinite(r?.month?.value)).map(([code, r]) => [code, r.month.value])
  if (vals.length < 2) return {}
  const max = Math.max(...vals.map(v => v[1])), min = Math.min(...vals.map(v => v[1]))
  if (max === min) return {}
  return { maior: vals.find(v => v[1] === max)[0], menor: vals.find(v => v[1] === min)[0] }
}
