import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { readStorage } from '../src/storage.js'

for (const [app, current, old, foreign] of [['cotacoes', 'cotacoes-v6', 'cotacoes-v5', 'caixa-v1']]) {
  test(`${app}: ativação preserva caches dos outros aplicativos`, async () => {
    const handlers = {}, deleted = []
    vm.runInNewContext(readFileSync(new URL(`../../${app}/public/sw.js`, import.meta.url), 'utf8'), {
      self: { addEventListener: (type, handler) => { handlers[type] = handler }, clients: { claim() {} } },
      caches: { keys: async () => [current, old, 'cotacoes-v4', foreign, 'outro-site-v1'], delete: async key => { deleted.push(key) } },
    })
    let pending
    handlers.activate({ waitUntil(p) { pending = p } })
    await pending
    assert.deepEqual(deleted, [old, 'cotacoes-v4'])
  })
}

test('histórico continua sem acesso ao armazenamento', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError') } })
    assert.equal(readStorage('tabelaAberta'), null)
    assert.equal(readStorage('tabelaAberta', '0'), '0')
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else delete globalThis.localStorage
  }
})

import { toQuote } from '../src/useQuotes.js'
test('contrato da cotação rejeita dados ausentes, infinitos e preços não positivos', () => {
  const raw = { bid: '5.1', ask: '5.2', high: '5.3', low: '5', timestamp: '1760000000', pctChange: '0' }
  assert.equal(toQuote(raw, 'USD').bid, 5.1)
  for (const key of ['bid', 'ask', 'high', 'low', 'timestamp']) {
    for (const value of [undefined, '', 'NaN', 'Infinity', 0, -1]) assert.equal(toQuote({ ...raw, [key]: value }, 'USD'), null, `${key}: ${value}`)
  }
  for (const value of [undefined, '', 'NaN']) assert.equal(toQuote({ ...raw, pctChange: value }, 'USD'), null)
  assert.equal(toQuote(null, 'USD'), null)
})

import { centralMaxAge } from '../src/useQuotes.js'
test('validade central acompanha janelas de coleta, inclusive fim de semana', () => {
  const min = 60000
  assert.equal(centralMaxAge(Date.parse('2026-10-23T15:00:00Z')), 45 * min)
  assert.equal(centralMaxAge(Date.parse('2026-11-11T12:04:59Z')), 75 * min)
  assert.equal(centralMaxAge(Date.parse('2026-11-11T12:05:00Z')), 45 * min)
  assert.equal(centralMaxAge(Date.parse('2026-10-23T23:00:00Z')), 75 * min)
  const saturday = Date.parse('2026-10-24T15:00:00Z')
  const lastFriday = Date.parse('2026-10-24T02:07:00Z')
  assert.ok(saturday - lastFriday <= centralMaxAge(saturday))
  assert.ok(saturday - (lastFriday - 2 * 3600000) > centralMaxAge(saturday))
})
