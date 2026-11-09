import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/HeavyVehicles.css', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../src/TerminalDesk.jsx', import.meta.url), 'utf8')

test('Notícias mantém abas em uma faixa horizontal sem mudar os demais painéis', () => {
  const strip = css.match(/\.terminal-news \.desk-panel > header \.desk-tabs\s*\{([^}]+)\}/)?.[1]
  assert.ok(strip)
  for (const rule of ['flex: 1 1 100%', 'max-width: 100%', 'flex-wrap: nowrap', 'overflow-x: auto', 'scrollbar-width: thin']) assert.ok(strip.includes(rule), rule)
  assert.match(css, /\.terminal-news \.desk-tabs button\s*\{[^}]*flex:\s*0 0 auto;[^}]*min-height:\s*44px;/)
  assert.match(css, /\.terminal-news \.desk-tabs button:focus-visible\s*\{[^}]*outline-offset:\s*-3px;/)
})

test('abas preservam seleção, foco e navegação por setas, Home e End', () => {
  for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) assert.ok(panel.includes(`e.key === '${key}'`))
  assert.match(panel, /tabRefs\.current\[next\]\?\.focus\(\)/)
  assert.match(panel, /role="tablist"/)
  assert.match(panel, /role="tab" aria-selected=/)
  assert.match(panel, /role: 'tabpanel'/)
})
