import test from 'node:test'
import assert from 'node:assert/strict'
import { quoteAgeState, quoteAgeLabel, inCollectionWindow, lastCollectionEnd, offHoursReference, QUOTE_AGE_LIMIT_MS } from '../src/quoteFreshness.js'
import { intradaySelection } from '../src/intradayState.js'
import { periodChange } from '../src/stats.js'
const now = Date.parse('2026-10-26T20:48:00Z')
test('HTTP success or new collection never resets the original price age', () => {
  const q = {timestamp:now-2*3600000,generatedAt:now}
  assert.equal(quoteAgeState(q,now),'Dado antigo')
  assert.equal(q.timestamp,now-2*3600000)
  assert.equal(quoteAgeState({timestamp:now-QUOTE_AGE_LIMIT_MS},now),'')
  assert.equal(quoteAgeState({timestamp:now-QUOTE_AGE_LIMIT_MS-1},now),'Dado antigo')
})
test('stale, daily reserve, absence and clock problems have distinct states', () => {
  assert.equal(quoteAgeState(null,now),'Sem dado')
  assert.equal(quoteAgeState({stale:true,timestamp:now},now),'Pendente')
  assert.equal(quoteAgeState({fallback:true,timestamp:now-86400000},now),'Reserva diária')
  for(const timestamp of [null,NaN,0,now+60001]) assert.equal(quoteAgeState({timestamp},now),'Horário inválido')
})
test('age is factual even on weekend/outside collector window; never declares market closed', () => {
  const sunday=Date.parse('2026-10-25T15:00Z'),q={timestamp:sunday-86400000}
  assert.equal(quoteAgeState(q,sunday),'Dado antigo')
  assert.equal(quoteAgeState({timestamp:now},now),'')
})
test('USD/BRL served samples are ordered by time: decline from first sample can coexist with positive provider day delta', () => {
  const first={t:Date.parse('2026-10-26T15:02:51Z'),bid:5.4548},last={t:Date.parse('2026-10-26T20:50:04Z'),bid:5.406}
  const points=intradaySelection([last,first],'2026-10-26').points
  assert.deepEqual(points,[first,last])
  assert.ok(Math.abs(periodChange(points)-(-.8946249175038501))<1e-10)
  const providerDayPercent=8.793912
  assert.ok(providerDayPercent>0 && periodChange(points)<0)
})
test('intraday membership uses São Paulo civil day, including UTC midnight, independent of host timezone', () => {
  const p={t:Date.parse('2026-10-27T01:00Z'),bid:5}
  assert.deepEqual(intradaySelection([p],'2026-10-26').points,[p])
  assert.deepEqual(intradaySelection([p],'2026-10-27').points,[])
  assert.equal(intradaySelection([p],'2026-10-27').previousDay,'2026-10-26')
})

test('fora da janela de coleta, a referência do fim da janela aparece em tom neutro sem mudar a regra de idade', () => {
  const at = (iso) => Date.parse(iso)
  const quinta22h = at('2026-11-12T22:00:00-03:00'), fim = at('2026-11-12T18:00:00-03:00')
  assert.equal(inCollectionWindow(at('2026-11-12T09:04:00-03:00')), false)
  assert.equal(inCollectionWindow(at('2026-11-12T09:05:00-03:00')), true)
  assert.equal(inCollectionWindow(at('2026-11-12T17:59:00-03:00')), true)
  assert.equal(inCollectionWindow(fim), false)
  assert.equal(inCollectionWindow(at('2026-11-14T11:00:00-03:00')), false) // sábado
  assert.equal(lastCollectionEnd(quinta22h), fim)
  assert.equal(lastCollectionEnd(at('2026-11-13T08:00:00-03:00')), fim) // sexta antes da abertura
  assert.equal(lastCollectionEnd(at('2026-11-15T12:00:00-03:00')), at('2026-11-13T18:00:00-03:00')) // domingo olha a sexta
  assert.equal(lastCollectionEnd(at('2026-11-16T07:00:00-03:00')), at('2026-11-13T18:00:00-03:00')) // segunda cedo olha a sexta
  const fechamento = { timestamp: at('2026-11-12T19:41:00-03:00') }
  assert.equal(quoteAgeState(fechamento, quinta22h), 'Dado antigo') // a regra de idade não muda
  assert.deepEqual(quoteAgeLabel(fechamento, quinta22h), { text: 'Referência de 12/11\u00a019:41', tone: 'neutral', state: 'Dado antigo' })
  // parou no meio da tarde: continua sendo atraso, mesmo à noite
  const parada = { timestamp: at('2026-11-12T15:00:00-03:00') }
  assert.equal(offHoursReference(parada, quinta22h), false)
  assert.deepEqual(quoteAgeLabel(parada, quinta22h), { text: 'Dado antigo', tone: 'alert', state: 'Dado antigo' })
  // dentro da janela nunca fica neutro
  const meioDia = at('2026-11-12T12:00:00-03:00')
  assert.equal(quoteAgeLabel({ timestamp: meioDia - 11 * 60000 }, meioDia).tone, 'alert')
  assert.deepEqual(quoteAgeLabel({ timestamp: meioDia }, meioDia), { text: '', tone: '', state: '' })
})
