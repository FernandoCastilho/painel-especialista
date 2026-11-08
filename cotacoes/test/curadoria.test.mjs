import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { CURADORIA_MS, CURADORIA_TOPICS, curateItems, relevantCuradoria, curadoriaSource, normalizeCuradoria } from '../src/curadoria.js'
import { collectCuradoria, queriesFor } from '../scripts/curadoria-lib.mjs'
const now = Date.parse('2026-11-06T03:40:00Z')
const article = (title, t = now, props = {}) => ({ title, t, link: `https://www.gov.br/fazenda/${encodeURIComponent(title)}`, sourceUrl: 'https://www.gov.br', ...props })
const rss = items => `<rss><channel>${items.map(item => `<item><title>${item.title}</title><link>${item.link}</link><pubDate>${new Date(item.t).toUTCString()}</pubDate><source url="${item.sourceUrl}">Fonte</source></item>`).join('')}</channel></rss>`
const fake = (items = []) => async () => ({ ok: true, text: async () => rss(items) })
test('curadoria uses exact inclusive 168h and excludes future, expired and undated publications', () => {
  const items = curateItems('imposto', [article('Imposto no limite', now - CURADORIA_MS), article('Imposto passado', now - CURADORIA_MS - 1), article('Imposto futuro', now + 1), article('Imposto sem data', undefined, { t: null }), article('Imposto sexto dia', now - 6 * 86400000)], [], now)
  assert.deepEqual(items.map(item => item.title), ['Imposto sexto dia', 'Imposto no limite'])
})
test('relevance filters exclude incidental Receita, TV CBS and retail split payment', () => {
  for (const title of ['Receita Federal apreende brinquedos', 'CBS estreia série nova', 'IR ao cinema']) assert.equal(relevantCuradoria('reforma', title), false)
  assert.equal(relevantCuradoria('imposto', 'Receita Federal apreende brinquedos'), false)
  assert.equal(relevantCuradoria('split-payment', 'Split payment divide pagamentos de marketplace'), false)
  assert.equal(relevantCuradoria('split-payment', 'Impostos: split payment será adotado de forma facultativa em 2027'), true)
  assert.equal(relevantCuradoria('reforma', 'IBS e CBS: novas alíquotas'), true)
  for (const title of ['Fim da escala 6×1', 'Jornada de trabalho: escala 6 x 1', 'Escala seis por um em discussão']) assert.equal(relevantCuradoria('escala-6x1', title), true)
  assert.equal(relevantCuradoria('escala-6x1', 'Time vence por 6x1'), false)
})
test('source hostname is validated; matching display names and suffix spoofs are rejected', () => {
  assert.equal(curadoriaSource('https://gov.br.evil.test'), null)
  assert.equal(curadoriaSource('javascript:gov.br'), null)
  assert.equal(curadoriaSource('https://www12.senado.leg.br').type, 'Fonte oficial')
  assert.equal(curateItems('imposto', [article('Imposto novo', now, { source: 'Receita Federal', sourceUrl: 'https://unknown.test' })], [], now).length, 0)
})
test('retained articles preserve publication dates, sources and deduplicate by title/link', () => {
  const first = article('Imposto: regra nova', now - 86400000)
  const items = curateItems('imposto', [first, { ...first, link: first.link + '/copy' }, { ...first, title: 'Outro imposto' }], [first], now)
  assert.equal(items.length, 1); assert.equal(items[0].t, first.t); assert.equal(items[0].source, 'Órgão público (www.gov.br)')
})
test('collector restricts queries and preserves seven days only across failure/recovery', async () => {
  const good = await collectCuradoria({ now, fetchImpl: fake([article('Imposto: atualização')]) })
  assert.ok(CURADORIA_TOPICS.every(topic => queriesFor(topic).every(q => q.includes('site:'))))
  assert.equal(good.topics.imposto.status, 'ok'); assert.equal(good.topics.imposto.lastSuccessAt, now)
  const failed = await collectCuradoria({ now: now + 3600000, previous: [good], fetchImpl: async () => { throw new Error('offline') } })
  assert.equal(failed.topics.imposto.status, 'unavailable'); assert.equal(failed.topics.imposto.lastSuccessAt, now)
  assert.equal(failed.topics.imposto.items[0].t, now)
  assert.equal(normalizeCuradoria(failed, 'imposto', now + 3600000).stale, true)
  const expired = await collectCuradoria({ now: now + CURADORIA_MS + 1, previous: [failed], fetchImpl: async () => { throw new Error('offline') } })
  assert.equal(expired.topics.imposto.items.length, 0)
  const recovered = await collectCuradoria({ now: now + 7200000, previous: [failed], fetchImpl: fake() })
  assert.equal(recovered.topics.imposto.status, 'ok'); assert.equal(recovered.topics.imposto.lastSuccessAt, now + 7200000)
})
test('empty valid feeds differ from invalid RSS and partially failed sources', async () => {
  const empty = await collectCuradoria({ now, fetchImpl: fake() })
  assert.equal(normalizeCuradoria(empty, 'imposto', now).stale, false)
  const invalid = await collectCuradoria({ now, fetchImpl: async () => ({ ok: true, text: async () => '<html>maintenance</html>' }) })
  assert.equal(invalid.topics.imposto.status, 'unavailable')
  let calls = 0
  const partial = await collectCuradoria({ now, fetchImpl: async (...args) => ++calls % 2 ? fake()(...args) : { ok: false, status: 503 } })
  for (const topic of Object.values(partial.topics)) { assert.equal(topic.status, 'partial'); assert.equal(topic.queriesSucceeded, 1); assert.equal(topic.lastSuccessAt, null) }
})
test('normalizer rejects malformed file and considers original success age, not fresh packaging time', async () => {
  assert.equal(normalizeCuradoria({ windowDays: 5 }, 'imposto', now), null)
  const data = await collectCuradoria({ now, fetchImpl: fake() })
  data.generatedAt = now + 4 * 3600000
  assert.equal(normalizeCuradoria(data, 'imposto', now + 4 * 3600000).stale, true)
})
test('four tabs follow Manchetes, existing groups remain, default window remains 5 days', async () => {
  const src = await readFile(new URL('../src/Resumo.jsx', import.meta.url), 'utf8')
  const index = src.indexOf('const NEWS_TABS')
  const tabs = src.slice(index).match(/label: '[^']+'/g).slice(0, 9)
  assert.deepEqual(tabs, ["label: 'Moedas'", "label: 'Manchetes'", "label: 'Imposto'", "label: 'Split payment'", "label: 'Reforma tributária'", "label: 'Escala 6x1'", "label: 'Eleições EUA'", "label: 'Google Trends'", "label: 'Veículos pesados'"])
  assert.match(await readFile(new URL('../src/newsWindow.js', import.meta.url), 'utf8'), /NEWS_WINDOW_DAYS = 5/)
})

test('dividend-only investment news is excluded and government origin labels remain accurate', () => {
  for (const title of ['Axia não prevê pagamento de dividendos além do mínimo de 25% do lucro líquido', 'Deutsche Telekom anuncia alta nos dividendos e recompra de ações', 'BTG aposta em dividendos']) assert.equal(relevantCuradoria('imposto', title), false)
  assert.equal(relevantCuradoria('imposto', 'Retenção sobre dividendos terá novo prazo'), true)
  assert.equal(curadoriaSource('https://cgibs.gov.br').label, 'Comitê Gestor do IBS')
  const state = curateItems('imposto', [article('ICMS: nova regra', now, { sourceUrl: 'https://estado.rs.gov.br' })], [], now)[0]
  assert.equal(state.source, 'Órgão público (estado.rs.gov.br)')
})
