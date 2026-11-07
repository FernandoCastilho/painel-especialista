import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { hookRenderer } from './helpers/hooks.mjs'
import * as layout from '../src/knowledgeLayout.js'
import * as educacao from '../src/educacao.js'
import { getKnowledgeView } from '../src/knowledgeGraph.js'

const require = createRequire(import.meta.url)
const NOW = Date.parse('2026-11-07T15:00:00Z')
const allNodes = el => Array.isArray(el) ? el.flatMap(allNodes) : el && typeof el === 'object' ? [el, ...allNodes(el.props?.children)] : []
const textOf = el => Array.isArray(el) ? el.map(textOf).join('') : el && typeof el === 'object' ? textOf(el.props?.children) : typeof el === 'string' || typeof el === 'number' ? String(el) : ''
const concept = { id: 'concept:teste', type: 'concept', label: 'Conceito sintético', summary: 'Uma explicação de teste.', route: { tab: 'aprender', view: 'teste' } }
const article = { id: 'news:teste', type: 'news', label: 'Manchete sintética de teste', summary: 'Publicação relacionada por tema.', source: 'Fonte sintética', href: 'https://www.gov.br/noticia-de-teste', publishedAt: '2026-11-06', datePrecision: 'day', t: Date.parse('2026-11-06T15:00:00Z'), licenseUrl: 'https://creativecommons.org/licenses/by-nd/3.0/' }
const edge = { id: 'theme:teste', source: concept.id, target: article.id, label: 'Conexão temática', reason: 'Termo explícito no título: conceito sintético.' }
const fixture = (nodes = [concept, article], links = [edge]) => ({ nodes, links, meta: { newsCount: nodes.filter(node => node.type === 'news').length, lastUpdatedAt: NOW, coverageNotes: ['Seleção sintética; não representa uma coleta real.'] } })

async function setupMap(t, { resource = { status: 'ok', data: {} }, graph = fixture(), persisted, reduced = false } = {}) {
  const source = await readFile(new URL('../src/KnowledgeMap.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }, calls = [], destinations = [], timers = new Map()
  let clock = NOW, timerId = 0
  const matchMedia = () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} })
  const dependencies = {
    react: { ...React, useMemo: fn => fn() },
    './useDataFile.js': { useDataFile: () => resource },
    './useNewsClock.js': { useNewsClock: () => clock },
    './knowledgeGraph.js': { buildKnowledgeGraph: args => { calls.push(args); return graph }, getKnowledgeView },
    './knowledgeLayout.js': layout,
    './KnowledgeMap.css': {},
    './Help.jsx': { __esModule: true, default: ({ label, children }) => React.createElement('details', {}, React.createElement('summary', {}, label), children) },
  }
  runInNewContext(code, {
    module, exports: module.exports,
    window: { matchMedia },
    sessionStorage: { getItem: () => persisted ? JSON.stringify(persisted) : null, setItem() {} },
    setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id },
    clearTimeout: id => timers.delete(id),
    require: name => dependencies[name] ?? require(name),
  })
  const render = hookRenderer(() => module.exports.default({ goto: (...args) => destinations.push(args) }))
  t.after(() => render.close())
  await render.settle()
  return {
    render, calls, destinations,
    html: () => renderToStaticMarkup(render.value),
    find: predicate => allNodes(render.value).find(predicate),
    button(label) { return this.find(node => node.type === 'button' && (node.props['aria-label'] || textOf(node)) === label) },
    async click(label) { const button = this.button(label); assert.ok(button, label); assert.notEqual(button.props.disabled, true); button.props.onClick(); await render.settle() },
    async search(value) { this.find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value } }); await render.settle() },
    async advance(milliseconds) { clock += milliseconds; render.render(); await render.settle() },
  }
}

test('map distinguishes loading, partial failure and empty news without inventing coverage', async t => {
  const loading = await setupMap(t, { resource: { status: 'loading' }, graph: fixture([], []) })
  assert.match(loading.html(), /Carregando notícias/)
  const failed = await setupMap(t, { resource: { status: 'error', error: 'mensagem interna sensível' }, graph: fixture([], []) })
  assert.match(failed.html(), /Algumas fontes estão indisponíveis ou atrasadas/)
  assert.doesNotMatch(failed.html(), /mensagem interna sensível/)
  const empty = await setupMap(t, { graph: fixture([], []) })
  assert.match(empty.html(), /Nenhuma notícia dos últimos 7 dias disponível nesta seleção/)
  assert.match(empty.html(), /Nenhum ponto encontrado/)
  assert.match(empty.html(), /não representa toda a imprensa/)
})

test('selected day-only article shows original source, day, link, licence and thematic rationale', async t => {
  const h = await setupMap(t, { persisted: { selectedId: article.id, types: ['sector', 'concept', 'news'] } })
  const html = h.html()
  assert.match(html, /Fonte sintética/)
  assert.match(html, /dateTime="2026-11-06"/)
  assert.match(html, /06\/11\/2026/)
  assert.match(html, /horário não informado/)
  assert.doesNotMatch(html, /06\/11\/2026,\s*\d/)
  assert.ok(html.includes(article.href))
  assert.match(html, /target="_blank" rel="noopener noreferrer"/)
  assert.match(html, /Licença de uso/)
  assert.match(html, /Conexão temática/)
  assert.match(html, /Termo explícito no título/)
  assert.match(html, /Não comprovam causa ou impacto/)
})

test('list preserves a day-only publication label instead of shifting its UTC midnight to the previous day', async t => {
  const dayArticle = { ...article, publishedAt: '2026-11-03', t: Date.parse('2026-11-03T00:00:00Z') }
  const h = await setupMap(t, { graph: fixture([concept, dayArticle]) })
  await h.click('Lista')
  const list = h.find(node => node.props?.className === 'km-list')
  assert.match(textOf(list), /Fonte sintética · 03\/11\/2026/)
  assert.doesNotMatch(textOf(list), /02\/11\/2026/)
})

test('list, search, type filters and reset retain understandable results and navigable content', async t => {
  const h = await setupMap(t)
  await h.click('Lista')
  assert.equal(h.button('Lista').props['aria-pressed'], true)
  assert.match(h.html(), /aria-label="Pontos do mapa"/)
  assert.match(h.html(), /Fonte sintética/)
  await h.search('nãoexiste')
  assert.match(h.html(), /Nenhum ponto encontrado/)
  await h.click('Voltar à matriz')
  assert.equal(h.find(node => node.type === 'input').props.value, '')
  await h.click('Notícias · 7 dias')
  assert.equal(h.button('Notícias · 7 dias').props['aria-pressed'], false)
  assert.doesNotMatch(h.html(), /Manchete sintética de teste/)
  const item = h.find(node => node.type === 'button' && node.props.className?.includes('km-list-item'))
  assert.ok(item)
  item.props.onClick()
  await h.render.settle()
  assert.equal(h.button('Retomar movimento').props['aria-pressed'], true)
  await h.click('Abrir conceito ↗')
  assert.deepEqual(h.destinations, [['aprender', 'teste']])
  assert.match(h.html(), /Conexões diretas/)
  await h.click('Fechar detalhes')
  assert.match(h.html(), /Uma rede para entender melhor/)
})

test('selection shows only the point and its direct neighbours; returning to the matrix restores every point', async t => {
  const sector = { id: 'sector:teste', type: 'sector', label: 'Setor sintético', summary: 'Segundo nível.', route: { tab: 'setores', view: 'teste' } }
  const unrelated = { id: 'concept:isolado', type: 'concept', label: 'Conceito isolado', summary: 'Sem vínculo com a seleção.' }
  const secondEdge = { id: 'theme:segundo-nivel', source: article.id, target: sector.id, label: 'Conexão temática', reason: 'Segundo vínculo sintético.' }
  const h = await setupMap(t, { graph: fixture([concept, article, sector, unrelated], [edge, secondEdge]) })
  await h.click('Lista')
  const visible = () => allNodes(h.render.value).filter(node => node.type === 'button' && node.props.className?.includes('km-list-item')).map(node => textOf(node))
  const choose = async label => {
    const item = h.find(node => node.type === 'button' && node.props.className?.includes('km-list-item') && textOf(node).includes(label))
    assert.ok(item, label)
    item.props.onClick()
    await h.render.settle()
  }
  assert.equal(visible().length, 4)
  await choose(concept.label)
  assert.equal(visible().length, 2)
  assert.ok(visible().some(label => label.includes(concept.label)))
  assert.ok(visible().some(label => label.includes(article.label)))
  assert.ok(!visible().some(label => label.includes(sector.label)))
  assert.ok(!visible().some(label => label.includes(unrelated.label)))
  await h.click(`${article.label} ›`)
  assert.equal(visible().length, 3)
  assert.ok(visible().some(label => label.includes(sector.label)))
  assert.ok(!visible().some(label => label.includes(unrelated.label)))
  await h.click('Voltar à matriz')
  assert.equal(visible().length, 4)
  assert.match(h.html(), /Uma rede para entender melhor/)
  assert.equal(h.button('Pausar movimento').props['aria-pressed'], false)
})

test('reduced motion cannot be resumed by the control and clock changes rebuild publication selection', async t => {
  const h = await setupMap(t, { reduced: true })
  assert.equal(h.button('Movimento reduzido').props.disabled, true)
  assert.equal(h.button('Movimento reduzido').props['aria-pressed'], true)
  assert.equal(h.calls.at(-1).now, NOW)
  await h.advance(60000)
  assert.equal(h.calls.at(-1).now, NOW + 60000)
})

test('Aprender starts in map mode and keeps concept routes and the original list available', async t => {
  const source = await readFile(new URL('../src/Aprender.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }, destinations = []
  const passthrough = ({ children }) => React.createElement('div', {}, children)
  const dependencies = {
    react: { ...React, useMemo: fn => fn() },
    './educacao.js': educacao,
    './Aprender.css': {},
    './Avisos.jsx': { Aviso: passthrough },
    './TerminalDesk.jsx': { Panel: passthrough },
    './Help.jsx': { __esModule: true, default: passthrough },
    './KnowledgeMap.jsx': { __esModule: true, default: () => React.createElement('section', { 'data-test': 'map-screen' }, 'Mapa sintético') },
  }
  runInNewContext(code, { module, exports: module.exports, window: { matchMedia: () => ({ matches: false }) }, require: name => dependencies[name] ?? require(name) })
  let view = ''
  const render = hookRenderer(() => module.exports.default({ view, goto: (...args) => destinations.push(args) }))
  t.after(() => render.close())
  await render.settle()
  const button = label => allNodes(render.value).find(node => node.type === 'button' && textOf(node) === label)
  assert.match(renderToStaticMarkup(render.value), /data-test="map-screen"/)
  assert.equal(button('Mapa do conhecimento').props['aria-pressed'], true)
  button('Conceitos').props.onClick()
  assert.deepEqual(destinations.at(-1), ['aprender', 'conceitos'])
  view = 'conceitos'; render.render(); await render.settle()
  assert.match(renderToStaticMarkup(render.value), /aria-label="Conceitos"/)
  assert.equal(button('Conceitos').props['aria-pressed'], true)
  button('Mapa do conhecimento').props.onClick()
  assert.deepEqual(destinations.at(-1), ['aprender', 'mapa'])
  view = 'sofr'; render.render(); await render.settle()
  assert.match(renderToStaticMarkup(render.value), /Explicação simples/)
  assert.doesNotMatch(renderToStaticMarkup(render.value), /data-test="map-screen"/)
  button('Conceitos').props.onClick()
  assert.deepEqual(destinations.at(-1), ['aprender', 'sofr'])
})

test('surface handlers support pinch, remaining-finger panning, cancellation and drag without accidental selection', async t => {
  // Expose the same internal component only in this compiled test. Effects and
  // DOM APIs are stubbed: this tests event-state transitions, not device gestures.
  const source = await readFile(new URL('../src/KnowledgeMap.jsx', import.meta.url), 'utf8')
  const { code } = await transform(`${source}\nexport { GraphSurface }`, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }, selected = []
  const dependencies = {
    react: { ...React, useMemo: fn => fn(), useEffect() {} },
    './useDataFile.js': {}, './useNewsClock.js': {}, './knowledgeGraph.js': {},
    './knowledgeLayout.js': layout, './KnowledgeMap.css': {}, './Help.jsx': {},
  }
  runInNewContext(code, { module, exports: module.exports, require: name => dependencies[name] ?? require(name) })
  const graph = fixture()
  const render = hookRenderer(() => module.exports.GraphSurface({ graph, selectedId: '', onSelect: id => selected.push(id), paused: true, reduced: false, restart: 0, cameraReset: 0, labels: false }))
  t.after(() => render.close())
  await render.settle()
  render.value.ref.current = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 540 }), setPointerCapture() {} }
  const pointer = (id, x, y, node = null, type = 'touch') => ({ pointerId: id, clientX: x, clientY: y, pointerType: type, button: 0, type: 'pointerup', target: { closest: () => node ? { getAttribute: () => node } : null } })
  const send = async (handler, event) => { render.value.props[handler](event); await render.settle() }
  const transformOf = () => allNodes(render.value).find(node => node.type === 'g' && node.props.transform?.includes('scale(')).props.transform
  await send('onPointerDown', pointer(1, 100, 100))
  await send('onPointerDown', pointer(2, 200, 100))
  await send('onPointerMove', pointer(2, 300, 100))
  assert.equal(transformOf(), 'translate(-100 -100) scale(2)')
  await send('onPointerUp', pointer(2, 300, 100))
  await send('onPointerMove', pointer(1, 120, 115))
  assert.equal(transformOf(), 'translate(-80 -85) scale(2)')
  await send('onPointerCancel', { ...pointer(1, 120, 115), type: 'pointercancel' })
  await send('onPointerMove', pointer(1, 500, 500))
  assert.equal(transformOf(), 'translate(-80 -85) scale(2)')
  await send('onPointerDown', pointer(3, 200, 200, concept.id))
  await send('onPointerMove', pointer(3, 260, 250, concept.id))
  await send('onPointerUp', pointer(3, 260, 250, concept.id))
  assert.deepEqual(selected, [])
  await send('onPointerDown', pointer(4, 260, 250, concept.id))
  await send('onPointerUp', pointer(4, 260, 250, concept.id))
  assert.deepEqual(selected, [concept.id])
  assert.doesNotMatch(transformOf(), /NaN|Infinity/)
})

test('resuming the simulation preserves the camera while the explicit camera reset returns to the matrix', async t => {
  const source = await readFile(new URL('../src/KnowledgeMap.jsx', import.meta.url), 'utf8')
  const { code } = await transform(`${source}\nexport { GraphSurface }`, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  const stage = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 540 }), addEventListener() {}, removeEventListener() {} }
  let refIndex = 0
  const dependencies = {
    react: { ...React, useMemo: fn => fn(), useRef: initial => { const ref = React.useRef(initial); if (refIndex++ === 0) ref.current = stage; return ref } },
    './useDataFile.js': {}, './useNewsClock.js': {}, './knowledgeGraph.js': {},
    './knowledgeLayout.js': layout, './KnowledgeMap.css': {}, './Help.jsx': {},
  }
  runInNewContext(code, {
    module, exports: module.exports,
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, document: { hidden: false },
    require: name => dependencies[name] ?? require(name),
  })
  const graph = fixture()
  const props = { graph, selectedId: '', onSelect() {}, paused: true, reduced: false, restart: 0, cameraReset: 0, labels: false }
  const render = hookRenderer(() => { refIndex = 0; return module.exports.GraphSurface(props) })
  t.after(() => render.close())
  await render.settle()
  const camera = () => allNodes(render.value).find(node => node.type === 'g' && node.props.transform?.includes('scale(')).props.transform
  const zoom = allNodes(render.value).find(node => node.type === 'button' && node.props['aria-label'] === 'Aproximar mapa')
  zoom.props.onClick()
  await render.settle()
  const zoomed = camera()
  assert.match(zoomed, /scale\(1\.25\)/)
  props.paused = false; props.restart++
  render.render(); await render.settle()
  assert.equal(camera(), zoomed)
  props.paused = true; props.restart++
  render.render(); await render.settle()
  assert.equal(camera(), zoomed)
  props.cameraReset++
  render.render(); await render.settle()
  assert.equal(camera(), 'translate(0 0) scale(1)')
})
