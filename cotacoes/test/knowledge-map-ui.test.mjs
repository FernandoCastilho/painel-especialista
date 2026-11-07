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
import { canonicalNewsUrl } from '../src/sectorNews.js'

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
  const { code } = await transform(`${source}\nexport { NodeContextMenu }`, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }, calls = [], destinations = [], opened = [], timers = new Map(), listeners = new Map()
  let clock = NOW, timerId = 0, elapsed = 0
  const matchMedia = () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} })
  const dependencies = {
    react: { ...React, useMemo: fn => fn() },
    'react-dom': { createPortal: element => element },
    './sectorNews.js': { canonicalNewsUrl },
    './useDataFile.js': { useDataFile: () => resource },
    './useNewsClock.js': { useNewsClock: () => clock },
    './knowledgeGraph.js': { buildKnowledgeGraph: args => { calls.push(args); return graph }, getKnowledgeView },
    './knowledgeLayout.js': layout,
    './KnowledgeMap.css': {},
    './Help.jsx': { __esModule: true, default: ({ label, children }) => React.createElement('details', {}, React.createElement('summary', {}, label), children) },
  }
  const document = { body: {}, activeElement: null, addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) }
  runInNewContext(code, {
    module, exports: module.exports,
    window: { matchMedia, innerWidth: 1280, innerHeight: 900, open: (...args) => { opened.push(args); return null }, addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) },
    document,
    requestAnimationFrame: callback => { callback(); return 1 }, cancelAnimationFrame() {},
    sessionStorage: { getItem: () => persisted ? JSON.stringify(persisted) : null, setItem() {} },
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: elapsed + delay }); return id },
    clearTimeout: id => timers.delete(id),
    require: name => dependencies[name] ?? require(name),
  })
  const render = hookRenderer(() => module.exports.default({ goto: (...args) => destinations.push(args) }))
  t.after(() => render.close())
  await render.settle()
  return {
    render, calls, destinations, opened, listeners,
    html: () => renderToStaticMarkup(render.value),
    find: predicate => allNodes(render.value).find(predicate),
    button(label) { return this.find(node => node.type === 'button' && (node.props['aria-label'] || textOf(node)) === label) },
    async click(label) { const button = this.button(label); assert.ok(button, label); assert.notEqual(button.props.disabled, true); button.props.onClick(); await render.settle() },
    async search(value) { this.find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value } }); await render.settle() },
    async advance(milliseconds) { clock += milliseconds; render.render(); await render.settle() },
    async advanceTimers(milliseconds) {
      elapsed += milliseconds
      for (const [id, timer] of [...timers]) if (timer.at <= elapsed && timers.has(id)) { timers.delete(id); timer.callback() }
      await render.settle()
    },
    async contextFor(item) {
      const trigger = { focusCount: 0, isConnected: true, focus() { this.focusCount++; document.activeElement = this }, getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 44 }) }
      item.props.onContextMenu({ clientX: 50, clientY: 60, currentTarget: trigger, preventDefault() {}, stopPropagation() {} })
      await render.settle()
      return trigger
    },
    async menu() {
      const component = this.find(node => node.type === module.exports.NodeContextMenu)
      assert.ok(component, 'menu component is open')
      let props = component.props
      const menuRender = hookRenderer(() => module.exports.NodeContextMenu(props))
      t.after(() => menuRender.close())
      await menuRender.settle()
      const focused = []
      const items = [0, 1].map(index => ({ focus() { focused.push(index); document.activeElement = this } }))
      menuRender.value.ref.current = { getBoundingClientRect: () => ({ width: 240, height: 160 }), querySelector: () => items[0], querySelectorAll: () => items, contains: element => items.includes(element) }
      props = { ...props, point: { ...props.point } }
      menuRender.render(); await menuRender.settle()
      return {
        render: menuRender, focused, items,
        find: predicate => allNodes(menuRender.value).find(predicate),
        async click(label) {
          const target = allNodes(menuRender.value).find(node => node.props?.role === 'menuitem' && textOf(node) === label)
          assert.ok(target, label)
          assert.notEqual(target.props.disabled, true)
          target.props.onClick()
          await render.settle()
          menuRender.close()
        },
        async key(key) { menuRender.value.props.onKeyDown({ key, preventDefault() {}, stopPropagation() {} }); await render.settle() },
      }
    },
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
  const relatedNews = h.button(`${article.label} ›`)
  await h.contextFor(relatedNews)
  const menu = await h.menu()
  await menu.click('Ver conexões')
  assert.equal(visible().length, 3)
  assert.ok(visible().some(label => label.includes(sector.label)))
  assert.ok(!visible().some(label => label.includes(unrelated.label)))
  await h.click('Voltar à matriz')
  assert.equal(visible().length, 4)
  assert.match(h.html(), /Uma rede para entender melhor/)
  assert.equal(h.button('Pausar movimento').props['aria-pressed'], false)
})

test('clicking a news item opens its canonical HTTPS URL with opener isolation; unsafe URLs never open', async t => {
  const tracked = { ...article, href: 'https://example.org/materia?utm_source=teste#trecho' }
  const h = await setupMap(t, { graph: fixture([concept, tracked]) })
  await h.click('Lista')
  const row = h.find(node => node.type === 'button' && node.props.className?.includes('km-list-item km-news'))
  row.props.onClick(); await h.render.settle()
  assert.deepEqual(h.opened, [['https://example.org/materia', '_blank', 'noopener,noreferrer']])
  assert.equal(h.destinations.length, 0)
  assert.equal(h.find(node => node.props?.className === 'km-publication'), undefined)
  for (const href of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', 'http://example.org/test', 'https://user:password@example.org/test', 'https://example.org:8443/test']) {
    const unsafe = await setupMap(t, { graph: fixture([{ ...article, href }], []) })
    await unsafe.click('Lista')
    const item = unsafe.find(node => node.type === 'button' && node.props.className?.includes('km-list-item km-news'))
    item.props.onClick(); await unsafe.render.settle()
    assert.deepEqual(unsafe.opened, [], href)
    await unsafe.contextFor(item)
    const menu = await unsafe.menu()
    const unavailable = menu.find(node => node.props?.role === 'menuitem' && textOf(node) === 'Ir para a página ↗')
    assert.equal(unavailable.type, 'button')
    assert.equal(unavailable.props.disabled, true, href)
    menu.render.close()
  }
})

test('context menu opens sector/concept routes and offers a safe native link for news', async t => {
  const sector = { id: 'sector:industrial', type: 'sector', label: 'Setor de teste', route: { tab: 'setores', view: 'pasta/industria' } }
  for (const node of [concept, sector]) {
    const h = await setupMap(t, { graph: fixture([node], []) })
    await h.click('Lista')
    const item = h.find(el => el.type === 'button' && el.props.className?.includes('km-list-item'))
    await h.contextFor(item)
    const menu = await h.menu()
    assert.equal(menu.find(el => el.props?.role === 'menu').props['aria-label'], 'Ações do ponto')
    assert.equal(menu.find(el => el.props?.role === 'menuitem' && textOf(el) === 'Ir para a página ↗').type, 'button')
    await menu.click('Ir para a página ↗')
    assert.deepEqual(h.destinations, [[node.route.tab, node.route.view]])
    assert.deepEqual(h.opened, [])
    assert.equal(h.find(el => el.type?.name === 'NodeContextMenu'), undefined)
  }
  const h = await setupMap(t)
  await h.click('Lista')
  const item = h.find(el => el.type === 'button' && el.props.className?.includes('km-list-item km-news'))
  const trigger = await h.contextFor(item)
  const menu = await h.menu()
  const link = menu.find(el => el.props?.role === 'menuitem' && el.type === 'a')
  assert.equal(link.props.href, article.href)
  assert.equal(link.props.target, '_blank')
  assert.equal(link.props.rel, 'noopener noreferrer')
  await menu.click('Ver conexões')
  assert.equal(h.find(el => el.props?.className === 'km-publication')?.type, 'p')
  assert.deepEqual(h.opened, [])
  assert.equal(trigger.focusCount, 1)
})

test('context menu focuses its first action, supports arrow/Home/End keys and restores the trigger on Escape', async t => {
  const h = await setupMap(t)
  await h.click('Lista')
  const item = h.find(el => el.type === 'button' && el.props.className?.includes('km-list-item km-concept'))
  const trigger = await h.contextFor(item)
  const menu = await h.menu()
  assert.deepEqual(menu.focused, [0])
  await menu.key('ArrowDown')
  await menu.key('Home')
  await menu.key('End')
  await menu.key('ArrowUp')
  assert.deepEqual(menu.focused, [0, 1, 0, 1, 0])
  await menu.key('Escape')
  assert.equal(trigger.focusCount, 1)
  assert.equal(h.find(el => el.type?.name === 'NodeContextMenu'), undefined)
  assert.deepEqual(h.opened, [])
})

test('context menu positioning uses the document viewport excluding the scrollbar and constrains narrow screens', async () => {
  const source = await readFile(new URL('../src/KnowledgeMap.jsx', import.meta.url), 'utf8')
  const { code } = await transform(`${source}\nexport { contextPosition }`, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }, document = { documentElement: { clientWidth: 305, clientHeight: 650 } }
  const dependencies = {
    react: React, 'react-dom': { createPortal: element => element }, './sectorNews.js': { canonicalNewsUrl },
    './useDataFile.js': {}, './useNewsClock.js': {}, './knowledgeGraph.js': {},
    './knowledgeLayout.js': {}, './KnowledgeMap.css': {}, './Help.jsx': {},
  }
  runInNewContext(code, { module, exports: module.exports, document, window: { innerWidth: 320, innerHeight: 700 }, require: name => dependencies[name] ?? require(name) })
  const position = module.exports.contextPosition
  const rightBottom = position({ clientX: 319, clientY: 699 })
  assert.equal(rightBottom.x, 17)
  assert.equal(rightBottom.y, 482)
  assert.equal(rightBottom.maxWidth, 289)
  assert.ok(rightBottom.x + 280 <= document.documentElement.clientWidth - 8)
  assert.ok(rightBottom.y + 160 <= document.documentElement.clientHeight - 8)
  document.documentElement = { clientWidth: 180, clientHeight: 260 }
  const narrow = position({ clientX: 500, clientY: 500 }, 400, 200)
  assert.equal(narrow.x, 8)
  assert.equal(narrow.maxWidth, 164)
  assert.equal(narrow.y, 52)
  assert.ok(narrow.x + narrow.maxWidth <= 172)
  assert.ok(narrow.y + 200 <= 252)
  const upperLeft = position({ clientX: -20, clientY: -30 })
  assert.equal(upperLeft.x, 8)
  assert.equal(upperLeft.y, 8)
  document.documentElement = undefined
  const fallback = position({ clientX: 500, clientY: 900 })
  assert.equal(fallback.x, 32)
  assert.equal(fallback.y, 532)
})

test('long press on a news card opens actions and consumes the following synthetic click', async t => {
  const h = await setupMap(t)
  await h.click('Lista')
  const item = h.find(el => el.type === 'button' && el.props.className?.includes('km-list-item km-news'))
  const trigger = { focus() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 44 }) }
  item.props.onPointerDown({ pointerType: 'touch', clientX: 30, clientY: 40, currentTarget: trigger })
  await h.advanceTimers(499)
  assert.equal(h.find(el => el.type?.name === 'NodeContextMenu'), undefined)
  await h.advanceTimers(1)
  assert.ok(h.find(el => el.type?.name === 'NodeContextMenu'))
  item.props.onPointerUp()
  item.props.onClick()
  await h.render.settle()
  assert.deepEqual(h.opened, [])
  const menu = await h.menu()
  await menu.click('Ver conexões')
  assert.ok(h.find(el => el.props?.className === 'km-publication'))
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
    'react-dom': { createPortal: element => element }, './sectorNews.js': { canonicalNewsUrl },
    './useDataFile.js': {}, './useNewsClock.js': {}, './knowledgeGraph.js': {},
    './knowledgeLayout.js': layout, './KnowledgeMap.css': {}, './Help.jsx': {},
  }
  runInNewContext(code, { module, exports: module.exports, setTimeout, clearTimeout, require: name => dependencies[name] ?? require(name) })
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
    'react-dom': { createPortal: element => element }, './sectorNews.js': { canonicalNewsUrl },
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

test('graph news activation is suppressed after drag, pinch, cancellation and long press; keyboard actions are distinct', async t => {
  const source = await readFile(new URL('../src/KnowledgeMap.jsx', import.meta.url), 'utf8')
  const { code } = await transform(`${source}\nexport { GraphSurface }`, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }, activated = [], contexts = [], focused = [], timers = new Map()
  let elapsed = 0, timerId = 0
  const dependencies = {
    react: { ...React, useMemo: fn => fn(), useEffect() {} },
    'react-dom': { createPortal: element => element }, './sectorNews.js': { canonicalNewsUrl },
    './useDataFile.js': {}, './useNewsClock.js': {}, './knowledgeGraph.js': {},
    './knowledgeLayout.js': layout, './KnowledgeMap.css': {}, './Help.jsx': {},
  }
  runInNewContext(code, {
    module, exports: module.exports,
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: elapsed + delay }); return id },
    clearTimeout: id => timers.delete(id),
    require: name => dependencies[name] ?? require(name),
  })
  const graph = fixture()
  const render = hookRenderer(() => module.exports.GraphSurface({ graph, selectedId: '', onSelect() {}, onActivate: id => activated.push(id), onContextMenu: (id, point) => contexts.push({ id, point }), paused: true, reduced: false, restart: 0, cameraReset: 0, labels: false }))
  t.after(() => render.close())
  await render.settle()
  const targets = new Map(graph.nodes.map(node => [node.id, { getAttribute: () => node.id, getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 44 }), focus: () => focused.push(node.id) }]))
  render.value.ref.current = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 540 }), setPointerCapture() {}, querySelectorAll: () => [...targets.values()] }
  const pointer = (id, x, y, node = null) => ({ pointerId: id, clientX: x, clientY: y, pointerType: 'touch', button: 0, type: 'pointerup', target: { closest: () => targets.get(node) || null } })
  const send = async (handler, event) => { render.value.props[handler](event); await render.settle() }
  const advance = async delay => { elapsed += delay; for (const [id, timer] of [...timers]) if (timer.at <= elapsed && timers.has(id)) { timers.delete(id); timer.callback() } await render.settle() }
  const newsNode = () => allNodes(render.value).find(node => node.props?.['data-node-id'] === article.id)
  await send('onPointerDown', pointer(1, 100, 100, article.id))
  await advance(499)
  assert.equal(contexts.length, 0)
  await advance(1)
  assert.equal(contexts.length, 1)
  assert.equal(contexts[0].id, article.id)
  await send('onPointerUp', pointer(1, 100, 100, article.id))
  newsNode().props.onClick({ detail: 1 })
  assert.deepEqual(activated, [])
  await send('onPointerDown', pointer(2, 100, 100, article.id))
  await send('onPointerMove', pointer(2, 120, 120, article.id))
  await advance(600)
  await send('onPointerUp', pointer(2, 120, 120, article.id))
  assert.equal(contexts.length, 1)
  assert.deepEqual(activated, [])
  await send('onPointerDown', pointer(3, 100, 100, article.id))
  await send('onPointerDown', pointer(4, 200, 100))
  await advance(600)
  await send('onPointerMove', pointer(4, 300, 100))
  await send('onPointerUp', pointer(4, 300, 100))
  await send('onPointerUp', pointer(3, 100, 100, article.id))
  assert.equal(contexts.length, 1)
  assert.deepEqual(activated, [])
  await send('onPointerDown', pointer(5, 100, 100, article.id))
  await send('onPointerCancel', { ...pointer(5, 100, 100, article.id), type: 'pointercancel' })
  await advance(600)
  assert.equal(contexts.length, 1)
  assert.deepEqual(activated, [])
  await send('onPointerDown', pointer(6, 100, 100, article.id))
  await send('onPointerUp', pointer(6, 100, 100, article.id))
  assert.deepEqual(activated, [article.id])
  const key = name => ({ key: name, currentTarget: targets.get(article.id), shiftKey: name === 'F10', preventDefault() {}, stopPropagation() {} })
  newsNode().props.onKeyDown(key('Enter'))
  newsNode().props.onKeyDown(key(' '))
  assert.deepEqual(activated, [article.id, article.id, article.id])
  newsNode().props.onKeyDown(key('ContextMenu'))
  newsNode().props.onKeyDown(key('F10'))
  assert.equal(contexts.length, 3)
  assert.equal(contexts.at(-1).point.clientX, 60)
  assert.equal(contexts.at(-1).point.clientY, 42)
  newsNode().props.onKeyDown(key('ArrowRight'))
  assert.deepEqual(focused, [concept.id])
  assert.equal(timers.size, 0)
})
