import { createSimulationState, validateState } from './state.mjs'
import { normalizeSectorNews, validIsoTimestamp } from '../../src/sectorNews.js'

export const PRODUCTION_SOURCE_IDS = Object.freeze(['mapa', 'antt', 'mdic', 'anp', 'anm', 'ana', 'cvm', 'ans', 'ipen', 'aneel', 'susep'])
export const PRODUCTION_STORE_ID = 'institutional-news-production'

// Explicit operational bootstrap, never called automatically by the collector.
// A candidate may be checked; it only becomes active after a confirmed real read.
export function createProductionState({ previousFeed, now = Date.now() }) {
  normalizeSectorNews(previousFeed, now)
  const state = createSimulationState({ approvedIds: PRODUCTION_SOURCE_IDS, now, storeId: PRODUCTION_STORE_ID })
  state.environment = 'production'
  for (const [id, entry] of Object.entries(state.sources)) {
    const previous = previousFeed.sourceStates?.[id]
    for (const field of ['checkedAt', 'lastSuccessAt']) {
      const value = previous?.[field]
      if (validIsoTimestamp(value) !== null && Date.parse(value) <= now) entry[field] = value
    }
    entry.lastCollectedAt = entry.lastSuccessAt
    if (!entry.block) entry.reason = 'Candidate selected for a first real CI verification; not yet active.'
  }
  return validateState(state, { allowProduction: true })
}
