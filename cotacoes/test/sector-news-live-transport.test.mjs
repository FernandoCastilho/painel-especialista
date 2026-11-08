import test from 'node:test'
import assert from 'node:assert/strict'
import { createLiveTransport, isLiveTransport, LIVE_RESPONSE_BYTES } from '../scripts/sector-news-safe/live-transport.mjs'
import { ploneDiscoveryUrl } from '../scripts/sector-news-safe/plone-discovery.mjs'
import { SECTOR_NEWS_SOURCES } from '../src/sectorNews.js'
const source = SECTOR_NEWS_SOURCES.find(source => source.id === 'mapa')
const make = () => createLiveTransport({ sourceIds: ['mapa'] })
function mockFetch(t, fetch) { const saved = globalThis.fetch; globalThis.fetch = fetch; t.after(() => { globalThis.fetch = saved }) }
const response = (body, options = {}) => new Response(body, { status: 200, ...options })

test('closed transport only accepts reviewed transport candidates and no injected callbacks', () => {
  for (const id of ['mapa', 'antt', 'mdic', 'anp', 'anm', 'ana', 'cvm', 'ans', 'ipen', 'aneel', 'susep']) assert.ok(isLiveTransport(createLiveTransport({ sourceIds: [id] })))
  for (const ids of [[], ['anvisa'], ['mapa', 'mapa'], ['unknown']]) assert.throws(() => createLiveTransport({ sourceIds: ids }))
  assert.throws(() => createLiveTransport({ sourceIds: ['mapa'], fetch: () => {} }))
  assert.equal(isLiveTransport({ request() {} }), false)
  assert.equal(Object.isFrozen(make()), true)
})

test('rejects every URL escape before fetch, including unselected sources', async t => {
  let calls = 0
  mockFetch(t, async () => { calls++; return response('ok') })
  const transport = make()
  for (const url of ['http://www.gov.br/robots.txt', 'https://gov.br/robots.txt', 'https://www.gov.br:443/robots.txt', 'https://u:p@www.gov.br/robots.txt', source.url + '?x=1', source.url + '#x', source.articlePrefix + '%2fescape', source.articlePrefix + '%41', source.articlePrefix + '../escape', source.articlePrefix + 'x\\z', source.articlePrefix + '@@view', source.articlePrefix + 'login', SECTOR_NEWS_SOURCES.find(s => s.id === 'anp').url, 'https://www.gov.br.example.test/robots.txt']) await assert.rejects(transport.request(url), /url_outside/)
  assert.equal(calls, 0)
})

test('requests only approved listing/article/robots with manual redirects and no retries', async t => {
  const calls = []
  mockFetch(t, async (url, options) => { calls.push([url, options]); return response('conteúdo') })
  const transport = make()
  for (const url of [source.url, source.articlePrefix + 'noticia-institucional-aprovada', source.robotsUrl]) assert.deepEqual(await transport.request(url), { status: 200, body: 'conteúdo' })
  assert.equal(calls.length, 3)
  for (const [, options] of calls) { assert.equal(options.redirect, 'manual'); assert.equal(options.credentials, 'omit'); assert.ok(options.signal.aborted) }
})

test('returns denial and redirect statuses for durable runner suspension without following', async t => {
  let calls = 0, status = 403
  mockFetch(t, async () => { calls++; return response('denied', { status }) })
  const transport = make()
  for (const code of [301, 302, 401, 403, 429, 503]) { status = code; assert.deepEqual(await transport.request(source.url), { status: code, body: '' }) }
  assert.equal(calls, 6)
})

test('rejects oversized content length and streaming bytes without buffering whole response', async t => {
  let canceled = 0, mode = 'length'
  mockFetch(t, async () => mode === 'length' ? response('small', { headers: { 'content-length': String(LIVE_RESPONSE_BYTES + 1) } }) : response(new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(1_000_001)) }, cancel() { canceled++ } })))
  const transport = make()
  await assert.rejects(transport.request(source.url), /response_too_large/)
  mode = 'stream'
  await assert.rejects(transport.request(source.url), /response_too_large/)
  assert.ok(canceled > 0)
})

test('15 second deadline includes a stalled body and aborts/cancels it', async t => {
  let signal, canceled = 0
  mockFetch(t, async (_, options) => { signal = options.signal; return response(new ReadableStream({ pull() { return new Promise(() => {}) }, cancel() { canceled++ } })) })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const pending = make().request(source.url)
  await new Promise(resolve => setImmediate(resolve))
  t.mock.timers.tick(15_000)
  await assert.rejects(pending, /request_timeout/)
  assert.equal(signal.aborted, true)
  assert.equal(canceled, 1)
})

test('preserves challenge and licence markup for runner inspection and rejects an unexpectedly followed URL', async t => {
  const html = '<script>captcha</script><h1>Access denied</h1><a href="https://creativecommons.org/licenses/by-nd/3.0/">license</a>'
  let followed = false
  mockFetch(t, async () => followed ? { status: 200, redirected: true, url: 'https://other.test/', body: null } : response(html))
  const transport = make()
  assert.equal((await transport.request(source.url)).body, html)
  followed = true
  await assert.rejects(transport.request(source.url), /redirect_requires_review/)
})

test('network failure makes one attempt and the deadline also covers pending response headers', async t => {
  let calls = 0, stalled = false, signal
  mockFetch(t, async (_, options) => {
    calls++; signal = options.signal
    if (stalled) return new Promise(() => {})
    throw Error('network unavailable')
  })
  const transport = make()
  await assert.rejects(transport.request(source.url), /network unavailable/)
  assert.equal(calls, 1)
  stalled = true
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const pending = transport.request(source.url)
  t.mock.timers.tick(15_000)
  await assert.rejects(pending, /request_timeout/)
  assert.equal(calls, 2)
  assert.equal(signal.aborted, true)
})

for (const id of ['aneel', 'susep']) test(`${id}: exact discovery URL uses bounded existing transport without broader API access`, async t => {
  const calls = []
  mockFetch(t, async (url, options) => { calls.push([url, options]); return response('{"items":[]}') })
  const transport = createLiveTransport({ sourceIds: [id] })
  const url = ploneDiscoveryUrl(id)
  assert.equal((await transport.request(url)).status, 200)
  assert.equal(calls[0][1].headers.accept, 'application/json')
  assert.equal(calls[0][1].redirect, 'manual')
  assert.equal(calls[0][1].credentials, 'omit')
  for (const invalid of [url + '&b_start=5', url + '#x', url.replace('b_size%22%3A5', 'b_size%22%3A30'), ploneDiscoveryUrl(id === 'aneel' ? 'susep' : 'aneel')]) await assert.rejects(transport.request(invalid), /url_outside/)
  assert.equal(calls.length, 1)
})

for (const id of ['aneel', 'susep']) test(`${id}: discovery preserves denial and redirect outcomes without following or retry`, async t => {
  let status = 403, calls = 0
  mockFetch(t, async () => { calls++; return response('', { status }) })
  const transport = createLiveTransport({ sourceIds: [id] })
  for (const code of [301, 403, 429]) {
    status = code
    assert.deepEqual(await transport.request(ploneDiscoveryUrl(id)), { status: code, body: '' })
  }
  assert.equal(calls, 3)
})
