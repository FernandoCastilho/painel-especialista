import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/Terminal.css', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../src/TerminalDesk.jsx', import.meta.url), 'utf8')

// A faixa única com rolagem só valia depois de abrir a aba Veículos pesados (o estilo vinha junto com ela).
// Com a aba retirada em 24/11/2026, vale o formato que a página já mostrava ao abrir: abas quebram em linhas, todas visíveis.
test('Notícias mostra todas as abas, quebrando em linhas, sem mudar os demais painéis', () => {
  assert.match(css, /\.terminal-news \.desk-tabs\s*\{\s*flex-wrap:\s*wrap;\s*\}/)
  assert.match(css, /\.terminal-news \.desk-tabs button\s*\{\s*min-height:\s*44px;\s*\}/)
  assert.doesNotMatch(css, /\.terminal-news[^{]*\.desk-tabs\s*\{[^}]*nowrap/)
})

test('abas preservam seleção, foco e navegação por setas, Home e End', () => {
  for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) assert.ok(panel.includes(`e.key === '${key}'`))
  assert.match(panel, /tabRefs\.current\[next\]\?\.focus\(\)/)
  assert.match(panel, /role="tablist"/)
  assert.match(panel, /role="tab" aria-selected=/)
  assert.match(panel, /role: 'tabpanel'/)
})
