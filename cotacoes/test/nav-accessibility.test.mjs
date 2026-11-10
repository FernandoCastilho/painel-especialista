import * as appSections from '../src/appSections.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { hookRenderer } from './helpers/hooks.mjs'

const require = createRequire(import.meta.url)
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []

async function setup(t) {
  const listeners = new Map(), destinations = []
  const document = { activeElement: null, addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) }
  const targets = Array.from({ length: 5 }, (_, i) => ({ id: i, focus() { document.activeElement = this } }))
  const triggerTarget = { focus() { document.activeElement = this } }
  const container = { contains: target => target === triggerTarget || targets.includes(target) }
  const menuTarget = { querySelectorAll: () => targets }
  const refTargets = [container, triggerTarget, menuTarget]
  let refIndex = 0
  const deps = {
    react: { ...React, useId: () => 'nav-test', useRef(initial) {
      const ref = React.useRef(initial)
      if (initial === null && ref.current === null) ref.current = refTargets[refIndex++]
      return ref
    } },
    './Nav.css': {},
    './appSections.js': appSections,
  }
  const source = await readFile(process.env.NAV_SOURCE || new URL('../src/Nav.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, document, require: name => deps[name] ?? require(name) })
  const render = hookRenderer(() => module.exports.default({ tab: 'setores', onTab: id => destinations.push(id) }))
  t.after(() => render.close())
  await render.settle()
  const find = fn => nodes(render.value).find(fn)
  return { render, document, targets, triggerTarget, listeners, destinations,
    trigger: () => find(n => n.props?.['aria-haspopup'] === 'menu'),
    menu: () => find(n => n.props?.role === 'menu'),
    menuItems: () => nodes(render.value).filter(n => n.props?.role === 'menuitem') }
}
const key = (value, extra = {}) => ({ key: value, prevented: false, stopped: false, preventDefault() { this.prevented = true }, stopPropagation() { this.stopped = true }, ...extra })

test('mobile More names its menu, focuses first item and supports arrow/Home/End keys', async t => {
  const a = await setup(t)
  a.trigger().props.onClick(); await a.render.settle()
  assert.equal(a.document.activeElement, a.targets[0], 'opening menu must focus its first item')
  assert.equal(a.trigger().props['aria-controls'], a.menu().props.id)
  assert.equal(a.menu().props['aria-labelledby'], a.trigger().props.id)
  assert.equal(a.menuItems().length, 5)
  assert.ok(a.menuItems().every(n => n.props.tabIndex === -1))
  assert.equal(a.menuItems().filter(n => n.props['aria-current'] === 'page').length, 1)
  for (const [value, target] of [['ArrowDown', 1], ['End', 4], ['ArrowDown', 0], ['ArrowUp', 4], ['Home', 0]]) {
    const event = key(value); a.menu().props.onKeyDown(event)
    assert.equal(event.prevented, true)
    assert.equal(a.document.activeElement, a.targets[target])
  }
  const escape = key('Escape'); a.listeners.get('keydown')(escape); await a.render.settle()
  assert.ok(escape.prevented && escape.stopped)
  assert.equal(a.document.activeElement, a.triggerTarget)
  assert.equal(a.trigger().props['aria-expanded'], false)
  assert.equal(a.menu(), undefined)
  assert.equal(a.listeners.size, 0)
})

test('mobile More supports repeated keyboard opening, Tab exit and selecting a destination', async t => {
  const a = await setup(t)
  for (const [value, target] of [['ArrowUp', 4], ['ArrowDown', 0]]) {
    const event = key(value); a.trigger().props.onKeyDown(event); await a.render.settle()
    assert.equal(event.prevented, true)
    assert.equal(a.document.activeElement, a.targets[target])
    const tab = key('Tab', { shiftKey: value === 'ArrowUp' }); a.menu().props.onKeyDown(tab); await a.render.settle()
    assert.equal(tab.prevented, false, 'browser keeps native forward/backward tab traversal')
    assert.equal(a.document.activeElement, a.triggerTarget)
    assert.equal(a.menu(), undefined)
  }
  a.trigger().props.onClick(); await a.render.settle()
  a.menuItems()[1].props.onClick(); await a.render.settle()
  assert.deepEqual(a.destinations, ['setores'])
  assert.equal(a.document.activeElement, a.triggerTarget)
  assert.equal(a.menu(), undefined)
})

test('mobile More closes on outside pointer/focus without stealing external focus', async t => {
  const a = await setup(t)
  for (const event of ['pointerdown', 'focusin']) {
    a.trigger().props.onClick(); await a.render.settle()
    a.listeners.get(event)({ target: a.targets[0] }); await a.render.settle()
    assert.ok(a.menu())
    a.document.activeElement = 'outside'
    a.listeners.get(event)({ target: 'outside' }); await a.render.settle()
    assert.equal(a.menu(), undefined)
    assert.equal(a.document.activeElement, 'outside')
    assert.equal(a.listeners.size, 0)
  }
})
