import test from 'node:test'
import assert from 'node:assert/strict'
import { alertasDoDia, fechamentoAnterior, textoAlerta } from '../src/alertaVariacao.js'
import { toQuote } from '../src/useQuotes.js'

const NOW = Date.parse('2026-11-05T15:00:00Z')
const q = (bid, base = 5.48, extra = {}) => ({ bid, delta: bid - base, pct: (bid / base - 1) * 100, timestamp: NOW - 60000, ...extra })

test('alerta usa fechamento anterior e o Δ dia da cotação, por moeda e sentido', () => {
  let a = alertasDoDia({ quotes: { USD: q(5.5), EUR: q(6.15, 6.14) }, now: NOW })
  assert.deepEqual(a.map((x) => [x.code, x.dir]), [['USD', 'alta']])
  assert.equal(a[0].id, '2026-11-05:USD:alta')
  assert.match(textoAlerta(a[0]), /Dólar em alta de 0,36% em relação ao fechamento anterior da fonte \(5,4800 → 5,5000 às 11:59 de Brasília\)/)
  assert.doesNotMatch(textoAlerta(a[0]), /ontem|09:00|primeira cotação/)
  a = alertasDoDia({ quotes: { USD: q(5.46), EUR: q(6.1, 6.14) }, now: NOW })
  assert.deepEqual(a.map((x) => [x.code, x.dir]), [['USD', 'queda'], ['EUR', 'queda']])
})

test('primeira observação já dispara sem intraday; movimento após 9h não substitui Δ dia', () => {
  const timestamp = Date.parse('2026-11-05T12:00:00Z')
  const alerts = (quote, first) => alertasDoDia({ quotes: { USD: quote }, firsts: { USD: first }, now: timestamp })
  assert.equal(alerts(q(5.52, 5.5, { timestamp }), { t: timestamp, v: 5.52 }).length, 1)
  assert.equal(alerts(q(5.5, 5.5, { timestamp }), { t: timestamp - 300000, v: 5.4 }).length, 0)
  assert.equal(alerts(q(5.52, 5.5, { timestamp: timestamp - 1 })).length, 0, 'mantém início às 9h BRT')
})

test('limite percentual estrito nos dois sentidos, com o mesmo arredondamento do Δ dia', () => {
  const alerts = (bid, pct) => alertasDoDia({ quotes: { USD: q(bid, 5, { pct }) }, now: NOW })
  assert.equal(alerts(5.015, 0.3).length, 0)
  assert.equal(alerts(4.985, -0.3).length, 0)
  assert.equal(alerts(5.01501, 0.3002).length, 1)
  assert.equal(alerts(4.98499, -0.3002).length, 1)
  assert.equal(alerts(5.01501, 0.30).length, 0, 'pctChange arredondado preserva igualdade com o Δ dia')
  assert.equal(alerts(5.0155, 0.31).length, 1, 'delta em reais não precisa ser R$0,30')
})

test('referência é da própria fonte, não de PTAX/BCE, par distinto ou amostra inválida', () => {
  const quote = q(5.5)
  assert.equal(fechamentoAnterior(quote), 5.48)
  for (const extra of [{ bid: Infinity }, { bid: 0 }, { delta: null }, { delta: NaN }, { delta: Infinity }, { delta: 6 }, { delta: 5.5 }, { pct: null }, { pct: NaN }, { pct: Infinity }, { pct: -2 }]) {
    assert.equal(fechamentoAnterior({ ...quote, ...extra }), null, JSON.stringify(extra))
    assert.equal(alertasDoDia({ quotes: { USD: { ...quote, ...extra } }, now: NOW }).length, 0)
  }
  for (const extra of [{ stale: true }, { fallback: true }, { source: 'EUR' }, { source: 'BCE' }]) {
    assert.equal(alertasDoDia({ quotes: { USD: { ...quote, ...extra } }, now: NOW }).length, 0)
  }
  assert.equal(alertasDoDia({ quotes: { JPY: quote, CNH: quote }, now: NOW }).length, 0)
})

test('sem cotação recente do dia não há alerta, inclusive no fim de semana', () => {
  for (const timestamp of [NOW - 600001, NOW + 60001, NOW - 864e5, Infinity, NaN, 0, 1e30]) {
    assert.equal(alertasDoDia({ quotes: { USD: q(5.5, 5.48, { timestamp }) }, now: NOW }).length, 0)
  }
  assert.equal(alertasDoDia({ quotes: { USD: q(5.5, 5.48, { timestamp: NOW - 600000 }) }, now: NOW }).length, 1)
  const friday = Date.parse('2026-11-06T22:00:00Z'), saturday = Date.parse('2026-11-07T12:00:00Z')
  assert.equal(alertasDoDia({ quotes: { USD: q(5.5, 5.48, { timestamp: friday }) }, now: saturday }).length, 0)
})

test('segunda e após feriado usam a base da fonte, sem exigir calendário ou amostra de ontem', () => {
  for (const iso of ['2026-11-09T12:01:00Z', '2026-11-03T12:01:00Z']) {
    const now = Date.parse(iso)
    const a = alertasDoDia({ quotes: { USD: q(5.5, 5.48, { timestamp: now }) }, now })
    assert.equal(a.length, 1)
    assert.equal(a[0].base, 5.48)
    assert.equal(a[0].id, `${iso.slice(0, 10)}:USD:alta`)
    assert.equal(a[0].baseAt, undefined, 'sem data inventada para o fechamento')
  }
})

test('virada civil é de Brasília, sem reaproveitar cotação do dia anterior', () => {
  const now = Date.parse('2026-11-06T01:00:00Z') // ainda quinta em Brasília
  const quote = q(5.5, 5.48, { timestamp: now })
  assert.equal(alertasDoDia({ quotes: { USD: quote }, now })[0].id, '2026-11-05:USD:alta')
  assert.equal(alertasDoDia({ quotes: { USD: quote }, now: Date.parse('2026-11-06T03:01:00Z') }).length, 0)
})

test('campos reais publicados em 06/11 conferem com fechamento diário de 05/11', () => {
  // Snapshot público origin/data: quotes.json e history.json, consultados em 07/11/2026.
  const now = Date.parse('2026-11-06T22:15:00Z')
  const usd = toQuote({ bid: '5.503', ask: '5.5035', high: '5.5235', low: '5.4835', varBid: '-0.0008', pctChange: '-0.014534', timestamp: '1794002689' }, 'USD')
  const eur = toQuote({ bid: '6.1303', ask: '6.1323', high: '6.1819', low: '6.1154', varBid: '-0.0486', pctChange: '-0.786544', timestamp: '1794003270' }, 'EUR')
  assert.ok(Math.abs(fechamentoAnterior(usd) - 5.5038) < 1e-12)
  assert.ok(Math.abs(fechamentoAnterior(eur) - 6.1789) < 1e-12)
  const a = alertasDoDia({ quotes: { USD: usd, EUR: eur }, now })
  assert.deepEqual(a.map(x => [x.code, x.dir, x.pct]), [['EUR', 'queda', eur.pct]])
})

test('entradas ausentes ou parâmetro inválido não geram alerta', () => {
  assert.deepEqual(alertasDoDia({ now: NOW }), [])
  for (const now of [NaN, Infinity, 1e30]) assert.deepEqual(alertasDoDia({ quotes: { USD: q(5.5) }, now }), [])
  for (const limite of [NaN, Infinity, -1]) assert.deepEqual(alertasDoDia({ quotes: { USD: q(5.5) }, now: NOW, limite }), [])
})

test('coerência tolera só o arredondamento até 0,005 ponto percentual', () => {
  const quote = q(5.5), implied = quote.delta / (quote.bid - quote.delta) * 100
  for (const sign of [-1, 1]) {
    assert.equal(fechamentoAnterior({ ...quote, pct: implied + sign * 0.005 }), 5.48)
    assert.equal(fechamentoAnterior({ ...quote, pct: implied + sign * 0.00501 }), null)
  }
})
