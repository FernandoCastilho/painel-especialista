import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {latestMovement, movementSummary, normalizeMovement} from '../src/movimentoFalimentar.js'

const raw = JSON.parse(readFileSync(new URL('../data/movimento-falimentar/2026-11-06.json', import.meta.url)))
const fixture = () => ({schemaVersion: 1, generatedAt: Date.parse(raw.source.consultedAt), editions: [structuredClone(raw)]})
test('real edition retains corporate mentions, missing location and stages without fabricating processes', () => {
  const edition = latestMovement(fixture())
  const s = movementSummary(edition)
  assert.equal(edition.events.length, 20)
  assert.deepEqual(s.counts, {pedido: 4, deferimento: 1, concessao: 3})
  assert.equal(s.requests.length, 4)
  assert.deepEqual(s.byUf, [{uf: 'RN', count: 3, share: 75}, {uf: null, count: 1, share: 25}])
  assert.ok(s.requests.every(e => !e.processNumber && !e.requestDate))
})
test('latest edition uses publication date rather than consultation order', () => {
  const f = fixture(), older = structuredClone(raw)
  older.source.id = 'older'; older.source.publicationDate = '2026-11-05'; older.source.consultedAt = '2026-11-09T00:00:00Z'
  f.editions.unshift(older)
  assert.equal(latestMovement(f).source.id, raw.source.id)
})
test('reject duplicate editions and mentions, malformed sources and invented geographical values', () => {
  for (const mutate of [f => f.editions.push(structuredClone(raw)), f => f.editions[0].events.push(structuredClone(raw.events[0])), f => {f.editions[0].source.url = 'https://example.com'}, f => {f.editions[0].events[0].historicalUf = 'XX'}, f => {f.editions[0].source.publicationDate = '2026-02-30'}, f => {f.editions[0].source.consultedAt = 'invalid'}]) {
    const f = fixture(); mutate(f); assert.throws(() => normalizeMovement(f))
  }
})
