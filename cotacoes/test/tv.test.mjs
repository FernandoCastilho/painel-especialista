import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import * as tv from '../src/tvCanais.js'
import { hookRenderer } from './helpers/hooks.mjs'

const require = createRequire(import.meta.url)
const { TV_CANAIS, TV_TAMANHOS, TV_EVENTO, tvEmbedUrl, lerPreferencia, gravarPreferencia } = tv
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []
const memoria = (inicial = {}) => ({ dados: { ...inicial }, getItem(k) { return this.dados[k] ?? null }, setItem(k, v) { this.dados[k] = v } })

test('TV usa só o player oficial do YouTube pelo canal, sem som e sem vídeo fixo', () => {
  assert.deepEqual(TV_CANAIS.map(c => c.nome), ['CNN Brasil', 'Bloomberg TV'])
  for (const canal of TV_CANAIS) {
    assert.match(canal.canal, /^UC[\w-]{22}$/)
    const url = new URL(tvEmbedUrl(canal))
    assert.equal(url.origin + url.pathname, 'https://www.youtube.com/embed/live_stream')
    assert.equal(url.searchParams.get('channel'), canal.canal)
    assert.equal(url.searchParams.get('mute'), '1')
    assert.equal(new URL(canal.youtube).hostname, 'www.youtube.com')
  }
})

test('preferência guarda canal e tamanho e ignora valor inválido ou armazenamento indisponível', () => {
  const s = memoria()
  assert.deepEqual(lerPreferencia(s), { canal: null, tamanho: 'p' })
  gravarPreferencia({ canal: 'bloomberg', tamanho: 'g' }, s)
  assert.deepEqual(lerPreferencia(s), { canal: 'bloomberg', tamanho: 'g' })
  assert.deepEqual(lerPreferencia(memoria({ 'painel-tv': '{"canal":"x","tamanho":"gigante"}' })), { canal: null, tamanho: 'p' })
  assert.deepEqual(lerPreferencia(memoria({ 'painel-tv': '{quebrado' })), { canal: null, tamanho: 'p' })
  assert.doesNotThrow(() => gravarPreferencia({}, { setItem() { throw new Error('cheio') } }))
  assert.deepEqual(TV_TAMANHOS.map(t => t.largura), [320, 480, 720])
})

async function montar(t) {
  const listeners = new Map(), storage = memoria()
  const window = { addEventListener: (k, fn) => listeners.set(k, fn), removeEventListener: k => listeners.delete(k) }
  const focados = []
  const gatilho = { offsetParent: {}, focus() { focados.push('gatilho') } }
  const document = { body: {}, fullscreenEnabled: true, querySelector: () => null, querySelectorAll: () => [{ offsetParent: null }, gatilho] }
  const { code } = await transform(readFileSync(new URL('../src/TvDock.jsx', import.meta.url), 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  const deps = { react: React, 'react-dom': { createPortal: n => n }, './TvDock.css': {}, './tvCanais.js': { ...tv, lerPreferencia: () => lerPreferencia(storage), gravarPreferencia: p => gravarPreferencia(p, storage) } }
  runInNewContext(code, { module, exports: module.exports, window, document, require: n => deps[n] ?? require(n) })
  const render = hookRenderer(() => module.exports.default())
  t.after(() => render.close())
  await render.settle()
  const all = () => nodes(render.value)
  const botao = rotulo => all().find(n => n.type === 'button' && (n.props['aria-label'] === rotulo || nodes(n.props.children).some(c => c?.props?.children === rotulo)))
  return { render, listeners, storage, focados, all, botao, iframes: () => all().filter(n => n.type === 'iframe') }
}

test('botão TV abre a escolha do canal sem carregar vídeo; troca, tamanho e fechar', async t => {
  const tvDock = await montar(t)
  assert.equal(tvDock.render.value, null, 'fechada ao abrir o painel')
  tvDock.listeners.get(TV_EVENTO)(); await tvDock.render.settle()
  assert.equal(tvDock.all()[0].props.role, 'dialog')
  assert.equal(tvDock.iframes().length, 0, 'nenhum vídeo antes da escolha')

  tvDock.botao('CNN Brasil').props.onClick(); await tvDock.render.settle()
  assert.equal(tvDock.iframes().length, 1)
  assert.match(tvDock.iframes()[0].props.src, /channel=UCvdwhh_fDyWccR42-rReZLw/)
  assert.equal(tvDock.iframes()[0].props.referrerPolicy, 'strict-origin-when-cross-origin', 'o YouTube recusa o player sem a origem (erro 153)')
  assert.doesNotMatch(tvDock.iframes()[0].props.sandbox, /allow-top-navigation/)

  tvDock.botao('Bloomberg TV').props.onClick(); await tvDock.render.settle()
  assert.equal(tvDock.iframes().length, 1, 'troca substitui o vídeo')
  assert.match(tvDock.iframes()[0].props.src, /channel=UCIALMKvObZNtJ6AmdCLP7Lg/)

  tvDock.botao('TV grande').props.onClick(); await tvDock.render.settle()
  assert.equal(tvDock.all()[0].props.style['--tv-largura'], '720px')
  assert.deepEqual(JSON.parse(tvDock.storage.dados['painel-tv']), { canal: 'bloomberg', tamanho: 'g' })

  tvDock.botao('Fechar TV').props.onClick(); await tvDock.render.settle()
  assert.equal(tvDock.render.value, null)
  assert.deepEqual(tvDock.focados, ['gatilho'], 'foco volta ao botão TV visível')

  tvDock.listeners.get(TV_EVENTO)(); await tvDock.render.settle()
  assert.equal(tvDock.iframes().length, 0, 'reabrir pede a escolha de novo e não carrega vídeo sozinho')
  const legenda = nodes(tvDock.botao('Bloomberg TV').props.children).find(n => n.type === 'small')
  assert.equal([legenda.props.children].flat().join(''), 'Inglês · último assistido')
})

test('botão TV fica no menu ao lado de Mais e a TV está montada fora das seções', () => {
  const nav = readFileSync(new URL('../src/Nav.jsx', import.meta.url), 'utf8')
  assert.match(nav, /<span>Mais<\/span>[\s\S]*data-tv-trigger[\s\S]*new Event\('painel:tv'\)[\s\S]*<span>TV<\/span>/)
  assert.equal(TV_EVENTO, 'painel:tv')
  assert.match(readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8'), /<RpnDock[^\n]*\n\s*<TvDock \/>/)
})
