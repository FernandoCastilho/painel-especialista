// Testes do reaproveitamento do último dado válido e da reserva do histórico do câmbio.
import test from 'node:test'
import assert from 'node:assert/strict'
import { fillFromPrevious, fillNewsFromPrevious, loadPrevious } from '../scripts/prev-lib.mjs'
import { parseEcbSeries } from '../src/useHistory.js'

test('último dado válido: completa só o que veio vazio e registra a origem', () => {
  const prev = { generatedAt: 100, cdi: [[1, 14]], selic: [[1, 15]], focus: { date: 'x' }, ptax: { USD: { sell: 5 }, EUR: { sell: 6 } } }
  const out = { cdi: [[2, 14.1]], selic: [], focus: null, ptax: { USD: { sell: 5.1 } } }
  fillFromPrevious(out, prev, ['cdi', 'selic', 'focus', 'ptax'])
  assert.deepEqual(out.cdi, [[2, 14.1]]) // dado novo vence
  assert.deepEqual(out.selic, [[1, 15]])
  assert.deepEqual(out.focus, { date: 'x' })
  assert.deepEqual(out.ptax, { USD: { sell: 5.1 }, EUR: { sell: 6 } })
  assert.deepEqual(out.stale, { selic: 100, focus: 100, ptax: 100 })
})

test('último dado válido: mantém a data da coleta original ao reaproveitar de novo', () => {
  const prev = { generatedAt: 500, stale: { selic: 100 }, selic: [[1, 15]] }
  const out = { selic: [] }
  fillFromPrevious(out, prev, ['selic'])
  assert.equal(out.stale.selic, 100)
})

test('último dado válido: sem arquivo anterior nada muda', () => {
  const out = { cdi: [] }
  fillFromPrevious(out, null, ['cdi'])
  assert.deepEqual(out, { cdi: [], stale: {} })
})

test('notícias: moeda sem manchetes novas mantém as anteriores', () => {
  const news = { USD: [], EUR: [{ title: 'novo', t: 9 }] }
  const stale = fillNewsFromPrevious(news, { generatedAt: 7, news: { USD: [{ title: 'velho', t: 6 }], EUR: [{ title: 'antigo', t: 5 }] } }, 10)
  assert.equal(news.USD[0].title, 'velho')
  assert.equal(news.EUR[0].title, 'novo')
  assert.deepEqual(stale, { USD: 7 })
})

test('arquivo publicado: sem repositório ou com falha de rede devolve null', async () => {
  assert.equal(await loadPrevious('macro.json', ''), null)
  const wait = async () => {} // as 3 tentativas continuam valendo; só a espera entre elas é pulada no teste
  assert.equal(await loadPrevious('macro.json', 'a/b', { wait, fetchImpl: async () => { throw new Error('rede') } }), null)
  assert.equal(await loadPrevious('macro.json', 'a/b', { wait, fetchImpl: async () => ({ ok: true, status: 200, text: async () => '' }) }), null)
})

test('BCE: série diária vira pontos ordenados, ignorando valores inválidos', () => {
  const p = parseEcbSeries({ rates: { '2026-10-08': { BRL: 5.4 }, '2026-10-07': { BRL: 5.3 }, '2026-10-06': {} } })
  assert.deepEqual(p.map((x) => x.bid), [5.3, 5.4])
  assert.equal(p[0].high, 5.3)
  assert.deepEqual(parseEcbSeries(undefined), [])
})

test('alerta: só entra o que está reaproveitado há mais de 6 horas', async () => {
  const { staleReport } = await import('../scripts/stale-lib.mjs')
  const now = 100 * 36e5
  const r = staleReport({ macro: { stale: { cdi: now - 2 * 36e5, selic: now - 7 * 36e5, sofr: null } }, curves: { stale: { br: now - 30 * 36e5 } }, news: {} }, now, 6)
  assert.deepEqual(r.map((i) => i.label).sort(), ['DI x pré', 'SOFR', 'Selic'])
  assert.equal(r.find((i) => i.label === 'Selic').hours, 7)
  assert.equal(r.find((i) => i.label === 'SOFR').hours, null) // data desconhecida conta como antiga
  assert.deepEqual(staleReport(null), [])
})

test('histórico: a janela de 360 dias atende os recortes dos gráficos', async () => {
  const { fullWindow, sliceRange } = await import('../src/useHistory.js')
  const win = fullWindow(new Date(2026, 9, 10, 15, 30))
  assert.equal(win.end.getHours(), 0)
  assert.equal(Math.round((win.end - win.start) / 864e5), 359)
  const day = 864e5
  const pts = Array.from({ length: 360 }, (_, i) => ({ t: win.start.getTime() + i * day + 12 * 36e5, bid: 5 + i / 1000 }))
  const last30 = sliceRange(pts, new Date(win.end.getTime() - 29 * day), win.end)
  assert.equal(last30.length, 30)
  assert.equal(last30.at(-1).t, pts.at(-1).t)
  assert.equal(sliceRange(pts, win.start, win.end).length, 360)
})
