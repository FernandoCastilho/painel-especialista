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
const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : n && typeof n === 'object' ? [n, ...nodes(typeof n.type === 'function' ? n.type(n.props) : n.props?.children)] : []
const text = n => Array.isArray(n) ? n.map(text).join('') : n && typeof n === 'object' ? text(typeof n.type === 'function' ? n.type(n.props) : n.props?.children) : n == null ? '' : String(n)
async function setup(t, reduced = false, supported = true) {
  const listeners = new Map(), mediaListeners = new Map(), observed = new Set(), scenes = [0, 1].map(() => ({ dataset: { motion: 'false' } }))
  let observe, disconnected = false
  const media = { matches: reduced, addEventListener: (k, f) => mediaListeners.set(k, f), removeEventListener: k => mediaListeners.delete(k) }
  const document = { hidden: false, addEventListener: (k, f) => listeners.set(k, f), removeEventListener: k => listeners.delete(k) }
  const deps = { react: React, './icmsSt.js': content, './IcmsStDiagram.css': {} }
  const source = await readFile(new URL('../src/IcmsStDiagram.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  const Observer = class { constructor(fn) { observe = fn } observe(target) { observed.add(target) } unobserve(target) { observed.delete(target) } disconnect() { observed.clear(); disconnected = true } }
  runInNewContext(code, { module, exports: module.exports, window: { matchMedia: () => media }, document, IntersectionObserver: supported ? Observer : undefined, require: name => deps[name] ?? require(name) })
  const render = hookRenderer(() => { const value = module.exports.default({ goto() {} }); value.ref.current = { querySelectorAll: () => scenes }; return value })
  t.after(() => render.close()); await render.settle()
  return { render, scenes, media, mediaListeners, document, listeners, observed,
    enter(index) { if (observed.has(scenes[index])) observe([{ target: scenes[index], isIntersecting: true }]) },
    outside(index) { observe([{ target: scenes[index], isIntersecting: false }]) },
    get disconnected() { return disconnected },
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
test('editorial keeps both complete scenes and no playback controls', async t => {
  const h = await setup(t)
  const all = nodes(h.render.value), full = text(h.render.value)
  assert.equal(all.filter(n => n.type === 'figure').length, 2)
  assert.equal(all.filter(n => n.props?.className === 'icms-actor').length, 8)
  const scenes = all.filter(n => n.type === 'figure')
  assert.equal(nodes(scenes[0]).filter(n => n.props?.['data-payer'] === true).length, 1)
  assert.equal(nodes(scenes[1]).filter(n => n.props?.['data-payer'] === true).length, 3)
  for (const scene of scenes) assert.equal(nodes(scene).filter(n => n.props?.className === 'icms-actor').at(-1).props['data-payer'], false)
  assert.ok(!/Reproduzir|Pausar|Próxima etapa|Reiniciar|Etapa [1-4] de/.test(full))
  assert.equal(all.filter(n => n.type === 'button').length, 2, 'only related concept navigation remains')
  assert.match(full, /Crédito fiscal não édinheiro na conta/)
  assert.equal(all.filter(n => n.type === 'svg' && String(n.props['aria-hidden']) === 'true').length, 10)
})
test('each scene animates once on entry, with static content already available', async t => {
  const h = await setup(t)
  assert.equal(h.observed.size, 2); h.outside(0); assert.equal(h.scenes[0].dataset.motion, 'false')
  h.enter(0); assert.equal(h.scenes[0].dataset.motion, 'true'); assert.equal(h.observed.size, 1)
  h.scenes[0].dataset.motion = 'false'; h.enter(0); assert.equal(h.scenes[0].dataset.motion, 'false', 'scrolling back cannot replay')
  h.enter(1); assert.equal(h.scenes[1].dataset.motion, 'true'); assert.equal(h.observed.size, 0)
})
test('reduced motion and visibility changes stop motion without hiding the explanation', async t => {
  const h = await setup(t, true)
  h.enter(0); assert.equal(h.scenes[0].dataset.motion, 'false')
  h.media.matches = false; h.mediaListeners.get('change')(); h.enter(1); assert.equal(h.scenes[1].dataset.motion, 'true')
  h.media.matches = true; h.mediaListeners.get('change')(); assert.equal(h.scenes[1].dataset.motion, 'false')
  assert.match(text(h.render.value), /Fabricante/); assert.match(text(h.render.value), /Fisco estadual/)
  h.scenes[1].dataset.motion = 'true'; h.document.hidden = true; h.listeners.get('visibilitychange')(); assert.equal(h.scenes[1].dataset.motion, 'false')
  h.document.hidden = false; h.listeners.get('visibilitychange')(); assert.equal(h.scenes[1].dataset.motion, 'false')
})
test('unmount disconnects observers and listeners; missing observer leaves readable static scenes', async t => {
  const h = await setup(t); h.render.close()
  assert.equal(h.disconnected, true); assert.equal(h.listeners.size, 0); assert.equal(h.mediaListeners.size, 0)
  const fallback = await setup(t, false, false)
  assert.equal(fallback.observed.size, 0); assert.equal(nodes(fallback.render.value).filter(n => n.type === 'figure').length, 2)
})
