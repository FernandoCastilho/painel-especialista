import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createProductionState } from '../scripts/sector-news-safe/production-state.mjs'
import { createGitHubStore } from '../scripts/sector-news-safe/git-store.mjs'
import { createLiveTransport } from '../scripts/sector-news-safe/live-transport.mjs'
import { runSectorNewsProduction } from '../scripts/sector-news-safe/runner.mjs'
import { confirmedSnapshot } from '../scripts/sector-news-live.mjs'
import { digest } from '../scripts/sector-news-safe/state.mjs'
import { parserMaintenanceEnabled } from '../scripts/sector-news-safe/maintenance.mjs'
import { normalizeSectorNews } from '../src/sectorNews.js'

const previous = JSON.parse(await readFile(new URL('../public/sector-news.json', import.meta.url), 'utf8'))
const now = Date.parse('2026-11-08T14:00:00Z')

test('production bootstrap preserves real historical success and suspensions without claiming activation', () => {
  const state = createProductionState({ previousFeed: previous, now })
  assert.equal(state.environment, 'production')
  assert.equal(state.sources.mapa.status, 'ready')
  assert.equal(state.sources.mapa.lastSuccessAt, previous.sourceStates.mapa.lastSuccessAt)
  assert.equal(state.sources.anvisa.status, 'suspended')
  assert.equal(state.sources.ibge.status, 'suspended')
  assert.equal(state.feed.lastPublication, null)
  assert.throws(() => confirmedSnapshot(state, { payload: previous, token: 'a'.repeat(40) }, now), /not_confirmed/)
  assert.equal(normalizeSectorNews({ ...previous, delivery: undefined }, now).collection.automaticCollectionEnabled, false)
})

test('production wrapper recognizes the actual Git and live transport contracts before reading state', async () => {
  const old = process.env.GITHUB_TOKEN
  process.env.GITHUB_TOKEN = 'test-credential-not-printed'
  const service = createGitHubStore({ storeId: 'institutional-news-production', rootToken: 'a'.repeat(40), feedRootToken: 'b'.repeat(40) })
  try {
    // Stop before I/O: this tests the real branded production publisher/transport,
    // while the actual Git behavior is tested separately using real bare repos.
    const store = { ...service.store, read: async () => { throw Error('state_read_reached') } }
    const operation = () => runSectorNewsProduction({ store, publisher: service.publisher, transport: createLiveTransport({ sourceIds: ['mapa'] }), previousFeed: previous,
      sourceIds: ['mapa'], runId: 'contract-check', verifiedSince: '2026-11-08T13:00:00Z', clock: () => now })
    if (parserMaintenanceEnabled()) assert.deepEqual(await operation(), { status: 'maintenance', networkEnabled: false, collectionAttempted: false })
    else await assert.rejects(operation(), /state_read_reached/)
  } finally {
    await service.close()
    if (old === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = old
  }
})

test('confirmed publication preserves article dates; corruption or uncertain receipt cannot replace snapshot', () => {
  const feed = structuredClone(previous)
  feed.collectionPolicy = { mode: 'institutional-headlines-live', automaticScheduleEnabled: true, persistentStateStatus: 'github-protected-history' }
  feed.delivery = { generatedAt: '2026-11-08T13:02:00Z', publishedAt: null, stateRevision: 8, stateRef: 'refs/heads/sector-news-state', feedRef: 'refs/heads/sector-news-feed' }
  feed.sourceStates.mapa = { ...feed.sourceStates.mapa, status: 'partial', checkedAt: '2026-11-08T13:00:00Z', lastSuccessAt: '2026-11-08T13:01:00Z' }
  const receipt = 'c'.repeat(40), proof = { publishedAt: '2026-11-08T13:03:00Z', receipt, digest: digest(feed) }
  const state = { feed: { lastPublication: proof } }
  const result = confirmedSnapshot(state, { payload: feed, token: receipt }, now)
  assert.deepEqual(result.topics, previous.topics)
  assert.equal(result.sourceStates.mapa.lastSuccessAt, '2026-11-08T13:01:00Z')
  assert.equal(normalizeSectorNews(result, now).collection.automaticCollectionEnabled, true)
  assert.throws(() => confirmedSnapshot(state, { payload: feed, token: 'd'.repeat(40) }, now), /not_confirmed/)
  const changed = structuredClone(feed); changed.generatedAt = '2026-11-08T13:59:00Z'
  assert.throws(() => confirmedSnapshot(state, { payload: changed, token: receipt }, now), /not_confirmed/)
})
