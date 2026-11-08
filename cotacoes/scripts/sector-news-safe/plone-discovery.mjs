// Reviewed discovery adapter only. No network or state mutation is performed here.
// Production source selection and historical holds intentionally remain unchanged.
import { SECTOR_NEWS_SOURCES, sectorNewsItemMatchesTopic } from '../../src/sectorNews.js'

const routes = Object.freeze({
  aneel: '/aneel/++api++/pt-br/assuntos/noticias/@querystring-search',
  susep: '/susep/++api++/pt-br/central-de-conteudos/noticias/@querystring-search',
})
export const PLONE_DISCOVERY_LIMIT = 5
function sourceFor(id) {
  if (!Object.hasOwn(routes, id)) throw Error('plone_source_not_reviewed')
  return SECTOR_NEWS_SOURCES.find(source => source.id === id)
}
export function ploneDiscoveryUrl(id) {
  sourceFor(id)
  // Same official customSearch query, with a bounded first page. Never follow batching links.
  const query = { b_size: PLONE_DISCOVERY_LIMIT, limit: PLONE_DISCOVERY_LIMIT,
    query: [
      { i: 'portal_type', o: 'plone.app.querystring.operation.selection.any', v: ['News Item'] },
      { i: 'path', o: 'plone.app.querystring.operation.string.relativePath', v: '' },
    ], sort_on: 'effective', sort_order: 'descending', sort_order_boolean: true, b_start: 0 }
  return `https://www.gov.br${routes[id]}?query=${encodeURIComponent(JSON.stringify(query))}`
}
export function isPloneDiscoveryUrl(id, url) {
  return Object.hasOwn(routes, id) && url === ploneDiscoveryUrl(id)
}
export function parsePloneDiscovery(body, id) {
  const source = sourceFor(id)
  if (typeof body !== 'string' || Buffer.byteLength(body) > 2_000_000) throw Error('plone_response_invalid')
  let data
  try { data = JSON.parse(body) } catch { throw Error('plone_response_invalid') }
  if (!data || !Array.isArray(data.items) || data.items.length > PLONE_DISCOVERY_LIMIT || !Number.isSafeInteger(data.items_total) || data.items_total < data.items.length) throw Error('plone_response_invalid')
  // The service returns its public content URL rather than the ++api++ transport URL.
  let identity
  try { identity = new URL(data['@id']) } catch { throw Error('plone_response_identity') }
  if (identity.origin + identity.pathname !== source.url + '/@querystring-search' || identity.username || identity.password || identity.port || identity.hash) throw Error('plone_response_identity')
  const found = new Map()
  for (const item of data.items) {
    if (!item || item['@type'] !== 'News Item' || item.review_state !== 'published') throw Error('plone_item_invalid')
    const link = item['@id'], title = item.title
    if (typeof link !== 'string' || typeof title !== 'string' || !title.trim() || title.length > 600 || /[<>]/.test(title)) throw Error('plone_item_invalid')
    let url
    try { url = new URL(link) } catch { throw Error('plone_item_url') }
    if (url.href !== link || !link.startsWith(source.articlePrefix) || url.origin !== 'https://www.gov.br' || url.username || url.password || url.port || url.search || url.hash || /[%@\\]/.test(link) || /\/(?:RSS|search|login)(?:\/|$)/i.test(url.pathname) || url.pathname.split('/').pop().length < 16) throw Error('plone_item_url')
    if (source.topics.some(topic => sectorNewsItemMatchesTopic(topic, { title, link }))) found.set(link, title)
  }
  // No publication date, description, image or body is trusted from discovery.
  // Each candidate still requires the original article, licence and date validation.
  return [...found].map(([link, title]) => ({ link, title }))
}
