import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collect } from '../scripts/quotes-lib.mjs'

const now = Date.UTC(2026, 10, 19, 18)
const quote = (bid, time) => ({ bid: String(bid), ask: String(bid + .001), high: String(bid + .1), low: String(bid - .1), pctChange: '0', varBid: '0', timestamp: String(time / 1000) })
const batch = { USDBRL: quote(5.4, now - 652 * 60000), USDCNH: quote(7.1, now), EURBRL: quote(6.1, now), JPYBRL: { ...quote(.035, now), low: '.034', high: '.036' } }
const json = value => ({ ok: true, status: 200, json: async () => structuredClone(value) })
async function setup(t) {
  const dir = await mkdtemp(join(tmpdir(), 'cnh-refresh-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

test('yuan recupera lote defasado com duas consultas individuais compatíveis', async t => {
  const dir = await setup(t), urls = []
  const result = await collect({ dir, now, tries: 1, fetchFn: async url => {
    urls.push(String(url))
    if (String(url).includes('/USD-BRL,')) return json(batch)
    if (String(url).endsWith('/USD-BRL')) return json({ USDBRL: quote(5.42, now) })
    if (String(url).endsWith('/USD-CNH')) return json({ USDCNH: quote(7.1, now) })
    return json({})
  } })
  assert.equal(result.ok, true)
  const saved = JSON.parse(await readFile(join(dir, 'quotes.json'), 'utf8'))
  assert.ok(saved.cnh && !saved.cnh.stale, 'recuperação comprovada deve liberar o yuan')
  assert.equal(saved.cnh.timestamp, now)
  assert.deepEqual(saved.cnh.legTimestamps, { USDBRL: now, USDCNH: now })
  assert.equal(saved.cnh.bid, 5.42 / 7.101)
  assert.equal(saved.quotes.USDBRL.bid, '5.42')
  assert.equal(saved.rejected.CNH, undefined)
  assert.equal(urls.filter(url => /\/last\/USD-(BRL|CNH)$/.test(url)).length, 2)
  const intraday = JSON.parse(await readFile(join(dir, 'intraday.json'), 'utf8'))
  assert.deepEqual(intraday.series.CNH.points, [[now, saved.cnh.bid]])
})

test('yuan não fabrica cruzamento nem ponto intraday com tentativas incompatíveis ou antigas', async t => {
  for (const individual of [batch, { ...batch, USDCNH: quote(7.1, now - 700 * 60000) }]) {
    const dir = await setup(t)
    await collect({ dir, now, tries: 1, fetchFn: async url => {
      if (String(url).includes('/USD-BRL,')) return json(batch)
      if (String(url).endsWith('/USD-BRL')) return json({ USDBRL: individual.USDBRL })
      if (String(url).endsWith('/USD-CNH')) return json({ USDCNH: individual.USDCNH })
      return json({})
    } })
    const saved = JSON.parse(await readFile(join(dir, 'quotes.json'), 'utf8'))
    const intraday = JSON.parse(await readFile(join(dir, 'intraday.json'), 'utf8'))
    assert.equal(saved.cnh, null)
    assert.match(saved.rejected.CNH, /diferença/)
    assert.equal(saved.quotes.USDCNH.timestamp, batch.USDCNH.timestamp, 'consulta individual não regride a observação do lote')
    assert.ok(!intraday.series.CNH)
  }
})

test('falha das consultas individuais conserva a última referência válida sem inventar atualidade', async t => {
  const dir = await setup(t), old = now - 700 * 60000
  await collect({ dir, now: old, tries: 1, fetchFn: async () => json({ ...batch, USDBRL: quote(5.4, old), USDCNH: quote(7.1, old), EURBRL: quote(6.1, old), JPYBRL: { ...quote(.035, old), low: '.034', high: '.036' } }) })
  const previous = JSON.parse(await readFile(join(dir, 'quotes.json'), 'utf8')).cnh
  await collect({ dir, now, tries: 1, fetchFn: async url => String(url).includes('/USD-BRL,') ? json(batch) : { ok: false, status: 429 } })
  const saved = JSON.parse(await readFile(join(dir, 'quotes.json'), 'utf8'))
  assert.equal(saved.cnh.bid, previous.bid)
  assert.equal(saved.cnh.timestamp, old)
  assert.equal(saved.cnh.stale, true)
  const intraday = JSON.parse(await readFile(join(dir, 'intraday.json'), 'utf8'))
  assert.equal(intraday.series.CNH.points.length, 1)
  assert.equal(intraday.series.CNH.points[0][0], old)
})