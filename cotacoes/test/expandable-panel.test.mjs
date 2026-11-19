import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { hookRenderer } from './helpers/hooks.mjs'
const require = createRequire(import.meta.url)
const nodes = el => Array.isArray(el) ? el.flatMap(nodes) : el && typeof el === 'object' ? [el, ...nodes(el.props?.children)] : []

test('expansão usa dialog, não duplica conteúdo e fecha/restaura por Escape e navegação', async t => {
  const source = await readFile(new URL('../src/ExpandablePanel.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader:'jsx', format:'cjs', jsx:'automatic' })
  const listeners = new Map(), body = { style: { overflow:'auto' } }
  let shown = 0, closed = 0, focused = 0
  const dialog = { showModal: () => shown++, close: () => closed++ }
  const trigger = { focus: () => focused++ }
  const module = { exports:{} }
  const deps = { react: { ...React, useId: () => 'test-title' }, './BndesIcon.jsx': { __esModule:true, default: () => null }, './ExpandIcon.jsx': { __esModule:true, default: () => null }, './ExpandablePanel.css':{} }
  runInNewContext(code, { module, exports:module.exports, require:n => deps[n] ?? require(n), document:{body}, window:{addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k)}, queueMicrotask })
  const sentinel = React.createElement('p', {id:'unique-result'}, 'Resultado')
  const render = hookRenderer(() => {
    const tree = module.exports.default({ title:'Parcelas', children:sentinel })
    for (const node of nodes(tree)) if (node.ref) node.ref.current = node.type === 'dialog' ? dialog : trigger
    return tree
  })
  t.after(() => render.close())
  await render.settle()
  assert.equal(nodes(render.value).filter(n=>n.props?.id==='unique-result').length,1)
  nodes(render.value).find(n=>n.type==='button').props.onClick()
  await render.settle()
  assert.equal(shown,1); assert.equal(body.style.overflow,'hidden')
  assert.equal(nodes(render.value).filter(n=>n.props?.id==='unique-result').length,1)
  let prevented=false
  nodes(render.value).find(n=>n.type==='dialog').props.onCancel({preventDefault:()=>{prevented=true}})
  await render.settle()
  assert.equal(prevented,true); assert.equal(closed,1); assert.equal(body.style.overflow,'auto'); assert.equal(focused,1)
  nodes(render.value).find(n=>n.type==='button').props.onClick(); await render.settle()
  listeners.get('hashchange')(); await render.settle()
  assert.equal(shown,2); assert.equal(closed,2); assert.equal(listeners.size,0)
})
