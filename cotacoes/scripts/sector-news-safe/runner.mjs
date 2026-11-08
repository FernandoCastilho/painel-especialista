import { SECTOR_NEWS_SOURCES, normalizeSectorNews, validateSectorNewsItem } from '../../src/sectorNews.js'
import { extractGovArticleLinks, parseGovArticle, robotsAllows, makeSectorNewsFile, MAX_ARTICLES_PER_SOURCE, MAX_RESPONSE_BYTES } from '../sector-news-lib.mjs'
import { validateState, validateTransition, digest, iso, STATE_REF, FEED_REF } from './state.mjs'
import { isFixtureTransport, isFixturePublisher } from './fixtures.mjs'
import { isLiveTransport } from './live-transport.mjs'
import { isGitHubPublisher } from './git-store.mjs'
import { parserMaintenanceEnabled } from './maintenance.mjs'
import { ploneDiscoveryUrl, isPloneDiscoveryUrl, parsePloneDiscovery } from './plone-discovery.mjs'

export const DEFAULT_MODE = 'off'
const MAX_RUN_MS = 10 * 60_000
const MAX_REQUESTS = 370
const MIN_INTERVAL_MS = 1100
const challenge = text => /support id is|testing whether you are a human|captcha|access denied|forbidden/i.test(text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' '))
const errorCode = error => {
  const text = String(error?.message || '')
  if (/http_(401|403|429)/.test(text)) return text.match(/http_(401|403|429)/)[0]
  if (/redirect/.test(text)) return 'redirect_requires_review'
  if (/robots/.test(text)) return 'robots_requires_review'
  if (/challenge|denied|captcha/i.test(text)) return 'access_challenge'
  if (/license/.test(text)) return 'license_requires_review'
  if (/budget/.test(text)) return 'budget_exhausted'
  if (/parse|publication_dates|candidates/.test(text)) return 'parser_requires_review'
  return 'operation_outcome_uncertain'
}
class StateCommitError extends Error {}
const id = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(value)

// No live setting exists. A production adapter or scheduler is intentionally absent.
// clock/sleep move a simulated clock; transport and publisher must be our closed fixtures.
export async function runSectorNewsSimulation({ mode = DEFAULT_MODE, store, transport, publisher, previousFeed,
  sourceIds = [], runId, clock = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  if (mode === 'off') return { status: 'disabled', networkEnabled: false }
  if (mode !== 'simulation' || !isFixtureTransport(transport) || !isFixturePublisher(publisher)) throw new Error('live_collection_disabled: only closed offline fixtures are accepted')
  return runCollector({ store, transport, publisher, previousFeed, sourceIds, runId, clock, sleep, environment: 'simulation-only' })
}

export async function runSectorNewsProduction({ store, transport, publisher, previousFeed, sourceIds = [], runId, verifiedSince, clock = Date.now } = {}) {
  // Applies to direct calls as well as --collect and scheduled workflows.
  if (parserMaintenanceEnabled()) return { status: 'maintenance', networkEnabled: false, collectionAttempted: false }
  if (store?.kind !== 'git-append-only-journal' || !isLiveTransport(transport) || !isGitHubPublisher(publisher)) throw new Error('production_adapters_required')
  if (!Number.isFinite(Date.parse(verifiedSince)) || Date.parse(verifiedSince) > clock()) throw new Error('production_verification_boundary_required')
  return runCollector({ store, transport, publisher, previousFeed, sourceIds, runId, verifiedSince, clock, sleep: ms => new Promise(resolve => setTimeout(resolve, ms)), environment: 'production' })
}

async function runCollector({ store, transport, publisher, previousFeed, sourceIds, runId, verifiedSince, clock, sleep, environment }) {
  if (!store || store.ref !== STATE_REF || typeof store.read !== 'function' || typeof store.compareAndSwap !== 'function') throw new Error('durable_state_store_required')
  if (!id(runId) || !Array.isArray(sourceIds) || !sourceIds.length || new Set(sourceIds).size !== sourceIds.length || sourceIds.some(key => !SECTOR_NEWS_SOURCES.some(s => s.id === key))) throw new Error('explicit_valid_run_and_sources_required')
  let monotonicNow = clock()
  const time = () => { const next = clock(); iso(next); if (next < monotonicNow) throw new Error('clock_regression'); monotonicNow = next; return next }
  normalizeSectorNews(previousFeed, time()) // Feed can be empty, but never absent/corrupt.
  let saved = await store.read()
  const checkRead = snapshot => {
    if (!snapshot || snapshot.confirmed !== true || snapshot.ref !== STATE_REF || typeof snapshot.token !== 'string' || !snapshot.token) throw new Error('state_read_not_confirmed')
    validateState(snapshot.state, { allowProduction: environment === 'production' })
    if (snapshot.state.environment !== environment) throw new Error('state_environment_mismatch')
    if (Date.parse(snapshot.state.updatedAt) > time()) throw new Error('state_clock_in_future')
    return snapshot
  }
  checkRead(saved)
  if (saved.state.run || Object.values(saved.state.sources).some(s => s.activeRun || s.request) || saved.state.feed.status === 'in_flight') throw new Error('unfinished_run_requires_authorized_review')
  const selected = sourceIds.map(key => SECTOR_NEWS_SOURCES.find(s => s.id === key))
  const sharedBlock = source => saved.state.sharedBlocks[new URL(source.url).origin] || saved.state.sharedBlocks[source.robotsUrl]
  const eligible = selected.filter(s => s.enabled && s.automaticCollection && saved.state.sources[s.id].status === 'ready' && !sharedBlock(s))
  const skipped = selected.filter(s => !eligible.includes(s)).map(s => s.id)
  if (!eligible.length) return { status: 'suspended', skipped, networkEnabled: false }
  const commit = async mutate => {
    try {
      const next = structuredClone(saved.state)
      next.revision++; mutate(next); next.updatedAt = iso(time())
      validateTransition(saved.state, next, { allowProduction: environment === 'production' })
      const result = await store.compareAndSwap(saved.token, next)
      checkRead(result)
      if (result.token === saved.token || digest(result.state) !== digest(next)) throw new Error('state_commit_not_confirmed')
      // The adapter's acknowledgement alone is insufficient. Read the durable head.
      const observed = checkRead(await store.read())
      if (observed.token !== result.token || digest(observed.state) !== digest(next)) throw new Error('state_read_after_write_mismatch')
      saved = observed
    } catch (error) { throw new StateCommitError(`state_commit_failed_closed: ${error.message}`, { cause: error }) }
  }
  const start = time()
  await commit(state => { state.run = { id: runId, status: 'in_flight', startedAt: iso(start), requests: 0, sourceIds: eligible.map(source => source.id) } })
  const items = [], failureCodes = [], robotsByUrl = new Map()
  let lastRequestAt = null, requestNumber = 0
  // Every prospective request is recorded and read back BEFORE its first access.
  const request = async (source, kind, url, robots = null) => {
    if (time() - start >= MAX_RUN_MS || requestNumber >= MAX_REQUESTS) throw new Error('run_budget_exhausted')
    const parsed = new URL(url)
    const discovery = kind === 'listing' && isPloneDiscoveryUrl(source.id, url)
    const allowed = kind === 'robots' ? url === source.robotsUrl : kind === 'listing' ? url === source.url || discovery : url.startsWith(source.articlePrefix) && !parsed.search
    if (/%(?:2f|5c|2e)/i.test(url) || /\/(?:RSS|@@|search|login)(?:[/?]|$)/i.test(url) || parsed.protocol !== 'https:' || parsed.hostname !== 'www.gov.br' || parsed.username || parsed.password || parsed.port || parsed.hash || !allowed) throw new Error('url_outside_approved_source')
    if (robots !== null && !robotsAllows(robots, url)) throw new Error('robots_disallow')
    if (lastRequestAt !== null && time() - lastRequestAt < MIN_INTERVAL_MS) await sleep(MIN_INTERVAL_MS - (time() - lastRequestAt))
    if (time() - start >= MAX_RUN_MS) throw new Error('run_budget_exhausted')
    // A simulated sleeper that doesn't respect pacing cannot trigger even a fixture request.
    if (lastRequestAt !== null && time() - lastRequestAt < MIN_INTERVAL_MS) throw new Error('pacing_not_confirmed')
    const at = iso(time()), requestId = `${runId}.${++requestNumber}`
    await commit(state => {
      const entry = state.sources[source.id]
      if (entry.block || (entry.activeRun && entry.activeRun !== runId)) throw new Error('source_not_eligible')
      const newAttempt = entry.activeRun !== runId
      entry.status = 'collecting'; entry.activeRun = runId
      if (newAttempt) entry.checkedAt = at
      entry.request = { id: requestId, kind, url, startedAt: at }
      state.run.requests++
    })
    // Durable storage can itself stall. Recheck immediately before transport,
    // keeping the confirmed in_flight as a barrier if the budget expired.
    if (time() - start >= MAX_RUN_MS) throw new Error('run_budget_exhausted')
    lastRequestAt = time()
    const response = await transport.request(url)
    if (response.status >= 300 && response.status < 400) throw new Error('redirect_requires_review')
    if (response.status < 200 || response.status >= 300) throw new Error(`http_${response.status}`)
    if (Buffer.byteLength(response.body) > MAX_RESPONSE_BYTES) throw new Error('response_too_large')
    if (challenge(response.body)) throw new Error('access_challenge')
    return response.body
  }
  const finishRequest = async source => commit(state => { state.sources[source.id].request = null })
  for (const source of eligible) {
    // If a durable write/read fails, abort outside the collection catch. No more access.
    let collectionError = null, lastCollectedAt = null
    try {
      let robots = robotsByUrl.get(source.robotsUrl)
      if (robots === undefined) {
        robots = await request(source, 'robots', source.robotsUrl)
        // Reject malformed robots even when no Disallow matches the requested route.
        if (!robotsAllows(robots, source.url)) throw new Error('robots_disallow')
        await finishRequest(source)
        robotsByUrl.set(source.robotsUrl, robots)
      }
      const listing = await request(source, 'listing', source.url, robots)
      if (!listing.includes('creativecommons.org/licenses/by-nd/3.0')) throw new Error('license_not_confirmed')
      // Gradual operation reads at most five articles per source per round.
      let links
      if (['aneel', 'susep'].includes(source.id)) {
        // The index's licence is checked first. Discovery is a second, bounded,
        // journalled request subject to the same robots, budgets and failure holds.
        await finishRequest(source)
        const discovery = await request(source, 'listing', ploneDiscoveryUrl(source.id), robots)
        links = parsePloneDiscovery(discovery, source.id)
      } else links = extractGovArticleLinks(listing, source)
      links = links.slice(0, environment === 'production' ? 5 : MAX_ARTICLES_PER_SOURCE)
      if (!links.length) throw new Error('listing_unparsed_or_no_candidates')
      await finishRequest(source)
      for (const { link } of links) {
        const html = await request(source, 'article', link, robots)
        const collectedAt = iso(time())
        const article = parseGovArticle(html, source, link, collectedAt)
        // Invalid original timestamps fail review; old articles simply age out in the feed.
        const validation = validateSectorNewsItem(article, time())
        if (!validation.item && validation.reason !== 'outside_120h_or_uncertain_boundary') throw new Error(`parse_${validation.reason}`)
        items.push(article); lastCollectedAt = collectedAt
        await commit(state => { const entry = state.sources[source.id]; entry.request = null; entry.lastCollectedAt = collectedAt; entry.lastSuccessAt = collectedAt })
      }
    } catch (error) { if (error instanceof StateCommitError) throw error; collectionError = error }
    if (collectionError) {
      // A failing commit is never retried with a refreshed token or alternative store.
      // If it cannot save the block, the previously durable in_flight is the barrier.
      const code = errorCode(collectionError)
      const pendingKind = saved.state.sources[source.id].request?.kind
      await commit(state => {
        const entry = state.sources[source.id]
        entry.status = 'suspended'; entry.activeRun = null; entry.request = null
        entry.block = { code, detectedAt: iso(time()) }; entry.reason = code
        if (pendingKind === 'robots' || code === 'robots_requires_review') state.sharedBlocks[source.robotsUrl] ||= structuredClone(entry.block)
        // A common-host denial must not be retried through a sibling ministry route.
        if (/^http_(401|403|429)$/.test(code) || code === 'access_challenge') state.sharedBlocks[new URL(source.url).origin] ||= structuredClone(entry.block)
      })
      failureCodes.push({ sourceId: source.id, code })
      break // No next source after any denial, crash ambiguity, parse or transport failure.
    }
    await commit(state => {
      const entry = state.sources[source.id]
      entry.status = 'ready'; entry.activeRun = null; entry.request = null
      entry.reason = lastCollectedAt ? 'partial_verified_collection' : 'no_verified_articles'
    })
  }
  const projected = Object.fromEntries(Object.entries(saved.state.sources).map(([key, entry]) => {
    const shared = sharedBlock(SECTOR_NEWS_SOURCES.find(source => source.id === key))
    return [key, { checkedAt: entry.checkedAt, lastSuccessAt: entry.lastSuccessAt,
      status: entry.block || shared ? 'failed' : entry.lastSuccessAt && (environment !== 'production' || Date.parse(entry.lastSuccessAt) >= Date.parse(verifiedSince)) ? 'partial' : 'unavailable',
      accessSuspended: Boolean(entry.block || shared), reason: shared?.code || entry.reason }]
  }))
  const generatedAt = iso(time())
  const feed = makeSectorNewsFile({ previous: previousFeed, items, sourceStates: projected, now: time() })
  feed.collectionPolicy = { ...feed.collectionPolicy, mode: environment === 'production' ? 'institutional-headlines-live' : 'offline-simulation-only', automaticScheduleEnabled: environment === 'production', persistentStateStatus: environment === 'production' ? 'github-protected-history' : 'simulation-only; not production approved' }
  // Feed contains only a public projection; it is NEVER the authority for access.
  feed.delivery = { generatedAt, publishedAt: null, stateRevision: saved.state.revision, stateRef: STATE_REF, feedRef: FEED_REF }
  const payloadDigest = digest(feed)
  await commit(state => { state.feed = { ...state.feed, status: 'prepared', generatedAt, digest: payloadDigest, publishedAt: null, receipt: null } })
  await commit(state => { state.feed.status = 'in_flight' })
  const receipt = await publisher.publish(feed, payloadDigest)
  if (!receipt || receipt.confirmed !== true || receipt.digest !== payloadDigest || !id(receipt.receipt)) throw new Error('publication_not_confirmed')
  const publishedAt = iso(time())
  await commit(state => { state.feed = { ...state.feed, status: 'published', publishedAt, receipt: receipt.receipt, lastPublication: { publishedAt, digest: payloadDigest, receipt: receipt.receipt } }; state.run = null })
  return { status: failureCodes.length ? 'partial' : environment === 'production' ? 'collected' : 'simulated', networkEnabled: environment === 'production', state: saved.state, token: saved.token, feed, publication: { publishedAt, receipt: receipt.receipt }, skipped, failures: failureCodes }
}
