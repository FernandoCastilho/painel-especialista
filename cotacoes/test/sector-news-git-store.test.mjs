import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLocalGitStoreForTests, isGitHubPublisher } from '../scripts/sector-news-safe/git-store.mjs'
import { createSimulationState, digest, STATE_REF, FEED_REF } from '../scripts/sector-news-safe/state.mjs'
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
  const connect = () => createLocalGitStoreForTests({ remote, rootToken, feedRootToken, storeId: 'git-test', verifyProtection: async () => { checks++; if (!protection) throw Error('protection_mismatch') } })
  const connection = connect(); t.after(() => connection.close())
  return { ...connection, state, feed, connect, rootToken, git, remote, get checks() { return checks }, set protection(value) { protection = value } }
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
