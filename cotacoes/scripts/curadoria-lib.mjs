import { CURADORIA_TOPICS, CURADORIA_SOURCES, CURADORIA_DAYS, curateItems } from '../src/curadoria.js'
import { googleUrl, parseRss } from './news-lib.mjs'

// Queries delimitadas por domínio; a origem declarada no RSS também é validada.
const sourceGroups = [CURADORIA_SOURCES.filter(s => s.type === 'Fonte oficial'), CURADORIA_SOURCES.filter(s => s.type !== 'Fonte oficial')]
export const queriesFor = topic => sourceGroups.map(group => `(${topic.query}) (${group.map(s => `site:${s.domain}`).join(' OR ')})`)
export async function collectCuradoria({ now = Date.now(), previous = [], fetchImpl = fetch } = {}) {
  const topics = {}
  await Promise.all(CURADORIA_TOPICS.map(async topic => {
    const fresh = [], errors = []
    const queries = queriesFor(topic)
    await Promise.all(queries.map(async query => {
      try {
        const response = await fetchImpl(googleUrl(query, 'pt', '7d'), { headers: { 'user-agent': 'Mozilla/5.0 (painel-curadoria)' }, signal: AbortSignal.timeout(20000) })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const xml = await response.text()
        if (!/<rss[\s>]/i.test(xml) || !/<channel[\s>]/i.test(xml) || !/<\/rss>/i.test(xml)) throw new Error('RSS inválido')
        fresh.push(...parseRss(xml))
      } catch (error) { errors.push(error.message) }
    }))
    const histories = previous.map(data => data?.topics?.[topic.id]).filter(Boolean)
    const previousSuccess = Math.max(0, ...histories.map(item => item.lastSuccessAt).filter(t => Number.isFinite(t) && t <= now)) || null
    topics[topic.id] = { label: topic.label, checkedAt: now, lastSuccessAt: errors.length ? previousSuccess : now, status: errors.length === queries.length ? 'unavailable' : errors.length ? 'partial' : 'ok', queriesSucceeded: queries.length - errors.length, queriesTotal: queries.length, errors, items: curateItems(topic.id, fresh, histories.flatMap(item => Array.isArray(item.items) ? item.items : []), now) }
  }))
  return { schemaVersion: 1, generatedAt: now, windowDays: CURADORIA_DAYS, topics }
}
