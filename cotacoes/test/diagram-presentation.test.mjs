import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'
import { runInNewContext } from 'node:vm'
import { hookRenderer } from './helpers/hooks.mjs'

test('ciclo compartilhado preserva foco, Voltar, prioridade do laser e restaura página', async t => {
  const listeners = new Map(), root = { inert: false }, body = { style: { overflow: 'auto' } }
  let laserFocus = 0, buttonFocus = 0, back = 0
  const window = { innerWidth: 1200, innerHeight: 900, history: { state: { route: 'setores' }, pushState(state) { this.state = state }, back() { back++; this.state = { route: 'setores' } } }, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) }
  const document = { body, getElementById: () => root, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) }
  class Observer { observe() {} disconnect() {} }
  const source = await readFile(new URL('../src/useDiagramPresentation.js', import.meta.url), 'utf8')
  const { code } = await transform(source, { format: 'cjs' }), module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, window, document, ResizeObserver: Observer, MutationObserver: Observer, require: () => ({ ...React, useLayoutEffect: React.useEffect }) })
  const render = hookRenderer(() => module.exports.useDiagramPresentation('sectorDiagramFullscreen', true))
  t.after(() => render.close())
  await render.settle()
  render.value.figureRef.current = { offsetWidth: 1000, offsetHeight: 600, parentElement: { scrollTop: 400 } }
  render.value.maximizeRef.current = { focus() { buttonFocus++ } }
  render.value.dialogRef.current = { focus() {}, querySelector: () => ({ focus() { laserFocus++ } }) }
  render.value.setExpanded(true); await render.settle()
  assert.equal(root.inert, true); assert.equal(body.style.overflow, 'hidden')
  assert.equal(render.value.figureRef.current.parentElement.scrollTop, 0)
  assert.equal(window.history.state.route, 'setores')
  assert.equal(window.history.state.sectorDiagramFullscreen, true)
  assert.ok(laserFocus > 0)
  const event = (key, defaultPrevented = false) => ({ key, defaultPrevented, preventDefault() { this.defaultPrevented = true } })
  listeners.get('keydown')(event('p')); await render.settle(); assert.equal(render.value.paused, true)
  listeners.get('keydown')(event('Escape', true)); await render.settle(); assert.equal(render.value.expanded, true)
  listeners.get('keydown')(event('Escape')); await render.settle()
  assert.equal(render.value.expanded, false); assert.equal(root.inert, false)
  assert.equal(body.style.overflow, 'auto'); assert.equal(buttonFocus, 1); assert.equal(back, 1)
  assert.equal(listeners.size, 0)
})
