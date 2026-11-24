import { indexSearchData, isNewsSearchFile } from './globalSearch.js'
import { NEWS_WINDOW_MS, newsCollectionStale } from './newsWindow.js'

// Uma publicação futura entra na janela em t e sai um milissegundo após as 120 horas.
function nextNewsChange(file, data, now) {
  const lists = file === 'news.json' ? Object.values(data.news ?? {}) :
    file === 'temas.json' ? Object.values(data.temas ?? {}).map(topic => topic?.items) : [data.items]
  let next = Infinity
  for (const list of lists) {
    for (const item of Array.isArray(list) ? list : []) {
      const t = item?.t
      if (!Number.isFinite(t) || t <= 0) continue
      const boundary = t > now ? t : t + NEWS_WINDOW_MS + 1
      if (boundary > now && boundary < next) next = boundary
    }
  }
  return next
}

export class SearchSession {
  catalog = null
  entries = new Map()
  view = null

  setCatalog(docs) {
    this.catalog = docs
    this.view = null
  }

  needsLoad(file, shared, now, ttl, retry) {
    const entry = this.entries.get(file)
    if (!entry?.ok || entry.stale) return true
    if (shared && (shared.stale || shared.lastSuccessAt !== entry.lastSuccessAt || shared.data !== entry.data)) return true
    const age = now - entry.lastSuccessAt
    return age < 0 || age >= ttl || (retry && (entry.limited || (entry.news && newsCollectionStale(entry.data, now))))
  }

  accept(source, result, now) {
    const [file, route, label] = source
    const { data } = result
    const stamp = data.generatedAt || data.updatedAt
    let entry = this.entries.get(file)
    // Focus e histórico podem ser corrigidos sem alterar a data geral da coleta.
    // Só comparamos conteúdo se uma nova resposta trouxer a mesma data.
    const unchanged = entry?.ok && (entry.data === data ||
      (entry.stamp === stamp && JSON.stringify(entry.data) === JSON.stringify(data)))
    if (!unchanged) {
      const { docs, limited } = indexSearchData(file, data, route, label, now)
      const news = isNewsSearchFile(file)
      entry = { file, route, label, stamp, docs, limited, news, indexedAt: now,
        nextChange: news ? nextNewsChange(file, data, now) : Infinity }
    }
    this.view = null
    this.entries.set(file, { ...entry, data, ok: true, stale: !!result.stale, lastSuccessAt: result.lastSuccessAt ?? now })
  }

  fail([file, , label]) {
    const entry = this.entries.get(file)
    this.view = null
    this.entries.set(file, entry?.ok ? { ...entry, stale: true } : { file, label, ok: false })
  }

  snapshot(now) {
    if (this.view && now >= this.view.at && now < this.view.nextChange &&
        this.view.sources.every(source => {
          const entry = this.entries.get(source.file)
          return !entry.news || source.stale === (entry.stale || newsCollectionStale(entry.data, now))
        })) return this.view
    const docs = [...(this.catalog || [])], sources = []
    let nextChange = Infinity
    for (const entry of this.entries.values()) {
      if (entry.news && (now >= entry.nextChange || now < entry.indexedAt)) {
        const indexed = indexSearchData(entry.file, entry.data, entry.route, entry.label, now)
        entry.docs = indexed.docs
        entry.limited = indexed.limited
        entry.indexedAt = now
        entry.nextChange = nextNewsChange(entry.file, entry.data, now)
      }
      if (entry.ok) {
        docs.push(...entry.docs)
        nextChange = Math.min(nextChange, entry.nextChange)
      }
      const { file, label, ok, limited, stamp } = entry
      sources.push({ file, label, ok, limited, stamp, stale: entry.stale || (entry.news && newsCollectionStale(entry.data, now)) })
    }
    this.view = { docs, sources, nextChange, at: now }
    return this.view
  }
}
