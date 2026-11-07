import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { hookRenderer, deferred } from './helpers/hooks.mjs'
import * as regras from '../src/alertaVariacao.js'
import * as datas from '../src/marketReturns.js'

const require = createRequire(import.meta.url)
const NOW = Date.parse('2026-11-05T15:00:00Z')
const ID = '2026-11-05:USD:alta', KEY = 'alerta-variacao'
const quote = (bid) => { const base = bid < 5.6 ? 5.5 : 6; return { bid, delta: bid - base, pct: (bid / base - 1) * 100, timestamp: NOW - 60000 } }
const quotesAlerta = () => ({ USD: quote(5.52), EUR: quote(6) })
const nodes = (el) => Array.isArray(el) ? el.flatMap(nodes) : el && typeof el === 'object' ? [el, ...nodes(el.props?.children)] : []
const textOf = (el) => Array.isArray(el) ? el.map(textOf).join('') : el && typeof el === 'object' ? textOf(el.props?.children) : typeof el === 'string' || typeof el === 'number' ? String(el) : ''

async function setup(t, { permission = 'default', quotes = quotesAlerta(), saved = {}, unsupported = false, noStorage = false, now = NOW } = {}) {
  const clock = { now }
  const store = new Map([[KEY, JSON.stringify(saved)]]), events = new Map(), deliveries = [], requests = []
  const behavior = { fail: false, registration: true, registrationWaiting: null, waiting: null, requestResult: 'granted', requestError: false, permitWaiting: null }
  const add = (type, fn) => { if (!events.has(type)) events.set(type, new Set()); events.get(type).add(fn) }
  const remove = (type, fn) => events.get(type)?.delete(fn)
  function Notification(title, options) {
    if (behavior.fail) throw new Error('Sistema indisponível')
    deliveries.push({ title, options, via: 'constructor' })
  }
  Notification.permission = permission
  Notification.requestPermission = async () => {
    requests.push(true)
    if (behavior.requestError) throw new Error('Pedido indisponível')
    if (behavior.permitWaiting) await behavior.permitWaiting.promise
    Notification.permission = behavior.requestResult
    return behavior.requestResult
  }
  const navegador = { webdriver: false, serviceWorker: { getRegistration: async () => {
    if (behavior.registrationWaiting) await behavior.registrationWaiting.promise
    return behavior.registration ? {
    showNotification: async (title, options) => {
      if (behavior.waiting) await behavior.waiting.promise
      if (behavior.fail) throw new Error('Sistema indisponível')
      deliveries.push({ title, options, via: 'service-worker' })
    },
  } : null } } }
  const sandbox = {
    Date: class extends Date { static now() { return clock.now } },
    navigator: navegador,
    document: { hidden: false, addEventListener: add, removeEventListener: remove },
    window: { addEventListener: add, removeEventListener: remove },
    localStorage: { getItem: (k) => { if (noStorage) throw new Error('Sem armazenamento'); return store.get(k) ?? null }, setItem: (k, v) => { if (noStorage) throw new Error('Sem armazenamento'); store.set(k, v) } },
    ...(unsupported ? {} : { Notification }),
  }
  const deps = {
    react: { ...React, useMemo: (fn, deps) => React.useCallback(fn(), deps) },
    './alertaVariacao.js': { ...regras, alertasDoDia: (args) => regras.alertasDoDia({ ...args, now: clock.now }) },
    './marketReturns.js': datas,
    './useHistory.js': { useIntraday: () => { throw new Error('Alerta não depende mais de intraday') } },
  }
  for (const file of ['alertaNotificacao.js', 'AlertaVariacao.jsx']) {
    const source = await readFile(new URL('../src/' + file, import.meta.url), 'utf8')
    const { code } = await transform(source, { loader: file.endsWith('jsx') ? 'jsx' : 'js', format: 'cjs', jsx: 'automatic' })
    const module = { exports: {} }
    runInNewContext(code, { ...sandbox, module, exports: module.exports, require: (name) => deps[name] ?? require(name) })
    deps['./' + file] = module.exports
  }
  let current = quotes
  const render = hookRenderer(() => deps['./AlertaVariacao.jsx'].default({ quotes: current }))
  t.after(() => render.close())
  await render.settle()
  return {
    render, deliveries, requests, store, behavior, Notification, clock,
    state: () => JSON.parse(store.get(KEY)),
    text: () => textOf(render.value),
    button: (name) => nodes(render.value).find((n) => n.type === 'button' && (n.props['aria-label'] ?? textOf(n)).includes(name)),
    async refresh(next = { ...current }) { current = next; render.render(); await render.settle() },
    async event(type) { for (const fn of events.get(type) ?? []) fn(); await render.settle() },
  }
}

test('sem alerta nem permissão, oferece ativação sem abrir prompt automaticamente', async t => {
  const h = await setup(t, { quotes: { USD: quote(5.5), EUR: quote(6) } })
  assert.ok(h.button('Permitir notificações de câmbio'))
  assert.match(h.text(), /mais de ±0,30%.*fechamento anterior.*mesmo Δ dia.*último fechamento disponível.*9h de Brasília.*aberto e visível.*monitoramento contínuo em segundo plano nem com o app fechado/)
  assert.equal(h.requests.length, 0)
  assert.equal(h.deliveries.length, 0)
  assert.deepEqual(h.state(), {})
})

test('conceder após alerta envia imediatamente e só marca sucesso confirmado', async t => {
  const h = await setup(t)
  assert.match(h.text(), /Dólar em alta de 0,36%/)
  assert.deepEqual(h.state(), {})
  await h.button('Permitir notificações').props.onClick()
  await h.render.settle()
  assert.equal(h.requests.length, 1)
  assert.equal(h.deliveries.length, 1)
  assert.equal(h.deliveries[0].options.tag, ID)
  assert.equal(h.state()[ID].sistemaEnviadoEm, NOW)
  await h.refresh()
  assert.equal(h.deliveries.length, 1)
  assert.ok(!h.button('Permitir notificações'))
})

test('cliques repetidos não repetem pedido; escolha default mantém convite sem insistir', async t => {
  const h = await setup(t)
  h.behavior.requestResult = 'default'
  h.behavior.permitWaiting = deferred()
  const button = h.button('Permitir notificações')
  const a = button.props.onClick(), b = button.props.onClick()
  await h.render.settle()
  assert.equal(h.requests.length, 1)
  assert.equal(h.button('Aguardando sua escolha').props.disabled, true)
  h.behavior.permitWaiting.resolve()
  await Promise.all([a, b]); await h.render.settle()
  await h.refresh()
  assert.ok(h.button('Permitir notificações'))
  assert.equal(h.requests.length, 1)
  assert.deepEqual(h.state(), {})
})

test('bloqueada explica configurações; liberação externa é detectada ao voltar ao app', async t => {
  const h = await setup(t, { permission: 'denied' })
  assert.match(h.text(), /Notificações bloqueadas.*configurações.*não permite repetir o pedido/)
  assert.ok(!h.button('Permitir notificações'))
  assert.equal(h.requests.length, 0)
  assert.deepEqual(h.state(), {})
  h.Notification.permission = 'granted'
  await h.event('focus')
  assert.equal(h.deliveries.length, 1)
})

test('sem suporte mantém alerta no painel e explica opção de Tela de Início sem prometer push', async t => {
  const h = await setup(t, { unsupported: true })
  assert.match(h.text(), /Dólar em alta.*indisponíveis neste navegador.*Tela de Início.*não há monitoramento contínuo em segundo plano nem com o app fechado/)
  assert.ok(!h.button('Permitir notificações'))
  assert.deepEqual(h.state(), {})
})

test('falha de envio não consome alerta; tentativa seguinte pode entregar sem duplicar', async t => {
  const h = await setup(t, { permission: 'default' })
  h.behavior.fail = true
  await h.button('Permitir notificações').props.onClick(); await h.render.settle()
  assert.deepEqual(h.state(), {})
  assert.equal(h.deliveries.length, 0)
  assert.match(h.text(), /Não foi possível enviar/)
  h.behavior.fail = false
  h.button('Tentar enviar novamente').props.onClick(); await h.render.settle()
  assert.equal(h.deliveries.length, 1)
  assert.equal(h.state()[ID].sistemaEnviadoEm, NOW)
  assert.doesNotMatch(h.text(), /Não foi possível enviar/)
})

test('envios pendentes não se duplicam em atualizações e preservam dispensa concorrente', async t => {
  const h = await setup(t)
  h.behavior.waiting = deferred()
  await h.button('Permitir notificações').props.onClick(); await h.render.settle()
  await h.refresh(); await h.refresh()
  h.button('Dispensar alerta do dólar').props.onClick(); await h.render.settle()
  assert.equal(h.state()[ID].dispensado, true)
  h.behavior.waiting.resolve(); await h.render.settle()
  assert.equal(h.deliveries.length, 1)
  assert.deepEqual(h.state()[ID], { dispensado: true, sistemaEnviadoEm: NOW })
})

test('estado legado não comprova envio; dispensa e sucesso novo continuam deduplicados', async t => {
  const h = await setup(t, { permission: 'granted', saved: { [ID]: { notificado: true } } })
  assert.equal(h.deliveries.length, 1)
  const remount = await setup(t, { permission: 'granted', saved: h.state() })
  assert.equal(remount.deliveries.length, 0)
  const dismissed = await setup(t, { permission: 'granted', saved: { [ID]: { notificado: true, dispensado: true } } })
  assert.equal(dismissed.render.value, null)
  assert.equal(dismissed.deliveries.length, 0)
})

test('sem service worker usa Notification; sem armazenamento deduplica nesta montagem', async t => {
  const h = await setup(t, { noStorage: true })
  h.behavior.registration = false
  await h.button('Permitir notificações').props.onClick(); await h.render.settle()
  await h.refresh()
  assert.equal(h.deliveries.length, 1)
  assert.equal(h.deliveries[0].via, 'constructor')
})

test('erro ao solicitar não oculta convite nem marca o alerta como enviado', async t => {
  const h = await setup(t)
  h.behavior.requestError = true
  await h.button('Permitir notificações').props.onClick(); await h.render.settle()
  assert.match(h.text(), /Não foi possível abrir o pedido/)
  assert.equal(h.button('Permitir notificações').props.disabled, false)
  assert.deepEqual(h.state(), {})
})

test('dólar/euro e sentidos opostos são independentes e estados simultâneos não se sobrescrevem', async t => {
  const h = await setup(t, { permission: 'granted', quotes: { USD: quote(5.52), EUR: quote(5.97) } })
  assert.equal(h.deliveries.length, 2)
  assert.equal(h.state()[ID].sistemaEnviadoEm, NOW)
  assert.equal(h.state()['2026-11-05:EUR:queda'].sistemaEnviadoEm, NOW)
  await h.refresh({ USD: quote(5.47), EUR: quote(5.97) })
  assert.equal(h.deliveries.length, 3)
  assert.equal(h.state()['2026-11-05:USD:queda'].sistemaEnviadoEm, NOW)
  await h.refresh({ USD: quote(5.52), EUR: quote(5.97) })
  assert.equal(h.deliveries.length, 3)
})


test('permissão tardia não envia cotação que passou de 9m59s para 10m01s', async t => {
  const quotes = quotesAlerta(); quotes.USD.timestamp = NOW - 599000
  const h = await setup(t, { quotes })
  h.clock.now += 2000
  await h.button('Permitir notificações').props.onClick(); await h.render.settle()
  assert.equal(h.deliveries.length, 0)
  assert.deepEqual(h.state(), {})
  assert.doesNotMatch(h.text(), /Dólar em alta/)
  await h.refresh({ ...quotes, USD: { ...quotes.USD, timestamp: h.clock.now } })
  assert.equal(h.deliveries.length, 1, 'nova cotação válida ainda pode enviar o alerta não consumido')
})

test('cotação pode expirar com o diálogo de permissão ainda aberto', async t => {
  const quotes = quotesAlerta(); quotes.USD.timestamp = NOW - 599000
  const h = await setup(t, { quotes })
  h.behavior.permitWaiting = deferred()
  const permission = h.button('Permitir notificações').props.onClick()
  await h.render.settle(); h.clock.now += 2000
  h.behavior.permitWaiting.resolve(); await permission; await h.render.settle()
  assert.equal(h.deliveries.length, 0)
  assert.deepEqual(h.state(), {})
})

test('retry revalida idade e não consome um alerta vencido', async t => {
  const quotes = quotesAlerta(); quotes.USD.timestamp = NOW - 599000
  const h = await setup(t, { quotes })
  h.behavior.fail = true
  await h.button('Permitir notificações').props.onClick(); await h.render.settle()
  const retry = h.button('Tentar enviar novamente')
  assert.ok(retry)
  h.behavior.fail = false; h.clock.now += 2000
  retry.props.onClick(); await h.render.settle()
  assert.equal(h.deliveries.length, 0)
  assert.deepEqual(h.state(), {})
  assert.ok(!h.button('Tentar enviar novamente'))
})

test('liberação externa também descarta a cotação expirada', async t => {
  const quotes = quotesAlerta(); quotes.USD.timestamp = NOW - 599000
  const h = await setup(t, { quotes, permission: 'denied' })
  h.clock.now += 2000; h.Notification.permission = 'granted'
  await h.event('focus')
  assert.equal(h.deliveries.length, 0)
  assert.deepEqual(h.state(), {})
})

test('espera pelo service worker revalida idade antes de showNotification ou Notification', async t => {
  for (const registration of [true, false]) {
    const quotes = quotesAlerta(); quotes.USD.timestamp = NOW - 599000
    const h = await setup(t, { quotes })
    h.behavior.registration = registration
    h.behavior.registrationWaiting = deferred()
    await h.button('Permitir notificações').props.onClick(); await h.render.settle()
    h.clock.now += 2000
    h.behavior.registrationWaiting.resolve(); await h.render.settle()
    assert.equal(h.deliveries.length, 0)
    assert.deepEqual(h.state(), {})
  }
})

test('cotação nova substitui texto pendente; reversão e dispensa cancelam o envio aguardando registro', async t => {
  for (const change of ['new', 'reverse', 'dismiss', 'unmount']) {
    const h = await setup(t)
    h.behavior.registrationWaiting = deferred()
    await h.button('Permitir notificações').props.onClick(); await h.render.settle()
    if (change === 'new') await h.refresh({ USD: quote(5.53), EUR: quote(6) })
    if (change === 'reverse') await h.refresh({ USD: quote(5.5), EUR: quote(6) })
    if (change === 'dismiss') { h.button('Dispensar alerta do dólar').props.onClick(); await h.render.settle() }
    if (change === 'unmount') h.render.close()
    h.behavior.registrationWaiting.resolve(); await h.render.settle()
    assert.equal(h.deliveries.length, change === 'new' ? 1 : 0)
    if (change === 'new') assert.match(h.deliveries[0].options.body, /5,5300/)
    else assert.equal(h.state()[ID]?.sistemaEnviadoEm, undefined)
  }
})

test('permissão e retry após meia-noite de Brasília não enviam o alerta de ontem', async t => {
  for (const retry of [false, true]) {
    const now = Date.parse('2026-11-06T02:59:59Z')
    const quotes = { USD: { ...quote(5.52), timestamp: now }, EUR: { ...quote(6), timestamp: now } }
    const h = await setup(t, { quotes, now })
    if (retry) {
      h.behavior.fail = true
      await h.button('Permitir notificações').props.onClick(); await h.render.settle()
      h.behavior.fail = false
    }
    const button = h.button(retry ? 'Tentar enviar novamente' : 'Permitir notificações')
    h.clock.now += 2000
    await button.props.onClick(); await h.render.settle()
    assert.equal(h.deliveries.length, 0)
    assert.deepEqual(h.state(), {})
  }
})
