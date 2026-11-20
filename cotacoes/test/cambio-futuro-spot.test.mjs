import test from 'node:test'
import assert from 'node:assert/strict'
import { explicacaoFaixa, explicacaoPonto, mesaDailyEur, mesaIntradayCnh, mesaSpotRange, spotDayPlan } from '../src/cambioFuturoSpot.js'

const at = time => Date.parse(time + ':00-03:00')
const eur = (time, extras = {}) => ({ source: 'EUR', bid: 6.491, ask: 6.5, timestamp: at(time), ...extras })
const cnh = (time, leg, extras = {}) => ({ source: 'CNH', cross: true, bid: .8598, ask: .8601, low: .84, high: .87, pct: null, delta: null,
  timestamp: at(time), legTimestamps: { USDBRL: at(time), USDCNH: at(leg) }, ...extras })

test('em sessão considera hoje em Brasília, sem reutilizar ontem, dado atrasado ou futuro', () => {
  const plan = spotDayPlan(at('2026-11-19T10:00'))
  assert.equal(plan.open, true)
  assert.equal(plan.day, '2026-11-19')
  const ref = mesaSpotRange('EUR', eur('2026-11-19T09:57'), plan)
  assert.deepEqual(ref, { date: '2026-11-19', time: at('2026-11-19T09:57'), bid: 6.491, ask: 6.5, today: true })
  for (const quote of [null, eur('2026-11-18T17:59'), eur('2026-11-19T09:49'), eur('2026-11-19T10:01'),
    eur('2026-11-19T09:59', { fallback: true }), eur('2026-11-19T09:59', { bid: 6.51 }),
    eur('2026-11-19T09:59', { stale: true }), eur('2026-11-19T09:59', { ask: null })]) assert.equal(mesaSpotRange('EUR', quote, plan), null)
})

test('fora da sessão usa dia anterior real, incluindo feriado/fim de semana, e não rebaixa o dia depois do fechamento', () => {
  for (const date of ['2026-11-20T10:30', '2026-11-21T10:30', '2026-11-23T08:59']) {
    const plan = spotDayPlan(at(date))
    assert.equal(plan.open, false)
    assert.equal(plan.day, '2026-11-19')
    assert.equal(mesaSpotRange('EUR', eur('2026-11-19T17:59'), plan)?.today, false)
    assert.equal(mesaSpotRange('EUR', eur('2026-11-18T17:59'), plan), null)
    assert.equal(mesaSpotRange('EUR', eur('2026-11-20T09:00'), plan), null)
  }
  const evening = spotDayPlan(at('2026-11-19T23:30'))
  assert.equal(evening.day, '2026-11-19', 'não vira sexta-feira no relógio UTC')
  assert.equal(mesaSpotRange('EUR', eur('2026-11-19T17:55'), evening)?.today, true)
})

test('CNH à vista exige offshore e duas pernas compatíveis e nunca aceita CNY/BCE', () => {
  const plan = spotDayPlan(at('2026-11-20T10:00'))
  const quote = cnh('2026-11-19T16:50', '2026-11-19T16:54')
  assert.ok(mesaSpotRange('CNH', quote, plan))
  for (const bad of [{ ...quote, source: 'CNY' }, { ...quote, fallback: true }, { ...quote, stale: true }, { ...quote, legTimestamps: null },
      cnh('2026-11-19T15:49', '2026-11-19T17:00'), cnh('2026-11-19T23:55', '2026-11-20T00:01')]) {
    assert.equal(mesaSpotRange('CNH', bad, plan), null)
  }
})
test('sem faixa, usa EUR diário ou CNH intradiário aceito sem inventar preço de venda', () => {
  const closed = spotDayPlan(at('2026-11-20T12:00'))
  const open = spotDayPlan(at('2026-11-19T10:00'))
  const prev = { t: at('2026-11-19T17:35'), bid: 6.51 }
  const holiday = { t: at('2026-11-20T09:35'), bid: 6.53 }
  const file = { source: 'AwesomeAPI', generatedAt: at('2026-11-20T10:01'), series: { EUR: { source: 'EUR', points: [holiday, prev] } } }
  assert.deepEqual(mesaDailyEur(file, closed), { date: '2026-11-19', t: prev.t, value: 6.51 })
  assert.equal(mesaDailyEur(file, open), null)
  assert.equal(mesaDailyEur({ ...file, source: 'BCE' }, closed), null)
  assert.equal(mesaDailyEur({ ...file, generatedAt: null }, closed), null)
  assert.equal(mesaDailyEur({ ...file, series: { CNH: { source: 'CNH', points: [prev] } } }, closed), null, 'CNH diário não comprova a sincronia das pernas')
  const intraday = { source: 'CNH', feed: 'AwesomeAPI (coleta central a cada 5 min)', generatedAt: file.generatedAt, points: [
    { t: holiday.t, bid: .865 }, { t: prev.t, bid: .86 }, { t: at('2026-11-19T15:00'), bid: .855 },
  ] }
  assert.deepEqual(mesaIntradayCnh(intraday, closed), { date: '2026-11-19', t: prev.t, value: .86 })
  assert.equal(mesaIntradayCnh({ ...intraday, feed: undefined }, closed), null)
  assert.equal(mesaIntradayCnh({ ...intraday, source: 'CNY' }, closed), null)
  assert.equal(mesaIntradayCnh({ ...intraday, points: [intraday.points[0]] }, closed), null)
})

test('compara somente partida na precisão mostrada, sem medir custo ou presumir lado', () => {
  const ref = { bid: 6.491, ask: 6.5 }
  assert.equal(explicacaoFaixa(NaN, ref), '')
  assert.equal(explicacaoFaixa(6.4909, ref), 'Partida abaixo da faixa.')
  assert.equal(explicacaoFaixa(6.5001, ref), 'Partida acima da faixa.')
  assert.equal(explicacaoFaixa(6.491, ref), 'Partida dentro da faixa.')
  assert.equal(explicacaoFaixa(6.50001, ref), 'Partida dentro da faixa.')
})


test('ponto histórico só compara o número exibido, sem % ou mérito de preço', () => {
  const reference = { value: .85 }
  assert.equal(explicacaoPonto(NaN, reference), '')
  assert.equal(explicacaoPonto(.86, null), '')
  assert.equal(explicacaoPonto(.8499, reference), 'Partida abaixo do valor indicativo exibido.')
  assert.equal(explicacaoPonto(.8501, reference), 'Partida acima do valor indicativo exibido.')
  assert.equal(explicacaoPonto(.85004, reference), 'Partida igual ao valor indicativo exibido.')
})
