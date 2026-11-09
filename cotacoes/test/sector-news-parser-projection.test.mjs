import test from 'node:test'
import assert from 'node:assert/strict'
import { createSimulationState } from '../scripts/sector-news-safe/state.mjs'
import { APPROVED_PARSER_RELEASES } from '../scripts/sector-news-safe/parser-release.mjs'
import { previousFeedAfterParserCollection } from '../scripts/sector-news-safe/runner.mjs'
import { mergeSectorSourceStates } from '../scripts/sector-news-lib.mjs'
const now = Date.parse('2026-11-09T01:10:00Z')
function fixture() {
  const state = createSimulationState({ now })
  state.environment = 'production'
  state.parserRelease = structuredClone(APPROVED_PARSER_RELEASES[0])
  for (const key of ['aneel', 'susep']) Object.assign(state.sources[key], { status: 'ready', block: null, checkedAt: '2026-11-09T01:00:00Z', lastSuccessAt: '2026-11-09T01:01:00Z', lastCollectedAt: '2026-11-09T01:01:00Z' })
  const previous = { sourceStates: Object.fromEntries(['aneel', 'susep', 'anvisa'].map(id => [id, { accessSuspended: true, checkedAt: '2026-11-05T10:00:00Z', status: 'failed' }])), topics: { energy: { items: [] } } }
  return { state, previous }
}
test('reviewed parser success clears only obsolete public flags without mutating inputs', () => {
  const { state, previous } = fixture(), original = structuredClone({ state, previous })
  const prepared = previousFeedAfterParserCollection(previous, state)
  for (const id of ['aneel', 'susep']) {
    assert.equal(prepared.sourceStates[id].accessSuspended, false)
    const merged = mergeSectorSourceStates(prepared.sourceStates, { [id]: { accessSuspended: false, status: 'partial', checkedAt: state.sources[id].checkedAt } })
    assert.equal(merged[id].accessSuspended, false)
    assert.equal(merged[id].status, 'partial')
  }
  assert.deepEqual(prepared.sourceStates.anvisa, previous.sourceStates.anvisa)
  assert.deepEqual(prepared.topics, previous.topics)
  assert.deepEqual({ state, previous }, original)
})
for (const mode of ['source-block', 'shared-block', 'no-success', 'before-review', 'newer-public']) test(`public flag remains with ${mode}`, () => {
  const { state, previous } = fixture()
  if (mode === 'source-block') Object.assign(state.sources.aneel, { status: 'suspended', block: { code: 'access_challenge', detectedAt: state.updatedAt } })
  if (mode === 'shared-block') state.sharedBlocks['https://www.gov.br'] = { code: 'access_challenge', detectedAt: state.updatedAt }
  if (mode === 'no-success') state.sources.aneel.lastSuccessAt = null
  if (mode === 'before-review') state.sources.aneel.lastSuccessAt = '2026-11-05T10:00:00Z'
  if (mode === 'newer-public') previous.sourceStates.aneel.checkedAt = '2026-11-09T01:09:00Z'
  assert.equal(previousFeedAfterParserCollection(previous, state).sourceStates.aneel.accessSuspended, true)
})
test('no reviewed release preserves public suspension', () => {
  const { previous } = fixture(), state = createSimulationState({ now })
  state.environment = 'production'
  assert.deepEqual(previousFeedAfterParserCollection(previous, state), previous)
})
test('unapproved release fails closed', () => {
  const { state, previous } = fixture()
  state.parserRelease.reviewId = 'unapproved'
  assert.throws(() => previousFeedAfterParserCollection(previous, state), /parser_release_not_approved/)
})
test('ordinary feed merge still cannot clear a previous suspension', () => {
  assert.equal(mergeSectorSourceStates({ aneel: { accessSuspended: true } }, { aneel: { accessSuspended: false } }).aneel.accessSuspended, true)
})
