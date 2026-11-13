import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { hookRenderer } from './helpers/hooks.mjs'
import * as position from '../src/mascotPosition.js'
const require = createRequire(import.meta.url)
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []
async function setup(t, width = 1280, open = true) {
  const store = new Map(), listeners = new Map(), searches = []
  const localStorage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) }
  const window = { innerWidth: width, innerHeight: 900, localStorage, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) }
  const deps = { react: React, 'react-dom': { createPortal: el => el }, './mascotPosition.js': position, './mascotSlot.js': { currentMascotSlot: () => null, subscribeMascotSlot: () => () => {} } }
  const { code } = await transform(await readFile(new URL('../src/MascotDock.jsx', import.meta.url), 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, window, localStorage, require: name => deps[name] ?? require(name) })
  const renderer = hookRenderer(() => module.exports.default({ onSearch: request => searches.push(request), children: 'Owl' }))
  t.after(() => renderer.close()); await renderer.settle()
  const find = predicate => nodes(renderer.value).find(predicate)
  const mini = () => find(node => node.props?.className === 'mascot-mini')
  if (open) { mini().props.onClick(); await renderer.settle() }
  const button = label => find(node => node.props?.['aria-label'] === label)
  const dock = () => find(node => node.props?.className === 'mascot-dock')
  const key = async name => { button('Mover mascote').props.onKeyDown({ key: name, preventDefault() {} }); await renderer.settle() }
  return { renderer, find, mini, button, dock, key, store, window, listeners, searches }
}
test('mascot starts small and floating; click enlarges, shrink button and double click return to small', async t => {
  const s = await setup(t, 1280, false)
  assert.equal(s.dock(), undefined); assert.ok(s.mini())
  assert.equal(s.find(node => node.props?.className?.startsWith('mascot-tray')).props.className, 'mascot-tray')
  s.mini().props.onClick(); await s.renderer.settle(); assert.ok(s.dock()); assert.equal(s.mini(), undefined)
  s.button('Reduzir mascote').props.onClick(); await s.renderer.settle(); assert.equal(s.dock(), undefined); assert.ok(s.mini())
  s.mini().props.onClick(); await s.renderer.settle()
  s.find(node => node.props?.className === 'mascot-figure').props.onDoubleClick(); await s.renderer.settle()
  assert.equal(s.dock(), undefined); assert.ok(s.mini())
  assert.deepEqual(JSON.parse(s.store.get(position.MASCOT_PREFERENCE_KEY)), { hidden: false, desktop: null })
})
test('mascot controls: keyboard, click controls, reset, shrink and enlarge persist UI only', async t => {
  const s = await setup(t)
  const initial = s.dock().props.style.left
  await s.key('ArrowLeft'); assert.equal(s.dock().props.style.left, initial - 20)
  s.button('Mover mascote').props.onClick({ detail: 0 }); await s.renderer.settle()
  s.button('Mover para esquerda').props.onClick(); await s.renderer.settle()
  assert.equal(s.dock().props.style.left, initial - 40)
  await s.key('Home'); assert.equal(s.dock().props.style.left, initial)
  s.button('Reduzir mascote').props.onClick(); await s.renderer.settle(); assert.equal(s.dock(), undefined)
  s.mini().props.onClick(); await s.renderer.settle(); assert.ok(s.dock())
  assert.deepEqual(JSON.parse(s.store.get(position.MASCOT_PREFERENCE_KEY)), { hidden: false, desktop: null })
})
test('mascot controls: pointer clamps and resize recovers; search passes actual anchor/opener', async t => {
  const s = await setup(t), capture = { setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {} }
  s.button('Mover mascote').props.onPointerDown({ button: 0, clientX: 100, clientY: 100, pointerId: 1, currentTarget: capture })
  s.button('Mover mascote').props.onPointerMove({ clientX: -9999, clientY: -9999, pointerId: 1, currentTarget: capture }); await s.renderer.settle()
  assert.equal(s.dock().props.style.left, 8); assert.equal(s.dock().props.style.top, 96)
  // A keyboard activation must still open controls after a completed drag.
  s.button('Mover mascote').props.onClick({ detail: 0 }); await s.renderer.settle()
  assert.ok(s.button('Mover para direita'))
  s.window.innerWidth = 390; s.listeners.get('resize')(); await s.renderer.settle()
  for (let i = 0; i < 30; i++) await s.key('ArrowRight')
  assert.ok(s.dock().props.style.left <= 238)
  s.dock().ref.current = { id: 'actual-owl' }
  const opener = { id: 'actual-button' }
  s.find(node => node.props?.className === 'mascot-search').props.onClick({ currentTarget: opener })
  assert.equal(s.searches[0].opener, opener); assert.equal(s.searches[0].anchor.id, 'actual-owl')
})

test('default desktop position returns after a temporary narrow viewport', async t => {
  const s = await setup(t)
  const initial = s.dock().props.style.left
  s.window.innerWidth = 390; s.listeners.get('resize')(); await s.renderer.settle()
  s.window.innerWidth = 1280; s.listeners.get('resize')(); await s.renderer.settle()
  assert.equal(s.dock().props.style.left, initial)
})
