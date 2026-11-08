import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createGitHubStore, isGitHubPublisher, PROTECTION_ID } from '../scripts/sector-news-safe/github-store.mjs'
import { createSimulationState, STATE_REF, FEED_REF, digest } from '../scripts/sector-news-safe/state.mjs'
const hash = value => createHash('sha1').update(JSON.stringify(value)).digest('hex')
const initial = () => ({ ...createSimulationState({ now: Date.parse('2026-11-08T12:00:00Z'), storeId: 'github-test' }), environment: 'production' })
function server() {
  const refs = new Map(), commits = new Map(), trees = new Map(), blobs = new Map(), calls = []
  let rules = { id: PROTECTION_ID, target: 'branch', enforcement: 'active', bypass_actors: [], conditions: { ref_name: { include: [STATE_REF, FEED_REF], exclude: [] } }, rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }] }
  let intercept = () => null
  const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
  async function fetchImpl(url, options) {
    assert.equal(new URL(url).origin, 'https://api.github.com')
    assert.equal(options.redirect, 'error')
    assert.equal(options.headers.Authorization, 'Bearer secret-test-token')
    const path = new URL(url).pathname.replace('/repos/FernandoCastilho/painel-especialista', '')
    const body = options.body ? JSON.parse(options.body) : null
    const call = { method: options.method, path, body }; calls.push(call)
    const special = await intercept(call)
    if (special) return special
    if (path === `/rulesets/${PROTECTION_ID}`) return response(rules)
    if (path.startsWith('/git/ref/')) {
      const ref = `refs/${path.slice('/git/ref/'.length)}`
      return refs.has(ref) ? response({ ref, object: { type: 'commit', sha: refs.get(ref) } }) : response({}, 404)
    }
    if (path === '/git/trees' && options.method === 'POST') {
      const tree = body.tree.map(entry => {
        const blob = { encoding: 'base64', content: Buffer.from(entry.content).toString('base64'), size: Buffer.byteLength(entry.content) }
        const sha = hash(blob); blobs.set(sha, blob)
        return { path: entry.path, mode: entry.mode, type: 'blob', sha }
      })
      const sha = hash(tree); trees.set(sha, { sha, tree, truncated: false }); return response({ sha })
    }
    if (path === '/git/commits' && options.method === 'POST') {
      const sha = hash(body); commits.set(sha, { sha, tree: { sha: body.tree }, parents: body.parents.map(sha => ({ sha })) }); return response({ sha })
    }
    if (path === '/git/refs' && options.method === 'POST') {
      if (refs.has(body.ref)) return response({}, 422)
      refs.set(body.ref, body.sha); return response({ ref: body.ref, object: { type: 'commit', sha: body.sha } }, 201)
    }
    if (path.startsWith('/git/refs/') && options.method === 'PATCH') {
      assert.equal(body.force, false)
      const ref = `refs/${path.slice('/git/refs/'.length)}`
      if (commits.get(body.sha).parents[0]?.sha !== refs.get(ref)) return response({}, 422)
      refs.set(ref, body.sha); return response({ ref, object: { type: 'commit', sha: body.sha } })
    }
    for (const [prefix, map] of [['/git/commits/', commits], ['/git/trees/', trees], ['/git/blobs/', blobs]]) if (path.startsWith(prefix)) return response(map.get(path.slice(prefix.length)) || {}, map.has(path.slice(prefix.length)) ? 200 : 404)
    throw Error(`Unexpected mock request ${options.method} ${path}`)
  }
  const connect = pins => createGitHubStore({ token: 'secret-test-token', storeId: 'github-test', fetchImpl, ...pins })
  return { connect, refs, commits, trees, blobs, calls, response, set rules(value) { rules = value }, get rules() { return rules }, set intercept(fn) { intercept = fn } }
}
async function setup() {
  const api = server(), connection = api.connect()
  const pins = await connection.bootstrap(initial(), { schemaVersion: 1, topics: {}, sourceStates: {} })
  return { api, pins, ...api.connect(pins) }
}

test('explicit bootstrap pins two separate root commits; absent state never initializes on read', async () => {
  const api = server()
  await assert.rejects(api.connect().store.read(), /bootstrap_pin_required/)
  assert.equal(api.refs.size, 0)
  const { pins, store, publisher, bootstrap } = await setup()
  assert.match(pins.rootToken, /^[a-f0-9]{40}$/)
  assert.notEqual(pins.rootToken, pins.feedRootToken)
  assert.equal((await store.read()).state.revision, 0)
  assert.equal(publisher.ref, FEED_REF)
  assert.equal(isGitHubPublisher(publisher), true)
  assert.equal(isGitHubPublisher({ ...publisher }), false)
  await assert.rejects(bootstrap(initial(), {}), /already_exist/)
})

test('CAS persists and rereads exact state, rejects stale token and nonmonotonic revision', async () => {
  const { store, api } = await setup()
  const before = await store.read(), next = { ...before.state, revision: 1 }
  const saved = await store.compareAndSwap(before.token, next)
  assert.deepEqual(saved.state, next)
  assert.notEqual(saved.token, before.token)
  await assert.rejects(store.compareAndSwap(before.token, { ...next, revision: 2 }), /cas_conflict/)
  await assert.rejects(store.compareAndSwap(saved.token, { ...next, revision: 3 }), /non_monotonic_revision/)
  assert.equal(api.calls.filter(call => call.method === 'PATCH').length, 1)
})

test('concurrent writers cannot overwrite a committed sibling', async () => {
  const { store, api, pins } = await setup()
  const other = api.connect(pins).store, before = await store.read()
  const next = { ...before.state, revision: 1 }
  const results = await Promise.allSettled([store.compareAndSwap(before.token, next), other.compareAndSwap(before.token, { ...next, updatedAt: '2026-11-08T12:00:01.000Z' })])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal((await store.read()).state.revision, 1)
})

test('history must reach the pinned bootstrap and payload digest must match', async () => {
  const { api, pins } = await setup()
  await assert.rejects(api.connect({ ...pins, rootToken: 'f'.repeat(40) }).store.read(), /missing_pinned_root/)
  const commit = api.commits.get(pins.rootToken), tree = api.trees.get(commit.tree.sha)
  const blob = api.blobs.get(tree.tree[0].sha), record = JSON.parse(Buffer.from(blob.content, 'base64'))
  record.payload.revision = 10
  blob.content = Buffer.from(JSON.stringify(record)).toString('base64')
  await assert.rejects(api.connect(pins).store.read(), /integrity_error/)
})

test('protection mismatch or unreadable API prevents all writes', async () => {
  for (const change of [rule => { rule.enforcement = 'disabled' }, rule => { rule.bypass_actors = [{}] }, rule => { rule.conditions.ref_name.include.pop() }, rule => { rule.rules.pop() }]) {
    const { api, store } = await setup()
    const before = await store.read(), count = api.calls.length
    const rule = structuredClone(api.rules); change(rule); api.rules = rule
    await assert.rejects(store.compareAndSwap(before.token, { ...before.state, revision: 1 }), /protection_mismatch/)
    assert.ok(api.calls.slice(count).every(call => call.method === 'GET'))
  }
  const { api, store } = await setup()
  api.intercept = () => { throw Error('transport details secret-test-token') }
  await assert.rejects(store.read(), error => error.message === 'github_read_failed' && !error.message.includes('secret-test-token'))
})

test('publisher confirms the separately served feed JSON; wrong digest never writes', async () => {
  const { publisher, api, readFeed } = await setup()
  const feed = { schemaVersion: 1, topics: { real: { items: [] } }, sourceStates: {} }
  const receipt = await publisher.publish(feed, digest(feed))
  assert.equal(receipt.confirmed, true)
  assert.equal(receipt.receipt, api.refs.get(FEED_REF))
  assert.deepEqual((await readFeed()).payload, feed)
  const count = api.calls.length
  await assert.rejects(publisher.publish(feed, '0'.repeat(64)), /digest_mismatch/)
  assert.equal(api.calls.length, count)
})

test('uncertain ref update is never retried or reported as a confirmed publication', async () => {
  const { publisher, api } = await setup()
  const feed = { schemaVersion: 1, topics: {}, sourceStates: {} }
  api.intercept = call => { if (call.method === 'PATCH') throw Error('connection interrupted') }
  await assert.rejects(publisher.publish(feed, digest(feed)), /write_outcome_uncertain/)
  assert.equal(api.calls.filter(call => call.method === 'PATCH').length, 1)
})

test('publisher rejects a public file that differs from the committed journal envelope', async () => {
  const { publisher, api } = await setup()
  const feed = { schemaVersion: 1, topics: { changed: true }, sourceStates: {} }
  let publicBlob
  api.intercept = call => {
    if (call.method === 'GET' && call.path.startsWith('/git/trees/')) {
      const tree = api.trees.get(call.path.split('/').pop())
      publicBlob = tree?.tree.find(entry => entry.path === 'sector-news.json')?.sha
    }
    if (call.path === `/git/blobs/${publicBlob}`) return api.response({ encoding: 'base64', content: Buffer.from(JSON.stringify({ incorrect: true })).toString('base64') })
  }
  await assert.rejects(publisher.publish(feed, digest(feed)), /publication_not_confirmed/)
})

test('production store refuses simulation bootstrap and bounded API rejects oversized JSON', async () => {
  const api = server()
  await assert.rejects(api.connect().bootstrap(createSimulationState({ now: Date.parse('2026-11-08T12:00:00Z'), storeId: 'github-test' }), {}), /invalid_bootstrap/)
  assert.equal(api.refs.size, 0)
  api.intercept = () => api.response({ oversized: 'x'.repeat(4 * 1024 * 1024) })
  await assert.rejects(api.connect().verifyProtection(), /response_too_large/)
})

test('hidden bypass actors require the exact administratively reviewed ruleset version', async () => {
  const api = server(), reviewed = '2026-11-08T10:16:49.237-03:00'
  const rule = structuredClone(api.rules)
  delete rule.bypass_actors
  rule.updated_at = reviewed
  api.rules = rule
  assert.equal(await api.connect({ protectionReviewedAt: reviewed }).verifyProtection(), true)
  await assert.rejects(api.connect().verifyProtection(), /protection_mismatch/)
  await assert.rejects(api.connect({ protectionReviewedAt: '2026-11-08T13:16:49.238Z' }).verifyProtection(), /review_version_mismatch/)
  assert.ok(api.calls.every(call => call.method === 'GET'))
})

test('reviewed version cannot hide an explicit bypass or permit changed ruleset version', async () => {
  const api = server(), reviewed = '2026-11-08T10:16:49.237-03:00'
  api.rules = { ...api.rules, updated_at: reviewed, bypass_actors: [{ actor_id: 123, actor_type: 'User', bypass_mode: 'always' }] }
  await assert.rejects(api.connect({ protectionReviewedAt: reviewed }).verifyProtection(), /protection_mismatch/)
  api.rules = { ...api.rules, updated_at: '2026-11-08T13:16:50.237Z', bypass_actors: [] }
  await assert.rejects(api.connect({ protectionReviewedAt: reviewed }).verifyProtection(), /review_version_mismatch/)
})
