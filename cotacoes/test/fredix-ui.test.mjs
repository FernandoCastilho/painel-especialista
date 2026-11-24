import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { hookRenderer, deferred } from './helpers/hooks.mjs'
import * as fredix from '../src/fredix.js'
import * as seguranca from '../src/fredixSeguranca.js'
const require = createRequire(import.meta.url)
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []

async function montar(t, { endpoint = 'https://fredix.exemplo.dev', perguntar = async () => 'Dólar a R$ 5,93.' } = {}) {
  const ouvintes = new Map(), enviados = []
  const window = { addEventListener: (tipo, fn) => ouvintes.set(tipo, fn), removeEventListener: tipo => ouvintes.delete(tipo) }
  const deps = { react: React, 'react-dom': { createPortal: el => el }, './fredixConfig.json': {}, './fredix.js': { ...fredix, perguntarAoFredix: async (config, mensagens, opcoes) => { enviados.push(mensagens); return perguntar(config, mensagens, opcoes) } }, './fredixSeguranca.js': seguranca, './FredixChat.css': {} }
  const { code } = await transform(await readFile(new URL('../src/FredixChat.jsx', import.meta.url), 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, window, document: { body: {} }, require: nome => deps[nome] ?? require(nome), AbortController, setTimeout, clearTimeout })
  const r = hookRenderer(() => module.exports.default({ configuration: { endpoint, turnstileSiteKey: '' } }))
  t.after(() => r.close())
  await r.settle()
  const achar = fn => nodes(r.value).find(fn)
  const porId = id => achar(n => n.props?.id === id)
  achar(n => n.props?.className?.includes('fredix-trigger')).ref.current = { focus() {} }
  porId('fredix-pergunta').ref.current = { focus() {} }
  const dialogo = { open: false, showModal() { this.open = true }, close() { this.open = false } }
  porId('fredix-dialog').ref.current = dialogo
  const abrir = async () => { achar(n => n.props?.className?.includes('fredix-trigger')).props.onClick(); await r.settle() }
  const escrever = async texto => { porId('fredix-pergunta').props.onChange({ target: { value: texto } }); await r.settle() }
  const enviar = async () => { await achar(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); await r.settle() }
  const mensagens = () => nodes(r.value).filter(n => n.props?.className?.startsWith?.('fredix-msg'))
  return { r, achar, porId, abrir, escrever, enviar, mensagens, dialogo, enviados, ouvintes }
}

test('Fredix: abre só no clique, pergunta e mostra a resposta', async t => {
  const s = await montar(t)
  assert.equal(s.dialogo.open, false)
  await s.abrir()
  assert.equal(s.dialogo.open, true)
  await s.escrever('Como está o dólar?')
  await s.enviar()
  assert.equal(JSON.stringify(s.enviados[0]), JSON.stringify([{ role: 'user', content: 'Como está o dólar?' }]))
  assert.equal(s.mensagens().length, 2)
  assert.equal(s.porId('fredix-pergunta').props.value, '')
})

test('Fredix: dado de cliente não sai do navegador', async t => {
  const s = await montar(t)
  await s.abrir()
  await s.escrever('cliente CPF 123.456.789-09 quer giro')
  await s.enviar()
  assert.equal(s.enviados.length, 0)
  assert.match(s.achar(n => n.props?.role === 'alert').props.children, /CPF/)
})

test('Fredix: falha preserva a pergunta e não mostra resposta falsa', async t => {
  const s = await montar(t, { perguntar: async () => { throw new Error('O Fredix atingiu o limite de uso de hoje.') } })
  await s.abrir()
  await s.escrever('Selic?')
  await s.enviar()
  assert.equal(s.mensagens().length, 0)
  assert.equal(s.porId('fredix-pergunta').props.value, 'Selic?')
  assert.match(s.achar(n => n.props?.role === 'alert').props.children, /limite/)
})

test('Fredix: clique duplo envia uma vez só', async t => {
  const pendente = deferred()
  const s = await montar(t, { perguntar: () => pendente.promise })
  await s.abrir()
  await s.escrever('Dólar?')
  const form = s.achar(n => n.type === 'form')
  const a = form.props.onSubmit({ preventDefault() {} })
  await s.r.settle()
  const b = s.achar(n => n.type === 'form').props.onSubmit({ preventDefault() {} })
  pendente.resolve('ok')
  await Promise.all([a, b]); await s.r.settle()
  assert.equal(s.enviados.length, 1)
})

test('Fredix: sem servidor configurado não envia e avisa', async t => {
  const s = await montar(t, { endpoint: '' })
  await s.abrir()
  assert.match(s.achar(n => n.props?.className === 'feedback-notice').props.children, /configuração/)
  assert.equal(s.porId('fredix-pergunta').props.disabled, true)
  s.ouvintes.get('hashchange')(); await s.r.settle()
  assert.equal(s.dialogo.open, false)
})
