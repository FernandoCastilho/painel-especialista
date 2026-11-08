// Production Git object journal. Both refs are dedicated, append-only and protected.
import { digest, validateState, validateTransition, STATE_REF, FEED_REF } from './state.mjs'
const publishers = new WeakSet()
export const isGitHubPublisher = value => publishers.has(value)
export const PROTECTION_ID = 26798792
const SHA = /^[a-f0-9]{40}$/
const MAX_BYTES = 4 * 1024 * 1024
const fail = message => { throw new Error(message) }
const sha = value => SHA.test(value) ? value : fail('github_invalid_sha')
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export function createGitHubStore({ owner = 'FernandoCastilho', repo = 'painel-especialista', token = process.env.GITHUB_TOKEN, rootToken, feedRootToken, storeId, protectionReviewedAt, fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo) || !token || typeof fetchImpl !== 'function' || !storeId || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) fail('github_configuration_required')
  if (rootToken) sha(rootToken)
  if (feedRootToken) sha(feedRootToken)
  const base = `https://api.github.com/repos/${owner}/${repo}`
  async function api(method, path, body, missingAllowed = false) {
    const url = new URL(base + path)
    if (url.origin !== 'https://api.github.com' || !url.pathname.startsWith(`/repos/${owner}/${repo}/`)) fail('github_url_not_allowed')
    const content = body === undefined ? undefined : JSON.stringify(body)
    if (content && Buffer.byteLength(content) > MAX_BYTES) fail('github_request_too_large')
    try {
      const response = await fetchImpl(url.href, { method, redirect: 'error', signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }, body: content })
      if (missingAllowed && response.status === 404) return null
      if (!response.ok) fail(`github_http_${response.status}`)
      if (!response.body) fail('github_empty_response')
      let bytes = 0
      const chunks = []
      for await (const chunk of response.body) {
        bytes += chunk.length
        if (bytes > MAX_BYTES) { await response.body.cancel?.().catch(() => {}); fail('github_response_too_large') }
        chunks.push(Buffer.from(chunk))
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch (error) {
      // Never include transport errors, headers, URLs with credentials or response bodies.
      if (/^github_(http_\d+|response_too_large|empty_response)$/.test(error.message)) throw error
      fail(method === 'GET' ? 'github_read_failed' : 'github_write_outcome_uncertain')
    }
  }
  async function verifyProtection() {
    const rule = await api('GET', `/rulesets/${PROTECTION_ID}`)
    const refs = rule.conditions?.ref_name
    // GitHub hides bypass actors from non-admin readers. An omission is only
    // acceptable for the exact ruleset version reviewed through an admin token.
    // Any version change requires a new privileged review, even if actors are visible.
    const reviewedVersion = typeof protectionReviewedAt === 'string' && Number.isFinite(Date.parse(protectionReviewedAt))
    const sameVersion = reviewedVersion && typeof rule.updated_at === 'string' && Date.parse(rule.updated_at) === Date.parse(protectionReviewedAt)
    if (protectionReviewedAt !== undefined && !sameVersion) fail('github_protection_review_version_mismatch')
    const bypassVerified = Object.hasOwn(rule, 'bypass_actors')
      ? Array.isArray(rule.bypass_actors) && rule.bypass_actors.length === 0
      : sameVersion
    if (rule.id !== PROTECTION_ID || rule.target !== 'branch' || rule.enforcement !== 'active' || !bypassVerified || !equal([...(refs?.include || [])].sort(), [STATE_REF, FEED_REF].sort()) || !Array.isArray(refs?.exclude) || refs.exclude.length || !['deletion', 'non_fast_forward'].every(type => rule.rules?.some(item => item.type === type))) fail('github_protection_mismatch')
    return true
  }
  async function head(ref, missingAllowed = false) {
    const value = await api('GET', `/git/ref/${ref.slice(5)}`, undefined, missingAllowed)
    if (!value) return null
    if (value.ref !== ref || value.object?.type !== 'commit') fail('github_ref_mismatch')
    return sha(value.object.sha)
  }
  async function objectAt(commitSha) {
    const commit = await api('GET', `/git/commits/${sha(commitSha)}`)
    if (commit.sha !== commitSha || !Array.isArray(commit.parents) || commit.parents.length > 1) fail('github_history_invalid')
    const tree = await api('GET', `/git/trees/${sha(commit.tree?.sha)}`)
    if (tree.truncated || !Array.isArray(tree.tree)) fail('github_tree_invalid')
    const entry = tree.tree.find(item => item.path === 'record.json' && item.type === 'blob')
    const blob = await api('GET', `/git/blobs/${sha(entry?.sha)}`)
    if (blob.encoding !== 'base64' || typeof blob.content !== 'string' || blob.size > MAX_BYTES) fail('github_blob_invalid')
    let record
    try { record = JSON.parse(Buffer.from(blob.content.replace(/\s/g, ''), 'base64').toString('utf8')) } catch { fail('github_record_invalid') }
    const parent = commit.parents.length ? sha(commit.parents[0].sha) : null
    if (record.parent !== parent || record.digest !== digest(record.payload)) fail('github_integrity_error')
    return { record, parent, tree }
  }
  const verified = new Map()
  async function readJournal(ref, pinnedRoot, stateJournal) {
    if (!pinnedRoot) fail('github_bootstrap_pin_required')
    const token = await head(ref)
    let cursor = token, newer, newest
    const seen = new Set()
    while (true) {
      if (seen.has(cursor) || seen.size >= 100000) fail('github_history_invalid')
      seen.add(cursor)
      const cached = verified.get(`${pinnedRoot}:${cursor}`)
      const entry = cached || await objectAt(cursor)
      const payload = entry.record.payload
      if (entry.record.kind !== (stateJournal ? 'state' : 'feed')) fail('github_journal_kind_invalid')
      if (stateJournal) {
        validateState(payload, { allowProduction: true })
        if (payload.environment !== 'production') fail('github_production_state_required')
        if (payload.storeId !== storeId) fail('github_store_identity_mismatch')
        if (newer) validateTransition(payload, newer, { allowProduction: true })
      }
      if (!newest) newest = { token, payload, tree: entry.tree }
      if (cached) break
      if (cursor === pinnedRoot) {
        if (entry.parent !== null || (stateJournal && payload.revision !== 0)) fail('github_root_invalid')
        break
      }
      if (!entry.parent) fail('github_history_missing_pinned_root')
      newer = payload
      cursor = entry.parent
    }
    if (await head(ref) !== token) fail('github_head_changed_during_read')
    // Only cache a checkpoint after its entire ancestry reached the pinned root.
    verified.set(`${pinnedRoot}:${token}`, { record: { kind: stateJournal ? 'state' : 'feed', parent: null, digest: digest(newest.payload), payload: structuredClone(newest.payload) }, parent: null, tree: newest.tree })
    return newest
  }
  async function createCommit(parent, payload, kind) {
    const record = { kind, parent, digest: digest(payload), payload }
    const tree = [{ path: 'record.json', mode: '100644', type: 'blob', content: JSON.stringify(record) + '\n' }]
    if (kind === 'feed') tree.push({ path: 'sector-news.json', mode: '100644', type: 'blob', content: JSON.stringify(payload) + '\n' })
    const createdTree = await api('POST', '/git/trees', { tree })
    const commit = await api('POST', '/git/commits', { message: `Institutional news ${kind} journal`, tree: sha(createdTree.sha), parents: parent ? [parent] : [] })
    return sha(commit.sha)
  }
  async function append(ref, expected, payload, kind) {
    if (await head(ref) !== expected) fail('github_cas_conflict')
    const commit = await createCommit(expected, payload, kind)
    // Recheck before the one and only ref update; server enforces fast-forward too.
    if (await head(ref) !== expected) fail('github_cas_conflict')
    await api('PATCH', `/git/refs/${ref.slice(5)}`, { sha: commit, force: false })
    if (await head(ref) !== commit) fail('github_write_not_confirmed')
    return commit
  }
  async function read() {
    await verifyProtection()
    const saved = await readJournal(STATE_REF, rootToken, true)
    return { ref: STATE_REF, token: saved.token, state: structuredClone(saved.payload), confirmed: true }
  }
  async function compareAndSwap(expected, next) {
    sha(expected)
    const current = await read()
    if (current.token !== expected) fail('github_cas_conflict')
    validateTransition(current.state, next, { allowProduction: true })
    await verifyProtection()
    const committed = await append(STATE_REF, expected, next, 'state')
    const observed = await read()
    if (observed.token !== committed || !equal(observed.state, next)) fail('github_write_not_confirmed')
    return observed
  }
  async function readFeed() {
    await verifyProtection()
    const observed = await readJournal(FEED_REF, feedRootToken, false)
    const file = observed.tree.tree.find(item => item.path === 'sector-news.json' && item.type === 'blob')
    const blob = await api('GET', `/git/blobs/${sha(file?.sha)}`)
    if (blob.encoding !== 'base64') fail('github_feed_blob_invalid')
    let actual
    try { actual = JSON.parse(Buffer.from(blob.content, 'base64').toString('utf8')) } catch { fail('github_feed_blob_invalid') }
    if (!equal(actual, observed.payload) || digest(actual) !== digest(observed.payload) || await head(FEED_REF) !== observed.token) fail('github_publication_not_confirmed')
    return { payload: structuredClone(actual), token: observed.token, ref: FEED_REF, confirmed: true }
  }
  const publisher = Object.freeze({ ref: FEED_REF, async publish(feed, payloadDigest) {
    if (digest(feed) !== payloadDigest) fail('github_feed_digest_mismatch')
    await verifyProtection()
    const previous = await readJournal(FEED_REF, feedRootToken, false)
    const receipt = await append(FEED_REF, previous.token, feed, 'feed')
    const observed = await readFeed()
    if (observed.token !== receipt || !equal(observed.payload, feed)) fail('github_publication_not_confirmed')
    return { confirmed: true, receipt, digest: payloadDigest }
  } })
  publishers.add(publisher)
  async function bootstrap(initialState, previousFeed) {
    await verifyProtection()
    const state = validateState(initialState, { allowProduction: true })
    if (state.environment !== 'production' || state.storeId !== storeId || state.revision !== 0 || state.run !== null || !previousFeed || typeof previousFeed !== 'object') fail('github_invalid_bootstrap')
    if (await head(STATE_REF, true) || await head(FEED_REF, true)) fail('github_bootstrap_refs_already_exist')
    const stateRoot = await createCommit(null, state, 'state')
    const feedRoot = await createCommit(null, previousFeed, 'feed')
    await api('POST', '/git/refs', { ref: STATE_REF, sha: stateRoot })
    await api('POST', '/git/refs', { ref: FEED_REF, sha: feedRoot })
    rootToken = stateRoot
    feedRootToken = feedRoot
    const saved = await read()
    const savedFeed = await readFeed()
    if (saved.token !== stateRoot || savedFeed.token !== feedRoot || !equal(saved.state, state) || !equal(savedFeed.payload, previousFeed)) fail('github_bootstrap_not_confirmed')
    return { rootToken, feedRootToken, storeId }
  }
  return Object.freeze({ store: Object.freeze({ ref: STATE_REF, kind: 'github-append-only-journal', read, compareAndSwap }), publisher, bootstrap, verifyProtection, readFeed })
}
