import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import * as content from '../src/icmsSt.js'
import { CONCEITOS, CONEXAO, buscarConceitos, conexoesDe } from '../src/educacao.js'
import { buildKnowledgeGraph } from '../src/knowledgeGraph.js'
import { hookRenderer } from './helpers/hooks.mjs'
const require = createRequire(import.meta.url)
const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : n && typeof n === 'object' ? [n, ...nodes(n.props?.children)] : []
const text = n => Array.isArray(n) ? n.map(text).join('') : n && typeof n === 'object' ? text(n.props?.children) : n == null ? '' : String(n)
async function setup(t, reduced = false) {
  const timers = new Map(), listeners = new Map(), mediaListeners = new Map()
  let id = 0
  const media = { matches: reduced, addEventListener: (k, f) => mediaListeners.set(k, f), removeEventListener: k => mediaListeners.delete(k) }
  const document = { hidden: false, addEventListener: (k, f) => listeners.set(k, f), removeEventListener: k => listeners.delete(k) }
  const deps = { react: React, './icmsSt.js': content, './IcmsStDiagram.css': {} }
  const source = await readFile(new URL('../src/IcmsStDiagram.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, window: { matchMedia: () => media }, document, setTimeout: f => { timers.set(++id, f); return id }, clearTimeout: key => timers.delete(key), require: name => deps[name] ?? require(name) })
  const render = hookRenderer(() => module.exports.default())
  t.after(() => render.close()); await render.settle()
  const button = label => nodes(render.value).find(n => n.type === 'button' && text(n) === label)
  return { render, timers, media, mediaListeners, document, listeners, button,
    stage: () => nodes(render.value).find(n => n.props?.className === 'icms-stage').props,
    async click(label) { const b = button(label); assert.ok(b, label); assert.notEqual(b.props.disabled, true); b.props.onClick(); await render.settle() },
    async tick() { const [key, fn] = [...timers][0] || []; assert.ok(fn); timers.delete(key); fn(); await render.settle() },
  }
}

test('illustration isolates timing and reconciles the hypothetical RPA chain', () => {
  const e = content.exemploIcmsSt()
  assert.deepEqual(e.debitos, [18, 27, 36]); assert.deepEqual(e.creditos, [0, 18, 27]); assert.deepEqual(e.recolhimentos, [18, 9, 9])
  assert.equal(e.proprio + e.antecipado, e.total); assert.equal(e.total, 36)
  assert.equal(e.basePresumida, e.bases.at(-1)); assert.match(content.CONCEITO_ICMS_ST.exemplo.resultado, /Não estima economia/)
})
test('concept is searchable and connected in the list and knowledge map', () => {
  assert.ok(CONCEITOS.includes(content.CONCEITO_ICMS_ST)); assert.ok(CONEXAO.itens.some(c => c.id === 'substituicao-tributaria'))
  for (const term of ['substituição', 'ICMS', 'PGDAS']) assert.ok(buscarConceitos(term).some(c => c.id === 'substituicao-tributaria'), term)
  assert.equal(conexoesDe('substituicao-tributaria').length, 2)
  assert.ok(buildKnowledgeGraph().nodes.some(n => n.id === 'concept:substituicao-tributaria'))
})
test('factual scope distinguishes RPA, Simples, stock credits and São Paulo', async () => {
  const code = await readFile(new URL('../src/IcmsStDiagram.jsx', import.meta.url), 'utf8')
  for (const phrase of ['30/09/2026', '12 parcelas', 'PGDAS-D', '9030.3', 'não depósito automático', 'não é o fim nacional', '01/10']) assert.ok(code.includes(phrase), phrase)
  assert.equal(content.FONTES_ICMS_ST.length, 4)
  assert.ok(content.FONTES_ICMS_ST.every(f => f.url.startsWith('https://legislacao.fazenda.sp.gov.br/')))
  assert.match(content.CONCEITO_ICMS_ST.frase, /não é ficar isento/)
})
test('motion starts paused, advances once, pauses, resets and ends without loop', async t => {
  const h = await setup(t)
  assert.equal(h.timers.size, 0); assert.equal(h.stage()['data-step'], 0)
  await h.click('Reproduzir'); assert.equal(h.timers.size, 1)
  await h.tick(); assert.equal(h.stage()['data-step'], 1)
  await h.click('Pausar'); assert.equal(h.timers.size, 0)
  await h.click('Próxima etapa'); assert.equal(h.stage()['data-step'], 2)
  await h.click('Reproduzir'); await h.tick(); await h.tick()
  assert.equal(h.stage()['data-step'], 3); assert.equal(h.stage()['data-playing'], false); assert.equal(h.timers.size, 0)
  await h.click('Reproduzir novamente'); assert.equal(h.stage()['data-step'], 0)
  await h.click('Sem ST · exemplo no RPA'); assert.equal(h.stage()['data-mode'], 'normal'); assert.equal(h.timers.size, 0)
  await h.click('Próxima etapa'); await h.click('Reiniciar'); assert.equal(h.stage()['data-step'], 0)
})
test('reduced motion keeps manual controls and responds to live preference changes', async t => {
  const h = await setup(t, true)
  assert.equal(h.button('Reproduzir'), undefined); assert.equal(h.timers.size, 0)
  await h.click('Próxima etapa'); assert.equal(h.stage()['data-step'], 1)
  h.media.matches = false; h.mediaListeners.get('change')(); await h.render.settle(); await h.click('Reproduzir')
  h.media.matches = true; h.mediaListeners.get('change')(); await h.render.settle()
  assert.equal(h.stage()['data-playing'], false); assert.equal(h.timers.size, 0)
})
test('hiding and unmounting clean the playback timer and event listeners', async t => {
  const h = await setup(t)
  await h.click('Reproduzir'); h.document.hidden = true; h.listeners.get('visibilitychange')(); await h.render.settle()
  assert.equal(h.timers.size, 0); assert.equal(h.stage()['data-playing'], false)
  h.document.hidden = false; h.listeners.get('visibilitychange')(); await h.render.settle(); await h.click('Reproduzir')
  h.render.close(); assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0); assert.equal(h.mediaListeners.size, 0)
})
