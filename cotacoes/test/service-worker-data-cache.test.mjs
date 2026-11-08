import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

function worker() {
  const handlers = {}, entries = new Map()
  let version = 0, mode = 'online', quota = false
  const cache = {
    async put(key, response) { if (quota) throw Error('quota'); entries.set(String(key), response.clone()) },
    async match(key) { return entries.get(String(key))?.clone() },
  }
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self: { location: { origin: 'https://panel.example' }, addEventListener(type, handler) { handlers[type] = handler } },
    URL, caches: { async open() { return cache } },
    fetch: async () => {
      if (mode === 'offline') throw Error('offline')
      if (mode === 'http-error') return new Response('unavailable', { status: 503 })
      return new Response(JSON.stringify({ version: ++version }), { headers: { 'Content-Type': 'application/json' } })
    },
  })
  return {
    entries,
    mode(value) { mode = value }, quota(value) { quota = value },
    async request(path = 'macro.json?t=1', origin = 'https://panel.example') {
      let result
      handlers.fetch({ request: { method: 'GET', url: `${origin}/${path}` }, respondWith(promise) { result = promise } })
      return result ? await result : undefined
    },
  }
}

test('timestamped requests overwrite the same JSON cache key; offline returns the latest successful version', async () => {
  const sw = worker()
  for (let version = 1; version <= 3; version++) assert.equal((await (await sw.request(`macro.json?t=${version}`)).json()).version, version)
  assert.equal(sw.entries.size, 1)
  sw.mode('offline')
  assert.equal((await (await sw.request('macro.json?t=4')).json()).version, 3)
})

test('HTTP failure preserves the previous valid JSON; missing files and foreign origins do not invent data', async () => {
  const sw = worker()
  await sw.request()
  sw.mode('http-error')
  assert.equal((await (await sw.request('macro.json?t=2')).json()).version, 1)
  assert.equal((await sw.request('missing.json')).status, 503)
  sw.mode('offline')
  assert.equal(await sw.request('missing.json'), undefined)
  assert.equal(await sw.request('macro.json', 'https://other.example'), undefined)
})

test('cache quota failure does not hide successful network data or replace the previous valid cached version', async () => {
  const sw = worker()
  await sw.request()
  sw.quota(true)
  assert.equal((await (await sw.request('macro.json?t=2')).json()).version, 2)
  sw.mode('offline')
  assert.equal((await (await sw.request('macro.json?t=3')).json()).version, 1)
})
