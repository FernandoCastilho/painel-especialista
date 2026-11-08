// A janela de sete dias aplica-se somente às quatro curadorias de tributos/trabalho.
// As demais notícias mantêm a janela de cinco dias do painel.
export const CURADORIA_DAYS = 7
export const CURADORIA_MS = CURADORIA_DAYS * 86400000
export const CURADORIA_TOPICS = [
  { id: 'imposto', label: 'Imposto', query: 'imposto OR impostos OR tributação OR "Receita Federal" OR IRPF OR IOF OR ICMS OR dividendos' },
  { id: 'split-payment', label: 'Split payment', query: '"split payment" OR "pagamento segregado" OR "recolhimento na liquidação financeira"' },
  { id: 'reforma', label: 'Reforma tributária', query: '"reforma tributária" OR "IBS CBS" OR "imposto seletivo"' },
  { id: 'escala-6x1', label: 'Escala 6x1', query: '"escala 6x1" OR "escala 6 por 1" OR "fim da 6x1" OR "jornada de trabalho"' },
]
const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export function relevantCuradoria(id, title) {
  const text = fold(title)
  if (id === 'imposto') return /\bimpostos?\b|tribut|\b(irpf|irpj|iof|icms|ipva|iptu|iss|pis|cofins|cbs|ibs|itcmd|irrf)\b/.test(text) || (/dividendos/.test(text) && /retencao|isencao/.test(text))
  if (id === 'split-payment') return /split[\s-]+payment|pagamento segregado|recolhimento (?:do imposto )?na liquidacao financeira/.test(text) && /impost|tribut|\b(ibs|cbs)\b|receita|fazenda|reforma/.test(text)
  if (id === 'reforma') return /reforma tribut|imposto seletivo|\biva dual\b|\bcomite gestor do ibs\b/.test(text) || (/\b(ibs|cbs)\b/.test(text) && /tribut|imposto|aliquota|reforma|\bibs\b.*\bcbs\b|\bcbs\b.*\bibs\b/.test(text))
  if (id === 'escala-6x1') return /\b6\s*(?:x|×|por|a|\/|:|para)\s*1\b|seis (?:dias? )?por um/.test(text) && /escala|jornada|trabalh|pec|folga|fim/.test(text)
  return false
}
export const CURADORIA_SOURCES = [
  { domain: 'gov.br', label: 'Órgão público', type: 'Fonte oficial' },
  { domain: 'camara.leg.br', label: 'Câmara dos Deputados', type: 'Fonte oficial' },
  { domain: 'senado.leg.br', label: 'Senado Federal', type: 'Fonte oficial' },
  { domain: 'cgibs.gov.br', label: 'Comitê Gestor do IBS', type: 'Fonte oficial' },
  { domain: 'economia.uol.com.br', label: 'UOL Economia', type: 'Imprensa' },
  { domain: 'stf.jus.br', label: 'STF', type: 'Fonte oficial' },
  { domain: 'stj.jus.br', label: 'STJ', type: 'Fonte oficial' },
  { domain: 'agenciabrasil.ebc.com.br', label: 'Agência Brasil', type: 'Imprensa' },
  { domain: 'valor.globo.com', label: 'Valor Econômico', type: 'Imprensa' },
  { domain: 'g1.globo.com', label: 'g1', type: 'Imprensa' },
  { domain: 'reuters.com', label: 'Reuters', type: 'Imprensa' },
  { domain: 'jota.info', label: 'JOTA', type: 'Imprensa especializada' },
  { domain: 'estadao.com.br', label: 'Estadão', type: 'Imprensa' },
  { domain: 'folha.uol.com.br', label: 'Folha de S.Paulo', type: 'Imprensa' },
]
export function curadoriaSource(sourceUrl) {
  try {
    const url = new URL(sourceUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    const host = url.hostname.toLowerCase()
    return [...CURADORIA_SOURCES].sort((a, b) => b.domain.length - a.domain.length).find(source => host === source.domain || host.endsWith('.' + source.domain)) ?? null
  } catch { return null }
}
export const recentCuradoria = (items, now = Date.now()) => (Array.isArray(items) ? items : []).filter(item => Number.isFinite(now) && Number.isFinite(item?.t) && item.t > 0 && item.t >= now - CURADORIA_MS && item.t <= now)
export function curateItems(id, fresh, previous = [], now = Date.now()) {
  const links = new Set(), titles = new Set()
  return recentCuradoria([...fresh, ...previous], now).sort((a, b) => b.t - a.t).flatMap(item => {
    const source = curadoriaSource(item.sourceUrl)
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    const titleKey = fold(title).replace(/[^a-z0-9]+/g, ' ').trim()
    if (!title || !source || !relevantCuradoria(id, title) || !/^https?:\/\//.test(item.link ?? '') || links.has(item.link) || titles.has(titleKey)) return []
    links.add(item.link); titles.add(titleKey)
    return [{ title, link: item.link, t: item.t, source: source.domain === 'gov.br' ? `Órgão público (${new URL(item.sourceUrl).hostname})` : source.label, sourceUrl: item.sourceUrl, sourceType: source.type }]
  })
}
export function normalizeCuradoria(data, id, now = Date.now()) {
  if (data?.schemaVersion !== 1 || data.windowDays !== CURADORIA_DAYS || !CURADORIA_TOPICS.some(topic => topic.id === id) || !Array.isArray(data.topics?.[id]?.items)) return null
  const topic = data.topics[id]
  const checkedAt = typeof topic.checkedAt === 'number' ? topic.checkedAt : NaN
  const lastSuccessAt = typeof topic.lastSuccessAt === 'number' ? topic.lastSuccessAt : NaN
  return { ...topic, generatedAt: data.generatedAt, items: curateItems(id, topic.items, [], now), stale: topic.status !== 'ok' || !Number.isFinite(checkedAt) || checkedAt > now || !Number.isFinite(lastSuccessAt) || lastSuccessAt > now || now - lastSuccessAt > 3 * 3600000 }
}
