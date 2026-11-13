import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
function loadComponent(name) {
  const result = buildSync({ entryPoints: [new URL(`../src/${name}.jsx`, import.meta.url).pathname], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/jsx-runtime'], loader: { '.css': 'empty' } })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports)
  return module.exports
}
const Notice = loadComponent('HolidayNotice').default
const Holidays = loadComponent('Feriados').default
const { default: Clock, ZONES, isUsualTradingTime } = loadComponent('Clock')

test('avisos e lista usam o dia de Brasília após meia-noite UTC', () => {
  const original = Date.now
  Date.now = () => Date.parse('2026-11-02T00:30:00Z')
  try {
    const notice = renderToStaticMarkup(createElement(Notice, { hol: { pracas: ['CIVBR'], loaded: true }, days: 2, list: true }))
    assert.match(notice, /02\/11\/2026 · segunda-feira \(amanhã\)/)
    assert.doesNotMatch(notice, /02\/11\/2026 · segunda-feira \(hoje\)/)
    const list = renderToStaticMarkup(createElement(Holidays, { hol: {} }))
    assert.match(list, /02\/11\/26<\/b><small>seg<\/small>/)
    assert.match(list, /class="fer-left soon">amanhã/)
  } finally { Date.now = original }
})

test('horário habitual respeita fuso/fim de semana sem afirmar abertura em feriado', () => {
  assert.equal(isUsualTradingTime(new Date('2026-11-02T15:00:00Z'), ZONES.BRL), true)
  assert.equal(isUsualTradingTime(new Date('2026-11-01T15:00:00Z'), ZONES.BRL), false)
  assert.equal(isUsualTradingTime(new Date('2026-11-02T21:00:00Z'), ZONES.BRL), false)
  const markup = renderToStaticMarkup(createElement(Clock, { codes: ['BRL', 'USD'] }))
  assert.match(markup, /role="timer" aria-label="Horários locais: São Paulo, Nova York"/)
  assert.equal((markup.match(/class="clock-one" role="group"/g) || []).length, 2)
  assert.match(markup, /aria-label="\d{2}:\d{2}\. São Paulo — (dentro|fora) do horário habitual/)
  assert.match(markup, /horário habitual de negociação/)
  assert.match(markup, /Feriados e horários especiais não verificados/)
  assert.doesNotMatch(markup, /mercado (aberto|fechado)/)
})
