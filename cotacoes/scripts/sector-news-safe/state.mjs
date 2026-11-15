// Offline-only safety model. No production bootstrap, unblock, network or credential API.
import { createHash } from 'node:crypto'
import { APPROVED_PARSER_RELEASES, validParserRelease, isExactParserRelease } from './parser-release.mjs'
import { APPROVED_SOURCE_RELEASES, validSourceRelease, exactSourceRelease } from './source-release.mjs'
import { SECTOR_NEWS_SOURCES, validIsoTimestamp } from '../../src/sectorNews.js'

export const STATE_REF = 'refs/heads/sector-news-state'
export const FEED_REF = 'refs/heads/sector-news-feed'
export const SCHEMA_VERSION = 1
export const HISTORICAL_HOLDS = Object.freeze({
  anvisa: 'access_outcome_uncertain',
  ibge: 'license_http_403',
  anatel: 'access_challenge',
  mec: 'access_challenge',
  mtur: 'prior_operation_outcome_uncertain',
  aneel: 'parser_review_required',
  susep: 'parser_review_required',
})
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const registryDigest = digest(SECTOR_NEWS_SOURCES)
export const SHARED_ACCESS_SCOPES = ['https://www.gov.br', 'https://www.gov.br/robots.txt']
export const iso = now => {
  if (!Number.isSafeInteger(now) || !Number.isFinite(new Date(now).getTime())) throw new Error('invalid_clock')
  return new Date(now).toISOString()
}
const object = x => x && typeof x === 'object' && !Array.isArray(x)
const id = x => typeof x === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(x)
const timestamp = x => x === null || validIsoTimestamp(x) !== null
const assert = (test, reason) => { if (!test) throw new Error(`state_invalid: ${reason}`) }

// This helper can only seed simulations. It never uses a public feed as access state.
// Historical denials/uncertainty cannot be overridden, even by approvedIds.
export function createSimulationState({ approvedIds = [], now, storeId = 'offline-fixture' } = {}) {
  if (!id(storeId) || !Array.isArray(approvedIds) || approvedIds.some(x => !SECTOR_NEWS_SOURCES.some(s => s.id === x))) throw new Error('invalid_simulation_seed')
  const at = iso(now)
  const sources = Object.fromEntries(SECTOR_NEWS_SOURCES.map(source => {
    const reason = HISTORICAL_HOLDS[source.id] || (!source.enabled || !source.automaticCollection ? 'source_not_approved' : 'review_required')
    const ready = approvedIds.includes(source.id) && source.enabled && source.automaticCollection && !HISTORICAL_HOLDS[source.id]
    return [source.id, { status: ready ? 'ready' : 'suspended', checkedAt: null, lastCollectedAt: null, lastSuccessAt: null, activeRun: null, request: null,
      block: ready ? null : { code: reason, detectedAt: at }, reason: ready ? 'Synthetic approval for offline tests only.' : reason }]
  }))
  return validateState({ schemaVersion: SCHEMA_VERSION, environment: 'simulation-only', storeId, registryDigest, revision: 0, updatedAt: at,
    run: null, sharedBlocks: Object.fromEntries(SHARED_ACCESS_SCOPES.map(scope => [scope, null])), feed: { status: 'never_published', generatedAt: null, publishedAt: null, digest: null, receipt: null, lastPublication: null }, sources })
}

export function validateState(state, { allowProduction = false, parserReleaseGrants = APPROVED_PARSER_RELEASES, sourceReleaseGrants = APPROVED_SOURCE_RELEASES } = {}) {
  assert(object(state) && state.schemaVersion === SCHEMA_VERSION, 'schema')
  assert((state.environment === 'simulation-only' || (allowProduction && state.environment === 'production')) && id(state.storeId), 'environment')
  assert(state.registryDigest === registryDigest, 'source_registry_changed_requires_review')
  if (state.parserRelease !== undefined) {
    assert(validParserRelease(state.parserRelease, parserReleaseGrants), 'parser_release_not_approved')
    assert(validIsoTimestamp(state.parserRelease.reviewedAt) !== null && Date.parse(state.parserRelease.reviewedAt) <= Date.parse(state.updatedAt), 'parser_release_time')
  }
  if (state.sourceReleases !== undefined) {
    assert(Array.isArray(state.sourceReleases) && state.sourceReleases.length > 0 && new Set(state.sourceReleases.map(r => r?.reviewId)).size === state.sourceReleases.length, 'source_releases')
    for (const review of state.sourceReleases) assert(validSourceRelease(review, sourceReleaseGrants) && Date.parse(review.reviewedAt) <= Date.parse(state.updatedAt), 'source_release_not_approved')
  }
  assert(Number.isSafeInteger(state.revision) && state.revision >= 0 && validIsoTimestamp(state.updatedAt) !== null, 'revision_or_time')
  assert(object(state.sources), 'sources')
  assert(object(state.sharedBlocks) && Object.keys(state.sharedBlocks).sort().join('|') === SHARED_ACCESS_SCOPES.slice().sort().join('|'), 'shared_access_scopes')
  for (const block of Object.values(state.sharedBlocks)) assert(block === null || (object(block) && id(block.code) && validIsoTimestamp(block.detectedAt) !== null && Date.parse(block.detectedAt) <= Date.parse(state.updatedAt)), 'shared_block')
  assert(Object.keys(state.sources).sort().join('|') === SECTOR_NEWS_SOURCES.map(s => s.id).sort().join('|'), 'incomplete_source_state')
  assert(state.run === null || (object(state.run) && id(state.run.id) && state.run.status === 'in_flight' && validIsoTimestamp(state.run.startedAt) !== null && Number.isSafeInteger(state.run.requests) && state.run.requests >= 0 && Array.isArray(state.run.sourceIds) && state.run.sourceIds.length > 0 && new Set(state.run.sourceIds).size === state.run.sourceIds.length && state.run.sourceIds.every(key => SECTOR_NEWS_SOURCES.some(source => source.id === key)) && Date.parse(state.run.startedAt) <= Date.parse(state.updatedAt)), 'run')
  for (const source of SECTOR_NEWS_SOURCES) {
    const s = state.sources[source.id]
    assert(object(s) && ['ready', 'collecting', 'suspended'].includes(s.status), `source_status:${source.id}`)
    assert(['checkedAt', 'lastCollectedAt', 'lastSuccessAt'].every(k => timestamp(s[k])), `source_dates:${source.id}`)
    assert([s.checkedAt, s.lastCollectedAt, s.lastSuccessAt].filter(Boolean).every(x => Date.parse(x) <= Date.parse(state.updatedAt)), 'future_source_date')
    assert(!s.lastSuccessAt || (s.lastCollectedAt && Date.parse(s.lastSuccessAt) <= Date.parse(s.lastCollectedAt)), 'success_without_collection')
    assert(typeof s.reason === 'string' && s.reason.length <= 1000, 'source_reason')
    assert(s.block === null || (object(s.block) && id(s.block.code) && validIsoTimestamp(s.block.detectedAt) !== null && Date.parse(s.block.detectedAt) <= Date.parse(state.updatedAt)), 'block')
    assert((s.status === 'suspended') === Boolean(s.block), 'block_status')
    assert(s.activeRun === null || (state.run && s.activeRun === state.run.id), 'source_run')
    assert((s.status === 'collecting') === Boolean(s.activeRun), 'collecting_without_run')
    assert(s.request === null || (s.activeRun && object(s.request) && id(s.request.id) && ['robots', 'listing', 'article'].includes(s.request.kind) && typeof s.request.url === 'string' && validIsoTimestamp(s.request.startedAt) !== null && Date.parse(s.request.startedAt) <= Date.parse(state.updatedAt) && Date.parse(s.request.startedAt) >= Date.parse(state.run.startedAt)), 'request')
    const reviewedParser = state.parserRelease && ['aneel', 'susep'].includes(source.id)
    if ((HISTORICAL_HOLDS[source.id] && !reviewedParser) || !source.enabled || !source.automaticCollection) assert(s.status === 'suspended', `historical_hold:${source.id}`)
  }
  assert(object(state.feed) && ['never_published', 'prepared', 'in_flight', 'published'].includes(state.feed.status), 'feed')
  assert(timestamp(state.feed.generatedAt) && timestamp(state.feed.publishedAt), 'feed_dates')
  assert(state.feed.digest === null || /^[a-f0-9]{64}$/.test(state.feed.digest), 'feed_digest')
  assert(state.feed.receipt === null || id(state.feed.receipt), 'feed_receipt')
  assert([state.feed.generatedAt, state.feed.publishedAt].filter(Boolean).every(x => Date.parse(x) <= Date.parse(state.updatedAt)), 'future_feed_date')
  assert(state.feed.lastPublication === null || (object(state.feed.lastPublication) && validIsoTimestamp(state.feed.lastPublication.publishedAt) !== null && Date.parse(state.feed.lastPublication.publishedAt) <= Date.parse(state.updatedAt) && /^[a-f0-9]{64}$/.test(state.feed.lastPublication.digest) && id(state.feed.lastPublication.receipt)), 'last_publication')
  if (state.feed.status === 'never_published') assert(['generatedAt', 'publishedAt', 'digest', 'receipt', 'lastPublication'].every(k => state.feed[k] === null), 'never_published_dates')
  else assert(state.feed.digest && state.feed.generatedAt, 'feed_missing_payload')
  if (state.feed.status === 'published') assert(state.feed.publishedAt && state.feed.receipt && Date.parse(state.feed.publishedAt) >= Date.parse(state.feed.generatedAt) && state.feed.lastPublication?.digest === state.feed.digest && state.feed.lastPublication.publishedAt === state.feed.publishedAt && state.feed.lastPublication.receipt === state.feed.receipt, 'feed_not_confirmed')
  else assert(state.feed.publishedAt === null && state.feed.receipt === null, 'unconfirmed_feed_dates')
  if (state.feed.status === 'in_flight') assert(state.run !== null, 'publication_without_run')
  return structuredClone(state)
}

// A runtime transition may add blocks but cannot clear or change an existing hold.
// Recovery is never automatic: only an exact, code-reviewed grant may close an interrupted run
// (run-recovery.mjs, suspends only) or release an executor-uncertain hold (source-release.mjs).
export function validateTransition(before, after, options) {
  validateState(before, options); validateState(after, options)
  const parserRelease = isExactParserRelease(before, after, options?.parserReleaseGrants)
  const released = exactSourceRelease(before, after, options?.sourceReleaseGrants)
  if (before.parserRelease) assert(JSON.stringify(after.parserRelease) === JSON.stringify(before.parserRelease), 'parser_release_immutable')
  assert(after.environment === before.environment, 'environment_transition')
  assert(after.revision === before.revision + 1 && after.storeId === before.storeId, 'non_monotonic_revision')
  assert(Date.parse(after.updatedAt) >= Date.parse(before.updatedAt), 'clock_regression')
  for (const scope of SHARED_ACCESS_SCOPES) if (before.sharedBlocks[scope]) assert(JSON.stringify(before.sharedBlocks[scope]) === JSON.stringify(after.sharedBlocks[scope]), 'shared_block_cannot_be_cleared')
  for (const key of Object.keys(before.sources)) {
    const old = before.sources[key], next = after.sources[key]
    if (old.block && !(parserRelease && ['aneel', 'susep'].includes(key)) && !released.includes(key)) assert(JSON.stringify(next.block) === JSON.stringify(old.block) && next.status === 'suspended', `block_cannot_be_cleared:${key}`)
    for (const field of ['checkedAt', 'lastCollectedAt', 'lastSuccessAt']) if (old[field]) assert(next[field] && Date.parse(next[field]) >= Date.parse(old[field]), `date_regression:${key}:${field}`)
  }
  return after
}
