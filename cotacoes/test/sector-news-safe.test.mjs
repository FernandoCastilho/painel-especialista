import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, symlink } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SECTOR_NEWS_SOURCES, CC_BY_ND_3, SECTOR_NEWS_WINDOW_MS } from '../src/sectorNews.js'
import { makeSectorNewsFile } from '../scripts/sector-news-lib.mjs'
import { createSimulationState, validateState, validateTransition, digest, STATE_REF, FEED_REF, HISTORICAL_HOLDS } from '../scripts/sector-news-safe/state.mjs'
import { createFixtureTransport, createFixturePublisher } from '../scripts/sector-news-safe/fixtures.mjs'
import { runSectorNewsSimulation } from '../scripts/sector-news-safe/runner.mjs'
import { initializeLocalSimulationStore, createLocalStateStore } from '../scripts/sector-news-safe/local-state-store.mjs'

const NOW = Date.parse('2026-11-05T12:00:00Z')
const mapa = SECTOR_NEWS_SOURCES.find(s => s.id === 'mapa')
const link = `${mapa.articlePrefix}2026/novembro/agricultura-publica-regra-para-safra`
const article = `<h1>Agricultura publica regra para safra</h1><meta property="article:published_time" content="2026-11-04T09:00:00Z">${CC_BY_ND_3}`
const fixtures = () => ({
  [mapa.robotsUrl]: { status: 200, body: 'User-agent: *\nDisallow:\nCrawl-delay: 1' },
  [mapa.url]: { status: 200, body: `<a href="${link}">Agricultura publica regra para safra</a>${CC_BY_ND_3}` },
  [link]: { status: 200, body: article },
})
function memoryStore(initial = createSimulationState({ approvedIds: ['mapa'], now: NOW }), options = {}) {
  let state = structuredClone(initial), token = `v${state.revision}`, reads = 0, writes = 0
  const history = [structuredClone(state)]
  return {
    ref: STATE_REF,
    get state() { return structuredClone(state) },
    get history() { return structuredClone(history) },
    get writes() { return writes },
    async read() {
      reads++
      if (reads === options.readFailure) throw new Error('simulated_storage_read_failure')
      if (reads === options.unconfirmedRead) return { state, token, ref: STATE_REF, confirmed: false }
      return { state: structuredClone(state), token, ref: STATE_REF, confirmed: true }
    },
    async compareAndSwap(expected, next) {
      writes++
      if (options.beforeWrite === writes) throw new Error('simulated_storage_write_failure')
      if (token !== expected) throw new Error('state_cas_conflict')
      validateTransition(state, next)
      state = structuredClone(next); token = `v${state.revision}`; history.push(structuredClone(state))
      if (options.afterWrite === writes) throw new Error('simulated_storage_write_outcome_uncertain')
      if (options.badAck === writes) return { token, state: initial, confirmed: true, ref: STATE_REF }
      return { token, state: structuredClone(state), confirmed: true, ref: STATE_REF }
    },
  }
}
function setup({ state, storage = {}, response = fixtures(), publication = 'confirmed', sourceIds = ['mapa'] } = {}) {
  let now = NOW
  const store = memoryStore(state, storage), transport = createFixtureTransport(response), publisher = createFixturePublisher({ result: publication })
  const options = { mode: 'simulation', store, transport, publisher, previousFeed: makeSectorNewsFile({ now }), sourceIds, runId: 'test-run', clock: () => now, sleep: async ms => { now += ms } }
  return { store, transport, publisher, options, setNow: value => { now = value }, run: overrides => runSectorNewsSimulation({ ...options, ...overrides }) }
}

test('off por padrão sem ler estado, acessar transporte ou publicar; live recusado', async () => {
  const x = setup()
  assert.deepEqual(await runSectorNewsSimulation(), { status: 'disabled', networkEnabled: false })
  assert.equal((await x.run({ mode: 'off', store: { read() { throw Error('must not read') } } })).status, 'disabled')
  for (const mode of ['live', 'on', true, 'true']) await assert.rejects(x.run({ mode }), /live_collection_disabled/)
  await assert.rejects(x.run({ transport: { request: globalThis.fetch } }), /live_collection_disabled/)
  await assert.rejects(x.run({ publisher: { publish: async () => ({ confirmed: true }) } }), /live_collection_disabled/)
  assert.equal(x.transport.calls.length, 0); assert.equal(x.publisher.calls, 0)
})
test('estado não vem do feed e bootstrap só admite simulação mantendo todos os bloqueios históricos', () => {
  const state = createSimulationState({ now: NOW, approvedIds: SECTOR_NEWS_SOURCES.map(s => s.id) })
  assert.equal(state.environment, 'simulation-only')
  for (const key of Object.keys(HISTORICAL_HOLDS)) assert.equal(state.sources[key].status, 'suspended')
  assert.equal(state.sources.bcb.status, 'suspended')
  assert.throws(() => createSimulationState({ now: NOW, approvedIds: ['unknown'] }), /invalid_simulation_seed/)
  for (const key of Object.keys(HISTORICAL_HOLDS)) {
    const invalid = structuredClone(state); invalid.sources[key].status = 'ready'; invalid.sources[key].block = null
    assert.throws(() => validateState(invalid), /historical_hold/)
  }
})
test('estado completo, esquema, identidade do cadastro, timestamps e integridade são obrigatórios', () => {
  const original = createSimulationState({ now: NOW })
  const mutations = [s => { s.schemaVersion = 2 }, s => { s.environment = 'production' }, s => { delete s.sources.mapa }, s => { s.registryDigest = 'changed' }, s => { s.revision = -1 }, s => { s.updatedAt = 'yesterday' }, s => { s.sources.mapa.checkedAt = '2026-11-06T00:00:00Z' }, s => { s.sources.mapa.lastSuccessAt = '2026-11-04T00:00:00Z' }, s => { s.sources.mapa.activeRun = 'ghost' }]
  for (const mutate of mutations) { const bad = structuredClone(original); mutate(bad); assert.throws(() => validateState(bad), /state_invalid/) }
})
test('feed ausente/corrompido e estado ausente/não confirmado falham antes do transporte', async () => {
  for (const feed of [undefined, null, {}, { schemaVersion: 2, topics: {}, sourceStates: {} }]) {
    const x = setup(); await assert.rejects(x.run({ previousFeed: feed })); assert.equal(x.transport.calls.length, 0)
  }
  for (const storage of [{ readFailure: 1 }, { unconfirmedRead: 1 }]) {
    const x = setup({ storage }); await assert.rejects(x.run()); assert.equal(x.transport.calls.length, 0)
  }
  const x = setup(); await assert.rejects(x.run({ store: { ...x.store, ref: 'refs/heads/data' } }), /durable_state_store_required/)
})
test('cada request tem in_flight confirmado antes; datas da matéria, coleta, sucesso e publicação distintas', async () => {
  const x = setup(), result = await x.run()
  assert.equal(result.status, 'simulated'); assert.equal(result.networkEnabled, false)
  assert.deepEqual(x.transport.calls, [mapa.robotsUrl, mapa.url, link])
  const inFlight = x.store.history.filter(s => s.sources.mapa.request)
  assert.deepEqual(inFlight.map(s => s.sources.mapa.request.url), x.transport.calls)
  assert.ok(inFlight.every(s => s.run.status === 'in_flight' && s.sources.mapa.status === 'collecting'))
  const final = x.store.state
  assert.equal(final.run, null); assert.equal(final.sources.mapa.request, null)
  assert.equal(final.sources.mapa.checkedAt, '2026-11-05T12:00:00.000Z')
  assert.equal(final.sources.mapa.lastSuccessAt, '2026-11-05T12:00:02.200Z')
  assert.equal(final.sources.mapa.lastCollectedAt, final.sources.mapa.lastSuccessAt)
  assert.equal(final.feed.status, 'published'); assert.equal(final.feed.publishedAt, result.publication.publishedAt)
  assert.equal(result.feed.topics.agricultura.items[0].publishedAt, '2026-11-04T09:00:00Z')
  assert.equal(result.feed.topics.agricultura.items[0].collectedAt, final.sources.mapa.lastCollectedAt)
  assert.equal(result.feed.delivery.publishedAt, null, 'payload não inventa confirmação antes da publicação')
  assert.equal(result.feed.delivery.feedRef, FEED_REF); assert.notEqual(STATE_REF, FEED_REF)
  assert.equal(result.feed.collectionPolicy.automaticScheduleEnabled, false)
})
test('cada nova rodada atualiza tentativa sem alterar publicação original', async () => {
  const x = setup(); const first = await x.run()
  x.setNow(NOW + 60_000)
  const second = await x.run({ runId: 'second-run', previousFeed: first.feed })
  assert.equal(second.state.sources.mapa.checkedAt, '2026-11-05T12:01:00.000Z')
  assert.equal(second.feed.topics.agricultura.items[0].publishedAt, '2026-11-04T09:00:00Z')
})
test('fontes bloqueadas/pendentes ignoradas mesmo quando feed público falsamente diz sucesso', async () => {
  const x = setup({ sourceIds: ['anvisa', 'ibge', 'anatel', 'mec', 'mtur', 'bcb'] })
  const publicFeed = structuredClone(x.options.previousFeed)
  for (const key of x.options.sourceIds) publicFeed.sourceStates[key] = { accessSuspended: false, status: 'ok', checkedAt: new Date(NOW).toISOString(), lastSuccessAt: new Date(NOW).toISOString() }
  const result = await x.run({ previousFeed: publicFeed })
  assert.equal(result.status, 'suspended'); assert.equal(x.transport.calls.length, 0); assert.equal(x.store.writes, 0)
})
for (const [name, change, expectedCalls] of [
  ['401', f => { f[mapa.url].status = 401 }, 2],
  ['403', f => { f[mapa.url].status = 403 }, 2],
  ['429', f => { f[mapa.url].status = 429 }, 2],
  ['redirect', f => { f[mapa.url].status = 302 }, 2],
  ['challenge', f => { f[mapa.url].body = 'Testing whether you are a human. Your support ID is 42' }, 2],
  ['robots disallow', f => { f[mapa.robotsUrl].body = 'User-agent: *\nDisallow: /' }, 1],
  ['robots malformed', f => { f[mapa.robotsUrl].body = 'User-agent: *\nUnknown: all' }, 1],
  ['license', f => { f[mapa.url].body = '<h1>Listing</h1>' }, 2],
  ['article license', f => { f[link].body = '<h1>Agricultura</h1>' }, 3],
  ['timeout', f => { f[mapa.url] = { error: 'network_timeout' } }, 2],
  ['500', f => { f[mapa.url].status = 500 }, 2],
  ['no candidates', f => { f[mapa.url].body = CC_BY_ND_3 }, 2],
  ['invalid date', f => { f[link].body = article.replace('2026-11-04T09:00:00Z', '2027-01-01T09:00:00Z') }, 3],
  ['oversized response', f => { f[mapa.url].body = 'a'.repeat(3_000_001) }, 2],
]) test(`${name}: suspensão durável imediata, sem retry e sem acessar próxima fonte`, async () => {
  const response = fixtures(); change(response)
  const state = createSimulationState({ now: NOW, approvedIds: ['mapa', 'antt'] })
  const x = setup({ state, response, sourceIds: ['mapa', 'antt'] }), result = await x.run()
  assert.equal(result.status, 'partial'); assert.equal(x.transport.calls.length, expectedCalls)
  assert.ok(x.store.state.sources.mapa.block); assert.equal(x.store.state.sources.mapa.lastSuccessAt, null)
  assert.equal(x.store.state.sources.antt.checkedAt, null)
  const blockingIndex = x.store.history.findIndex(s => s.sources.mapa.block)
  assert.ok(blockingIndex > 0)
  assert.equal(x.store.history[blockingIndex - 1].sources.mapa.request !== null || name.startsWith('robots'), true)
  const before = x.transport.calls.length
  const retry = await x.run({ runId: 'next-run', sourceIds: ['mapa'] })
  assert.equal(retry.status, 'suspended'); assert.equal(x.transport.calls.length, before)
})
for (const storage of [{ beforeWrite: 1 }, { afterWrite: 1 }, { beforeWrite: 2 }, { afterWrite: 2 }, { readFailure: 3 }, { unconfirmedRead: 3 }, { badAck: 2 }]) test(`crash/falha antes do acesso ${JSON.stringify(storage)} é fechado`, async () => {
  const x = setup({ storage }); await assert.rejects(x.run(), /state_commit_failed_closed/)
  assert.equal(x.transport.calls.length, 0); assert.equal(x.publisher.calls, 0)
  if (x.store.state.run) { await assert.rejects(x.run({ runId: 'restart' }), /unfinished_run_requires_authorized_review/); assert.equal(x.transport.calls.length, 0) }
})
for (const storage of [{ beforeWrite: 5 }, { afterWrite: 5 }]) test(`falha ao persistir 403 ${JSON.stringify(storage)} nunca libera retomada`, async () => {
  const response = fixtures(); response[mapa.url].status = 403
  const x = setup({ response, storage }); await assert.rejects(x.run(), /state_commit_failed_closed/)
  assert.equal(x.transport.calls.length, 2); assert.equal(x.store.writes, 5, 'nenhuma repetição automática da gravação')
  assert.ok(x.store.state.run); assert.ok(x.store.state.sources.mapa.request || x.store.state.sources.mapa.block)
  await assert.rejects(x.run({ runId: 'restart' }), /unfinished_run_requires_authorized_review/)
  assert.equal(x.transport.calls.length, 2)
})
test('perda de persistência depois de matéria válida conserva in_flight e impede nova coleta', async () => {
  const x = setup({ storage: { beforeWrite: 7 } })
  await assert.rejects(x.run(), /state_commit_failed_closed/)
  assert.equal(x.transport.calls.length, 3); assert.ok(x.store.state.sources.mapa.request)
  assert.equal(x.store.state.sources.mapa.lastSuccessAt, null)
  await assert.rejects(x.run({ runId: 'restart' }), /unfinished_run_requires_authorized_review/)
})
for (const publication of ['rejected', 'uncertain']) test(`publicação ${publication} não apaga estado nem dispara nova coleta`, async () => {
  const x = setup({ publication })
  await assert.rejects(x.run(), /publication_/)
  assert.equal(x.transport.calls.length, 3); assert.equal(x.publisher.calls, 1)
  assert.equal(x.store.state.feed.status, 'in_flight'); assert.equal(x.store.state.feed.publishedAt, null)
  assert.ok(x.store.state.sources.mapa.lastSuccessAt)
  await assert.rejects(x.run({ runId: 'restart' }), /unfinished_run_requires_authorized_review/)
  assert.equal(x.transport.calls.length, 3); assert.equal(x.publisher.calls, 1)
})
test('publicação confirmada mas confirmação final perdida não inventa sucesso nem repete publicação', async () => {
  const x = setup({ storage: { beforeWrite: 11 } })
  await assert.rejects(x.run(), /state_commit_failed_closed/)
  assert.equal(x.publisher.calls, 1); assert.ok(x.publisher.payload)
  assert.equal(x.store.state.feed.status, 'in_flight'); assert.equal(x.store.state.feed.publishedAt, null)
  await assert.rejects(x.run({ runId: 'restart' }), /unfinished_run_requires_authorized_review/)
  assert.equal(x.publisher.calls, 1)
})
test('concorrência CAS permite uma rodada e não repete requisições', async () => {
  const x = setup()
  const result = await Promise.allSettled([x.run({ runId: 'worker-a' }), x.run({ runId: 'worker-b' })])
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(result.filter(r => r.status === 'rejected').length, 1)
  assert.equal(x.transport.calls.length, 3); assert.equal(x.publisher.calls, 1)
})
test('reset de bloqueio e retrocesso de datas são rejeitados pelas transições', () => {
  const old = createSimulationState({ now: NOW })
  const next = structuredClone(old); next.revision++
  next.sources.mapa.status = 'ready'; next.sources.mapa.block = null
  assert.throws(() => validateTransition(old, next), /block_cannot_be_cleared/)
  next.sources.mapa = structuredClone(old.sources.mapa); next.updatedAt = '2026-11-04T00:00:00Z'
  assert.throws(() => validateTransition(old, next), /state_invalid/)
})
test('janela móvel descarta notícia vencida sem alterar data de publicação', async () => {
  const response = fixtures(); response[link].body = article.replace('2026-11-04T09:00:00Z', new Date(NOW - SECTOR_NEWS_WINDOW_MS - 1).toISOString())
  const x = setup({ response }), result = await x.run()
  assert.equal(result.feed.topics.agricultura.items.length, 0)
  assert.equal(result.feed.collectionPolicy.noMinimumCount, true)
})
test('pacing e orçamento não podem ser ignorados pelo relógio simulado', async () => {
  const x = setup(); const result = await x.run({ sleep: async () => {} })
  assert.equal(x.transport.calls.length, 1); assert.equal(result.status, 'partial')
  const y = setup(); const expired = await y.run({ sleep: async () => y.setNow(NOW + 600_001) })
  assert.equal(y.transport.calls.length, 1); assert.equal(expired.state.sources.mapa.block.code, 'budget_exhausted')
})

async function local(t) {
  const root = await mkdtemp(join(tmpdir(), 'sector-safe-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const checkoutDirectory = join(root, 'checkout'), feedDirectory = join(root, 'feed'), directory = join(root, 'state')
  await mkdir(checkoutDirectory); await mkdir(feedDirectory)
  const seed = createSimulationState({ approvedIds: ['mapa'], now: NOW })
  const identity = await initializeLocalSimulationStore({ directory, checkoutDirectory, feedDirectory, state: seed })
  const options = { ...identity, checkoutDirectory, feedDirectory }
  return { root, directory, seed, options, store: await createLocalStateStore(options) }
}
test('journal real em disco: reabertura preserva histórico versionado, identidade e resultado', async t => {
  const l = await local(t), x = setup()
  const result = await x.run({ store: l.store })
  const reopened = await createLocalStateStore(l.options), read = await reopened.read()
  assert.equal(read.state.feed.status, 'published'); assert.equal(digest(read.state), digest(result.state))
  const revisions = (await readdir(l.directory)).filter(n => n.startsWith('revision-'))
  assert.equal(revisions.length, read.state.revision + 1)
  assert.ok(!(await readdir(l.directory)).includes('LOCK'))
  assert.notEqual(l.directory, l.options.feedDirectory)
})
test('journal: bloco persistido sobrevive a novo processo lógico', async t => {
  const l = await local(t), response = fixtures(); response[mapa.url].status = 403
  const x = setup({ response }); await x.run({ store: l.store })
  const reopened = await createLocalStateStore(l.options)
  const before = x.transport.calls.length
  assert.equal((await x.run({ store: reopened, runId: 'restart' })).status, 'suspended')
  assert.equal(x.transport.calls.length, before)
})
test('journal: LOCK de processo interrompido nunca expira nem é roubado', async t => {
  const l = await local(t); await writeFile(join(l.directory, 'LOCK'), '{"interrupted":true}')
  await assert.rejects(l.store.read(), /writer_or_crash_requires_review/)
  const x = setup(); await assert.rejects(x.run({ store: l.store }), /writer_or_crash_requires_review/)
  assert.equal(x.transport.calls.length, 0)
})
test('journal: conflito CAS falha fechado e exige revisão em vez de sobrescrever estado', async t => {
  const l = await local(t), first = await l.store.read()
  const next = structuredClone(first.state); next.revision++
  await l.store.compareAndSwap(first.token, next)
  await assert.rejects(l.store.compareAndSwap(first.token, next), /state_cas_conflict/)
  await assert.rejects(l.store.read(), /writer_or_crash_requires_review/)
})
test('journal: head ausente/corrompido, revisão adulterada e root diferente são recusados', async t => {
  const l = await local(t), path = join(l.directory, 'HEAD.json'), original = await readFile(path, 'utf8')
  await rm(path); await assert.rejects(l.store.read(), /ENOENT/)
  await writeFile(path, '{broken'); await assert.rejects(l.store.read())
  await writeFile(path, original)
  const wrong = await createLocalStateStore({ ...l.options, rootToken: '0-' + '0'.repeat(64) })
  await assert.rejects(wrong.read(), /state_head_invalid/)
  const head = JSON.parse(original), revision = join(l.directory, `revision-${head.token}.json`), data = JSON.parse(await readFile(revision, 'utf8'))
  data.state.sources.mapa.reason = 'tampered'
  await writeFile(revision, JSON.stringify(data))
  await assert.rejects(l.store.read(), /state_integrity_or_identity_error/)
})
test('journal: raiz/histórico ausente não vira inicialização vazia', async t => {
  const l = await local(t), first = await l.store.read(), next = structuredClone(first.state); next.revision++
  await l.store.compareAndSwap(first.token, next)
  await rm(join(l.directory, `revision-${l.options.rootToken}.json`))
  await assert.rejects(l.store.read(), /ENOENT/)
  await assert.rejects(initializeLocalSimulationStore({ ...l.options, state: l.seed }), /EEXIST/)
})
test('journal: nunca armazenado dentro de checkout, feed ou alias por symlink', async t => {
  const l = await local(t)
  for (const directory of [join(l.options.checkoutDirectory, 'state'), join(l.options.feedDirectory, 'state'), join(l.options.checkoutDirectory, '..journal'), join(l.options.feedDirectory, '..journal')]) await assert.rejects(initializeLocalSimulationStore({ ...l.options, directory, state: l.seed }), /state_must_be_separate/)
  const alias = join(l.root, 'alias'); await symlink(l.options.feedDirectory, alias)
  await assert.rejects(initializeLocalSimulationStore({ ...l.options, directory: join(alias, 'state'), state: l.seed }), /state_must_be_separate/)
})

for (const kind of ['robots', 'origin']) test(`bloqueio compartilhado ${kind} impede outra fonte em nova rodada`, async () => {
  const response = fixtures(); response[kind === 'robots' ? mapa.robotsUrl : mapa.url].status = 403
  const state = createSimulationState({ now: NOW, approvedIds: ['mapa', 'antt'] })
  const x = setup({ state, response })
  await x.run()
  const count = x.transport.calls.length
  const next = await x.run({ runId: 'different-source', sourceIds: ['antt'] })
  assert.equal(next.status, 'suspended'); assert.equal(x.transport.calls.length, count)
  assert.ok(x.store.state.sharedBlocks['https://www.gov.br'])
  if (kind === 'robots') assert.ok(x.store.state.sharedBlocks[mapa.robotsUrl])
  const before = x.store.state, after = structuredClone(before); after.revision++; after.sharedBlocks['https://www.gov.br'] = null
  assert.throws(() => validateTransition(before, after), /shared_block_cannot_be_cleared/)
})
test('negação posterior preserva itens válidos e último sucesso, sem renová-lo pela falha', async () => {
  const response = fixtures(), second = link + '-segunda'
  response[mapa.url].body += `<a href="${second}">Agricultura publica segunda regra para safra</a>`
  response[second] = { status: 403, body: 'Forbidden' }
  const x = setup({ response }), result = await x.run()
  assert.equal(result.status, 'partial'); assert.equal(x.transport.calls.length, 4)
  assert.equal(result.state.sources.mapa.lastSuccessAt, '2026-11-05T12:00:02.200Z')
  assert.equal(result.state.sources.mapa.block.detectedAt, '2026-11-05T12:00:03.300Z')
  assert.equal(result.feed.topics.agricultura.items.length, 1)
  assert.equal(result.feed.sourceStates.mapa.status, 'failed')
})
test('nova publicação incerta mantém última confirmação separada do candidato', async () => {
  const x = setup(), first = await x.run(), last = first.state.feed.lastPublication
  x.setNow(NOW + 60_000)
  await assert.rejects(x.run({ runId: 'uncertain-second', publisher: createFixturePublisher({ result: 'uncertain' }) }), /publication_outcome_uncertain/)
  assert.deepEqual(x.store.state.feed.lastPublication, last)
  assert.equal(x.store.state.feed.publishedAt, null); assert.equal(x.store.state.feed.receipt, null)
  assert.notEqual(x.store.state.feed.digest, last.digest)
})
test('journal: rollback de HEAD com histórico posterior presente falha fechado', async t => {
  const l = await local(t), headPath = join(l.directory, 'HEAD.json'), before = await readFile(headPath, 'utf8')
  const x = setup(); await x.run({ store: l.store })
  await writeFile(headPath, before)
  await assert.rejects(l.store.read(), /state_orphan_or_rollback_requires_review/)
})
test('crash de processo após in_flight durável e antes de acesso impede reinício', async t => {
  const l = await local(t)
  const module = new URL('../scripts/sector-news-safe/local-state-store.mjs', import.meta.url).href
  const code = `import { createLocalStateStore } from ${JSON.stringify(module)}; const store = await createLocalStateStore(${JSON.stringify(l.options)}); const old = await store.read(); const next = structuredClone(old.state); next.revision++; next.run = { id: 'crashed-worker', status: 'in_flight', startedAt: next.updatedAt, requests: 0, sourceIds: ['mapa'] }; await store.compareAndSwap(old.token, next); process.exit(23);`
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' })
  assert.equal(child.status, 23, child.stderr)
  const reopened = await createLocalStateStore(l.options), x = setup()
  await assert.rejects(x.run({ store: reopened }), /unfinished_run_requires_authorized_review/)
  assert.equal(x.transport.calls.length, 0)
})
test('metadados de publicação e request incoerentes não são aceitos como estado válido', async () => {
  const x = setup(); const result = await x.run()
  const mutations = [
    s => { s.feed.generatedAt = '2027-01-01T00:00:00Z' },
    s => { s.feed.publishedAt = '2027-01-01T00:00:00Z' },
    s => { s.feed.generatedAt = s.feed.publishedAt; s.feed.publishedAt = '2026-11-04T00:00:00Z' },
    s => { s.feed.status = 'prepared' },
    s => { s.feed.lastPublication = null },
    s => { s.feed.receipt = null },
  ]
  for (const mutate of mutations) { const state = structuredClone(result.state); mutate(state); assert.throws(() => validateState(state), /state_invalid/) }
  const pending = x.store.history.find(s => s.sources.mapa.request)
  const badRequest = structuredClone(pending); badRequest.sources.mapa.request.startedAt = '2027-01-01T00:00:00Z'
  assert.throws(() => validateState(badRequest), /request/)
  const badRun = structuredClone(pending); badRun.run.startedAt = '2027-01-01T00:00:00Z'
  assert.throws(() => validateState(badRun), /run/)
})
test('robots compartilhado é lido uma vez por rodada e fontes planejadas ficam versionadas', async () => {
  const antt = SECTOR_NEWS_SOURCES.find(s => s.id === 'antt'), anttLink = `${antt.articlePrefix}regra-sobre-transporte-de-cargas-2026`
  const response = fixtures()
  response[antt.url] = { status: 200, body: `<a href="${anttLink}">Regra sobre transporte de cargas</a>${CC_BY_ND_3}` }
  response[anttLink] = { status: 200, body: article.replace('Agricultura publica regra para safra', 'Regra sobre transporte de cargas') }
  const state = createSimulationState({ now: NOW, approvedIds: ['mapa', 'antt'] })
  const x = setup({ state, response, sourceIds: ['mapa', 'antt'] })
  const result = await x.run()
  assert.equal(result.status, 'simulated'); assert.equal(x.transport.calls.length, 5)
  assert.equal(x.transport.calls.filter(url => url === mapa.robotsUrl).length, 1)
  assert.deepEqual(x.store.history[1].run.sourceIds, ['mapa', 'antt'])
})
test('limite de 40 matérias não requisita o 41º candidato', async () => {
  const response = fixtures(); response[mapa.url].body = CC_BY_ND_3
  for (let i = 0; i < 41; i++) {
    const url = `${link}-${i}`
    response[mapa.url].body += `<a href="${url}">Agricultura publica regra ${i} para safra</a>`
    if (i < 40) response[url] = { status: 200, body: article.replace('Agricultura publica regra para safra', `Agricultura publica regra ${i} para safra`) }
  }
  const x = setup({ response }); const result = await x.run()
  assert.equal(result.status, 'simulated'); assert.equal(x.transport.calls.length, 42)
  assert.ok(!x.transport.calls.includes(`${link}-40`))
})

test('persistência lenta não permite request depois do orçamento total', async () => {
  const x = setup()
  const store = { ...x.store, compareAndSwap: async (token, state) => {
    const result = await x.store.compareAndSwap(token, state)
    if (state.sources.mapa.request) x.setNow(NOW + 600_001)
    return result
  } }
  const result = await x.run({ store })
  assert.equal(result.status, 'partial'); assert.equal(x.transport.calls.length, 0)
  assert.equal(result.state.sources.mapa.block.code, 'budget_exhausted')
})


test('publicação entre cinco e sete dias é descartada sem suspender fonte por parser', async () => {
  const response = fixtures()
  response[link].body = article.replace('2026-11-04T09:00:00Z', new Date(NOW - 6 * 864e5).toISOString())
  const x = setup({ response }), result = await x.run()
  assert.equal(result.status, 'simulated')
  assert.equal(result.feed.topics.agricultura.items.length, 0)
  assert.equal(result.state.sources.mapa.status, 'ready')
  assert.equal(result.state.sources.mapa.block, null)
  assert.ok(result.state.sources.mapa.lastSuccessAt)
  assert.equal(result.feed.collectionPolicy.windowHours, 120)
})

test('ANEEL e Susep continuam sem requests ou publicação após instalar adaptador de descoberta', async () => {
  const x = setup({ sourceIds: ['aneel', 'susep'] })
  const before = x.store.state
  const result = await x.run()
  assert.equal(result.status, 'suspended')
  assert.deepEqual(result.skipped, ['aneel', 'susep'])
  assert.equal(x.transport.calls.length, 0)
  assert.equal(x.publisher.calls, 0)
  assert.equal(x.store.writes, 0)
  assert.deepEqual(x.store.state, before)
})
