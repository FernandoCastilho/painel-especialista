import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { intradayObservationWarning } from '../src/intradayState.js'
import { periodChange } from '../src/stats.js'
import { dataTimestamp } from '../src/dataTimestamp.js'
import { chartLinePath } from '../src/chartLinePath.js'
import { browserClock, hookRenderer, json } from './helpers/hooks.mjs'
import { marketDate } from '../src/marketReturns.js'
import * as chartToque from '../src/chartToque.js'
import * as chartEixo from '../src/chartEixo.js'

const now = Date.parse('2026-11-09T14:40:00Z'), day = '2026-11-09'
const first = { t: Date.parse('2026-11-09T10:00:16Z'), bid: 5.5031 }
const code = (await transform(await readFile(new URL('../src/HistoryChart.jsx', import.meta.url), 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' })).code
const require = createRequire(import.meta.url)
function render(points, overrides = {}) {
  const state = { status: points.length ? 'ok' : 'empty', generatedAt: now, data: points.length ? { source: 'USD', points, generatedAt: now, resolution: '5 min' } : null, ...overrides }
  const module = { exports: {} }
  const stubs = {
    './useHistory.js': { useIntraday: () => state, useHistory: () => state, useCentralDaily: () => ({}), centralFull: () => [] },
    './useMacro.js': { useMacro: () => ({}) }, './useQuotes.js': { seriesName: () => 'Dólar' },
    './dataTimestamp.js': { dataTimestamp }, './stats.js': { periodChange }, './chartLinePath.js': { chartLinePath },
    './storage.js': { readStorage: () => null }, './flags.js': { flagSvg: () => '' },
    './resample.js': { scaleOptions: () => [] }, './ChartFilters.jsx': { useFilterSlot: () => null },
    './rangeCompare.js': {}, './chartNavigation.js': {}, './chartToque.js': chartToque, './chartEixo.js': chartEixo, './Explain.jsx': () => null, './ChartAccess.css': {},
  }
  runInNewContext(code, { module, exports: module.exports, require: path => path in stubs ? stubs[path] : require(path) })
  return renderToStaticMarkup(createElement(module.exports.default, { currency: { code: 'USD' }, day: new Date(now), color: '#123456' }))
}

test('detalhe com uma amostra mostra o ponto real, sem 0,00% nem barras fictícias', () => {
  const html = render([first])
  assert.match(html, /Uma única amostra disponível/)
  assert.doesNotMatch(html, /0,00%|barras de 5 min|Pontos a cada 5 min/)
  assert.match(html, /Ver tabela \(1 amostra\)/)
  assert.match(html, /07:00/)
  assert.match(html, /11:40/)
  assert.match(html, /Arquivo gerado em/)
  assert.match(html, /<circle/)
})
test('detalhe com duas amostras calcula desde a primeira, inclusive zero verdadeiro', () => {
  const html = render([first, { t: first.t + 300000, bid: first.bid - .01 }])
  assert.match(html, /-0,18%/)
  assert.match(html, /desde a 1ª amostra/)
  assert.doesNotMatch(html, /Uma única amostra/)
  assert.match(render([first, { ...first, t: first.t + 300000 }]), /0,00%/)
})
test('sem amostras não inventa gráfico nem percentual', () => {
  const html = render([])
  assert.match(html, /Sem amostras na data selecionada/)
  assert.doesNotMatch(html, /0,00%|<svg/)
})
test('idade usa última amostra, não geração do arquivo nem fuso do navegador', () => {
  assert.match(intradayObservationWarning([first], day, now), /mais de 10 minutos/)
  assert.equal(intradayObservationWarning([first], '2026-11-08', now), '')
  assert.equal(intradayObservationWarning([], day, now), '')
  assert.equal(intradayObservationWarning([{ ...first, t: now - 600000 }], day, now), '')
  assert.match(intradayObservationWarning([{ ...first, t: now - 600001 }], day, now), /mais de 10 minutos/)
  assert.match(intradayObservationWarning([{ ...first, t: now + 60001 }], day, now), /futuro/)
  const midnight = Date.parse('2026-11-10T01:00:00Z')
  assert.match(intradayObservationWarning([{ ...first, t: midnight - 660000 }], day, midnight), /mais de 10 minutos/)
})
test('série envelhece com arquivo recém-gerado e se recupera com observação nova', async t => {
  const clock = browserClock(t), h = await import('../src/useHistory.js?intraday-age')
  const selected = marketDate(clock.now), stamp = clock.now - 9 * 60000
  let observation = stamp
  globalThis.fetch = async () => json({ generatedAt: clock.now, series: { USD: { points: [[observation, 5.5]] } } })
  const r = hookRenderer(() => h.useIntraday('USD', h.fromInput(selected)))
  clock.cleanup(() => r.close())
  assert.equal((await r.settle()).warning, '')
  await clock.advance(2 * 60000)
  assert.match((await r.settle()).warning, /mais de 10 minutos/)
  assert.equal(r.value.data.points[0].t, stamp)
  observation = clock.now
  await clock.advance(60000)
  assert.equal((await r.settle()).warning, '')
})
