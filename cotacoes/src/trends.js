export const TREND_GROUPS = [
  { id: 'credito', label: 'Crédito e caixa', terms: ['capital de giro', 'crédito empresarial', 'inadimplência'], match: /capital de giro|credito|inadimpl|endivid|renegocia/, question: 'O ciclo de recebimentos e pagamentos mudou a necessidade de capital de giro?' },
  { id: 'investimento', label: 'Investimento', terms: ['BNDES', 'financiamento de máquinas', 'investimento empresarial'], match: /bndes|finame|maquinas|investimento empresarial/, question: 'Há investimento previsto que precise de prazo de carência ou financiamento?' },
  { id: 'juros', label: 'Juros, câmbio e comex', terms: ['taxa Selic', 'dólar', 'exportação'], match: /selic|copom|dolar|cambio|exporta|importa|tarifa|fed|juros/, question: 'Como juros e câmbio afetam o custo da dívida e os próximos pagamentos no exterior?' },
  { id: 'custos', label: 'Custos', terms: ['preço do diesel', 'frete', 'energia elétrica'], match: /diesel|petroleo|frete|energia|combustivel|inflacao|ipca/, question: 'Quais custos pressionam a margem e exigem rever preços ou estoques?' },
  { id: 'reforma', label: 'Reforma tributária', terms: ['reforma tributária', 'CBS', 'IBS'], match: /reforma tributaria|\bcbs\b|\bibs\b|split payment/, question: 'A transição tributária pode mudar o caixa ou os prazos de recuperação de créditos?' },
]
export const normalizeTrend = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export const groupsForTrend = title => TREND_GROUPS.filter(g => g.match.test(normalizeTrend(title))).map(g => g.id)
export function exploreUrl(terms, period = 'today 3-m') {
  return `https://trends.google.com/trends/explore?${new URLSearchParams({ geo: 'BR', date: period, q: terms.join(','), hl: 'pt-BR' })}`
}

export const TREND_PERIODS = ['today 3-m', 'today 12-m']
// URL do iframe exibido pelo recurso oficial Incorporar > Manter os dados atualizados.
// Conferido na interface do Google Trends em 07/11/2026. Não é API de extração.
export function trendEmbedUrl(groupId, period = 'today 3-m') {
  const group = TREND_GROUPS.find(item => item.id === groupId)
  if (!group || !TREND_PERIODS.includes(period)) throw new Error('Recorte do Google Trends inválido')
  const request = { comparisonItem: group.terms.map(keyword => ({ keyword, geo: 'BR', time: period })), category: 0, property: '' }
  const query = new URL(exploreUrl(group.terms, period)).search.slice(1)
  return `https://trends.google.com/trends/embed/explore/TIMESERIES?${new URLSearchParams({ req: JSON.stringify(request), tz: '180', eq: query, hl: 'pt-BR' })}`
}

export const TREND_MAX_AGE_MS = 25 * 3600000
export const trendStamp = value => typeof value === 'string' ? Date.parse(value) : typeof value === 'number' ? value : NaN
export function validTrendData(data) {
  return !!data && typeof data === 'object' && Array.isArray(data.items) &&
    Number.isFinite(trendStamp(data.generatedAt)) && data.items.every(item => item && typeof item === 'object' &&
      typeof item.title === 'string' && item.title.trim() && Number.isFinite(trendStamp(item.publishedAt)) &&
      Array.isArray(item.groups) && item.groups.every(id => TREND_GROUPS.some(group => group.id === id)))
}
export function trendsOld(data, now = Date.now()) {
  const at = trendStamp(data?.generatedAt)
  return !Number.isFinite(at) || now - at > TREND_MAX_AGE_MS
}
