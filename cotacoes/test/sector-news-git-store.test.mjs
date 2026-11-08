import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLocalGitStoreForTests, isGitHubPublisher } from '../scripts/sector-news-safe/git-store.mjs'
import { planParserRelease } from '../scripts/sector-news-safe/parser-release.mjs'
import { createSimulationState, validateTransition, digest, STATE_REF, FEED_REF } from '../scripts/sector-news-safe/state.mjs'
const exec = promisify(execFile)
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'git-store-test-')), remote = join(directory, 'remote.git'), working = join(directory, 'seed')
  await mkdir(working)
  t.after(() => rm(directory, { recursive: true, force: true }))
  const git = async (args, cwd = working) => (await exec('git', args, { cwd, env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } })).stdout.trim()
  await git(['init', '--bare', '--quiet', remote])
  await git(['init', '--quiet'])
  await git(['config', 'user.name', 'Fixture'])
  await git(['config', 'user.email', 'fixture@example.invalid'])
  const state = { ...createSimulationState({ storeId: 'git-test', now: Date.parse('2026-11-08T12:00:00Z') }), environment: 'production' }
  const feed = { schemaVersion: 1, topics: {}, sourceStates: {} }
  async function seed(kind, payload, ref) {
    await git(['checkout', '--orphan', kind])
    await writeFile(join(working, 'record.json'), JSON.stringify({ kind, parent: null, digest: digest(payload), payload }))
    await git(['add', 'record.json'])
    if (kind === 'feed') { await writeFile(join(working, 'sector-news.json'), JSON.stringify(payload)); await git(['add', 'sector-news.json']) }
    await git(['commit', '--quiet', '-m', 'Explicit fixture bootstrap'])
    const root = await git(['rev-parse', 'HEAD'])
    await git(['push', '--quiet', remote, `${root}:${ref}`])
    return root
  }
  const rootToken = await seed('state', state, STATE_REF), feedRootToken = await seed('feed', feed, FEED_REF)
  let protection = true, checks = 0
  const connect = (options = {}) => createLocalGitStoreForTests({ ...options, remote, rootToken, feedRootToken, storeId: 'git-test', verifyProtection: async () => { checks++; if (options.checkProtection) await options.checkProtection(); if (!protection) throw Error('protection_mismatch') } })
  const connection = connect(); t.after(() => connection.close())
  return { ...connection, state, feed, connect, rootToken, git, remote, working, get checks() { return checks }, set protection(value) { protection = value } }
}

test('real bare Git stores CAS state and public feed with independent pinned roots', async t => {
  const f = await fixture(t), before = await f.store.read()
  const next = { ...before.state, revision: 1 }
  const saved = await f.store.compareAndSwap(before.token, next)
  assert.deepEqual(saved.state, next)
  assert.notEqual(saved.token, before.token)
  await assert.rejects(f.store.compareAndSwap(before.token, { ...next, revision: 2 }), /cas_conflict/)
  const feed = { ...f.feed, generatedAt: '2026-11-08T12:01:00Z' }
  const receipt = await f.publisher.publish(feed, digest(feed))
  assert.equal(receipt.confirmed, true)
  assert.deepEqual((await f.readFeed()).payload, feed)
  assert.equal(await f.git(['rev-parse', STATE_REF], f.remote), saved.token)
  assert.equal(await f.git(['rev-parse', FEED_REF], f.remote), receipt.receipt)
  assert.equal(isGitHubPublisher(f.publisher), false)
  assert.ok(f.checks < 20)
})

test('real competing Git writers preserve only one sibling, no force push', async t => {
  const f = await fixture(t), second = f.connect(); t.after(() => second.close())
  const before = await f.store.read(), next = { ...before.state, revision: 1 }
  const result = await Promise.allSettled([f.store.compareAndSwap(before.token, next), second.store.compareAndSwap(before.token, { ...next, updatedAt: '2026-11-08T12:00:01.000Z' })])
  assert.equal(result.filter(item => item.status === 'fulfilled').length, 1)
  assert.equal((await f.store.read()).state.revision, 1)
})

test('protection failure blocks real writes; digest mismatch never modifies feed ref', async t => {
  const f = await fixture(t), before = await f.store.read(), previousFeed = await f.git(['rev-parse', FEED_REF], f.remote)
  f.protection = false
  await assert.rejects(f.store.compareAndSwap(before.token, { ...before.state, revision: 1 }), /protection_mismatch/)
  assert.equal(await f.git(['rev-parse', STATE_REF], f.remote), before.token)
  f.protection = true
  await assert.rejects(f.publisher.publish({}, '0'.repeat(64)), /digest_mismatch/)
  assert.equal(await f.git(['rev-parse', FEED_REF], f.remote), previousFeed)
})

test('remote rollback fails closed with real Git objects and non-forced fetch', async t => {
  const f = await fixture(t), before = await f.store.read()
  await f.store.compareAndSwap(before.token, { ...before.state, revision: 1 })
  await f.git(['update-ref', STATE_REF, f.rootToken], f.remote)
  await assert.rejects(f.store.read(), /git_fetch_failed_or_non_fast_forward|git_remote_rollback_detected/)
})

test('closed journal rejects further operations and bootstrap is explicitly external', async t => {
  const f = await fixture(t)
  await assert.rejects(f.bootstrap(), /external_bootstrap_required/)
  await f.close()
  await assert.rejects(f.store.read(), /closed/)
})

const reviewFor = (state, token) => ({ beforeDigest: digest(state), parentToken: token, reviewId: 'isolated-review-aneel-susep', reviewedAt: '2026-11-08T12:01:00.000Z', sources: ['aneel', 'susep'] })
test('reviewed parser migration appends one real Git commit and preserves every other field and both roots', async t => {
  const f = await fixture(t), before = await f.store.read(), review = reviewFor(before.state, before.token)
  const reviewed = f.connect({ parserReleaseGrants: [review] }); t.after(() => reviewed.close())
  const oldFeed = await f.git(['rev-parse', FEED_REF], f.remote)
  await assert.rejects(f.applyParserRelease(before.token, review), /not_approved/)
  await assert.rejects(reviewed.store.compareAndSwap(before.token, planParserRelease(before.state, before.token, review, [review])), /dedicated_operation/)
  const saved = await reviewed.applyParserRelease(before.token, review)
  assert.equal(saved.confirmed, true); assert.notEqual(saved.token, before.token)
  assert.deepEqual(saved.state, planParserRelease(before.state, before.token, review, [review]))
  assert.equal(await f.git(['rev-parse', saved.token+'^'], f.remote), before.token)
  assert.equal(await f.git(['rev-parse', FEED_REF], f.remote), oldFeed)
  await f.git(['merge-base', '--is-ancestor', f.rootToken, saved.token], f.remote)
  // A fresh reader verifies the whole old history plus the exact reviewed transition.
  const fresh = f.connect({ parserReleaseGrants: [review] }); t.after(() => fresh.close())
  assert.deepEqual((await fresh.store.read()).state, saved.state)
  await assert.rejects(fresh.applyParserRelease(before.token, review), /cas_conflict/)
  const next = { ...saved.state, revision: saved.state.revision + 1 }
  assert.equal((await fresh.store.compareAndSwap(saved.token, next)).state.revision, 2)
})
test('parser migration CAS refuses changed head without retry and cannot overlap a competing writer', async t => {
  const f = await fixture(t), before = await f.store.read(), review = reviewFor(before.state, before.token)
  const a = f.connect({ parserReleaseGrants: [review] }), b = f.connect({ parserReleaseGrants: [review] })
  t.after(() => a.close()); t.after(() => b.close())
  const competing = { ...before.state, revision: 1, updatedAt: '2026-11-08T12:00:30.000Z' }
  const result = await Promise.allSettled([a.applyParserRelease(before.token, review), b.store.compareAndSwap(before.token, competing)])
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1)
  const fresh = f.connect({ parserReleaseGrants: [review] }); t.after(() => fresh.close())
  assert.equal((await fresh.store.read()).state.revision, 1)
  await assert.rejects(fresh.applyParserRelease(before.token, review), /cas_conflict/)
})
test('parser migration never changes other blocks, active operations or shared blocks', async t => {
  const f = await fixture(t), before = await f.store.read()
  for (const change of [s=>s.sources.aneel.block.code='http_403',s=>s.sources.susep.block.code='operation_outcome_uncertain',s=>s.sharedBlocks['https://www.gov.br']={code:'http_429',detectedAt:s.updatedAt},s=>s.run={id:'existing'},s=>s.sources.mapa.request={id:'existing'},s=>s.feed.status='in_flight']) {
    const state=structuredClone(before.state);change(state)
    const review=reviewFor(state,before.token)
    assert.throws(()=>planParserRelease(state,before.token,review,[review]), /wrong_block|shared_block|inflight/)
  }
  const review = reviewFor(before.state,before.token)
  for(const sources of [['aneel'],['anvisa','susep'],['aneel','susep','mtur']]) {
    const wrong={...review,sources};assert.throws(()=>planParserRelease(before.state,before.token,wrong,[wrong]), /not_approved/)
  }
  assert.throws(()=>planParserRelease(before.state,'a'.repeat(40),review,[review]), /stale_state/)
  assert.equal((await f.store.read()).token,before.token)
})

test('uncertain migration confirmation stops without retry; fresh read reconciles the single append', async t => {
  const f = await fixture(t), before = await f.store.read(), review = reviewFor(before.state,before.token)
  let checks = 0
  const interrupted = f.connect({ parserReleaseGrants: [review], checkProtection: async () => {
    if (++checks === 3) throw Error('simulated_confirmation_unavailable')
  } }); t.after(() => interrupted.close())
  await assert.rejects(interrupted.applyParserRelease(before.token,review), /confirmation_unavailable/)
  const remote = await f.git(['rev-parse',STATE_REF],f.remote)
  assert.notEqual(remote,before.token)
  assert.equal(await f.git(['rev-parse',remote+'^'],f.remote),before.token)
  const fresh=f.connect({parserReleaseGrants:[review]});t.after(()=>fresh.close())
  const observed=await fresh.store.read()
  assert.deepEqual(observed.state.parserRelease,review)
  assert.equal(observed.state.revision,1)
  await assert.rejects(fresh.applyParserRelease(before.token,review),/cas_conflict/)
  assert.equal(await f.git(['rev-parse',STATE_REF],f.remote),remote)
})

test('a reviewed parser release cannot clear a later suspension or change its immutable receipt', () => {
  const before = {...createSimulationState({storeId:'isolated',now:Date.parse('2026-11-08T12:00:00Z')}),environment:'production'}
  const review=reviewFor(before,'a'.repeat(40)), options={allowProduction:true,parserReleaseGrants:[review]}
  const released=planParserRelease(before,review.parentToken,review,[review])
  validateTransition(before,released,options)
  const blocked=structuredClone(released);blocked.revision++
  blocked.sources.aneel.status='suspended';blocked.sources.aneel.block={code:'http_403',detectedAt:blocked.updatedAt}
  validateTransition(released,blocked,options)
  const retry=structuredClone(blocked);retry.revision++;retry.sources.aneel.status='ready';retry.sources.aneel.block=null
  assert.throws(()=>validateTransition(blocked,retry,options),/block_cannot_be_cleared/)
  assert.throws(()=>planParserRelease(blocked,review.parentToken,review,[review]),/stale_state/)
  const changed=structuredClone(released);changed.revision++;changed.parserRelease.reviewId='different'
  assert.throws(()=>validateTransition(released,changed,options),/not_approved/)
  const unrelated=structuredClone(released);unrelated.sources.mapa.reason='changed without approval'
  assert.throws(()=>validateTransition(before,unrelated,options),/unrelated_change/)
})

test('history verifies actual Git parent of a release, including cached predecessors', async t => {
  const f=await fixture(t), before=await f.store.read()
  const review=reviewFor(before.state,'a'.repeat(40))
  const payload=planParserRelease(before.state,review.parentToken,review,[review])
  const cached=f.connect({parserReleaseGrants:[review]});t.after(()=>cached.close())
  await cached.store.read()
  await f.git(['checkout','--quiet','--detach',before.token])
  await writeFile(join(f.working,'record.json'),JSON.stringify({kind:'state',parent:before.token,digest:digest(payload),payload}))
  await f.git(['add','record.json']);await f.git(['commit','--quiet','-m','Invalid reviewed-parent fixture'])
  const bad=await f.git(['rev-parse','HEAD'])
  await f.git(['push','--quiet',f.remote,`${bad}:${STATE_REF}`])
  await assert.rejects(cached.store.read(),/parser_release_git_parent_mismatch/)
  const fresh=f.connect({parserReleaseGrants:[review]});t.after(()=>fresh.close())
  await assert.rejects(fresh.store.read(),/parser_release_git_parent_mismatch/)
})
