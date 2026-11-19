import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { hookRenderer } from './helpers/hooks.mjs'
import { THEME_STORAGE_KEY } from '../src/systemTheme.js'

const require = createRequire(import.meta.url)
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []

test('appearance control supports repeated choices, Escape, focus return and outside dismissal', async t => {
  let preference = 'system', focus = 0
  const listeners = new Map(), written = []
  const document = { addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) }
  const deps = {
    react: { ...React, useId: () => 'theme-test', useSyncExternalStore: (_, read) => read() },
    './ThemeControl.css': {},
    './systemTheme.js': { readThemePreference: () => preference, subscribeTheme: () => () => {}, setThemePreference: value => { preference = value; written.push(value) } },
  }
  const source = await readFile(new URL('../src/ThemeControl.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, document, require: name => deps[name] ?? require(name) })
  const render = hookRenderer(() => module.exports.default({ className: 'theme-mobile' }))
  t.after(() => render.close())
  const find = fn => nodes(render.value).find(fn)
  const trigger = () => find(node => node.props?.className === 'theme-trigger')
  const choices = () => find(node => node.props?.role === 'group')
  const container = () => render.value
  await render.settle()
  trigger().ref.current = { focus: () => focus++ }
  container().ref.current = { contains: node => node === 'inside' }
  assert.equal(trigger().props['aria-expanded'], false)
  assert.match(trigger().props['aria-label'], /Automático/)
  assert.equal(choices(), undefined)
  for (const value of ['light', 'dark', 'system']) {
    trigger().props.onClick(); await render.settle()
    assert.equal(trigger().props['aria-expanded'], true)
    assert.equal(choices().props.id, trigger().props['aria-controls'])
    const buttons = nodes(choices()).filter(node => node.type === 'button')
    assert.equal(buttons.length, 3)
    assert.equal(buttons.filter(node => node.props['aria-pressed']).length, 1)
    buttons[['light', 'dark', 'system'].indexOf(value)].props.onClick()
    await render.settle()
    assert.equal(trigger().props['aria-expanded'], false)
    assert.equal(choices(), undefined)
    assert.equal(listeners.size, 0)
  }
  assert.deepEqual(written, ['light', 'dark', 'system'])
  assert.equal(focus, 3)
  trigger().props.onClick(); await render.settle()
  let prevented = false, stopped = false
  container().props.onKeyDown({ key: 'Escape', preventDefault() { prevented = true }, stopPropagation() { stopped = true } })
  await render.settle()
  assert.equal(prevented && stopped, true)
  assert.equal(focus, 4)
  trigger().props.onClick(); await render.settle()
  listeners.get('pointerdown')({ target: 'outside' }); await render.settle()
  assert.equal(trigger().props['aria-expanded'], false)
  trigger().props.onClick(); await render.settle()
  container().props.onBlur({ currentTarget: { contains: () => false }, relatedTarget: 'outside' })
  await render.settle()
  assert.equal(trigger().props['aria-expanded'], false)
})

test('first-paint script uses the same saved choice, fallback and browser color', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  for (const [saved, osLight, expected, blocked] of [['light', false, 'light'], ['dark', true, 'dark'], [null, true, 'light'], ['invalid', false, 'dark'], [null, true, 'light', true]]) {
    const meta = {}, document = { documentElement: { dataset: {} }, querySelector: () => meta }
    const localStorage = { getItem: key => { assert.equal(key, THEME_STORAGE_KEY); if (blocked) throw Error('blocked'); return saved } }
    runInNewContext(script, { document, localStorage, matchMedia: () => ({ matches: osLight }) })
    assert.equal(document.documentElement.dataset.theme, expected)
    assert.equal(meta.content, expected === 'light' ? '#f3f3f1' : '#050505')
  }
})

test('narrow section headers let long titles wrap without shrinking theme targets', async () => {
  const css = await readFile(new URL('../src/ThemeControl.css', import.meta.url), 'utf8')
  assert.match(css, /@media\s*\(max-width:999px\)\s*\{\s*main\.app\s+\.top:has\(\.theme-mobile\)\s*>\s*h1\s*\{[^}]*min-width:0;[^}]*white-space:normal;[^}]*overflow-wrap:anywhere;/)
  assert.match(css, /\.theme-control\s*\{[^}]*flex:0 0 44px;/)
  assert.match(css, /\.theme-control \.theme-trigger\s*\{[^}]*width:44px;[^}]*min-width:44px;[^}]*height:44px;/)
  const fixture = await readFile(new URL('./fixtures/theme-responsive.html', import.meta.url), 'utf8')
  assert.match(fixture, /data-route="setores"/)
})

test('compact desktop keeps the full brand on two lines without reducing type or controls', async () => {
  const css = await readFile(new URL('../src/ThemeControl.css', import.meta.url), 'utf8')
  assert.doesNotMatch(css, /\.topbar-brand span\s*\{\s*display:none/)
  assert.match(css, /@media\s*\(min-width:1000px\) and \(max-width:1199px\)\s*\{\s*\.topbar:has\(\.theme-control\) \.topbar-brand\s*\{[^}]*flex:none;[^}]*flex-direction:column;[^}]*justify-content:center;[^}]*gap:0;[^}]*line-height:1\.15;/)
  assert.match(css, /\.theme-control \.theme-trigger\s*\{[^}]*width:44px;[^}]*min-width:44px;[^}]*height:44px;/)
})
