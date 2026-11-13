import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { pathToFileURL, fileURLToPath } from 'node:url'
// React in-memory regression harness; simulated nodes are not browser/visual evidence.
const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(root + 'package.json')
const React = require('react')
const { transform } = require('esbuild')
const { hookRenderer } = await import(pathToFileURL(root + 'test/helpers/hooks.mjs'))
const catalog = await import(pathToFileURL(root + 'src/centralSetorial.js'))
const history = await import(pathToFileURL(root + 'src/centralHistory.js'))
const insumos = await import(pathToFileURL(root + 'src/insumos.js'))
const { code } = await transform(readFileSync(root + 'src/Setores.jsx', 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
function children(node) {
  if (['PautasSetoriais', 'EstudoRelacionado'].includes(node.type?.name)) return node.type(node.props)
  return node.props?.children
}
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(children(node))] : []
const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(children(node)) : typeof node === 'string' || typeof node === 'number' ? String(node) : ''

async function setup(t, initial = 'central', state = { unrelatedFeature: { preserved: true } }) {
  let entries = [{ view: initial, state }], index = 0, view = initial, renderer, rafId = 0
  const frames = new Map(), elements = new Map(), calls = []
  const body = { id: '', key: 'body' }, document = { activeElement: body, getElementById: id => elements.get(id) || null }
  const window = {
    history: { get state() { return entries[index].state }, replaceState(state) { entries[index].state = structuredClone(state) } },
    scrollY: 200,
    requestAnimationFrame(fn) { frames.set(++rafId, fn); return rafId },
    cancelAnimationFrame(id) { frames.delete(id) },
    scrollTo(options) { calls.push({ scroll: options.top }); window.scrollY = options.top },
  }
  const deps = { react: { ...React, useId: () => 'search-review' }, './insumos.js': insumos, './centralSetorial.js': catalog, './centralHistory.js': history, './SetoresLegado.jsx': () => null, './SectorStudy.jsx': () => null, './SectorStudyLoader.jsx': () => null, './CentralSetorial.css': {} }
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, window, document, require: name => deps[name] ?? require(name) })
  const render = () => {
    renderer = hookRenderer(() => module.exports.default({ view, onView(next) { entries = entries.slice(0, index + 1); entries.push({ view: next, state: null }); index++; view = next; window.scrollTo({ top: 0 }) } }))
  }
  render()
  t.after(() => renderer.close())
  const key = node => node.props?.id || (String(node.props?.className).includes('central-surface') ? 'surface' : `${node.type}:${node.props?.['aria-label'] || text(node)}`)
  const syncDom = () => {
    const previous = new Map(elements)
    elements.clear()
    for (const node of nodes(renderer.value).filter(node => typeof node.type === 'string')) {
      const k = key(node), dom = previous.get(k) || { id: node.props?.id || '', key: k }
      dom.focus = () => { document.activeElement = dom; calls.push({ focus: k }) }
      dom.scrollIntoView = () => calls.push({ scrollIntoView: k })
      elements.set(k, dom)
      if (node.ref) node.ref.current = dom
    }
    if (document.activeElement !== body && ![...elements.values()].includes(document.activeElement)) document.activeElement = body
  }
  const flushFrames = () => { for (const [id, fn] of [...frames]) { frames.delete(id); fn() } }
  const settle = async ({ frameBeforeQueryCommit = false, deferFrames = false } = {}) => {
    renderer.render()
    // A passive effect may enqueue query state while the next frame already runs.
    // Keep that intermediate committed tree observable to catch focus-before-DOM races.
    if (frameBeforeQueryCommit) { syncDom(); flushFrames() }
    await renderer.settle(); syncDom(); if (!deferFrames) flushFrames()
    await renderer.settle(); syncDom()
  }
  await settle()
  return {
    get tree() { return renderer.value }, get view() { return view }, get state() { return entries[index].state }, get calls() { return calls },
    get active() { return document.activeElement.key }, get length() { return entries.length },
    get query() { return nodes(renderer.value).find(node => node.type === 'input' && node.props.type === 'search').props.value },
    async queryTo(value) { const node = nodes(renderer.value).find(node => node.type === 'input'); elements.get(key(node)).focus(); node.props.onChange({ target: { value } }); await settle() },
    async click(name, index = 0) { const node = nodes(renderer.value).filter(node => node.type === 'button' && (node.props['aria-label'] || text(node)) === name)[index]; assert.ok(node, name); elements.get(key(node)).focus(); node.props.onClick(); await settle() },
    async clickId(id) { const node = nodes(renderer.value).find(node => node.props?.id === id); assert.ok(node, id); elements.get(id).focus(); node.props.onClick(); await settle() },
    async back(options) { index--; view = entries[index].view; await settle(options) },
    async forward() { index++; view = entries[index].view; await settle() },
    async reload() { renderer.close(); frames.clear(); elements.clear(); document.activeElement = body; render(); await settle() },
  }
}

test('all 11 folders and 68 topic identities exist; folder breadcrumb restores focused opener', async t => {
  const h = await setup(t)
  assert.equal(nodes(h.tree).filter(node => node.props?.id?.startsWith('central-folder-')).length, 11)
  assert.equal(catalog.CATALOGO_SETORIAL.reduce((n, group) => n + group.topics.length, 0), 68)
  await h.clickId('central-folder-base-florestal')
  assert.equal(h.view, 'pasta/base-florestal')
  assert.equal(nodes(h.tree).filter(node => node.props?.id?.startsWith('central-topic-')).length, 6)
  await h.click('Todos os setores')
  assert.equal(h.active, 'central-folder-base-florestal')
})

test('search-study-breadcrumb-Back-Forward-reload restores per-entry query and keeps unrelated history state', async t => {
  const h = await setup(t)
  await h.queryTo('compensados')
  assert.equal(h.length, 1, 'typing replaces current entry')
  assert.equal(h.state.unrelatedFeature.preserved, true)
  await h.clickId('central-topic-base-florestal-3')
  assert.equal(h.view, 'topico/base-florestal/3'); assert.equal(h.query, '')
  await h.click('Todos os setores')
  assert.equal(h.query, 'compensados'); assert.equal(h.active, 'central-topic-base-florestal-3')
  await h.back(); assert.equal(h.query, ''); assert.equal(h.view, 'topico/base-florestal/3')
  await h.forward(); assert.equal(h.query, 'compensados')
  await h.reload(); assert.equal(h.query, 'compensados')
  await h.click('Limpar busca'); assert.equal(h.query, '')
  await h.reload(); assert.equal(h.query, '')
})

test('search from study restores original query and result focus using Back, then Forward opens new study', async t => {
  const h = await setup(t, 'topico/base-florestal/4')
  await h.queryTo('ciberseguranca')
  await h.clickId('central-topic-tic-1')
  assert.equal(h.query, '')
  await h.back(); assert.equal(h.query, 'ciberseguranca'); assert.equal(h.active, 'central-topic-tic-1')
  await h.reload(); assert.equal(h.query, 'ciberseguranca')
  await h.forward(); assert.equal(h.query, ''); assert.equal(h.view, 'topico/tic/1')
})

test('invalid topic routes return the catalog, never a fake study', async t => {
  for (const view of ['topico/base-florestal/', 'topico/base-florestal/-1', 'topico/base-florestal/999', 'pasta/inexistente']) {
    const h = await setup(t, view)
    assert.match(text(h.tree), /não foi encontrado/)
    assert.equal(nodes(h.tree).filter(node => node.props?.id?.startsWith('central-folder-')).length, 11)
    assert.equal(nodes(h.tree).filter(node => node.props?.className?.startsWith('central-detail')).length, 0)
  }
})

test('selecting the current study twice restores surface focus and scroll without adding history', async t => {
  const h = await setup(t, 'topico/base-florestal/3')
  for (let repeat = 0; repeat < 2; repeat++) {
    await h.queryTo('compensados')
    const callsBefore = h.calls.length
    await h.clickId('central-topic-base-florestal-3')
    assert.equal(h.query, '')
    assert.equal(h.view, 'topico/base-florestal/3')
    assert.equal(h.active, 'surface', 'persistent reading surface receives keyboard focus')
    assert.ok(h.calls.slice(callsBefore).some(call => call.scrollIntoView === 'surface'), 'current study returns to the viewport')
    assert.equal(h.length, 1, 'same-study selection does not push another history entry')
    assert.equal(h.state.centralSetorial.focusId, '', 'removed result is not saved as the focus target')
    assert.equal(h.state.unrelatedFeature.preserved, true)
  }
  await h.reload()
  assert.equal(h.query, '')
  assert.equal(h.active, 'surface')
})

test('toolbar clear-search returns focus to input on catalog, folder and study, including reload', async t => {
  for (const view of ['central', 'pasta/base-florestal', 'topico/base-florestal/3']) {
    const h = await setup(t, view)
    for (const query of ['compensados', 'ciberseguranca']) {
      await h.queryTo(query)
      await h.click('Limpar busca')
      assert.equal(h.query, '')
      assert.equal(h.active, 'search-review')
      assert.equal(h.state.centralSetorial.focusId, 'search-review')
      assert.equal(h.length, 1)
      assert.equal(h.view, view)
      assert.equal(h.state.unrelatedFeature.preserved, true)
    }
    await h.reload()
    assert.equal(h.query, '')
    assert.equal(h.active, 'search-review')
  }
})

test('empty-result clear action restores search focus and does not scroll the reader away', async t => {
  const h = await setup(t, 'topico/base-florestal/3')
  await h.queryTo('nãoexistezzz')
  const callsBefore = h.calls.length
  await h.click('Limpar busca', 1)
  assert.equal(h.query, '')
  assert.equal(h.active, 'search-review')
  assert.equal(h.state.centralSetorial.focusId, 'search-review')
  assert.equal(h.calls.slice(callsBefore).some(call => 'scroll' in call || 'scrollIntoView' in call), false)
  assert.equal(h.length, 1)
})


test('Back restores result focus only after the remembered query has committed to the DOM', async t => {
  const h = await setup(t, 'topico/base-florestal/4')
  await h.queryTo('ciberseguranca')
  await h.clickId('central-topic-tic-1')
  for (let repeat = 0; repeat < 2; repeat++) {
    const callsBefore = h.calls.length
    await h.back({ frameBeforeQueryCommit: true })
    assert.equal(h.query, 'ciberseguranca')
    assert.equal(h.active, 'central-topic-tic-1', 'focus must wait for the restored result, not fall back to the surface')
    assert.equal(h.calls.slice(callsBefore).some(call => call.focus === 'surface'), false, 'no premature fallback during the query render')
    await h.forward()
    assert.equal(h.view, 'topico/tic/1')
    assert.equal(h.query, '')
  }
  await h.back({ deferFrames: true })
  await h.queryTo('outro termo')
  assert.equal(h.active, 'search-review', 'typing cancels the old restoration instead of stealing focus')
  assert.equal(h.query, 'outro termo')
})

test('pautas aparecem na busca, abrem com status pendente e apontam para estudos existentes', async t => {
  const h = await setup(t)
  await h.queryTo('materiais de construcao')
  await h.clickId('central-research-materiais-de-construcao')
  assert.equal(h.view, 'pesquisa/materiais-de-construcao')
  assert.match(text(h.tree), /Pesquisa pendente/)
  assert.match(text(h.tree), /Investigar sazonalidade, estoques, frete/)
  await h.click('Todos os setores')
  assert.equal(h.query, 'materiais de construcao')
  assert.equal(h.active, 'central-research-materiais-de-construcao')
  await h.back()
  await h.reload()
  assert.match(text(h.tree), /Pesquisa pendente/)
  await h.click('Distribuição de materiais de construção')
  assert.equal(h.view, 'topico/atacado/2')
  await h.back()
  assert.equal(h.view, 'pesquisa/materiais-de-construcao')
})
