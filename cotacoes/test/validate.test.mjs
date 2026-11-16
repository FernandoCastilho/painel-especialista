import test from 'node:test'
import assert from 'node:assert/strict'
import { validateQuotes, validateAgainstPtax, validateHistory, validateIntraday } from '../scripts/validate-lib.mjs'
const now = Date.parse('2026-10-28T14:00:00Z'), s = String(now / 1000)
const r = (bid, extra = {}) => ({ bid: String(bid), ask: String(bid + 0.001), high: String(bid + 0.05), low: String(bid - 0.05), pctChange: '-0.39', timestamp: s, ...extra })
const good = () => ({ generatedAt: now - 300000, quotes: { USDBRL: r(5.33, { varBid: '-0.021', pctChange: '-0.392' }), EURBRL: r(5.93), JPYBRL: r(0.0337, { high: '0.0340', low: '0.0335' }), USDCNH: r(6.66, { pctChange: '-0.02' }) } })
test('quotes coerentes não geram achados', () => assert.deepEqual(validateQuotes(good(), now), []))
test('quotes: ponta do CNH ausente, defasada e incoerências são apontadas', () => {
  const f = good(); delete f.quotes.USDCNH
  assert.match(validateQuotes(f, now)[0].message, /USDCNH ausente/)
  const g = good(); g.quotes.USDCNH.timestamp = String(now / 1000 - 7200)
  assert.ok(validateQuotes(g, now).some((i) => /pontas do CNH/.test(i.message)))
  const h = good(); h.quotes.USDBRL.varBid = '0.5'
  assert.ok(validateQuotes(h, now).some((i) => /incoerente/.test(i.message)))
  const o = good(); o.generatedAt = now - 8 * 36e5
  assert.ok(validateQuotes(o, now).some((i) => /parada/.test(i.message)))
  const p = good(); p.quotes.EURBRL = r(9)
  assert.ok(validateQuotes(p, now).some((i) => /EUR\/USD implícito/.test(i.message)))
})
test('idade das cotações desconta o fim de semana de Brasília e volta a contar na segunda', () => {
  const fridayClose = Date.parse('2026-11-14T02:07:00Z') // sexta-feira, 23h07 em Brasília
  const stopped = (generatedAt, checkedAt) => validateQuotes({ ...good(), generatedAt }, Date.parse(checkedAt))
    .some(({ message }) => message.includes('coleta de cotações parada'))

  assert.equal(stopped(fridayClose, '2026-11-14T02:59:00Z'), false)
  assert.equal(stopped(fridayClose, '2026-11-16T01:19:00Z'), false) // domingo, 22h19 em Brasília
  assert.equal(stopped(fridayClose, '2026-11-16T08:07:00Z'), false) // exatamente seis horas de coleta
  assert.equal(stopped(fridayClose, '2026-11-16T08:08:00Z'), true)
  assert.equal(stopped(Date.parse('2026-11-13T19:00:00Z'), '2026-11-15T12:00:00Z'), true)
})

test('pausa prevista não oculta cotação inválida ou ausente', () => {
  const { quotes, ...file } = good()
  delete quotes.USDCNH
  const sunday = Date.parse('2026-11-15T12:00:00Z')
  const output = validateQuotes({ ...file, quotes, generatedAt: undefined }, sunday)
  assert.ok(output.some(({ message }) => message.includes('sem data de coleta')))
  assert.ok(output.some(({ message }) => message.includes('USDCNH ausente')))
})
test('PTAX: divergência acima de 3% do mesmo par', () => {
  assert.deepEqual(validateAgainstPtax(good(), { ptax: { USD: { sell: 5.3 } } }), [])
  assert.match(validateAgainstPtax(good(), { ptax: { USD: { sell: 4.5 } } })[0].message, /USD\/BRL/)
})
test('história e intraday: mínimo, atualidade, saltos e ordem', () => {
  const pts = Array.from({ length: 300 }, (_, i) => ({ t: now - (300 - i) * 864e5 / 2, bid: 0.8 }))
  const h = { series: { USD: { points: pts.map((p) => ({ ...p, bid: 5.3 })) }, EUR: { points: pts.map((p) => ({ ...p, bid: 5.9 })) }, JPY: { points: pts.map((p) => ({ ...p, bid: 0.034 })) }, CNH: { points: pts } } }
  assert.deepEqual(validateHistory(h, now), [])
  h.series.CNH.points = [...pts.slice(0, 100), { t: pts[100].t, bid: 1.2 }, ...pts.slice(101)]
  assert.ok(validateHistory(h, now).some((i) => /salto/.test(i.message)))
  h.series.EUR.points = pts.slice(0, 10)
  assert.ok(validateHistory(h, now).some((i) => /mínimo/.test(i.message)))
  const tick = (v) => Array.from({ length: 30 }, (_, i) => [now - (30 - i) * 300000, v])
  const intra = { series: { USD: { points: tick(5.3) }, EUR: { points: tick(5.9) }, JPY: { points: tick(0.034) }, CNH: { points: tick(0.8) } } }
  assert.deepEqual(validateIntraday(intra, now), [])
  intra.series.CNH.points = tick(0.8).reverse().map(([, v], i, a) => [a[a.length - 1 - i][0], v])
  assert.ok(validateIntraday({ series: { ...intra.series, CNH: { points: tick(0.8).slice(0, 20).concat([[now - 4000000, 0.8]]) } } }, now).some((i) => /ordem/.test(i.message)))
})
test('intraday: salto de 9% após pausa longa passa; o mesmo salto em 5 min é apontado', () => {
  const mk = (gap) => ({ series: Object.fromEntries(['USD', 'EUR', 'JPY', 'CNH'].map((c) => [c, { points: [...Array.from({ length: 25 }, (_, i) => [now - gap - (25 - i) * 300000, c === 'JPY' ? 0.034 : c === 'CNH' ? 0.8 : 5.0]), [now, c === 'JPY' ? 0.034 : c === 'CNH' ? 0.87 : 5.5]] }])) })
  assert.deepEqual(validateIntraday(mk(3 * 36e5), now), [])
  assert.ok(validateIntraday(mk(0), now).some((i) => /salto/.test(i.message)))
})

test('CNH rejeitado ou retido não é reportado como cruzamento novo distorcido',()=>{
 const f=good();f.quotes.USDCNH.timestamp=String(now/1000-7200)
 f.rejected={CNH:'pontas incompatíveis'};f.cnh=null
 assert.ok(!validateQuotes(f,now).some(i=>/pontas do CNH/.test(i.message)))
 f.cnh={stale:true};assert.ok(!validateQuotes(f,now).some(i=>/pontas do CNH/.test(i.message)))
 f.cnh.stale=false;assert.ok(validateQuotes(f,now).some(i=>/pontas do CNH/.test(i.message)))
})
