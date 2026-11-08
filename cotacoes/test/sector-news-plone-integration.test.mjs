import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Hypothetical post-review state is tested ONLY in an ephemeral module tree.
// No production state, registry, journal, source selection or checkout file is changed.
// The only substitution removes the two parser holds in the copied state module.
// This is integration coverage, not evidence of production approval or publication.
const root = await mkdtemp(join(tmpdir(), 'plone-integration-fixture-'))
await cp(new URL('../src/', import.meta.url), join(root, 'src'), { recursive: true })
await cp(new URL('../scripts/', import.meta.url), join(root, 'scripts'), { recursive: true })
await writeFile(join(root, 'package.json'), '{"type":"module"}')
const statePath = join(root, 'scripts/sector-news-safe/state.mjs')
let stateCode = await readFile(statePath, 'utf8')
for (const id of ['aneel', 'susep']) {
  const line = `  ${id}: 'parser_review_required',\n`
  assert.equal(stateCode.split(line).length, 2)
  stateCode = stateCode.replace(line, '')
}
await writeFile(statePath, stateCode)
const load = path => import(pathToFileURL(join(root, path)))
const { createSimulationState, validateTransition, digest, STATE_REF } = await load('scripts/sector-news-safe/state.mjs')
const { createFixtureTransport, createFixturePublisher } = await load('scripts/sector-news-safe/fixtures.mjs')
const { runSectorNewsSimulation } = await load('scripts/sector-news-safe/runner.mjs')
const { ploneDiscoveryUrl } = await load('scripts/sector-news-safe/plone-discovery.mjs')
const { makeSectorNewsFile } = await load('scripts/sector-news-lib.mjs')
const { SECTOR_NEWS_SOURCES, CC_BY_ND_3 } = await load('src/sectorNews.js')
test.after(async () => { await rm(root, { recursive: true, force: true }) })
const NOW = Date.parse('2026-11-08T18:00:00Z')
function setup(id, { fail, publication = 'confirmed', uncertainWrite = false, previousConfirmed = false } = {}) {
  let now = NOW, token = 'v0', writes = 0
  let state = createSimulationState({ approvedIds: [id], now, storeId: 'isolated-parser-review' })
  const source = SECTOR_NEWS_SOURCES.find(s => s.id === id)
  const title = id === 'aneel' ? 'ANEEL publica tarifa de energia elétrica' : 'Susep publica regras para seguradoras'
  const link = source.articlePrefix + '2026/fixture-offline-article'
  const discoveryUrl = ploneDiscoveryUrl(id)
  const listing = `${CC_BY_ND_3}<h1>Notícias</h1>`
  const discovery = JSON.stringify({ '@id': source.url + '/@querystring-search', items_total: 1,
    items: [{ '@id': link, '@type': 'News Item', review_state: 'published', title }] })
  const responses = {
    [source.robotsUrl]: { status: 200, body: 'User-agent: *\nDisallow:\n' },
    [source.url]: { status: 200, body: listing },
    [discoveryUrl]: { status: 200, body: discovery },
    [link]: { status: 200, body: `<h1>${title}</h1><meta property="article:published_time" content="2026-11-06T12:00:00Z">${CC_BY_ND_3}` },
  }
  if (fail) responses[fail.at === 'robots' ? source.robotsUrl : fail.at === 'article' ? link : discoveryUrl] = fail.response
  const transport = createFixtureTransport(responses), publisher = createFixturePublisher({ result: publication })
  const history = [], timeline = []
  const store = { ref: STATE_REF,
    async read() { timeline.push({ kind: 'read', request: state.sources[id].request?.url || null, calls: transport.calls.length }); return { confirmed: true, ref: STATE_REF, token, state: structuredClone(state) } },
    async compareAndSwap(expected, next) {
      assert.equal(expected, token); validateTransition(state, next)
      writes++; state = structuredClone(next); token = `v${writes}`
      history.push(structuredClone(state)); timeline.push({ kind: 'write', request: state.sources[id].request?.url || null, calls: transport.calls.length })
      if (uncertainWrite && state.sources[id].request?.url === discoveryUrl) throw Error('simulated_storage_write_outcome_uncertain')
      return { confirmed: true, ref: STATE_REF, token, state: structuredClone(state) }
    } }
  const oldAt = new Date(NOW - 3600000).toISOString()
  const oldItem = { title, link: source.articlePrefix + '2026/fixture-previous-article', sourceId: id,
    publishedAt: '2026-11-06T10:00:00Z', collectedAt: oldAt, type: 'comunicado', licenseUrl: CC_BY_ND_3 }
  const previousFeed = makeSectorNewsFile({ now, items: previousConfirmed ? [oldItem] : [],
    sourceStates: previousConfirmed ? { [id]: { status: 'partial', checkedAt: oldAt, lastSuccessAt: oldAt } } : {} })
  if (previousConfirmed) {
    state.sources[id].checkedAt = oldAt; state.sources[id].lastCollectedAt = oldAt; state.sources[id].lastSuccessAt = oldAt
    state.feed = { status: 'published', generatedAt: oldAt, publishedAt: oldAt, digest: digest(previousFeed), receipt: 'previous-fixture',
      lastPublication: { publishedAt: oldAt, digest: digest(previousFeed), receipt: 'previous-fixture' } }
  }
  const options = { mode: 'simulation', store, transport, publisher, previousFeed, sourceIds: [id], runId: 'isolated-review', clock: () => now, sleep: async ms => { now += ms } }
  return { transport, publisher, history, timeline, link, discoveryUrl, get state() { return state }, run: () => runSectorNewsSimulation(options) }
}
for (const id of ['aneel', 'susep']) {
  test(`${id}: discovery → journal → original article → confirmed fixture publication`, async () => {
    const x = setup(id), result = await x.run()
    assert.equal(result.status, 'simulated'); assert.equal(result.networkEnabled, false)
    assert.equal(x.transport.calls.length, 4); assert.equal(x.publisher.calls, 1)
    for (const [i, url] of x.transport.calls.entries()) {
      assert.ok(x.timeline.some(e => e.kind === 'write' && e.request === url && e.calls === i))
      assert.ok(x.timeline.some(e => e.kind === 'read' && e.request === url && e.calls === i))
    }
    assert.equal(x.state.feed.status, 'published'); assert.equal(x.state.run, null)
    assert.ok(Object.values(x.publisher.payload.topics).some(topic => topic.items.some(item => item.link === x.link)))
    assert.equal(x.publisher.payload.collectionPolicy.automaticScheduleEnabled, false)
    assert.equal(x.state.sources.anvisa.status, 'suspended'); assert.equal(x.state.sources.mtur.status, 'suspended')
  })
  for (const status of [301, 403, 429]) test(`${id}: discovery HTTP ${status} suspends without article or retry`, async () => {
    const x = setup(id, { fail: { response: { status, body: '' } } }), result = await x.run()
    assert.equal(result.status, 'partial'); assert.equal(x.state.sources[id].status, 'suspended')
    assert.deepEqual(x.transport.calls.filter(url => url === x.discoveryUrl), [x.discoveryUrl])
    assert.equal(x.transport.calls.includes(x.link), false)
    if (status !== 301) assert.ok(x.state.sharedBlocks['https://www.gov.br'])
  })
  for (const response of [{ status: 200, body: '<h1>Access denied</h1>' }, { status: 200, body: '{}' }, { error: 'request_timeout' }]) test(`${id}: discovery failure stops before article`, async () => {
    const x = setup(id, { fail: { response } }); await x.run()
    assert.equal(x.state.sources[id].status, 'suspended'); assert.equal(x.transport.calls.includes(x.link), false)
  })
  test(`${id}: uncertain pre-request journal write prevents discovery and restart`, async () => {
    const x = setup(id, { uncertainWrite: true })
    await assert.rejects(x.run(), /state_commit_failed_closed/)
    assert.equal(x.transport.calls.includes(x.discoveryUrl), false); assert.equal(x.publisher.calls, 0)
    const calls = x.transport.calls.length
    await assert.rejects(x.run(), /unfinished_run/); assert.equal(x.transport.calls.length, calls)
  })
  test(`${id}: uncertain publication remains in flight and cannot repeat`, async () => {
    const x = setup(id, { publication: 'uncertain' })
    await assert.rejects(x.run(), /publication_outcome_uncertain/)
    assert.equal(x.state.feed.status, 'in_flight'); assert.equal(x.state.feed.lastPublication, null)
    await assert.rejects(x.run(), /unfinished_run/); assert.equal(x.publisher.calls, 1)
  })
  test(`${id}: restrictive robots prevents listing and discovery`, async () => {
    const x = setup(id, { fail: { at: 'robots', response: { status: 200, body: 'User-agent: *\nDisallow: /' } } })
    await x.run(); assert.equal(x.transport.calls.length, 1); assert.equal(x.state.sources[id].status, 'suspended')
  })
}

for (const id of ['aneel', 'susep']) test(`${id}: failed discovery preserves previous valid articles and original success date`, async () => {
  const x = setup(id, { previousConfirmed: true, fail: { response: { status: 403, body: '' } } })
  const success = x.state.sources[id].lastSuccessAt
  await x.run()
  assert.equal(x.state.sources[id].lastSuccessAt, success)
  assert.ok(Object.values(x.publisher.payload.topics).some(topic => topic.items.some(item => item.link.endsWith('/fixture-previous-article'))))
})
for (const id of ['aneel', 'susep']) test(`${id}: uncertain publication preserves last confirmed receipt`, async () => {
  const x = setup(id, { previousConfirmed: true, publication: 'uncertain' })
  const last = structuredClone(x.state.feed.lastPublication)
  await assert.rejects(x.run(), /publication_outcome_uncertain/)
  assert.deepEqual(x.state.feed.lastPublication, last)
  assert.equal(x.state.feed.status, 'in_flight')
  await assert.rejects(x.run(), /unfinished_run/)
  assert.equal(x.publisher.calls, 1)
})
