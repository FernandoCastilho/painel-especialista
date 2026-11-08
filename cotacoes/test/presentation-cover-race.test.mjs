import React from 'react'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import * as latestRequest from '../src/latestRequest.js'
import * as presentation from '../src/apresentacao.js'
import { hookRenderer, deferred } from './helpers/hooks.mjs'
const require = createRequire(import.meta.url)
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []

test('editar site durante leitura impede capa anterior e erro antigo na tela real de montagem', async t => {
  const calls = []
  const source = await readFile(new URL('../src/Apresentacao.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' }), module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, AbortController, fetch: async () => ({ ok: false }), require: name => {
    if (name === 'react') return { ...React, useMemo: fn => fn() }
    if (name === './latestRequest.js') return latestRequest
    if (name === './apresentacao.js') return { ...presentation, buscarCapa: (site, signal) => { const request = deferred(); calls.push({ site, signal, ...request }); return request.promise } }
    if (name === './useHistory.js') return { useCentralDaily: () => ({}) }
    if (name === './useDataFile.js') return { useDataFile: () => ({}) }
    if (name === './useNewsClock.js') return { useNewsClock: () => Date.now() }
    if (name.startsWith('./')) return {}
    return require(name)
  } })
  const ui = hookRenderer(() => module.exports.default({ quotes: {} }))
  t.after(() => ui.close())
  await ui.settle()
  const input = () => nodes(ui.value).find(node => node.type === 'input' && node.props.type === 'url')
  const read = () => nodes(ui.value).find(node => node.type === 'button' && ['Ler site', 'Lendo…'].includes(node.props.children))
  input().props.onChange({ target: { value: 'old.test' } }); await ui.settle()
  const old = read().props.onClick()
  input().props.onChange({ target: { value: 'new.test' } }); await ui.settle()
  assert.equal(calls[0].signal.aborted, true)
  const current = read().props.onClick()
  calls[1].resolve({ titulo: 'Empresa atual', dominio: 'new.test' }); await current; await ui.settle()
  calls[0].reject(Error('falha antiga')); await old; await ui.settle()
  assert.equal(input().props.value, 'new.test')
  const text = JSON.stringify(ui.value)
  assert.match(text, /Empresa atual/)
  assert.doesNotMatch(text, /falha antiga|Não consegui ler/)
})
