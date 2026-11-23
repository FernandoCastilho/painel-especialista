import test from 'node:test'
import assert from 'node:assert/strict'
import { SearchSession } from '../src/searchSession.js'
import { indexSearchData, searchDocuments } from '../src/globalSearch.js'
import { NEWS_WINDOW_MS } from '../src/newsWindow.js'
const now = Date.parse('2026-11-05T12:00:00Z')
const article = (title, t) => ({ title, t, source: 'Fonte', link: 'https://example.test/' + title })
const items = [article('limiteexato', now - NEWS_WINDOW_MS), article('recentevalida', now - 1), article('expiradaunica', now - NEWS_WINDOW_MS - 1), article('futurounico', now + 1), article('semdatainvalida', undefined), article('textoinvalido', String(now))]
const fixtures = [
  ['news.json', { news: { USD: items } }, 'noticias'],
  ['temas.json', { temas: { 'moeda-usd': { label: 'Moeda', items }, cobre: { label: 'Metal', items } } }, 'resumo'],
  ['reforma-tributaria.json', { topic: 'reforma-tributaria', items }, 'resumo'],
]
for (const [file, data, route] of fixtures) test(`${file}: publication window prunes articles and aggregated bodies`, () => {
  const original = JSON.stringify(data)
  const docs = indexSearchData(file, { ...data, generatedAt: now }, route, 'Notícias', now).docs
  for (const word of ['limiteexato', 'recentevalida']) assert.ok(searchDocuments(docs, word).length, word)
  for (const word of ['expiradaunica', 'futurounico', 'semdatainvalida', 'textoinvalido']) {
    assert.equal(searchDocuments(docs, word).length, 0, word)
    assert.ok(!JSON.stringify(docs).includes(word), word)
  }
  assert.equal(JSON.stringify(data), original)
})
test('cached news is reindexed as the clock crosses the boundary, including parent bodies', () => {
  const data = { generatedAt: now, temas: { cobre: { label: 'Metal', items: [article('expiraagora', now - NEWS_WINDOW_MS)] } } }
  assert.ok(searchDocuments(indexSearchData('temas.json', data, 'resumo', 'Temas', now).docs, 'expiraagora').length)
  assert.equal(searchDocuments(indexSearchData('temas.json', data, 'resumo', 'Temas', now + 1).docs, 'expiraagora').length, 0)
})
test('empty or invalid news is valid empty search coverage, never metadata fallback', () => {
  assert.deepEqual(indexSearchData('news.json', { generatedAt: now, news: { USD: [article('oldonly', 1)] } }, 'noticias', 'Manchetes', now).docs, [])
  assert.deepEqual(indexSearchData('reforma-tributaria.json', { generatedAt: now, items: [] }, 'resumo', 'Reforma', now).docs, [])
})
test('publication time is independent of collection time or dates mentioned in the headline', () => {
  const data = { generatedAt: 1, news: { USD: [article('Estudo de 1990 republicado', now), article('Previsões 2027 antigas', 1)] } }
  const docs = indexSearchData('news.json', data, 'noticias', 'Manchetes', now).docs
  assert.ok(searchDocuments(docs, '1990').length)
  assert.equal(searchDocuments(docs, '2027').length, 0)
})
test('indicator history, monthly vehicle data and economic calendar stay searchable', () => {
  for (const file of ['indicator-history.json', 'heavy-vehicles.json', 'calendar.json']) {
    const docs = indexSearchData(file, { generatedAt: 1, items: [article('referenciahistorica', 1), article('eventofuturo', now + NEWS_WINDOW_MS)] }, 'cenarios/atividade', 'Dados', now).docs
    assert.ok(searchDocuments(docs, 'referenciahistorica').length)
    assert.ok(searchDocuments(docs, 'eventofuturo').length)
  }
})
test('a sessão mantém o índice até a próxima entrada ou saída na janela de publicação', () => {
  for (const [file, data, route] of fixtures) {
    const session = new SearchSession()
    session.accept([file, route, 'Noticias'], { data }, now)
    const first = session.snapshot(now)
    assert.equal(first.nextChange, now + 1)
    assert.ok(searchDocuments(first.docs, 'limiteexato').length)
    assert.equal(searchDocuments(first.docs, 'futurounico').length, 0)
    const second = session.snapshot(now + 1)
    assert.equal(searchDocuments(second.docs, 'limiteexato').length, 0)
    assert.ok(searchDocuments(second.docs, 'futurounico').length)
    assert.strictEqual(session.snapshot(now + 2).docs[0], second.docs[0])
    const afterClose = session.snapshot(now + NEWS_WINDOW_MS + 2)
    assert.equal(afterClose.docs.length, 0)
    assert.equal(afterClose.nextChange, Infinity)
  }
})

test('a sessão mantém cada versão e reconhece o vencimento, a atualização em outra tela e as falhas', () => {
  const source = ['calendar.json', 'cenarios/calendario', 'Calendário']
  const [file] = source
  const session = new SearchSession(), ttl = 600000
  const first = { data: { generatedAt: 1, items: [{title: 'Agenda econômica'}] }, lastSuccessAt: now }
  session.accept(source, first, now)
  const doc = session.snapshot(now).docs[0]
  assert.equal(session.needsLoad(file, first, now + ttl - 1, ttl, true), false)
  assert.equal(session.needsLoad(file, first, now + ttl, ttl, false), true)
  const confirmed = { data: structuredClone(first.data), lastSuccessAt: now + ttl }
  session.accept(source, confirmed, now + ttl)
  assert.strictEqual(session.snapshot(now + ttl).docs[0], doc)
  session.fail(source)
  assert.strictEqual(session.snapshot(now + ttl).docs[0], doc)
  assert.equal(session.snapshot(now + ttl).sources[0].stale, true)
  assert.equal(session.needsLoad(file, confirmed, now + ttl, ttl, false), true)
  session.accept(source, confirmed, now + ttl)
  assert.equal(session.snapshot(now + ttl).sources[0].stale, false)
  const changed = { data: { generatedAt: 2, items: [{title: 'Novo evento'}] }, lastSuccessAt: now + ttl }
  assert.equal(session.needsLoad(file, changed, now + ttl, ttl, false), true)
  session.accept(source, changed, now + ttl)
  assert.equal(session.snapshot(now + ttl).docs[0].title, 'Novo evento')
  for (const title of ['Sem versão A', 'Sem versão B']) {
    session.accept(source, { data: { title } }, now)
    assert.equal(session.snapshot(now).docs[0].title, title)
  }
  const missing = ['oil.json', 'cenarios/commodities', 'Brent']
  session.fail(missing)
  assert.equal(session.snapshot(now).sources.find(s => s.file === 'oil.json').ok, false)
  assert.equal(session.needsLoad('oil.json', null, now, ttl, false), true)
})

const macroFocus = (focusCheckedAt, median) => ({
  generatedAt: 100, focusCheckedAt,
  focus: { date: '2026-11-20', rows: [{ label: 'IPCA', indicator: 'IPCA', values: { 2027: { median } } }] },
})
const dailyHistory = bid => ({
  generatedAt: 100, backfill: { ok: true, at: 80 },
  series: { USD: { source: 'USD', points: [{ t: now, bid }] } },
})
for (const [source, first, revision] of [
  [['macro.json', 'juros', 'Juros e projeções'], macroFocus(110, 4.21), macroFocus(200, 5.73)],
  [['history.json', 'resumo', 'Histórico de câmbio'], dailyHistory(4.21), dailyHistory(5.73)],
]) test(source[0] + ': atualização parcial com a mesma data substitui os valores pesquisáveis', () => {
  const session = new SearchSession(), ttl = 600000
  session.accept(source, { data: first, lastSuccessAt: now }, now)
  const previous = session.snapshot(now).docs
  assert.ok(searchDocuments(previous, '4,21').length)
  assert.equal(session.needsLoad(source[0], { data: first, lastSuccessAt: now }, now + 1, ttl, false), false)

  const updated = { data: revision, lastSuccessAt: now + ttl }
  assert.equal(session.needsLoad(source[0], updated, now + ttl, ttl, false), true)
  session.accept(source, updated, now + ttl)
  const docs = session.snapshot(now + ttl).docs
  assert.equal(searchDocuments(docs, '4,21').length, 0)
  assert.ok(searchDocuments(docs, '5,73').length)

  const identical = { data: structuredClone(revision), lastSuccessAt: now + 2 * ttl }
  session.accept(source, identical, now + 2 * ttl)
  assert.strictEqual(session.snapshot(now + 2 * ttl).docs[0], docs[0])
  assert.equal(session.needsLoad(source[0], identical, now + 2 * ttl + 1, ttl, false), false)
})
