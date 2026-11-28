export const MARKET_IDS = ['ism-manufacturing', 'ism-services', 'caged', 'unemployment-br', 'consumer-confidence-br', 'payroll-us']
export const ACTIVITY_REVIEW_DAYS = 7
export function activityNeedsReview(item, now = Date.now()) {
  const checked = typeof item?.checkedAt === 'number' ? item.checkedAt : Date.parse(item?.checkedAt)
  const deadline = Date.parse(item?.nextReviewAt)
  const nextRelease = Date.parse(item?.nextReleaseAt)
  const reviewAt = Math.min(checked + ACTIVITY_REVIEW_DAYS * 864e5, Number.isFinite(deadline) ? deadline : Infinity, Number.isFinite(nextRelease) ? nextRelease : Infinity)
  return !!item?.stale || !Number.isFinite(checked) || checked > now || now >= reviewAt
}
export const BRL_IDS = ['ic-br', 'ic-br-agro', 'ic-br-metal', 'ic-br-energia', 'soja-saca']
export const FUEL_IDS = ['anp-gasolina', 'anp-etanol', 'anp-diesel', 'anp-glp']
export const COMMODITY_IDS = ['wti', 'henry-hub', 'ny-diesel', 'ny-gasoline', 'gold', 'copper', 'aluminum', 'iron-ore', 'soybeans', 'corn', 'sugar', 'coffee', 'urea', 'dap', 'wheat', 'beef', 'cotton', 'coal', 'cocoa', 'pulp-br']
const normalizeCommoditySearch = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
export function filterCommodities(items, query) {
  const terms = normalizeCommoditySearch(query).split(' ').filter(Boolean)
  if (!terms.length) return items
  return items.filter(item => {
    const label = normalizeCommoditySearch(item.label)
    return terms.every(term => label.includes(term))
  })
}
export const contextDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('/') : /^\d{4}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('/') : value || 'não informada'
export function validContextItem(item) {
  return item && typeof item.id === 'string' && typeof item.label === 'string' && (item.value === null || Number.isFinite(item.value)) && typeof item.unit === 'string' && typeof item.nature === 'string' && /^https:\/\//.test(item.sourceUrl || '')
}
export function contextItems(data, key, ids) {
  if (!Array.isArray(data?.[key])) throw new Error('Formato de dados inválido')
  const items = ids.map(id => data[key].find(item => item.id === id && validContextItem(item))).filter(Boolean)
  if (!items.length) throw new Error('Nenhum dado válido')
  return items
}
export function brentContext(data) {
  if (data?.benchmark !== 'Brent' || data?.kind !== 'spot' || data?.unit !== 'USD/barril') return null
  return { id:'brent', label:'Petróleo Brent', value: Number.isFinite(data.value) ? data.value : null, unit:'US$/barril', nature:'Spot diário · FOB', period:data.observationDate, releaseDate:data.releaseDate, checkedAt:data.generatedAt, stale:!!data.stale, error:data.error, sourceName:data.sourceName || 'EIA', sourceUrl:data.sourceURL || 'https://www.eia.gov/dnav/pet/hist/RBRTED.htm', benchmark:'Europe Brent • FOB', history:(Array.isArray(data.points) ? data.points : []).filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p?.date) && Number.isFinite(p.value) && p.value>0).map(p=>({period:p.date,value:p.value})) }
}
// Café arábica na bolsa de Nova York (ICE, contrato KC), do arquivo insumos-precos.json (Yahoo Finance, atrasado e não oficial).
// Fica ao lado da média mensal do Banco Mundial; não a substitui. Data do pregão no fuso de Nova York; horário do último negócio em Brasília.
// Máxima e mínima só quando a coleta trouxe a barra do mesmo pregão do último ponto. Sem série válida, sem linha.
export const COFFEE_NY_URL = 'https://finance.yahoo.com/quote/KC%3DF'
const nyDay = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
// Código do vencimento na ICE para o leitor: "KCH27" -> "mar/27".
const KC_MONTH_NAMES = { H: 'mar', K: 'mai', N: 'jul', U: 'set', Z: 'dez' }
const contractLabel = (code) => {
  const m = /^[A-Z]{2}([HKNUZ])(\d{2})$/.exec(code ?? '')
  return m ? `${KC_MONTH_NAMES[m[1]]}/${m[2]}` : 'mais próximo'
}
export function coffeeNyContext(data) {
  const s = data?.series?.['cafe-arabica']
  if (s?.unit !== 'US¢/libra-peso') return null
  const byDay = new Map()
  for (const p of Array.isArray(s.points) ? s.points : []) if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[1] > 0) byDay.set(nyDay(p[0]), p)
  const pts = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))
  if (!pts.length) return null
  const [period, [t, value]] = pts.at(-1)
  const day = s.lastDay?.t === t && Number.isFinite(s.lastDay.high) && Number.isFinite(s.lastDay.low) && s.lastDay.low <= value && value <= s.lastDay.high ? s.lastDay : null
  // Troca de contrato: o fechamento anterior do KC=F é de outro vencimento; o anterior e a variação do dia vêm do mesmo vencimento.
  const roll = day?.roll && Number.isFinite(day.prevClose) && day.prevClose > 0 ? day : null
  const time = Number.isFinite(day?.marketTime) ? new Date(day.marketTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : null
  return {
    id: 'coffee-ny', label: 'Café arábica · bolsa de Nova York', value, unit: s.unit, nature: 'contrato futuro ICE (KC) · diário', decimals: 2,
    period, time, dayHigh: day?.high ?? null, dayLow: day?.low ?? null, dayPrev: roll?.prevClose ?? null, contract: roll ? contractLabel(roll.contract) : null,
    checkedAt: Number.isFinite(s.checkedAt) ? new Date(s.checkedAt).toISOString() : null, stale: !!s.stale,
    sourceName: 'Yahoo Finance · ICE Futures U.S. (KC)', sourceUrl: COFFEE_NY_URL, benchmark: 'Café arábica "C" • contrato mais próximo • atrasado e não oficial',
    history: pts.map(([p, [, v]]) => ({ period: p, value: v })),
  }
}
export function contextValue(item) {
  return Number.isFinite(item?.value) ? item.value.toLocaleString('pt-BR', { maximumFractionDigits:item.decimals ?? 2, minimumFractionDigits:item.decimals ?? 0 }) : '—'
}

// Unidade em dólar escrita sempre do mesmo jeito na tela: "USD/barril" -> "US$/barril", "USc/libra" -> "US¢/libra".
// Só texto; o valor não muda. Outras unidades (R$, índice) ficam como vieram.
export function unidadeEmDolar(unit) {
  if (typeof unit !== 'string') return unit
  return unit.replace(/^\s*(?:USc|US\s?cents?|US¢|¢)(?=\/|\s|$)/i, 'US¢').replace(/^\s*(?:USD|US\$|U\$S)(?=\/|\s|$)/i, 'US$')
}
