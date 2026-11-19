import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { cnhCross } from '../src/quoteSafety.js'
import { browserClock, hookRenderer, json } from './helpers/hooks.mjs'

let version = 0
async function client() {
  const require = createRequire(import.meta.url)
  let source = await readFile(new URL('../src/useQuotes.js', import.meta.url), 'utf8')
  source = source.replace("from 'react'", `from '${pathToFileURL(require.resolve('react'))}'`)
    .replace("from './visiblePolling.js'", `from '${new URL('../src/visiblePolling.js', import.meta.url)}'`)
    .replace("from './quoteSafety.js'", `from '${new URL('../src/quoteSafety.js', import.meta.url)}'`)
    .replace("from '../scripts/data-schedules.mjs'", `from '${new URL('../scripts/data-schedules.mjs', import.meta.url)}'`)
    .replace('import.meta.env?.VITE_DATA_BASE', "'https://central.example'")
  return import(`data:text/javascript;base64,${Buffer.from(`${source}\n// safety ${++version}`).toString('base64')}`)
}

function batch(at, changes = {}) {
  const values = {
    USDBRL: { bid: '5.4', ask: '5.401', high: '5.5', low: '5.3' },
    EURBRL: { bid: '6.1', ask: '6.101', high: '6.2', low: '6.0' },
    JPYBRL: { bid: '0.035', ask: '0.0351', high: '0.036', low: '0.034' },
    USDCNH: { bid: '6.65', ask: '6.651', high: '6.7', low: '6.6' },
  }
  return Object.fromEntries(Object.entries(values).map(([pair, value]) => [pair, {
    ...value, pctChange: '0', timestamp: String(at / 1000), ...changes[pair],
  }]))
}
const invalidUsd = { bid: '54', ask: '54.01', high: '55', low: '53' }
const freshUsd = { bid: '5.41', ask: '5.411' }
const snapshot = (at, quotes) => ({ generatedAt: at, quotes, cnh: cnhCross(quotes.USDBRL, quotes.USDCNH) })

test('client safety: raw CNH uses USD/CNH validation while USD and JPY use their own ranges', async t => {
  const clock = browserClock(t), q = await client(), rows = batch(clock.now)
  assert.equal(q.toQuote(rows.USDBRL, 'USD').bid, 5.4)
  assert.equal(q.toQuote(rows.JPYBRL, 'JPY').bid, 0.035)
  assert.equal(q.toQuote(rows.USDCNH, 'CNH').bid, 6.65)
  assert.equal(q.toQuote({ ...rows.USDBRL, ...invalidUsd }, 'USD'), null)
})

test('client safety: an invalid or missing spot returns an error without calling BCE', async t => {
  const clock = browserClock(t), q = await client(), urls = []
  const rows = batch(clock.now, { USDBRL: invalidUsd })
  delete rows.JPYBRL
  globalThis.fetch = async url => { urls.push(String(url)); return json(rows) }
  const { results } = await q.fetchQuotes(undefined, { direct: true })
  assert.equal(urls.length, 1)
  assert.match(urls[0], /awesomeapi/)
  assert.ok(!results.USD.quote)
  assert.ok(results.USD.error)
  assert.ok(!results.JPY.quote)
  assert.ok(results.JPY.error)
  assert.ok(!results.CNH.quote)
  assert.ok(results.CNH.error)
  assert.equal(results.EUR.quote.bid, 6.1)
})

test('client safety: HTTP 200 with a malformed payload fails each currency without using BCE', async t => {
  browserClock(t)
  const q = await client(), urls = []
  for (const payload of [null, false, 0, [], 'invalid']) {
    globalThis.fetch = async url => { urls.push(String(url)); return json(payload) }
    const { results } = await q.fetchQuotes(undefined, { direct: true })
    for (const result of Object.values(results)) {
      assert.ok(!result.quote)
      assert.ok(result.error)
    }
  }
  assert.equal(urls.length, 5)
  assert.ok(urls.every(url => url.includes('awesomeapi')))
})

test('client safety: a malformed direct response preserves all previously displayed quotes and dates', async t => {
  const clock = browserClock(t), q = await client(), originalAt = clock.now
  const central = snapshot(originalAt, batch(originalAt)), urls = []
  globalThis.fetch = async url => {
    urls.push(String(url))
    return json(String(url).startsWith('https://central.example') ? central : null)
  }
  const r = hookRenderer(() => q.useQuotes())
  clock.cleanup(() => r.close())
  await r.settle()
  const prices = Object.fromEntries(Object.entries(r.value.quotes).map(([code, quote]) => [code, quote.bid]))
  await clock.advance(1000)
  await r.value.refresh(); await r.settle()
  for (const [code, quote] of Object.entries(r.value.quotes)) {
    assert.equal(quote.bid, prices[code])
    assert.equal(quote.timestamp, originalAt)
    assert.equal(quote.stale, true)
    assert.ok(quote.error)
  }
  assert.equal(r.value.updatedAt.getTime(), originalAt)
  assert.ok(r.value.error)
  assert.ok(urls.every(url => !url.includes('frankfurter')))
})

test('client safety: direct rejection and repeated central retention preserve dates, then recovery clears warnings', async t => {
  const clock = browserClock(t), q = await client(), originalAt = clock.now
  const originalRows = batch(originalAt), original = snapshot(originalAt, originalRows)
  let central = original, direct = batch(originalAt, { USDBRL: invalidUsd, EURBRL: { bid: '6.12', ask: '6.121' } })
  const urls = []
  globalThis.fetch = async url => {
    urls.push(String(url))
    return json(String(url).startsWith('https://central.example') ? central : direct)
  }
  const r = hookRenderer(() => q.useQuotes())
  clock.cleanup(() => r.close())
  await r.settle()
  const originalCnh = r.value.quotes.CNH
  await clock.advance(1000)
  direct = batch(clock.now, { USDBRL: invalidUsd, EURBRL: { bid: '6.12', ask: '6.121' } })
  await r.value.refresh(); await r.settle()
  assert.equal(r.value.quotes.USD.bid, 5.4)
  assert.equal(r.value.quotes.USD.timestamp, originalAt)
  assert.equal(r.value.quotes.USD.stale, true)
  assert.ok(r.value.errors.USD)
  assert.equal(r.value.quotes.CNH.bid, originalCnh.bid)
  assert.equal(r.value.quotes.CNH.timestamp, originalAt)
  assert.equal(r.value.quotes.CNH.stale, true)
  assert.equal(r.value.quotes.EUR.bid, 6.12)

  for (let attempt = 0; attempt < 2; attempt++) {
    await clock.advance(1000)
    central = {
      generatedAt: clock.now,
      quotes: batch(clock.now, { USDBRL: { ...originalRows.USDBRL, stale: true, error: 'USDBRL: valor rejeitado' } }),
      cnh: { ...original.cnh, stale: true, error: 'USDBRL: valor rejeitado' },
      rejected: { USDBRL: 'USDBRL: valor rejeitado' },
    }
    await r.value.reload(); await r.settle()
    assert.equal(r.value.quotes.USD.timestamp, originalAt)
    assert.equal(r.value.quotes.USD.bid, 5.4)
    assert.equal(r.value.quotes.USD.stale, true)
    assert.equal(r.value.quotes.CNH.timestamp, originalAt)
    assert.equal(r.value.quotes.CNH.bid, originalCnh.bid)
    assert.equal(r.value.quotes.CNH.stale, true)
  }

  await clock.advance(1000)
  central = snapshot(clock.now, batch(clock.now, { USDBRL: freshUsd }))
  await r.value.reload(); await r.settle()
  assert.equal(r.value.quotes.USD.bid, 5.41)
  assert.equal(r.value.quotes.USD.timestamp, clock.now)
  assert.notEqual(r.value.quotes.USD.stale, true)
  assert.ok(!r.value.quotes.USD.error)
  assert.ok(!r.value.errors.USD)
  assert.equal(r.value.quotes.CNH.timestamp, clock.now)
  assert.notEqual(r.value.quotes.CNH.stale, true)
  assert.ok(!r.value.quotes.CNH.error)
  assert.ok(urls.every(url => !url.includes('frankfurter')))
})

test('client safety: plausible central CNH with an invalid raw leg is retained with a warning', async t => {
  const clock = browserClock(t), q = await client(), rows = batch(clock.now)
  const central = snapshot(clock.now, rows)
  central.quotes = batch(clock.now, { USDBRL: invalidUsd })
  globalThis.fetch = async () => json(central)
  const { results } = await q.fetchQuotes()
  assert.ok(results.USD.error)
  assert.equal(results.CNH.quote.bid, central.cnh.bid)
  assert.equal(results.CNH.quote.stale, true)
  assert.ok(results.CNH.quote.error)
})

test('CNH legado só usa a nova variação quando as pontas correspondem à cotação', async t => {
  const clock = browserClock(t), q = await client()
  const rows = batch(clock.now, {
    USDBRL: { bid: '5.1', ask: '5.12', low: '5', high: '5.2', varBid: '0.10', pctChange: '2' },
    USDCNH: { bid: '6.86', ask: '6.93', low: '6.8', high: '7', varBid: '-0.14', pctChange: '-2' },
  })
  const central = snapshot(clock.now, rows)
  const { cnh } = central
  delete cnh.previousBid
  cnh.pct = 4
  cnh.delta = null
  globalThis.fetch = async () => json(central)

  const fresh = (await q.fetchQuotes()).results.CNH.quote
  assert.equal(fresh.bid, cnh.bid)
  assert.equal(fresh.pct.toFixed(2), '4.08')
  assert.equal(fresh.delta, fresh.bid - fresh.previousBid)

  central.quotes = batch(clock.now, { USDBRL: invalidUsd })
  const retained = (await q.fetchQuotes()).results.CNH.quote
  assert.equal(retained.bid, cnh.bid)
  assert.equal(retained.timestamp, cnh.timestamp)
  assert.equal(retained.stale, true)
  assert.equal(retained.delta, null)
  assert.equal(retained.pct, null)
})

test('client safety: an older valid central response cannot clear a newer local rejection warning', async t => {
  const clock = browserClock(t), q = await client(), sourceAt = clock.now
  let central = snapshot(sourceAt, batch(sourceAt))
  globalThis.fetch = async url => json(String(url).startsWith('https://central.example')
    ? central : batch(clock.now, { USDBRL: invalidUsd }))
  const r = hookRenderer(() => q.useQuotes())
  clock.cleanup(() => r.close())
  await r.settle()
  await clock.advance(1000)
  await r.value.refresh(); await r.settle()
  const updatedAt = r.value.updatedAt.getTime()
  const warning = r.value.quotes.USD.error
  await clock.advance(1000)
  central = snapshot(clock.now, batch(sourceAt - 3600000, { USDBRL: { bid: '5.3', ask: '5.301' } }))
  await r.value.reload(); await r.settle()
  assert.equal(r.value.quotes.USD.bid, 5.4)
  assert.equal(r.value.quotes.USD.timestamp, sourceAt)
  assert.equal(r.value.quotes.USD.stale, true)
  assert.equal(r.value.quotes.USD.error, warning)
  assert.equal(r.value.errors.USD, warning)
  assert.equal(r.value.updatedAt.getTime(), updatedAt)
})

test('client safety: a response consisting of retained quotes does not renew the last update date', async t => {
  const clock = browserClock(t), q = await client(), sourceAt = clock.now
  let central = snapshot(sourceAt, batch(sourceAt))
  globalThis.fetch = async () => json(central)
  const r = hookRenderer(() => q.useQuotes())
  clock.cleanup(() => r.close())
  await r.settle()
  await clock.advance(1000)
  central = {
    generatedAt: clock.now,
    quotes: Object.fromEntries(Object.entries(batch(sourceAt)).map(([pair, raw]) => [pair, { ...raw, stale: true, error: 'valor rejeitado' }])),
    cnh: { ...central.cnh, stale: true, error: 'valor rejeitado' },
  }
  await r.value.reload(); await r.settle()
  assert.equal(r.value.updatedAt.getTime(), sourceAt)
  assert.ok(r.value.error)
  for (const quote of Object.values(r.value.quotes)) {
    assert.equal(quote.timestamp, sourceAt)
    assert.equal(quote.stale, true)
    assert.ok(quote.error)
  }
})

test('client safety: an absurd BCE reference is rejected while valid fallback currencies remain available', async t => {
  const clock = browserClock(t), q = await client()
  globalThis.fetch = async url => {
    if (String(url).includes('awesomeapi')) return { ok: false, status: 503 }
    const from = new URL(url).searchParams.get('base')
    const rate = { USD: 54, EUR: 6.1, JPY: 0.035, CNY: 0.8 }[from]
    return json({ date: new Date(clock.now - 86400000).toISOString().slice(0, 10), rates: { BRL: rate } })
  }
  const { results } = await q.fetchQuotes(undefined, { direct: true })
  assert.ok(!results.USD.quote)
  assert.ok(results.USD.error)
  assert.equal(results.EUR.quote.bid, 6.1)
  assert.equal(results.EUR.quote.fallback, true)
  assert.equal(results.JPY.quote.bid, 0.035)
  assert.equal(results.CNH.quote.bid, 0.8)
})

test('CNH: cliente recusa pontas defasadas e legado incompatível, sem trocar por CNY',async t=>{
 const clock=browserClock(t),q=await client(),rows=batch(clock.now,{USDCNH:{timestamp:String((clock.now-2*3600000)/1000)}})
 const urls=[];globalThis.fetch=async url=>{urls.push(String(url));return json(rows)}
 const {results}=await q.fetchQuotes(undefined,{direct:true})
 assert.ok(!results.CNH.quote);assert.match(results.CNH.error,/120 min/)
 assert.ok(results.USD.quote);assert.equal(urls.length,1)
})
