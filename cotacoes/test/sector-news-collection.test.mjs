import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSectorNews, SECTOR_NEWS_COLLECTION, SECTOR_NEWS_WINDOW_MS } from '../src/sectorNews.js'

const now = Date.parse('2026-11-08T12:00:00Z')
const verified = () => ({
  schemaVersion: 1, topics: {},
  sourceStates: { mapa: { status: 'empty', checkedAt: '2026-11-08T11:00:00Z', lastSuccessAt: '2026-11-08T11:05:00Z', reason: 'private operational detail' } },
  collectionPolicy: { mode: 'institutional-headlines-live', automaticScheduleEnabled: true, persistentStateStatus: 'github-protected-history' },
  delivery: { generatedAt: '2026-11-08T11:30:00Z', publishedAt: '2026-11-08T11:31:00Z', receipt: 'a'.repeat(40), digest: 'b'.repeat(64), stateRevision: 2, stateRef: 'refs/heads/sector-news-state', feedRef: 'refs/heads/sector-news-feed' },
})

test('só ativa mensagem com entrega confirmada e consulta institucional recente', () => {
  const collection = normalizeSectorNews(verified(), now).collection
  assert.equal(collection.automaticCollectionEnabled, true)
  assert.equal(collection.checkedAt, '2026-11-08T11:00:00Z')
  assert.equal(collection.lastSuccessAt, '2026-11-08T11:05:00Z')
  assert.equal(collection.sourceStats.successful, 1)
  assert.equal(collection.sourceStats.suspended, 1)
  assert.equal(collection.sourceStats.pending, 5)
  assert.doesNotMatch(JSON.stringify(collection), /private operational/)
})

test('flag isolada, recibo inválido, datas futuras e referências erradas mantêm aviso offline', () => {
  const mutations = [
    data => delete data.delivery,
    data => { data.delivery.receipt = 'fake' },
    data => { data.delivery.digest = 'fake' },
    data => { data.delivery.publishedAt = null },
    data => { data.delivery.publishedAt = '2026-11-08T13:00:00Z' },
    data => { data.delivery.publishedAt = '2026-11-08T10:00:00Z' },
    data => { data.delivery.stateRevision = '2' },
    data => { data.delivery.stateRef = 'refs/heads/main' },
    data => { data.delivery.feedRef = 'refs/heads/main' },
    data => { data.collectionPolicy.persistentStateStatus = 'simulation-only' },
    data => { data.sourceStates = {} },
    data => { data.sourceStates.mapa.accessSuspended = true },
    data => { data.sourceStates.mapa.lastSuccessAt = '2026-11-08T13:00:00Z' },
    data => { data.sourceStates.mapa.lastSuccessAt = '2026-11-01T11:00:00Z' },
    data => { data.sourceStates.mapa.lastSuccessAt = '2026-11-08T11:31:00Z' },
    data => { data.sourceStates.mapa.lastSuccessAt = '2026-11-08T10:59:00Z' },
    data => { data.sourceStates.mapa.status = 'unavailable' },
  ]
  for (const mutate of mutations) {
    const data = verified(); mutate(data)
    assert.deepEqual(normalizeSectorNews(data, now).collection, SECTOR_NEWS_COLLECTION)
  }
  assert.deepEqual(normalizeSectorNews(verified(), now + SECTOR_NEWS_WINDOW_MS).collection, SECTOR_NEWS_COLLECTION)
})

test('falha posterior conserva último sucesso sem contar fonte falha como consulta válida', () => {
  const data = verified()
  data.sourceStates.mapa.status = 'partial'
  data.sourceStates.antt = { status: 'failed', checkedAt: '2026-11-08T11:20:00Z', lastSuccessAt: '2026-11-08T10:50:00Z', reason: 'falha posterior' }
  const result = normalizeSectorNews(data, now)
  assert.equal(result.collection.automaticCollectionEnabled, true)
  assert.equal(result.collection.sourceStats.successful, 1)
  assert.equal(result.collection.sourceStats.failed, 1)
  assert.equal(result.collection.checkedAt, '2026-11-08T11:20:00Z')
  assert.equal(result.sourceStates.antt.lastSuccessAt, '2026-11-08T10:50:00Z')
  assert.equal(result.sourceStates.antt.status, 'failed')
  data.sourceStates.mapa.status = 'failed'
  assert.deepEqual(normalizeSectorNews(data, now).collection, SECTOR_NEWS_COLLECTION)
})
