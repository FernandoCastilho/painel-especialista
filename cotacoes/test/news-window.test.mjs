import test from 'node:test'
import assert from 'node:assert/strict'
import { NEWS_WINDOW_DAYS, NEWS_WINDOW_HOURS, NEWS_WINDOW_MS, inNewsWindow, recentNews, newsCollectionStale } from '../src/newsWindow.js'
import { parseRss, freshOnly } from '../scripts/news-lib.mjs'
import { fillFromPrevious, fillNewsFromPrevious } from '../scripts/prev-lib.mjs'
import { mergeItems } from '../scripts/reforma-lib.mjs'
import { normalizeReforma, normalizeTemas, juntarMoedas } from '../src/reforma.js'
import { buildFeed } from '../src/feed.js'
import { topHeadlines, rateTiles } from '../src/snapshot.js'
import { SECTOR_NEWS_SOURCES, SECTOR_NEWS_WINDOW_MS, normalizeSectorNews, validateSectorNewsItem, publicationBounds } from '../src/sectorNews.js'
import { makeSectorNewsFile } from '../scripts/sector-news-lib.mjs'

const NOW = Date.parse('2026-11-05T11:00:00Z')
const item = (title, t, extra = {}) => ({ title, t, source: 'Fonte de teste', link: `https://example.org/${encodeURIComponent(title)}`, ...extra })
const edge = NOW - NEWS_WINDOW_MS
const fixtures = [item('Recente', NOW - 1000), item('Limite', edge), item('Expirada', edge - 1), item('Futura', NOW + 1), item('Sem data', undefined)]

test('política única: exatamente 120 horas, extremos inclusivos, sem tolerância futura', () => {
  assert.equal(NEWS_WINDOW_DAYS, 5); assert.equal(NEWS_WINDOW_HOURS, 120)
  assert.equal(NEWS_WINDOW_MS, 432000000); assert.equal(SECTOR_NEWS_WINDOW_MS, NEWS_WINDOW_MS)
  assert.equal(inNewsWindow(edge, NOW), true)
  assert.equal(inNewsWindow(edge - 1, NOW), false)
  assert.equal(inNewsWindow(NOW, NOW), true)
  for (const t of [NOW + 1, NaN, Infinity, -Infinity, 0, null, undefined, String(NOW)]) assert.equal(inNewsWindow(t, NOW), false)
  assert.equal(inNewsWindow(NOW - 6 * 864e5, NOW, 7 * 864e5), false)
  assert.deepEqual(recentNews(fixtures, NOW).map(i => i.title), ['Recente', 'Limite'])
  assert.deepEqual(recentNews(null, NOW), [])
})

test('RSS usa pubDate; geração, coleta e data do fato não rejuvenescem matéria', () => {
  const published = new Date(edge - 1000).toUTCString()
  const rss = `<rss><item><title>Reforma tributária: fato atual</title><link>https://example.org/real</link><pubDate>${published}</pubDate><dateModified>${new Date(NOW).toISOString()}</dateModified></item></rss>`
  const [parsed] = parseRss(rss)
  assert.equal(parsed.t, Date.parse(published))
  assert.deepEqual(freshOnly([{ ...parsed, collectedAt: NOW, generatedAt: NOW, eventDate: NOW }], NOW), [])
  assert.deepEqual(recentNews([{ collectedAt: NOW, generatedAt: NOW, eventDate: NOW }], NOW), [])
})

test('fallback filtra novas e anteriores, conserva aviso mesmo se todas expirarem', () => {
  const news = { USD: [fixtures[3]], EUR: [fixtures[2]], MERCADO: [] }
  const previous = { generatedAt: NOW - 10000, news: { USD: fixtures, EUR: [fixtures[2]], MERCADO: [fixtures[4]] }, stale: { USD: NOW - 20000 } }
  const original = structuredClone(previous)
  const stale = fillNewsFromPrevious(news, previous, NOW)
  assert.deepEqual(news.USD.map(i => i.title), ['Recente', 'Limite'])
  assert.deepEqual(news.EUR, []); assert.deepEqual(news.MERCADO, [])
  assert.equal(stale.USD, NOW - 20000); assert.equal(stale.EUR, NOW - 10000)
  assert.deepEqual(previous, original)
})

test('feeds e destaques filtram antes da seleção e limite', () => {
  const data = { USD: [...fixtures].reverse(), MERCADO: [...fixtures].reverse() }
  assert.deepEqual(buildFeed(data, 'ALL', 2, NOW).map(i => i.title), ['Recente', 'Limite'])
  assert.ok(topHeadlines({ news: data }, ['USD'], 2, NOW).every(i => inNewsWindow(i.t, NOW)))
})

test('legados de sete dias são revalidados na leitura e no merge, inclusive temas/moedas', () => {
  const items = fixtures.map(i => ({ ...i, title: `Reforma tributária ${i.title}` }))
  assert.equal(mergeItems(items, [], NOW).length, 2)
  const raw = { topic: 'reforma-tributaria', generatedAt: NOW, windowDays: 7, items }
  const normalized = normalizeReforma(raw, NOW)
  assert.equal(normalized.windowDays, 5); assert.equal(normalized.items.length, 2)
  assert.equal(normalizeReforma(raw, NOW + 1).items.some(i => i.title.endsWith('Limite')), false)
  const temas = normalizeTemas({ generatedAt: NOW, windowDays: 7, temas: { 'moeda-usd': { items } } }, NOW)
  assert.equal(temas['moeda-usd'].windowDays, 5)
  assert.equal(juntarMoedas(temas, NOW + 1).length, 1)
})

test('falha, parcial, atraso, geração futura/ausente e sucesso vazio não são confundidos', () => {
  assert.equal(newsCollectionStale({ generatedAt: NOW, items: [], stale: false, errors: [] }, NOW), false)
  assert.equal(newsCollectionStale({ generatedAt: NOW, stale: {} }, NOW), false)
  for (const data of [{}, { generatedAt: NOW + 1 }, { generatedAt: NOW - 3 * 3600000 - 1 }, { generatedAt: NOW, error: 'falha' }, { generatedAt: NOW, errors: ['falha parcial'] }, { generatedAt: NOW, stale: { USD: NOW } }, { generatedAt: NOW, stale: true }]) assert.equal(newsCollectionStale(data, NOW), true)
})

const source = SECTOR_NEWS_SOURCES.find(s => s.id === 'anvisa')
const institutional = extra => ({ title: 'Anvisa suspende equipamento para radioterapia superficial', link: `${source.articlePrefix}2026/test-radioterapia`, sourceId: source.id, publishedAt: new Date(edge).toISOString(), collectedAt: new Date(NOW).toISOString(), type: 'comunicado', licenseUrl: source.licenseUrl, ...extra })

test('institucionais usam publicação original, não t recebido/coleta/evento nem geração', () => {
  const raw = institutional({ publishedAt: new Date(edge - 1).toISOString(), t: NOW, eventDate: new Date(NOW).toISOString() })
  assert.equal(validateSectorNewsItem(raw, NOW).reason, 'outside_120h_or_uncertain_boundary')
  assert.equal(validateSectorNewsItem(institutional({ t: 1 }), NOW).item.t, edge)
  const file = makeSectorNewsFile({ items: [raw], now: NOW })
  assert.equal(file.collectionPolicy.windowHours, 120)
  assert.equal(file.topics['produtos-saude'].items.length, 0)
})

test('precisão de dia continua conservadora nas duas bordas', () => {
  const raw = institutional({ publishedAt: '2026-11-01', datePrecision: 'day' })
  const bounds = publicationBounds(raw)
  raw.collectedAt = new Date(bounds.max).toISOString()
  assert.equal(validateSectorNewsItem(raw, bounds.min + NEWS_WINDOW_MS).item.datePrecision, 'day')
  assert.equal(validateSectorNewsItem(raw, bounds.min + NEWS_WINDOW_MS + 1).reason, 'outside_120h_or_uncertain_boundary')
  assert.equal(validateSectorNewsItem({ ...raw, collectedAt: new Date(bounds.max).toISOString() }, bounds.max - 1).reason, 'future_or_uncertain_publication')
})

test('suspensão e sua causa sobrevivem à expiração das notícias e do último sucesso', () => {
  const sourceStates = { anvisa: { status: 'ok', checkedAt: new Date(edge - 1).toISOString(), lastSuccessAt: new Date(edge - 1).toISOString(), accessSuspended: true, reason: 'Causa original: desafio de acesso.' } }
  const result = normalizeSectorNews({ schemaVersion: 1, generatedAt: new Date(NOW).toISOString(), topics: {}, sourceStates }, NOW)
  assert.equal(result.sourceStates.anvisa.accessSuspended, true)
  assert.equal(result.sourceStates.anvisa.status, 'failed')
  assert.match(result.sourceStates.anvisa.reason, /Causa original: desafio de acesso/)
  assert.match(result.sourceStates.anvisa.reason, /Coleta suspensa/)
  assert.equal(result.sourceStates.anvisa.lastSuccessAt, sourceStates.anvisa.lastSuccessAt)
})

test('indicadores antigos e fallback financeiro não recebem corte de notícias', () => {
  const old = NOW - 400 * 864e5
  const series = [[old, 13.25]]
  assert.equal(rateTiles({ selic: series }, null)[0].value, 13.25)
  const out = { cdi: [] }
  fillFromPrevious(out, { generatedAt: old, cdi: series }, ['cdi'])
  assert.deepEqual(out.cdi, series)
})
