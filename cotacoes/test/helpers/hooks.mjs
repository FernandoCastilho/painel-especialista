import assert from 'node:assert/strict'
import React from 'react'

export function hookRenderer(renderHook) {
  const slots = []
  let cursor = 0, dirty = true, value, effects = [], updates = 0
  const memo = (fn, deps) => {
    const index = cursor++, old = slots[index]
    if (!old || deps.some((d, i) => !Object.is(d, old.deps[i]))) slots[index] = { deps, value: fn() }
    return slots[index].value
  }
  const dispatcher = {
    useState(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, (next) => {
        const previous = slots[index].value
        const result = typeof next === 'function' ? next(previous) : next
        if (!Object.is(previous, result)) { slots[index].value = result; dirty = true; updates++ }
      }]
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial } },
    useCallback(fn, deps) { return memo(() => fn, deps) },
    useLayoutEffect(effect, deps) { return dispatcher.useEffect(effect, deps) }, // neste apoio de testes, mesmo momento do useEffect
    useEffect(effect, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() } })
      }
    },
  }
  const render = () => {
    cursor = 0; dirty = false; effects = []
    const current = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher
    const original = current.current
    current.current = dispatcher
    try { value = renderHook() } finally { current.current = original }
    effects.forEach((effect) => effect())
    return value
  }
  return {
    render,
    get value() { return value },
    get updates() { return updates },
    async settle() {
      for (let i = 0; i < 15; i++) {
        if (dirty) render()
        await flush()
        if (!dirty) return value
      }
      assert.fail('O hook não estabilizou.')
    },
    close() { slots.forEach((slot) => slot?.cleanup?.()) },
  }
}
export const flush = () => new Promise((resolve) => setImmediate(resolve))
export const json = (data) => ({ ok: true, json: async () => data })
export const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }

// `start` fixa a hora inicial quando o comportamento testado depende do horário (ex.: janela de coleta do câmbio).
export function browserClock(t, start = Date.now()) {
  const saved = Object.fromEntries(['document', 'window', 'fetch', 'setInterval', 'clearInterval', 'localStorage'].map((k) => [k, globalThis[k]]))
  const oldNow = Date.now
  let now = start, id = 0
  const timers = new Map(), store = new Map(), cleanups = []
  const target = () => {
    const listeners = new Map()
    return {
      addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn) },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn) },
      dispatch(type) { for (const fn of listeners.get(type) ?? []) fn({ type }) },
      get size() { return [...listeners.values()].reduce((sum, a) => sum + a.size, 0) },
    }
  }
  const doc = Object.assign(target(), { hidden: false })
  const win = target()
  globalThis.document = doc
  globalThis.window = win
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) }
  globalThis.setInterval = (fn, ms) => { const key = ++id; timers.set(key, { fn, ms, at: now + ms }); return key }
  globalThis.clearInterval = (key) => timers.delete(key)
  Date.now = () => now
  t.after(() => {
    cleanups.forEach((cleanup) => cleanup())
    Date.now = oldNow
    for (const [key, val] of Object.entries(saved)) {
      if (val === undefined) delete globalThis[key]
      else globalThis[key] = val
    }
  })
  return {
    doc, win, store, timers,
    cleanup(fn) { cleanups.push(fn) },
    get now() { return now },
    async advance(ms) {
      const end = now + ms
      while (timers.size) {
        const next = Math.min(...[...timers.values()].map((timer) => timer.at))
        if (next > end) break
        now = next
        for (const [key, timer] of [...timers]) if (timer.at <= now && timers.has(key)) { timer.at += timer.ms; timer.fn() }
        await flush()
      }
      now = end
      await flush()
    },
  }
}
