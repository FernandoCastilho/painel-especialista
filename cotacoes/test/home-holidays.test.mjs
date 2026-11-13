import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'

const result = buildSync({ entryPoints: [fileURLToPath(new URL('../src/HolidayNotice.jsx', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/jsx-runtime'] })
const module = { exports: {} }
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
const Notice = module.exports.default
const props = { pracas: ['BR', 'NY', 'CN', 'JP'], expanded: true }

test('home includes international holidays despite saved Brazil-only preference', () => {
  const original = Date.now
  Date.now = () => Date.parse('2026-11-08T15:00:00Z')
  try {
    const html = renderToStaticMarkup(createElement(Notice, { ...props, hol: { pracas: ['BR'], loaded: true, ctx: { cn: { 2026: { off: new Map(), work: new Set() } } } } }))
    assert.doesNotMatch(html, /open=""/)
    assert.match(html, /Veterans Day/)
    assert.match(html, /11\/11\/2026 · quarta-feira \(em 3 dias\)/)
    assert.match(html, /15\/11\/2026 · domingo \(em 7 dias\)/)
    assert.match(html, /20\/11\/2026 · sexta-feira/)
    assert.match(html, /26\/11\/2026 · quinta-feira/)
    assert.match(html, /Thanksgiving/)
    assert.match(html, /Ação de Graças Trabalhista/)
    assert.match(html, /Proclamação da República/)
    assert.doesNotMatch(html, /China: nenhum feriado|referência financeira|primeiro:/)
    assert.match(html, /<summary><b>Feriados nos próximos 30 dias<\/b><\/summary>/)
    assert.doesNotMatch(html, /<p class="status">/)
    assert.match(html, /EUA \(Federal Reserve\)/)
    assert.match(html, /Japão/)
    assert.match(html, /Brasil/)
    assert.doesNotMatch(html, /Finados|Dia da Cultura/)
    assert.ok(html.indexOf('Veterans Day') < html.indexOf('Proclamação da República'))
    assert.match(readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8'), /HolidayNotice hol=\{hol\} pracas=\{\['BR', 'NY', 'CN', 'JP'\]\} expanded/)
  } finally { Date.now = original }
})

test('China distinguishes unavailable data from a period without holidays', () => {
  const original = Date.now
  Date.now = () => Date.parse('2026-11-08T15:00:00Z')
  try {
    const loading = renderToStaticMarkup(createElement(Notice, { ...props, hol: { pracas: ['BR'], loaded: false } }))
    assert.match(loading, /aguardando os dados oficiais/)
    const missing = renderToStaticMarkup(createElement(Notice, { ...props, hol: { pracas: ['BR'], loaded: true } }))
    assert.match(missing, /2026 indisponível nesta consulta/)
    assert.doesNotMatch(missing, /China: nenhum feriado/)
    assert.doesNotMatch(missing, /2027/)
  } finally { Date.now = original }
})

test('compact and list modes preserve their existing content', () => {
  const original = Date.now
  Date.now = () => Date.parse('2026-11-08T15:00:00Z')
  try {
    const hol = { pracas: ['NY'], loaded: true }
    const compact = renderToStaticMarkup(createElement(Notice, { hol }))
    assert.match(compact, /primeiro:/)
    assert.match(compact, /Veterans Day/)
    assert.doesNotMatch(compact, /open=""/)
    const list = renderToStaticMarkup(createElement(Notice, { hol, list: true }))
    assert.match(list, /Veterans Day/)
    assert.doesNotMatch(list, /<summary|<details/)
  } finally { Date.now = original }
})

test('expanded home preserves Chinese holiday rows when available', () => {
  const original = Date.now
  Date.now = () => Date.parse('2026-10-01T15:00:00Z')
  try {
    const hol = { pracas: ['BR'], loaded: true, ctx: { cn: { 2026: { off: new Map([['2026-10-01', 'Dia Nacional (fixture)']]), work: new Set() } } } }
    const html = renderToStaticMarkup(createElement(Notice, { ...props, hol }))
    assert.match(html, /Dia Nacional \(fixture\)/)
    assert.match(html, /China/)
    assert.doesNotMatch(html, /referência financeira|primeiro:/)
  } finally { Date.now = original }
})
