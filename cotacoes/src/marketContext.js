export const MARKET_IDS = ['ism-manufacturing', 'ism-services', 'caged', 'unemployment-br', 'payroll-us']
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
export const COMMODITY_IDS = ['wti', 'henry-hub', 'ny-diesel', 'ny-gasoline', 'gold', 'copper', 'aluminum', 'iron-ore', 'soybeans', 'corn', 'sugar', 'coffee', 'urea', 'dap', 'wheat', 'beef', 'cotton', 'coal', 'cocoa']
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
export function contextValue(item) {
  return Number.isFinite(item?.value) ? item.value.toLocaleString('pt-BR', { maximumFractionDigits:item.decimals ?? 2, minimumFractionDigits:item.decimals ?? 0 }) : '—'
}

// Unidade em dólar escrita sempre do mesmo jeito na tela: "USD/barril" -> "US$/barril", "USc/libra" -> "US¢/libra".
// Só texto; o valor não muda. Outras unidades (R$, índice) ficam como vieram.
export function unidadeEmDolar(unit) {
  if (typeof unit !== 'string') return unit
  return unit.replace(/^\s*(?:USc|US\s?cents?|US¢|¢)(?=\/|\s|$)/i, 'US¢').replace(/^\s*(?:USD|US\$|U\$S)(?=\/|\s|$)/i, 'US$')
}
