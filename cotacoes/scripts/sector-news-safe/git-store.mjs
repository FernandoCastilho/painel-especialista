// Dedicated Git journal: production never accepts a remote URL or command injection.
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { APPROVED_PARSER_RELEASES, planParserRelease } from './parser-release.mjs'
import { digest, validateState, validateTransition, STATE_REF, FEED_REF } from './state.mjs'
import { createGitHubStore as createRestStore } from './github-store.mjs'
import { planSourceRelease } from './source-release.mjs'
const branded = new WeakSet()
export const isGitHubPublisher = value => branded.has(value)
const sha = value => { if (!/^[a-f0-9]{40}$/.test(value)) throw Error('git_invalid_sha'); return value }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
// Depois do push, o GitHub pode responder por alguns segundos com uma réplica ainda no commit anterior (falha de
// 12/11/2026: gravação feita às 01:43:02 UTC e recusada por git_write_not_confirmed). A confirmação espera e relê
// só enquanto o servidor mostra exatamente o pai esperado; qualquer outro commit continua sendo recusa imediata.
const CONFIRM_ATTEMPTS = 6, CONFIRM_DELAY_MS = 2000
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const locals = { [STATE_REF]: 'refs/remotes/journal/state', [FEED_REF]: 'refs/remotes/journal/feed' }

export function createGitHubStore(options = {}) {
  const owner = options.owner || 'FernandoCastilho', repo = options.repo || 'painel-especialista'
  if (owner !== 'FernandoCastilho' || repo !== 'painel-especialista') throw Error('git_repository_not_approved')
  const token = process.env.GITHUB_TOKEN
  if (!token) throw Error('github_configuration_required')
  const protection = createRestStore({ ...options, owner, repo, token })
  if (Object.hasOwn(options, 'parserReleaseGrants')) throw Error('production_release_grants_must_be_code_reviewed')
  return build({ ...options, parserReleaseGrants: APPROVED_PARSER_RELEASES, remote: `https://github.com/${owner}/${repo}.git`, token, verifyProtection: protection.verifyProtection, production: true })
}
// Explicit local-only harness; rejects network remotes and has no production brand.
export function createLocalGitStoreForTests(options) {
  if (!options?.remote?.startsWith('/') || options.remote.includes('\0')) throw Error('local_test_remote_required')
  return build({ ...options, token: null, production: false })
}
function build({ remote, token, rootToken, feedRootToken, storeId, verifyProtection, production, parserReleaseGrants = APPROVED_PARSER_RELEASES, confirmDelayMs = CONFIRM_DELAY_MS }) {
  sha(rootToken); sha(feedRootToken)
  if (!storeId || typeof verifyProtection !== 'function') throw Error('git_configuration_required')
  let closed = false, directory, busy = false
  const cached = new Map()
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: token ? '3' : '2', GIT_CONFIG_KEY_0: 'core.hooksPath', GIT_CONFIG_VALUE_0: '/dev/null' }
  // Never persist this header in config or include it in command arguments/errors.
  if (token) { env.GIT_CONFIG_KEY_1 = 'http.https://github.com/.extraheader'; env.GIT_CONFIG_VALUE_1 = `Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}` }
  const redirectIndex = token ? 2 : 1
  env[`GIT_CONFIG_KEY_${redirectIndex}`] = 'http.followRedirects'
  env[`GIT_CONFIG_VALUE_${redirectIndex}`] = 'false'
  delete env.GIT_CONFIG_PARAMETERS
  delete env.GITHUB_TOKEN
  function command(args, input) {
    if (closed) return Promise.reject(Error('git_store_closed'))
    return new Promise((resolve, reject) => {
      const child = execFile('git', args, { cwd: directory, env, timeout: 30000, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8' }, (error, stdout) => {
        if (error) reject(Error(args[0] === 'push' ? 'git_write_outcome_uncertain' : 'git_operation_failed'))
        else resolve(stdout.trim())
      })
      child.stdin.on('error', () => {})
      child.stdin.end(input)
    })
  }
  const ready = (async () => { directory = await mkdtemp(join(tmpdir(), 'sector-news-git-')); await command(['init', '--bare', '--quiet']); return directory })()
  async function guard() { await ready; if (closed) throw Error('git_store_closed'); await verifyProtection() }
  const observedHeads = new Map()
  async function fetchHeads() {
    try { await command(['fetch', '--quiet', '--no-tags', '--no-write-fetch-head', remote, `${STATE_REF}:${locals[STATE_REF]}`, `${FEED_REF}:${locals[FEED_REF]}`]) } catch { throw Error('git_fetch_failed_or_non_fast_forward') }
    for (const ref of [STATE_REF, FEED_REF]) {
      const next = await head(ref), previous = observedHeads.get(ref)
      if (previous && previous !== next) {
        try { await command(['merge-base', '--is-ancestor', previous, next]) } catch { throw Error('git_remote_rollback_detected') }
      }
      observedHeads.set(ref, next)
    }
  }
  const head = async ref => sha(await command(['rev-parse', '--verify', locals[ref]]))
  async function inspect(commit, kind) {
    const parents = (await command(['show', '-s', '--format=%P', commit])).split(' ').filter(Boolean)
    if (parents.length > 1) throw Error('git_history_invalid')
    let record
    try { record = JSON.parse(await command(['show', `${commit}:record.json`])) } catch { throw Error('git_record_invalid') }
    const parent = parents.length ? sha(parents[0]) : null
    if (record.kind !== kind || record.parent !== parent || record.digest !== digest(record.payload)) throw Error('git_integrity_error')
    return { record, parent }
  }
  async function journal(ref, root, stateJournal) {
    const token = await head(ref)
    let cursor = token, newer, payload
    const traversed = new Set()
    while (true) {
      if (traversed.has(cursor)) throw Error('git_history_invalid')
      traversed.add(cursor)
      const key = `${root}:${cursor}`, known = cached.get(key)
      const entry = known || await inspect(cursor, stateJournal ? 'state' : 'feed')
      if (!payload) payload = entry.record.payload
      if (stateJournal) {
        validateState(entry.record.payload, { allowProduction: true, parserReleaseGrants })
        if (entry.record.payload.environment !== 'production' || entry.record.payload.storeId !== storeId) throw Error('git_state_identity_invalid')
        if (newer) {
          // cursor is the actual Git parent of the newer payload, including when
          // this predecessor is cached. Never trust the review's self-declared parent.
          if (!entry.record.payload.parserRelease && newer.parserRelease && newer.parserRelease.parentToken !== cursor) throw Error('parser_release_git_parent_mismatch')
          validateTransition(entry.record.payload, newer, { allowProduction: true, parserReleaseGrants })
        }
      }
      if (known) break
      if (cursor === root) {
        if (entry.parent !== null || (stateJournal && entry.record.payload.revision !== 0)) throw Error('git_root_invalid')
        break
      }
      if (!entry.parent) throw Error('git_pinned_root_not_reached')
      newer = entry.record.payload; cursor = entry.parent
    }
    cached.set(`${root}:${token}`, { record: { payload: structuredClone(payload) } })
    return { token, payload: structuredClone(payload) }
  }
  async function readUnlocked() {
    await guard(); await fetchHeads()
    const current = await journal(STATE_REF, rootToken, true)
    return { state: current.payload, token: current.token, confirmed: true, ref: STATE_REF }
  }
  async function feedUnlocked() {
    await guard(); await fetchHeads()
    const current = await journal(FEED_REF, feedRootToken, false)
    let publicFeed
    try { publicFeed = JSON.parse(await command(['show', `${current.token}:sector-news.json`])) } catch { throw Error('git_public_feed_invalid') }
    if (!same(publicFeed, current.payload)) throw Error('git_public_feed_mismatch')
    return { ...current, confirmed: true, ref: FEED_REF }
  }
  async function exclusive(action) {
    if (busy) throw Error('git_local_concurrent_operation')
    busy = true
    try { return await action() } finally { busy = false }
  }
  async function append(ref, expected, payload, kind) {
    await guard(); await fetchHeads()
    if (await head(ref) !== expected) throw Error('git_cas_conflict')
    const record = { kind, parent: expected, digest: digest(payload), payload }
    if (Buffer.byteLength(JSON.stringify(record)) > 4 * 1024 * 1024) throw Error('git_payload_too_large')
    const recordBlob = sha(await command(['hash-object', '-w', '--stdin'], JSON.stringify(record) + '\n'))
    let treeInput = `100644 blob ${recordBlob}\trecord.json\n`
    if (kind === 'feed') {
      const feedBlob = sha(await command(['hash-object', '-w', '--stdin'], JSON.stringify(payload) + '\n'))
      treeInput += `100644 blob ${feedBlob}\tsector-news.json\n`
    }
    const tree = sha(await command(['mktree'], treeInput))
    // Identity is only metadata for this dedicated journal, never a user credential.
    const commit = sha(await command(['-c', 'user.name=Institutional news journal', '-c', 'user.email=journal@users.noreply.github.com', 'commit-tree', tree, '-p', expected], `Institutional news ${kind} journal\n`))
    await command(['push', '--quiet', '--porcelain', remote, `${commit}:${ref}`])
    for (let attempt = 1; ; attempt++) {
      await fetchHeads()
      const observed = await head(ref)
      if (observed === commit) break
      if (observed !== expected || attempt >= CONFIRM_ATTEMPTS) throw Error('git_write_not_confirmed')
      await wait(confirmDelayMs)
    }
    return commit
  }
  const store = Object.freeze({ ref: STATE_REF, kind: 'git-append-only-journal', read: () => exclusive(readUnlocked), compareAndSwap: (token, next) => exclusive(async () => {
    sha(token)
    const before = await readUnlocked()
    if (before.token !== token) throw Error('git_cas_conflict')
    if (JSON.stringify(before.state.parserRelease) !== JSON.stringify(next.parserRelease)) throw Error('parser_release_dedicated_operation_required')
    if (JSON.stringify(before.state.sourceReleases) !== JSON.stringify(next.sourceReleases)) throw Error('source_release_dedicated_operation_required')
    validateTransition(before.state, next, { allowProduction: true, parserReleaseGrants })
    const committed = await append(STATE_REF, token, next, 'state')
    const observed = await readUnlocked()
    if (observed.token !== committed || !same(observed.state, next)) throw Error('git_write_not_confirmed')
    return observed
  }) })
  const applyParserRelease = (expectedToken, review) => exclusive(async () => {
    sha(expectedToken)
    const before = await readUnlocked()
    if (before.token !== expectedToken) throw Error('git_cas_conflict')
    const next = planParserRelease(before.state, expectedToken, review, parserReleaseGrants)
    validateTransition(before.state, next, { allowProduction: true, parserReleaseGrants })
    const committed = await append(STATE_REF, expectedToken, next, 'state')
    const observed = await readUnlocked()
    if (observed.token !== committed || !same(observed.state, next)) throw Error('parser_release_not_confirmed')
    return observed
  })
  // Liberação revisada de fontes: só a concessão exata do código, uma gravação, releitura obrigatória.
  const applySourceRelease = (expectedToken, review, now) => exclusive(async () => {
    sha(expectedToken)
    const before = await readUnlocked()
    if (before.token !== expectedToken) throw Error('git_cas_conflict')
    const next = planSourceRelease(before.state, review, now)
    validateTransition(before.state, next, { allowProduction: true, parserReleaseGrants })
    const committed = await append(STATE_REF, expectedToken, next, 'state')
    const observed = await readUnlocked()
    if (observed.token !== committed || !same(observed.state, next)) throw Error('source_release_not_confirmed')
    return observed
  })
  const publisher = Object.freeze({ ref: FEED_REF, publish: (feed, expectedDigest) => exclusive(async () => {
    if (digest(feed) !== expectedDigest) throw Error('git_feed_digest_mismatch')
    const before = await feedUnlocked()
    const receipt = await append(FEED_REF, before.token, feed, 'feed')
    const observed = await feedUnlocked()
    if (observed.token !== receipt || !same(observed.payload, feed)) throw Error('git_publication_not_confirmed')
    return { confirmed: true, receipt, digest: expectedDigest }
  }) })
  if (production) branded.add(publisher)
  return Object.freeze({ store, publisher, applyParserRelease, applySourceRelease, verifyProtection, readFeed: () => exclusive(feedUnlocked), bootstrap: async () => { throw Error('git_explicit_external_bootstrap_required') }, close: async () => { await ready.catch(() => {}); if (busy) throw Error('git_operation_in_progress'); closed = true; if (directory) await rm(directory, { recursive: true, force: true }); for (const key of Object.keys(env)) delete env[key] } })
}
