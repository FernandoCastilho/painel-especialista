import * as searchQueue from '../src/searchQueue.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { hookRenderer } from './helpers/hooks.mjs'
import * as search from '../src/globalSearch.js'
import * as newsWindow from '../src/newsWindow.js'
const { NEWS_WINDOW_MS } = newsWindow
const require = createRequire(import.meta.url)
const now = Date.parse('2026-11-05T12:00:00Z')
const article = (title, t) => ({ title, t, description: title + ' corpoexclusivo', link: `https://example.test/${title}`, source: 'Fonte' })
const index = (file, data, route = 'resumo') => search.indexSearchData(file, { generatedAt: now, ...data }, route, 'Notícias', now).docs
async function setup(t, doc) {
  const source = await readFile(new URL('../src/GlobalSearch.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  let setClock, selection = { doc, query: 'termoausente' }, closes = 0
  runInNewContext(code, { module, exports: module.exports, requestAnimationFrame: () => 1, cancelAnimationFrame: () => {}, require: name => {
    if (name === './searchQueue.js') return searchQueue
    if (name === './GlobalSearch.css') return {}
    if (name === './useNewsClock.js') return { useNewsClock: () => { const [clock, set] = useState(now); setClock = set; return clock } }
    if (name === './globalSearch.js') return search
    if (name === './newsWindow.js') return newsWindow
    if (name === './useQuotes.js') return { DATA_BASE: '' }
    if (name === './useDataFile.js') return { loadDataFile: () => { throw Error('No network allowed') } }
    return require(name)
  } })
  const render = hookRenderer(() => module.exports.SearchDestination({ selection, onClose: () => closes++ }))
  t.after(() => render.close())
  await render.settle()
  return {
    html: () => renderToStaticMarkup(render.value),
    advance: async ms => { if (setClock) setClock(value => value + ms); else render.render(); await render.settle() },
    select: async value => { selection = value; render.render(); await render.settle() },
    selection: { doc, query: 'termoausente' },
  }
}
const assertExpired = html => {
  assert.doesNotMatch(html, /tituloexpirado|corpoexclusivo/)
  assert.match(html, /120|expir|fora.{0,30}janela/i)
  assert.match(html, /Fechar resultado/)
}
test('selected individual headline expires without retaining its title or body', async t => {
  const doc = index('news.json', { news: { USD: [article('tituloexpirado', now - NEWS_WINDOW_MS)] } }, 'noticias').find(d => d.title === 'tituloexpirado')
  assert.ok(doc)
  const ui = await setup(t, doc)
  assert.match(ui.html(), /tituloexpirado/)
  await ui.advance(60000)
  assertExpired(ui.html())
})
test('selected aggregate prunes expired children while keeping still-current news', async t => {
  const doc = index('temas.json', { temas: { cobre: { label: 'Agregado do cobre', items: [article('tituloexpirado', now - NEWS_WINDOW_MS), article('titulovalido', now)] } } }).find(d => d.title === 'Agregado do cobre')
  assert.ok(doc)
  const ui = await setup(t, doc)
  assert.match(ui.html(), /tituloexpirado/)
  await ui.advance(60000)
  assert.doesNotMatch(ui.html(), /tituloexpirado/)
  assert.match(ui.html(), /titulovalido/)
  assert.match(ui.html(), /Fechar resultado/)
})
test('returning to a selected news result after leaving the route revalidates publication age', async t => {
  const doc = index('reforma-tributaria.json', { items: [article('tituloexpirado', now)] }).find(d => d.title === 'tituloexpirado')
  const ui = await setup(t, doc)
  await ui.select(null)
  assert.equal(ui.html(), '')
  await ui.advance(NEWS_WINDOW_MS + 1)
  await ui.select(ui.selection)
  assertExpired(ui.html())
})
test('selected historical indicator remains visible after the news window elapses', async t => {
  const doc = index('indicator-history.json', { series: [{ title: 'Indicador histórico de 1990', points: [{ t: 1, value: 42 }] }] }, 'cenarios/atividade')[0]
  const ui = await setup(t, doc)
  await ui.advance(NEWS_WINDOW_MS + 1)
  assert.match(ui.html(), /Indicador histórico de 1990/)
  assert.match(ui.html(), /42/)
  assert.match(ui.html(), /Fechar resultado/)
})
test('fully expired aggregate hides its saved title and all article content', async t => {
  const doc = index('temas.json', { temas: { cobre: { label: 'Agregado salvo exclusivo', items: [article('tituloexpirado', now - NEWS_WINDOW_MS)] } } }).find(d => d.title === 'Agregado salvo exclusivo')
  const ui = await setup(t, doc)
  assert.match(ui.html(), /Agregado salvo exclusivo/)
  await ui.advance(60000)
  assertExpired(ui.html())
  assert.doesNotMatch(ui.html(), /Agregado salvo exclusivo/)
})
test('legacy selected news without publication metadata fails closed despite a current file stamp', async t => {
  const doc = search.makeSearchDoc({ id: 'legacy', title: 'tituloexpirado', body: 'corpoexclusivo', route: 'noticias', file: 'news.json', stamp: now })
  const ui = await setup(t, doc)
  assertExpired(ui.html())
})
test('selected publication is visible at exactly 120 hours and hidden one millisecond later', async t => {
  const doc = index('news.json', { news: { USD: [article('tituloexpirado', now - NEWS_WINDOW_MS)] } }, 'noticias').find(d => d.title === 'tituloexpirado')
  const ui = await setup(t, doc)
  assert.match(ui.html(), /tituloexpirado/)
  await ui.advance(1)
  assertExpired(ui.html())
})
