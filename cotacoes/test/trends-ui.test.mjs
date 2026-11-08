import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { hookRenderer } from './helpers/hooks.mjs'
import * as model from '../src/trends.js'
import * as snapshot from '../src/trendsSnapshot.js'

const require = createRequire(import.meta.url)
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === 'object' ? [value, ...nodes(value.props?.children)] : []
async function setup(t, file = { status: 'ready', data: null }) {
  const source = await readFile(new URL('../src/GoogleTrends.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const deps = { react: React, './trends.js': model, './trendsSnapshot.js': snapshot, './GoogleTrends.css': {}, './useDataFile.js': { useDataFile: () => file } }
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, URL, URLSearchParams, require: name => deps[name] ?? require(name) })
  const render = hookRenderer(() => module.exports.default())
  t.after(() => render.close())
  await render.settle()
  return { render, all: () => nodes(render.value) }
}

test('cinco grupos e dois períodos substituem um único iframe oficial e o link correspondente', async t => {
  const h = await setup(t)
  for (const group of model.TREND_GROUPS) {
    const button = h.all().find(n => n.type === 'button' && n.props.children === group.label)
    button.props.onClick()
    button.props.onClick() // repetição não acumula widgets
    await h.render.settle()
    for (const period of model.TREND_PERIODS) {
      h.all().find(n => n.type === 'select').props.onChange({ target: { value: period } })
      await h.render.settle()
      const frames = h.all().filter(n => n.type === 'iframe')
      assert.equal(frames.length, 1)
      assert.equal(frames[0].props.src, model.trendEmbedUrl(group.id, period))
      assert.equal(frames[0].key, `${group.id}:${period}`)
      assert.ok(frames[0].props.title.includes(group.label))
      assert.equal(frames[0].props.sandbox, 'allow-scripts allow-same-origin allow-popups')
      assert.equal(frames[0].props.onLoad, undefined, 'load de iframe não comprova dados válidos')
      assert.equal(h.all().find(n => n.props?.className === 'trends-chart-link').props.href, model.exploreUrl(group.terms, period))
      const archive = h.all().find(n => n.props?.className === 'trends-archive')
      assert.equal(Boolean(archive), Boolean(snapshot.TREND_SNAPSHOT[group.id]))
      if (archive) assert.equal(archive.props.open, undefined, 'arquivo estático permanece recolhido')
    }
  }
})

test('indisponibilidade do RSS não remove histórico oficial nem fallback para a fonte', async t => {
  const h = await setup(t, { status: 'error', error: Error('offline'), data: { generatedAt: null, stale: true, items: [] } })
  assert.equal(h.all().filter(n => n.type === 'iframe').length, 1)
  assert.equal(h.all().filter(n => n.props?.className === 'trends-chart-link').length, 1)
  assert.ok(h.all().some(n => n.type === 'p' && String(n.props.children).includes('O painel não consegue confirmar')))
})
