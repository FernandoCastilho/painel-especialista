import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { createElement, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { hookRenderer } from './helpers/hooks.mjs'
import * as newsWindow from '../src/newsWindow.js'
import * as reforma from '../src/reforma.js'
import * as feed from '../src/feed.js'
const require = createRequire(import.meta.url)
const now = Date.parse('2026-11-05T12:00:00Z')
const article = (title, t) => ({ title, t, link: `https://example.test/${title}`, source: 'Fonte de teste' })
const wrapper = ({ children }) => createElement('p', {}, children)
function elements(node, predicate) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(n => elements(n, predicate))
  return [...(predicate(node) ? [node] : []), ...elements(node.props?.children, predicate)]
}
async function setup(t, name, props = {}, resource = {}) {
  const source = await readFile(new URL(`../src/${name}.jsx`, import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  let setClock
  runInNewContext(code, { module, exports: module.exports, require: name => {
    if (name === 'react') return { ...require(name), useMemo: fn => fn() }
    if (name === './useNewsClock.js') return { useNewsClock: () => { const [clock, set] = useState(now); setClock = set; return clock } }
    if (name === './newsWindow.js') return newsWindow
    if (name === './reforma.js') return reforma
    if (name === './feed.js') return feed
    if (name === './useNews.js') return { useNews: () => resource }
    if (name === './useQuotes.js') return { CURRENCIES: [{ code: 'USD' }, { code: 'EUR' }] }
    if (name === './Avisos.jsx') return { Aviso: wrapper }
    if (name === './Estado.jsx') return wrapper
    if (name === './Explain.jsx' || name === './RefreshButton.jsx') return () => null
    return require(name)
  } })
  const render = hookRenderer(() => module.exports.default({ colors: { USD: 'blue', EUR: 'red' }, ...props }))
  t.after(() => render.close())
  await render.settle()
  return {
    html: () => renderToStaticMarkup(render.value),
    buttons: () => elements(render.value, n => n.type === 'button'),
    advance: async ms => { setClock(value => value + ms); await render.settle() },
    click: async button => { button.props.onClick(); await render.settle() },
  }
}
for (const name of ['NoticiasPorDia', 'News']) {
  const load = (t, items, metadata = {}) => name === 'NoticiasPorDia'
    ? setup(t, name, { data: { generatedAt: now, items, ...metadata } })
    : setup(t, name, {}, { data: { generatedAt: now, news: { USD: items }, ...metadata } })
  test(`${name}: expired, future and undated articles never render`, async t => {
    const ui = await load(t, [article('validanajanela', now - 1), article('antigaoculta', now - newsWindow.NEWS_WINDOW_MS - 1), article('futuraoculta', now + 1), article('semdataoculta', undefined)])
    assert.match(ui.html(), /validanajanela/)
    for (const title of ['antigaoculta', 'futuraoculta', 'semdataoculta']) assert.ok(!ui.html().includes(title), title)
    assert.match(ui.html(), /120 horas/)
  })
  test(`${name}: open page expires an article without changing the snapshot`, async t => {
    const ui = await load(t, [article('ultimoinstante', now - newsWindow.NEWS_WINDOW_MS)])
    assert.match(ui.html(), /ultimoinstante/)
    await ui.advance(60000)
    assert.doesNotMatch(ui.html(), /ultimoinstante/)
    assert.match(ui.html(), /Nenhuma publicação válida nas últimas 120 horas/)
  })
  test(`${name}: empty stale snapshot discloses missing coverage honestly`, async t => {
    const ui = await load(t, [article('antigaoculta', now - newsWindow.NEWS_WINDOW_MS - 1)], { generatedAt: now - 86400000, stale: { USD: now - 86400000 } })
    assert.match(ui.html(), /Atualização incompleta, atrasada ou não confirmada/)
    assert.match(ui.html(), /Nenhuma publicação válida nas últimas 120 horas/)
    assert.doesNotMatch(ui.html(), /antigaoculta/)
    assert.doesNotMatch(ui.html(), /mantidas as matérias anteriores|mantidas as da última coleta|Sem notícias na semana/)
  })
  test(`${name}: current empty coverage does not claim there are no news`, async t => {
    const ui = await load(t, [])
    assert.match(ui.html(), /Isso não significa ausência de notícias/)
    assert.doesNotMatch(ui.html(), /Atualização incompleta/)
  })
}
test('NoticiasPorDia: expired selected day falls back to all with one active button', async t => {
  const ui = await setup(t, 'NoticiasPorDia', { data: { generatedAt: now, items: [article('noticiahoje', now - 1), article('diaexpirando', now - newsWindow.NEWS_WINDOW_MS)] } })
  const buttons = ui.buttons()
  assert.equal(buttons.length, 3)
  await ui.click(buttons.at(-1))
  assert.match(ui.html(), /diaexpirando/)
  assert.doesNotMatch(ui.html(), /noticiahoje/)
  await ui.advance(60000)
  assert.doesNotMatch(ui.html(), /diaexpirando/)
  assert.match(ui.html(), /noticiahoje/)
  assert.equal(ui.buttons().filter(b => b.props['aria-pressed']).length, 1)
  assert.equal(ui.buttons()[0].props['aria-pressed'], true)
})
test('News: currency filter remains selected when its last headline expires', async t => {
  const ui = await setup(t, 'News', {}, { data: { generatedAt: now, news: { USD: [article('usdexpirando', now - newsWindow.NEWS_WINDOW_MS)], EUR: [article('euraindaativo', now)] } } })
  await ui.click(ui.buttons().find(b => b.props.children === 'USD'))
  assert.match(ui.html(), /usdexpirando/)
  assert.doesNotMatch(ui.html(), /euraindaativo/)
  await ui.advance(60000)
  assert.doesNotMatch(ui.html(), /usdexpirando|euraindaativo/)
  assert.match(ui.html(), /Nenhuma publicação válida/)
  assert.equal(ui.buttons().find(b => b.props.children === 'USD').props['aria-pressed'], true)
})
test('NoticiasPorDia: explicit seven-day curation retains sixth day and expires at 168 hours', async t => {
  const ui = await setup(t, 'NoticiasPorDia', { windowDays: 7, data: { generatedAt: now, items: [article('sextodiavalido', now - 6 * 86400000), article('limitesetedias', now - 7 * 86400000), article('fora7dias', now - 7 * 86400000 - 1)] } })
  assert.match(ui.html(), /sextodiavalido/); assert.match(ui.html(), /limitesetedias/)
  assert.doesNotMatch(ui.html(), /fora7dias/); assert.match(ui.html(), /168 horas/)
  await ui.advance(60000)
  assert.doesNotMatch(ui.html(), /limitesetedias/); assert.match(ui.html(), /sextodiavalido/)
})
