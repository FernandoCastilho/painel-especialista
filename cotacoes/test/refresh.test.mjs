import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { browserClock, deferred, flush, hookRenderer, json } from './helpers/hooks.mjs'

const MIN = 60000, TTL = 6 * 3600000
let version = 0
const history = () => import(`../src/useHistory.js?refresh-test=${++version}`)
const day = '2026-10-22'
const at = (hour) => new Date(`${day}T${hour}:00:00`).getTime()
const file = (generatedAt, extra = false) => ({ generatedAt, source: 'Coleta central', resolution: '5 min', series: Object.fromEntries(['USD', 'EUR'].map((code) => [code, { points: [[at('10'), 5], [at('11'), 5.1], ...(extra ? [[at('12'), 5.2]] : [])] }])) })

test('intraday: série ausente ou inválida é erro, não ausência de amostras na data', async (t) => {
  const clock = browserClock(t), h = await history()
  globalThis.fetch = async () => json({ generatedAt: clock.now, series: { USD: { points: [[at('10'), 0]] } } })
  const usd = hookRenderer(() => h.useIntraday('USD', h.fromInput(day)))
  const eur = hookRenderer(() => h.useIntraday('EUR', h.fromInput(day)))
  clock.cleanup(() => { usd.close(); eur.close() })
  const invalid = await usd.settle()
  assert.equal(invalid.status, 'error')
  assert.match(invalid.error, /sem amostras válidas/)
  const absent = await eur.settle()
  assert.equal(absent.status, 'error')
  assert.match(absent.error, /ausente ou inválida/)
})

test('intraday: atualiza aberto no TTL exato, compartilha consulta e preserva pontos durante loading', async (t) => {
  const clock = browserClock(t), h = await history(), pending = [], urls = []
  globalThis.fetch = (url) => { urls.push(url); const p = deferred(); pending.push(p); return p.promise }
  const a = hookRenderer(() => h.useIntraday('USD', h.fromInput(day)))
  const b = hookRenderer(() => h.useIntraday('EUR', h.fromInput(day)))
  clock.cleanup(() => { a.close(); b.close() })
  await a.settle(); await b.settle()
  assert.equal(urls.length, 1)
  const originalAt = clock.now
  pending[0].resolve(json(file(originalAt)))
  assert.equal((await a.settle()).data.points.length, 2)
  assert.equal((await b.settle()).data.points.length, 2)
  await clock.advance(45000)
  assert.equal(urls.length, 1)
  await clock.advance(15000)
  assert.equal(urls.length, 2)
  const loading = await a.settle()
  assert.equal(loading.status, 'ok')
  assert.equal(loading.refreshing, true)
  assert.equal(loading.data.generatedAt, originalAt)
  assert.equal(loading.data.points.length, 2)
  pending[1].resolve(json(file(clock.now, true)))
  assert.equal((await a.settle()).data.points.length, 3)
  assert.equal((await b.settle()).data.points.length, 3)
  assert.equal(a.value.data.generatedAt, clock.now)
  assert.equal(a.value.data.feed, 'Coleta central')
  assert.ok(urls.every((url) => /^\.\/intraday\.json\?t=/.test(url)), 'não chama API de cotações')
})

test('intraday: pausa hidden, retoma por foco/visibility sem sobreposição e limpa listeners', async (t) => {
  const clock = browserClock(t), h = await history(), pending = []
  globalThis.fetch = () => { const p = deferred(); pending.push(p); return p.promise }
  const r = hookRenderer(() => h.useIntraday('USD', h.fromInput(day)))
  clock.cleanup(() => r.close())
  await r.settle(); pending[0].resolve(json(file(clock.now))); await r.settle()
  clock.doc.hidden = true; clock.doc.dispatch('visibilitychange')
  assert.equal(clock.timers.size, 0)
  await clock.advance(20 * MIN)
  clock.win.dispatch('focus'); await flush()
  assert.equal(pending.length, 1)
  clock.doc.hidden = false; clock.doc.dispatch('visibilitychange'); clock.win.dispatch('focus')
  await r.settle()
  assert.equal(pending.length, 2)
  await clock.advance(3 * MIN)
  clock.win.dispatch('focus'); await flush()
  assert.equal(pending.length, 2, 'não sobrepõe requisição pendente')
  r.close()
  const updates = r.updates
  assert.equal(clock.timers.size, 0)
  assert.equal(clock.win.size, 0)
  assert.equal(clock.doc.size, 0)
  pending[1].resolve(json(file(clock.now, true))); await flush()
  assert.equal(r.updates, updates, 'resposta após desmontagem não atualiza estado')
})

test('intraday: falha conserva série e data reais, avisa stale e recuperação limpa o aviso', async (t) => {
  const clock = browserClock(t), h = await history()
  let calls = 0, fail = false
  globalThis.fetch = async () => { calls++; if (fail) throw new Error('rede'); return json(file(clock.now, calls > 1)) }
  const r = hookRenderer(() => h.useIntraday('USD', h.fromInput(day)))
  clock.cleanup(() => r.close())
  const original = (await r.settle()).data
  fail = true; await clock.advance(10 * MIN)
  const failed = await r.settle()
  assert.equal(failed.status, 'ok'); assert.equal(failed.stale, true)
  assert.match(failed.error, /rede/)
  assert.deepEqual(failed.data, original)
  fail = false; await clock.advance(MIN)
  const recovered = await r.settle()
  assert.equal(recovered.data.points.length, 3)
  assert.equal(recovered.stale, undefined); assert.equal(recovered.error, undefined)
})

test('intraday: remount preserves cache age and renews on the next minute polling', async (t) => {
  const clock = browserClock(t), h = await history()
  let calls = 0
  globalThis.fetch = async () => { calls++; return json(file(clock.now, calls > 1)) }
  const a = hookRenderer(() => h.useIntraday('USD', h.fromInput(day)))
  await a.settle(); a.close(); await clock.advance(45000)
  const b = hookRenderer(() => h.useIntraday('USD', h.fromInput(day)))
  clock.cleanup(() => b.close())
  await b.settle(); assert.equal(calls, 1)
  await clock.advance(15000)
  assert.equal((await b.settle()).data.points.length, 2)
  await clock.advance(45000) // first minute polling after the remount at t=45s
  assert.equal((await b.settle()).data.points.length, 3)
  assert.equal(calls, 2)
})

test('intraday: resposta antiga não invade outra seleção e skip/data inválida não fazem polling', async (t) => {
  const clock = browserClock(t), h = await history(), p = deferred()
  let calls = 0, selected = day, skip = false
  globalThis.fetch = () => { calls++; return p.promise }
  const r = hookRenderer(() => h.useIntraday('USD', h.fromInput(selected), skip))
  clock.cleanup(() => r.close())
  await r.settle()
  selected = '2026-10-21'; r.render(); await r.settle()
  p.resolve(json(file(clock.now))); const result = await r.settle()
  assert.equal(calls, 1); assert.equal(result.status, 'empty'); assert.equal(result.data, undefined)
  skip = true; r.render(); await r.settle(); assert.equal(clock.timers.size, 0)
  skip = false; selected = ''; r.render(); assert.equal((await r.settle()).status, 'error')
  assert.equal(clock.timers.size, 0); assert.equal(calls, 1)
})

test('intraday: arquivo com coleta anterior não substitui série mais nova', async (t) => {
  const clock = browserClock(t), h = await history(), originalAt = clock.now
  let calls = 0
  globalThis.fetch = async () => json(file(++calls === 1 ? originalAt : originalAt - MIN))
  const r = hookRenderer(() => h.useIntraday('USD', h.fromInput(day)))
  clock.cleanup(() => r.close())
  await r.settle(); await clock.advance(10 * MIN)
  const result = await r.settle()
  assert.equal(result.data.generatedAt, originalAt)
  assert.equal(result.stale, true); assert.match(result.error, /anterior/)
})

test('diário: sessão aberta renova memória após seis horas, sem consultas antes ou duplicadas', async (t) => {
  const clock = browserClock(t), h = await history(), win = h.fullWindow()
  let calls = 0
  globalThis.fetch = async () => { calls++; return json({ rates: { [h.toInput(win.end)]: { BRL: 5 + calls / 10 } } }) }
  const a = hookRenderer(() => h.useHistory('TEST-TTL', win.start, win.end))
  const b = hookRenderer(() => h.useHistory('TEST-TTL', win.end, win.end))
  clock.cleanup(() => { a.close(); b.close() })
  await a.settle(); await b.settle(); assert.equal(calls, 1)
  await clock.advance(TTL - MIN); assert.equal(calls, 1)
  await clock.advance(MIN); assert.equal(calls, 2)
  assert.equal((await a.settle()).data.points[0].bid, 5.2)
  assert.equal((await b.settle()).data.points[0].bid, 5.2)
  assert.equal(a.value.data.points[0].t, Date.parse(`${h.toInput(win.end)}T15:00:00Z`))
})

test('diário: reidratação preserva idade do cache e expira no minuto correto', async (t) => {
  const clock = browserClock(t), h = await history(), win = h.fullWindow()
  const key = `TEST-STORED|full|${h.toYmd(win.end)}`, storedAt = clock.now - TTL + MIN
  const data = { source: 'TEST-STORED', points: [{ t: win.end.getTime() + 12 * 3600000, bid: 5 }] }
  localStorage.setItem('cotacoes-hist-v1', JSON.stringify({ [key]: { at: storedAt, data } }))
  let calls = 0
  globalThis.fetch = async () => { calls++; return json({ rates: { [h.toInput(win.end)]: { BRL: 5.2 } } }) }
  const r = hookRenderer(() => h.useHistory('TEST-STORED', win.start, win.end))
  clock.cleanup(() => r.close())
  assert.equal((await r.settle()).data.points[0].bid, 5)
  assert.equal(calls, 0)
  assert.equal(JSON.parse(localStorage.getItem('cotacoes-hist-v1'))[key].at, storedAt)
  await clock.advance(MIN)
  assert.equal(calls, 1); assert.equal((await r.settle()).data.points[0].bid, 5.2)
})

test('diário: falha de atualização mantém dados, e seleção nova nunca herda dados de outra', async (t) => {
  const clock = browserClock(t), h = await history(), win = h.fullWindow()
  let fail = false, code = 'TEST-FAIL'
  globalThis.fetch = async () => { if (fail) throw new Error('rede indisponível'); return json({ rates: { [h.toInput(win.end)]: { BRL: 5.1 } } }) }
  const r = hookRenderer(() => h.useHistory(code, win.start, win.end))
  clock.cleanup(() => r.close())
  const original = (await r.settle()).data
  fail = true; await clock.advance(TTL)
  const result = await r.settle()
  assert.equal(result.stale, true); assert.deepEqual(result.data, original)
  code = 'TEST-OTHER'; r.render()
  const changed = await r.settle()
  assert.equal(changed.status, 'error'); assert.equal(changed.data, undefined)
})

// Injeta somente a configuração Vite para exercer o hook real no Node com coleta central.
async function quotesWithCentral() {
  const require = createRequire(import.meta.url)
  let src = await readFile(new URL('../src/useQuotes.js', import.meta.url), 'utf8')
  src = src.replace("from 'react'", `from '${pathToFileURL(require.resolve('react'))}'`)
    .replace("from './visiblePolling.js'", `from '${new URL('../src/visiblePolling.js', import.meta.url)}'`)
    .replace("from './quoteSafety.js'", `from '${new URL('../src/quoteSafety.js', import.meta.url)}'`)
    .replace("from '../scripts/data-schedules.mjs'", `from '${new URL('../scripts/data-schedules.mjs', import.meta.url)}'`)
    .replace('import.meta.env?.VITE_DATA_BASE', "'https://central.example'")
  return import(`data:text/javascript;base64,${Buffer.from(`${src}\n// test ${++version}`).toString('base64')}`)
}
const batch = (time, usd = 5) => Object.fromEntries(Object.entries({ USDBRL: usd, EURBRL: 6.1, JPYBRL: 0.035, USDCNH: 7.1 }).map(([code, bid]) => [code, { bid: String(bid), ask: String(bid + (code === 'JPYBRL' ? .0001 : .01)), high: String(bid + (code === 'JPYBRL' ? .001 : .1)), low: String(bid - (code === 'JPYBRL' ? .001 : .1)), pctChange: '1', timestamp: String(time / 1000) }]))

test('quotes: anonymous response two hours older cannot replace the central price or its source timestamp', async t => {
  const clock = browserClock(t), q = await quotesWithCentral()
  globalThis.fetch = async url => url.startsWith('https://central.example')
    ? json({ generatedAt:clock.now, quotes:batch(clock.now,5.4) })
    : json(batch(clock.now-2*3600000,5.42))
  const r = hookRenderer(() => q.useQuotes())
  clock.cleanup(() => r.close())
  await r.settle()
  const original = r.value.quotes
  await r.value.refresh(); await r.settle()
  for (const code of ['USD','EUR','JPY','CNH']) {
    assert.equal(r.value.quotes[code].bid,original[code].bid)
    assert.equal(r.value.quotes[code].timestamp,original[code].timestamp)
  }
})

test('quotes: foco é automático, não concorre, manual prevalece e resposta abortada é ignorada', async (t) => {
  const clock = browserClock(t), q = await quotesWithCentral(), pending = []
  globalThis.fetch = (url, options) => { const p = deferred(); pending.push({ ...p, url, signal: options?.signal }); return p.promise }
  const r = hookRenderer(() => q.useQuotes())
  clock.cleanup(() => r.close())
  await r.settle()
  pending[0].resolve(json({ generatedAt: clock.now, quotes: batch(clock.now) })); await r.settle()
  await clock.advance(MIN)
  clock.win.dispatch('focus'); clock.doc.dispatch('visibilitychange'); await r.settle()
  assert.equal(pending.length, 2)
  assert.ok(pending.every((p) => p.url.startsWith('https://central.example/quotes.json')))
  await clock.advance(2 * MIN); assert.equal(pending.length, 2)
  const manual = r.value.refresh(); await flush()
  assert.equal(pending.length, 3)
  assert.equal(pending[1].signal.aborted, true)
  assert.match(pending[2].url, /economia\.awesomeapi\.com\.br/)
  const directAt = clock.now
  pending[2].resolve(json(batch(directAt, 5.5))); await manual; await r.settle()
  assert.equal(r.value.quotes.USD.bid, 5.5)
  pending[1].resolve(json({ generatedAt: directAt - MIN, quotes: batch(directAt - MIN, 4.9) })); await r.settle()
  assert.equal(r.value.quotes.USD.bid, 5.5)
  assert.equal(r.value.via, 'direto'); assert.equal(r.value.updatedAt.getTime(), directAt)
  clock.doc.hidden = true; clock.doc.dispatch('visibilitychange'); assert.equal([...clock.timers.values()].filter((timer) => timer.ms >= MIN).length, 0)
  await clock.advance(10 * MIN); assert.equal(pending.length, 3)
  clock.doc.hidden = false; clock.win.dispatch('focus'); clock.doc.dispatch('visibilitychange'); await r.settle()
  assert.equal(pending.length, 4); assert.match(pending[3].url, /^https:\/\/central\.example/)
  r.close(); const updates = r.updates
  assert.equal(pending[3].signal.aborted, true); assert.equal(clock.timers.size, 0)
  pending[3].resolve(json({ generatedAt: clock.now, quotes: batch(clock.now, 6) })); await flush()
  assert.equal(r.updates, updates)
})

test('quotes: a cada 10 min com a aba visível consulta a API direto; oculta, não consulta', async (t) => {
  const clock = browserClock(t, Date.parse('2026-11-19T14:00:00Z')), q = await quotesWithCentral(), urls = []
  globalThis.fetch = async (url) => { urls.push(url); return url.startsWith('https://central.example') ? json({ generatedAt: clock.now, quotes: batch(clock.now) }) : json(batch(clock.now, 5.5)) }
  const r = hookRenderer(() => q.useQuotes())
  clock.cleanup(() => r.close())
  await r.settle()
  const direct = () => urls.filter((u) => /awesomeapi/.test(u)).length
  assert.equal(direct(), 0)
  await clock.advance(9 * MIN); await r.settle(); assert.equal(direct(), 0)
  await clock.advance(MIN); await r.settle(); assert.equal(direct(), 1)
  assert.equal(r.value.via, 'direto')
  clock.doc.hidden = true; clock.doc.dispatch('visibilitychange')
  await clock.advance(30 * MIN); await r.settle(); assert.equal(direct(), 1)
})

for (const [iso, quando] of [['2026-11-19T23:00:00Z', 'noite'], ['2026-11-21T15:00:00Z', 'sábado'], ['2026-11-20T15:00:00Z', 'feriado da B3']]) {
  test(`quotes: com o câmbio fechado (${quando}) não há consulta direta automática`, async (t) => {
    const clock = browserClock(t, Date.parse(iso)), q = await quotesWithCentral(), urls = []
    globalThis.fetch = async (url) => { urls.push(url); return url.startsWith('https://central.example') ? json({ generatedAt: clock.now, quotes: batch(clock.now) }) : json(batch(clock.now, 5.5)) }
    const r = hookRenderer(() => q.useQuotes())
    clock.cleanup(() => r.close())
    await r.settle()
    await clock.advance(30 * MIN); await r.settle()
    assert.equal(urls.filter((u) => /awesomeapi/.test(u)).length, 0)
    assert.ok(urls.some((u) => u.startsWith('https://central.example')))
  })
}

test('quotes: central atrasada reutiliza cotação direta por 5 min sem alternar para BCE nem renovar data', async(t)=>{
 const clock=browserClock(t), q=await quotesWithCentral(), urls=[]
 let centralFresh=false, directCalls=0
 globalThis.fetch=async url=>{
  urls.push(url)
  if(url.startsWith('https://central.example'))return json({generatedAt:centralFresh?clock.now:clock.now-q.centralMaxAge(clock.now)-MIN,quotes:batch(clock.now,6)})
  assert.match(url,/economia\.awesomeapi\.com\.br/,'não chama referência BCE durante cooldown')
  directCalls++;return json(batch(clock.now,5+directCalls/10))
 }
 const first=await q.fetchQuotes();const originalAt=first.collectedAt
 assert.equal(first.via,'direto');assert.equal(first.results.USD.quote.bid,5.1)
 await clock.advance(MIN)
 const reused=await q.fetchQuotes()
 assert.equal(directCalls,1);assert.equal(reused.collectedAt,originalAt)
 assert.equal(reused.results.USD.quote.timestamp,originalAt);assert.equal(reused.results.USD.quote.bid,5.1)
 await clock.advance(4*MIN)
 const renewed=await q.fetchQuotes()
 assert.equal(directCalls,2);assert.equal(renewed.results.USD.quote.bid,5.2);assert.equal(renewed.collectedAt,clock.now)
 centralFresh=true;await clock.advance(MIN)
 const recovered=await q.fetchQuotes()
 assert.equal(recovered.via,'central');assert.equal(recovered.results.USD.quote.bid,6);assert.equal(directCalls,2)
})

test('quotes: resposta direta tardia não substitui cache de requisição mais recente no mesmo milissegundo',async(t)=>{
 const clock=browserClock(t), q=await quotesWithCentral(), pending=[]
 globalThis.fetch=url=>{
  if(url.startsWith('https://central.example'))return Promise.resolve(json({generatedAt:clock.now-q.centralMaxAge(clock.now)-MIN,quotes:batch(clock.now)}))
  const p=deferred();pending.push(p);return p.promise
 }
 const oldAt=clock.now, first=q.fetchQuotes(undefined,{direct:true});await flush()
 const newAt=clock.now, second=q.fetchQuotes(undefined,{direct:true});await flush()
 pending[1].resolve(json(batch(newAt,6)));await second
 pending[0].resolve(json(batch(oldAt,5)));await first
 const reused=await q.fetchQuotes()
 assert.equal(reused.results.USD.quote.bid,6);assert.equal(reused.collectedAt,newAt)
})
