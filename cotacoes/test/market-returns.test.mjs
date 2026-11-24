import test from 'node:test'
import assert from 'node:assert/strict'
import { accumulatedReturns, compatiblePtax, marketDate } from '../src/marketReturns.js'
const point = (d, bid) => ({ t: Date.parse(d + 'T20:00:00Z'), bid })
const file = points => ({ source: 'AwesomeAPI', series: { USD: { source: 'USD', points } } })
const now = Date.parse('2026-10-26T19:00:00Z')
test('MTD/YTD use compatible daily closes, exclude today, preserve actual base/end dates', () => {
  const f = file([point('2025-12-31', 4), point('2026-09-30', 5), point('2026-10-23', 5.5), point('2026-10-26', 9)])
  const r = accumulatedReturns(f, 'USD', now)
  assert.ok(Math.abs(r.month.value - 10) < 1e-10)
  assert.equal(r.year.value, 37.5)
  assert.equal(r.month.baseDate, '2026-09-30')
  assert.equal(r.year.baseDate, '2025-12-31')
  assert.equal(r.year.endDate, '2026-10-23')
})
test('missing coverage, old endpoints, mismatched feeds and CNY never become zero or CNH', () => {
  const f = file([point('2026-09-30', 5), point('2026-10-23', 5.5)])
  assert.equal(accumulatedReturns(f, 'USD', now).year, null)
  assert.deepEqual(accumulatedReturns({ ...f, source: 'BCE' }, 'USD', now), { month: null, year: null })
  assert.equal(accumulatedReturns({ ...f, series: { CNH: { ...f.series.USD, source: 'CNY' } } }, 'CNH', now).month, null)
  assert.equal(accumulatedReturns(file([point('2026-09-01', 5), point('2026-10-23', 6)]), 'USD', now).month, null)
  assert.equal(accumulatedReturns(f, 'USD', Date.parse('2026-11-20T19:00Z')).month, null)
})
test('São Paulo civil boundaries, first day, duplicate bars and invalid values', () => {
  assert.equal(marketDate(Date.parse('2026-11-01T01:00Z')), '2026-10-31')
  const f = file([point('2026-09-30', 5), point('2026-10-23', 5.1), {t:Date.parse('2026-10-24T01:00Z'),bid:5.5}, point('2026-10-24', null), point('2026-10-25', 0)])
  assert.ok(Math.abs(accumulatedReturns(f,'USD',now).month.value - 10) < 1e-10)
  assert.equal(accumulatedReturns(file([point('2025-12-31',4)]),'USD',Date.parse('2026-01-01T15:00Z')).year,null)
  assert.deepEqual(accumulatedReturns(file(null),'USD',now),{month:null,year:null})
  assert.deepEqual(accumulatedReturns(file([null,{t:1e18,bid:5}]),'USD',now),{month:null,year:null})
  const weekend = accumulatedReturns(file([point('2026-05-29',5),point('2026-06-01',5.5)]),'USD',Date.parse('2026-06-02T15:00Z'))
  assert.equal(weekend.month.baseDate,'2026-05-29')
  const leap = accumulatedReturns(file([point('2028-02-29',5),point('2028-03-01',5.5)]),'USD',Date.parse('2028-03-02T15:00Z'))
  assert.equal(leap.month.baseDate,'2028-02-29')
})
test('a meia-noite de São Paulo muda o período e exclui o dia ainda em curso', () => {
  const history = file([point('2025-12-31', 4), point('2026-09-30', 5), point('2026-10-30', 6), point('2026-10-31', 7)])
  const before = accumulatedReturns(history, 'USD', '2026-11-01T02:59:59Z')
  const after = accumulatedReturns(history, 'USD', '2026-11-01T03:00:00Z')
  assert.equal(before.month.endDate, '2026-10-30')
  assert.equal(after.month, null)
  assert.equal(after.year.endDate, '2026-10-31')
})

test('PTAX accepts official closing sell unit only for compatible USD/EUR/JPY', () => {
  const p = { sell: .03491, date: '2026-10-23', kind: 'Fechamento' }
  assert.equal(compatiblePtax('JPY',{source:'JPY'},p),p)
  assert.equal(compatiblePtax('JPY',{source:'JPY'},{...p,kind:'Fechamento PTAX'}).sell,.03491)
  for(const code of ['USD','EUR']) assert.equal(compatiblePtax(code,{source:code},p),p)
  assert.equal(compatiblePtax('CNH',{source:'CNH'},p),null)
  assert.equal(compatiblePtax('USD',{fallback:true},p),null)
  for(const bad of [{sell:null},{sell:0},{kind:'Fechamento Interbancário'},{date:'2026-02-30'},{date:''}]) assert.equal(compatiblePtax('USD',{source:'USD'},{...p,...bad}),null)
  assert.equal(compatiblePtax('USD',{source:'USD'},{...p,date:'2026-10-27'},now),null)
})

test('PTAX: aceita Abertura e Intermediário do dia (com rótulo de tipo e horário), não outros boletins', async () => {
  const { compatiblePtax, ptaxLabel } = await import('../src/marketReturns.js')
  const open = { sell: 5.3239, date: '2026-10-28', kind: 'Abertura', at: '2026-10-28 10:11:10.510783' }
  assert.equal(compatiblePtax('USD', { source: 'USD' }, open, Date.parse('2026-10-28T14:00:00Z')), open)
  assert.equal(ptaxLabel(open), 'abert. 10:11')
  assert.equal(compatiblePtax('EUR', { source: 'EUR' }, { ...open, kind: 'Intermediário' }, Date.parse('2026-10-28T14:00:00Z')).kind, 'Intermediário')
  assert.equal(ptaxLabel({ ...open, kind: 'Intermediário', at: '2026-10-28 12:05:00' }), 'interm. 12:05')
  assert.equal(ptaxLabel({ sell: 5.33, date: '2026-10-27', kind: 'Fechamento' }), 'fech. 27/10')
  assert.equal(compatiblePtax('USD', { source: 'USD' }, { ...open, kind: 'Fechamento Interbancário' }, Date.parse('2026-10-28T14:00:00Z')), null)
})

import { cnhPtaxCross, ptaxLabel } from '../src/marketReturns.js'
test('PTAX do CNH: referência cruzada só com as duas pontas a até 15 min do boletim', () => {
  const ptax = { sell: 5.28, at: '2026-10-27 13:06:12.123', kind: 'Fechamento PTAX', date: '2026-10-27' }
  const at = Date.parse('2026-10-27T13:06:12.123-03:00')
  const usd = [{ t: at - 60000, bid: 5.3 }, { t: at + 3600000, bid: 9 }], cnh = [{ t: at + 120000, bid: 0.8 }]
  const r = cnhPtaxCross(ptax, usd, cnh)
  assert.ok(Math.abs(r.sell - 5.28 / (5.3 / 0.8)) < 1e-12)
  assert.equal(ptaxLabel(r), 'ref. cruz.')
  assert.equal(cnhPtaxCross(ptax, usd, [{ t: at + 20 * 60000, bid: 0.8 }]), null)
  assert.equal(cnhPtaxCross(ptax, [], cnh), null)
  assert.equal(cnhPtaxCross({ ...ptax, at: 'x' }, usd, cnh), null)
})

test('destaques do mês: maior e menor alta, sem marca com dado insuficiente ou empate', async () => {
  const { destaquesMes } = await import('../src/marketReturns.js')
  const r = v => ({ month: v == null ? null : { value: v }, year: null })
  assert.deepEqual(destaquesMes({ USD: r(6.22), EUR: r(4.39), JPY: r(4.97), CNH: r(5.99) }), { maior: 'USD', menor: 'EUR' })
  assert.deepEqual(destaquesMes({ USD: r(-1), EUR: r(-3) }), { maior: 'USD', menor: 'EUR' })
  assert.deepEqual(destaquesMes({ USD: r(2), EUR: r(null) }), {})
  assert.deepEqual(destaquesMes({ USD: r(2), EUR: r(2) }), {})
  assert.deepEqual(destaquesMes(undefined), {})
})
