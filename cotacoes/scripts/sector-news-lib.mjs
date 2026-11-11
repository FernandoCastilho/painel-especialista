import { NEWS_WINDOW_HOURS } from '../src/newsWindow.js'
import { SECTOR_NEWS_TOPICS, SECTOR_NEWS_SOURCES, SECTOR_NEWS_WINDOW_MS, canonicalNewsUrl, sectorNewsItemMatchesTopic, validateSectorNewsItem, normalizeSectorNews, validIsoTimestamp } from '../src/sectorNews.js'

export const MAX_ARTICLES_PER_SOURCE = 40
export const MAX_RESPONSE_BYTES = 3_000_000
const USER_AGENT = 'PainelEspecialistaSectorNews/1.0 (+https://github.com/FernandoCastilho/painel-especialista)'
const MAX_RUN_MS = 10 * 60_000
const reviewRequired = message => /http_(401|403|429)|access_challenge|robots|license|redirect/.test(message)

const entityMap = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
export function decodeHtml(text) {
  return String(text ?? '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (all, entity) => {
    if (entity[0] !== '#') return entityMap[entity.toLowerCase()] || all
    const n = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
    return n >= 32 && n <= 0x10ffff ? String.fromCodePoint(n) : ''
  })
}
const plain = text => decodeHtml(String(text).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
const accessChallenge = html => /support id is|testing whether you are a human|captcha|access denied|forbidden/i.test(plain(html))
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map(m => [m[1].toLowerCase(), decodeHtml(m[3])]))
}

export function parseGovArticle(html, source, link, collectedAt) {
  if (accessChallenge(html)) throw new Error('access_challenge_or_denied: coleta interrompida, sem contorno')
  if (!html.includes('creativecommons.org/licenses/by-nd/3.0')) throw new Error('license_not_confirmed: licença esperada ausente nesta página')
  const title = plain(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '')
  const meta = Object.fromEntries([...html.matchAll(/<meta\b[^>]*>/gi)].map(m => { const a = attributes(m[0]); return [String(a.property || a.name || '').toLowerCase(), a.content] }))
  // Never fall back to modified/update metadata or a timestamp from the listing.
  const issued = ['article:published_time', 'datepublished', 'dc.date.issued', 'dcterms.issued'].map(key => meta[key]).filter(date => validIsoTimestamp(date) !== null)
  const inspectNode = node => {
    if (Array.isArray(node)) return node.forEach(inspectNode)
    if (!node || typeof node !== 'object') return
    if (node['@graph']) inspectNode(node['@graph'])
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']]
    if (!types.some(type => ['NewsArticle', 'Article', 'BlogPosting', 'Report'].includes(type))) return
    if (node.url && canonicalNewsUrl(node.url) !== canonicalNewsUrl(link)) return
    if (validIsoTimestamp(node.datePublished) !== null) issued.push(node.datePublished)
  }
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (attributes(script[1]).type !== 'application/ld+json') continue
    try { inspectNode(JSON.parse(script[2])) } catch { /* Broken JSON-LD is not a trustworthy timestamp. */ }
  }
  if (new Set(issued.map(Date.parse)).size > 1) throw new Error('conflicting_publication_dates: metadados de publicação discordam')
  let publishedAt = issued[0] || null
  let datePrecision = 'instant'
  if (!publishedAt) {
    const visible = plain(html).match(/Publicado em\s+(\d{2})\/(\d{2})\/(\d{4})\s+\d{2}(?:h|:)\d{2}/i)
    if (visible) { publishedAt = `${visible[3]}-${visible[2]}-${visible[1]}`; datePrecision = 'day' }
  }
  if (!title || !publishedAt) throw new Error('parse_error: título ou data de publicação original ausente')
  const author = meta.author || plain(html.match(/class=["'][^"']*(?:documentAuthor|document-author)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '')
  return { title, link, sourceId: source.id, source: source.label, publishedAt, collectedAt, datePrecision, type: source.type, licenseUrl: source.licenseUrl, ...(author ? { author } : {}) }
}

export function extractGovArticleLinks(html, source) {
  const found = new Map()
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attr = attributes(m[1]), title = plain(m[2])
    let link
    try { link = canonicalNewsUrl(new URL(attr.href, source.url).href) } catch { continue }
    if (!link?.startsWith(source.articlePrefix) || new URL(link).search || title.length < 12) continue
    // Link com espaço ou caractere codificado (%) é recusado pelo transporte antes de qualquer acesso;
    // ignorá-lo aqui evita suspender a fonte inteira por um endereço malformado do site.
    if (/[%@\\\s?#]/u.test(link)) continue
    if (new URL(link).pathname.split('/').pop().length < 16 || /\/(?:RSS|@@|search|login)(?:[/?]|$)/i.test(link)) continue
    if (source.topics.some(id => sectorNewsItemMatchesTopic(id, { title, link }))) found.set(link, title)
  }
  return [...found].map(([link, title]) => ({ link, title }))
}

// Conservative robots parser: any applicable named group also restricts us.
// If the format is unfamiliar, the collector fails closed rather than assuming access.
export function robotsAllows(robots, url) {
  if (typeof robots !== 'string' || /<html|captcha|support id is/i.test(robots)) throw new Error('robots_invalid_or_challenge')
  const path = new URL(url).pathname + new URL(url).search
  let relevant = false, sawDirective = false, sawAgent = false
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim(), split = line.indexOf(':')
    if (!line) continue
    if (split < 1) throw new Error('robots_unrecognized_format_requires_review')
    const key = line.slice(0, split).trim().toLowerCase(), value = line.slice(split + 1).trim()
    if (!['user-agent', 'disallow', 'allow', 'crawl-delay', 'sitemap'].includes(key)) throw new Error('robots_unknown_directive_requires_review')
    if (key === 'sitemap') {
      if (!/^https?:\/\/\S+$/.test(value)) throw new Error('robots_invalid_sitemap_requires_review')
      continue
    }
    if (key === 'user-agent') {
      if (!value) throw new Error('robots_empty_user_agent_requires_review')
      sawAgent = true
      if (sawDirective) { relevant = false; sawDirective = false }
      relevant ||= value === '*' || USER_AGENT.toLowerCase().includes(value.toLowerCase())
      continue
    }
    if (!sawAgent) throw new Error('robots_directive_without_agent_requires_review')
    if (['disallow', 'allow'].includes(key) && value && !value.startsWith('/')) throw new Error('robots_invalid_path_requires_review')
    if (key === 'crawl-delay' && !/^\d+(?:\.\d+)?$/.test(value)) throw new Error('robots_invalid_crawl_delay_requires_review')
    if (['disallow', 'allow', 'crawl-delay'].includes(key)) sawDirective = true
    if (key === 'disallow' && relevant && value) {
      const pattern = value.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')
      if (new RegExp(`^${pattern}`).test(path)) return false
    }
    if (key === 'crawl-delay' && relevant && Number(value) > 1) throw new Error('robots_crawl_delay_requires_review')
  }
  if (!sawAgent) throw new Error('robots_missing_user_agent_requires_review')
  return true
}

async function responseText(response) {
  const size = Number(response.headers?.get?.('content-length') || 0)
  if (size > MAX_RESPONSE_BYTES) throw new Error('response_too_large')
  if (!response.body?.getReader) {
    const result = await response.text()
    if (Buffer.byteLength(result) > MAX_RESPONSE_BYTES) throw new Error('response_too_large')
    return result
  }
  const reader = response.body.getReader(), chunks = []
  let total = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('response_too_large') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  return Buffer.concat(chunks).toString('utf8')
}

export async function fetchPublicText(url, { fetchImpl, allowedPrefix, robots = null } = {}) {
  if (typeof fetchImpl !== 'function' || fetchImpl === globalThis.fetch) throw new Error('live_collection_disabled: transporte real não habilitado; somente testes com transporte injetado')
  const u = new URL(url)
  if (u.protocol !== 'https:' || u.hostname !== 'www.gov.br' || u.username || u.password || u.port || !url.startsWith(allowedPrefix)) throw new Error('url_outside_approved_source')
  if (robots !== null && !robotsAllows(robots, url)) throw new Error('robots_disallow: coleta não autorizada para esta rota')
  let response
  try {
    response = await fetchImpl(url, { headers: { 'user-agent': USER_AGENT, accept: 'text/html,text/plain;q=0.8' }, signal: AbortSignal.timeout(15000), redirect: 'manual' })
  } catch (error) {
    throw new Error(`network_error: ${url}: ${error.message}${error.cause?.code ? ` (${error.cause.code})` : ''}`)
  }
  // No retry, proxy, alternate hostname or automatic redirect on access failure.
  if (response.status >= 300 && response.status < 400) throw new Error(`redirect_requires_review: HTTP ${response.status}`)
  if (!response.ok) throw new Error(`http_${response.status}: ${url}: fonte indisponível ou acesso negado`)
  return responseText(response)
}

export function mergeSectorSourceStates(previous = {}, current = {}) {
  const latest = (a, b) => !a ? b || null : !b ? a : Date.parse(a) >= Date.parse(b) ? a : b
  return Object.fromEntries([...new Set([...Object.keys(previous), ...Object.keys(current)])].map(id => {
    const old = previous[id] || {}, next = current[id] || {}
    const nextIsNewer = !old.checkedAt || (next.checkedAt && Date.parse(next.checkedAt) >= Date.parse(old.checkedAt))
    return [id, { ...(nextIsNewer ? old : next), ...(nextIsNewer ? next : old), checkedAt: latest(old.checkedAt, next.checkedAt), lastSuccessAt: latest(old.lastSuccessAt, next.lastSuccessAt), accessSuspended: Boolean(old.accessSuspended || next.accessSuspended) }]
  }))
}

export function makeSectorNewsFile({ previous = {}, items = [], sourceStates = {}, now = Date.now() } = {}) {
  const topics = Object.fromEntries(SECTOR_NEWS_TOPICS.map(topic => [topic.id, { ...topic, items: [] }]))
  const audit = []
  const all = [...items, ...Object.values(previous.topics || {}).flatMap(t => Array.isArray(t?.items) ? t.items : [])]
  for (const raw of all) {
    const validation = validateSectorNewsItem(raw, now)
    if (!validation.item) { audit.push({ sourceId: raw?.sourceId || null, link: canonicalNewsUrl(raw?.link), reason: validation.reason }); continue }
    const source = SECTOR_NEWS_SOURCES.find(s => s.id === validation.item.sourceId)
    let matched = false
    for (const id of source.topics) if (sectorNewsItemMatchesTopic(id, validation.item)) { topics[id].items.push(validation.item); matched = true }
    if (!matched) audit.push({ sourceId: source.id, link: validation.item.link, reason: 'no_relevant_topic' })
  }
  const normalized = normalizeSectorNews({ schemaVersion: 1, generatedAt: new Date(now).toISOString(), topics, sourceStates: mergeSectorSourceStates(previous.sourceStates, sourceStates) }, now)
  return { ...normalized, audit: [...new Map(audit.map(a => [JSON.stringify(a), a])).values()], collectionPolicy: { mode: 'institutional-headlines-only', noFullText: true, noPhotos: true, noMinimumCount: true, windowHours: NEWS_WINDOW_HOURS, maxArticlesPerSource: MAX_ARTICLES_PER_SOURCE, licence: 'per-source', licences: [...new Set(SECTOR_NEWS_SOURCES.filter(s => s.enabled).map(s => s.licenseUrl))], automaticScheduleEnabled: false, persistentStateStatus: 'not-homologated; CI must use offline revalidation' } }
}

export async function collectSectorNews({ previous = {}, sourceIds = null, now = Date.now(), fetchImpl, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  if (typeof fetchImpl !== 'function' || fetchImpl === globalThis.fetch) throw new Error('live_collection_disabled: coleta externa desabilitada até homologar persistência; somente testes com transporte injetado')
  const sourceStates = {}, items = [], started = Date.now()
  let robots, robotsError
  for (const source of SECTOR_NEWS_SOURCES) {
    if (!source.enabled || !source.automaticCollection || (sourceIds && !sourceIds.includes(source.id))) continue
    if (previous.sourceStates?.[source.id]?.accessSuspended) continue
    const checkedAt = new Date(now).toISOString()
    const oldSuccess = previous.sourceStates?.[source.id]?.lastSuccessAt || null
    try {
      if (Date.now() - started > MAX_RUN_MS) throw new Error('run_budget_exhausted')
      if (robots === undefined && !robotsError) {
        try {
          robots = await fetchPublicText(source.robotsUrl, { fetchImpl, allowedPrefix: 'https://www.gov.br/robots.txt' })
          if (!/user-agent\s*:/i.test(robots) || /<html|captcha|support id is/i.test(robots)) throw new Error('robots_invalid_or_challenge')
        }
        catch (error) { robotsError = error; throw error }
      }
      if (robotsError) throw new Error(`robots_unavailable: ${robotsError.message}`)
      const html = await fetchPublicText(source.url, { fetchImpl, allowedPrefix: source.url, robots })
      if (accessChallenge(html)) throw new Error('access_challenge: sem contorno')
      if (!html.includes('creativecommons.org/licenses/by-nd/3.0')) throw new Error('license_not_confirmed')
      const links = extractGovArticleLinks(html, source)
      if (!links.length) throw new Error('listing_unparsed_or_no_candidates: lista vazia/dinâmica; não confirma ausência de notícias')
      const errors = []
      let readCount = 0
      for (const { link } of links.slice(0, MAX_ARTICLES_PER_SOURCE)) {
        if (Date.now() - started > MAX_RUN_MS) { errors.push('run_budget_exhausted'); break }
        await pause(1100)
        try {
          const article = await fetchPublicText(link, { fetchImpl, allowedPrefix: source.articlePrefix, robots })
          items.push(parseGovArticle(article, source, link, checkedAt)); readCount++
        } catch (error) {
          errors.push(`${link}: ${error.message}`)
          if (reviewRequired(error.message)) break
        }
      }
      sourceStates[source.id] = { status: readCount ? 'partial' : 'failed', checkedAt, lastSuccessAt: readCount ? checkedAt : oldSuccess, accessSuspended: errors.some(reviewRequired),
        reason: `${readCount} páginas de matérias verificadas. Uma página de índice consultada, até ${MAX_ARTICLES_PER_SOURCE} matérias; cobertura parcial. ${errors.length ? `Falhas (${errors.length}): ${errors.slice(0, 3).join('; ')}` : 'Só manchetes originais; sem texto integral ou fotos.'}` }
    } catch (error) {
      sourceStates[source.id] = { status: 'failed', checkedAt, lastSuccessAt: oldSuccess, accessSuspended: reviewRequired(error.message), reason: error.message }
    }
  }
  return makeSectorNewsFile({ previous, items, sourceStates, now })
}

export { SECTOR_NEWS_WINDOW_MS }
