import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as curadoria from '../src/curadoria.js'
import * as newsWindow from '../src/newsWindow.js'
import * as reforma from '../src/reforma.js'

const require = createRequire(import.meta.url)
const now = Date.parse('2026-11-07T12:00:00Z')
const removedText = /Curadoria automática|Última consulta|Última coleta completa/
const compiled = Object.fromEntries(await Promise.all(['CuradoriaNoticias', 'NoticiasPorDia'].map(async name => {
  const source = await readFile(new URL(`../src/${name}.jsx`, import.meta.url), 'utf8')
  return [name, (await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })).code]
})))
function render(id, resource) {
  function load(name) {
    const module = { exports: {} }
    runInNewContext(compiled[name], { module, exports: module.exports, require: path => {
      if (path === './useDataFile.js') return { useDataFile: () => resource }
      if (path === './useNewsClock.js') return { useNewsClock: () => now }
      if (path === './curadoria.js') return curadoria
      if (path === './newsWindow.js') return newsWindow
      if (path === './reforma.js') return reforma
      if (path === './NoticiasPorDia.jsx') return load('NoticiasPorDia')
      if (path === './Estado.jsx') return ({ children }) => createElement('p', {}, children)
      return require(path)
    } })
    return module.exports.default
  }
  return renderToStaticMarkup(createElement(load('CuradoriaNoticias'), { id }))
}
function fixture(id, label, overrides = {}) {
  return { schemaVersion: 1, windowDays: 7, generatedAt: now, topics: { [id]: {
    checkedAt: now, lastSuccessAt: now, status: 'ok',
    items: [{ title: `${label}: nova regra tributária e trabalhista`, link: `https://www.gov.br/${id}`, sourceUrl: 'https://www.gov.br', t: now - 6 * 86400000 }],
    ...overrides,
  } } }
}
for (const { id, label } of curadoria.CURADORIA_TOPICS) {
  test(`${id}: hides the two requested blocks while retaining headline, source and seven-day window`, () => {
    const data = fixture(id, label), before = structuredClone(data)
    const html = render(id, { status: 'success', data })
    assert.doesNotMatch(html, removedText)
    assert.ok(html.includes(`${label}: nova regra tributária e trabalhista`))
    assert.match(html, /Órgão público|Comitê Gestor/)
    assert.match(html, /7 dias \(168 horas\)/)
    assert.deepEqual(data, before, 'presentation does not change collector metadata or articles')
  })
  test(`${id}: retains loading and unavailable states without the removed blocks`, () => {
    for (const [status, expected] of [['loading', /Carregando a curadoria/], ['error', /Curadoria indisponível no momento/]]) {
      const html = render(id, { status, data: null })
      assert.match(html, expected)
      assert.doesNotMatch(html, removedText)
    }
  })
  test(`${id}: retains partial, old, retained and empty coverage warnings`, () => {
    const resources = [
      { data: fixture(id, label, { status: 'partial' }) },
      { data: fixture(id, label, { lastSuccessAt: now - 4 * 3600000 }) },
      { data: fixture(id, label), stale: true },
      { data: fixture(id, label), status: 'error' },
    ]
    for (const resource of resources) {
      const html = render(id, { status: 'success', ...resource })
      assert.match(html, /Atualização incompleta, atrasada ou não confirmada/)
      assert.doesNotMatch(html, removedText)
    }
    const empty = render(id, { status: 'success', data: fixture(id, label, { items: [] }) })
    assert.match(empty, /Isso não significa ausência de notícias/)
    assert.doesNotMatch(empty, removedText)
  })
}
