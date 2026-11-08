import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchBankText } from '../scripts/bancos-transport.mjs'
const ok = { ok: true, text: async () => '{"value":[]}' }
const sleep = async () => {}
test('bank transport recovers a transient socket failure with bounded retries', async () => {
  let calls = 0
  const fetchImpl = async () => { if (++calls === 1) throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }); return ok }
  assert.equal(await fetchBankText('https://olinda.bcb.gov.br/', { fetchImpl, sleep }), '{"value":[]}')
  assert.equal(calls, 2)
})
test('bank transport never retries access denial or unknown failures', async () => {
  for (const failure of [403, 401, 404, new TypeError('fetch failed')]) {
    let calls = 0
    await assert.rejects(fetchBankText('https://olinda.bcb.gov.br/', { sleep, fetchImpl: async () => { calls++; if (failure instanceof Error) throw failure; return { ok: false, status: failure } } }))
    assert.equal(calls, 1)
  }
})
test('bank transport caps temporary server errors and respects long cooldowns', async () => {
  let calls = 0
  await assert.rejects(fetchBankText('https://olinda.bcb.gov.br/', { sleep, fetchImpl: async () => { calls++; return { ok: false, status: 503 } } }), /HTTP 503/)
  assert.equal(calls, 3)
  calls = 0
  await assert.rejects(fetchBankText('https://olinda.bcb.gov.br/', { sleep, fetchImpl: async () => { calls++; return { ok: false, status: 429, headers: new Map([['retry-after', '60']]) } } }), /HTTP 429/)
  assert.equal(calls, 1)
})
