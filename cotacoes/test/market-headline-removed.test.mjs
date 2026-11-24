import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/TerminalDesk.jsx', import.meta.url), 'utf8')
test('Mercado não repete frase de dólar e Ibovespa; mantém indicadores, gráficos e faixa geral', () => {
  assert.doesNotMatch(source, /className="manchete"|manchete\(items\)/)
  assert.match(source, /Mapa de variação – dia/)
  assert.match(source, /aria-label="Indicadores principais"/)
  assert.match(source, /kpiItems\(quotes, rates, ipca, ibov\)/)
  assert.match(source, /<RollingNumber className="kpi-value" value=\{i.value\}/)
  assert.match(source, /className=\{`kpi-change/)
  assert.match(source, /<Sparkline points=\{points\}/)
  assert.match(source, /export function Tape/)
})
