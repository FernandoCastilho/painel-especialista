import test from 'node:test'
import assert from 'node:assert/strict'
import { quotesWatchDecision } from '../scripts/quotes-watch.mjs'

test('vigia das cotações: só no pregão, dispara com mais de 15 min sem coleta e nada rodando', () => {
  const at = (iso, minAgo, running = false) => quotesWatchDecision({ generatedAt: Date.parse(iso) - minAgo * 60000, running, now: Date.parse(iso) })
  assert.equal(at('2026-11-03T14:15:00Z', 211).run, true) // 11h15 de Brasília, coleta das 7h44 (caso real)
  assert.equal(at('2026-11-03T14:15:00Z', 10).run, false) // em dia
  assert.equal(at('2026-11-03T14:15:00Z', 211, true).run, false) // já há coleta rodando
  assert.equal(at('2026-11-03T12:04:59Z', 300).run, false) // antes de 9h05
  assert.equal(at('2026-11-03T12:05:00Z', 300).run, true) // início exato 9h05
  assert.equal(at('2026-11-03T21:00:00Z', 300).run, true) // fechamento preservado
  assert.equal(at('2026-11-03T21:15:00Z', 300).run, false) // 18h15: depois do pregão
  assert.equal(at('2026-11-07T15:00:00Z', 300).run, false) // sábado
  assert.equal(quotesWatchDecision({ generatedAt: NaN, now: Date.parse('2026-11-03T15:00:00Z') }).run, true) // arquivo ilegível
})
