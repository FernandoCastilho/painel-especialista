import assert from 'node:assert/strict'
import test from 'node:test'
import { liveCross } from '../src/parity.js'
import { ageText, brentItem, changeText, dataStatus, feedState, ipcaItem, ipcaSpark, kpiItems, kpiSparks, monthlyCloses, sparkTone, parseCommand, tapeItems } from '../src/terminal.js'

const q = (bid, pct, extra = {}) => ({ bid, ask: bid, high: bid, low: bid, pct, timestamp: Date.now(), ...extra })
const quotes = { USD: q(5, 1, { source: 'USD' }), EUR: q(6, -0.5, { source: 'EUR' }), JPY: q(0.034, 0.2, { source: 'JPY' }), CNH: q(0.74, 0.1, { source: 'CNH' }) }
const rates = [
  { key: 'selic', label: 'Selic', value: 14.25, delta: 0 },
  { key: 'cdi', label: 'CDI', value: 14.15, delta: null },
  { key: 'di1', label: 'DI 1 ano', value: 13.8, delta: 0.04 },
  { key: 'ust10', label: 'Treasury 10a', value: 4.18, delta: -0.03 },
]

test('comandos: moedas, paridade e seções, com variações de escrita', () => {
  assert.deepEqual(parseCommand('USDBRL Curncy'), { kind: 'currency', code: 'USD' })
  assert.deepEqual(parseCommand(' usd/brl <GO> '), { kind: 'currency', code: 'USD' })
  assert.deepEqual(parseCommand('dólar'), { kind: 'currency', code: 'USD' })
  assert.deepEqual(parseCommand('iene'), { kind: 'currency', code: 'JPY' })
  assert.deepEqual(parseCommand('CNY'), { kind: 'currency', code: 'CNH' })
  assert.deepEqual(parseCommand('EUR/USD'), { kind: 'pair' })
  assert.deepEqual(parseCommand('juros'), { kind: 'tab', id: 'juros', sub: '' })
  assert.deepEqual(parseCommand('Notícias'), { kind: 'tab', id: 'noticias', sub: '' })
  assert.deepEqual(parseCommand('finimp'), { kind: 'tab', id: 'calculadora', sub: 'finimp' })
  assert.deepEqual(parseCommand('giro'), { kind: 'tab', id: 'calculadora', sub: 'giro' })
  assert.deepEqual(parseCommand('calculadoras'), { kind: 'tab', id: 'calculadora', sub: '' })
  assert.deepEqual(parseCommand('cenários'), { kind: 'tab', id: 'cenarios', sub: '' })
})

test('comando desconhecido ou vazio não navega', () => {
  assert.equal(parseCommand(''), null)
  assert.equal(parseCommand('   '), null)
  assert.equal(parseCommand(undefined), null)
  assert.equal(parseCommand('PETR4'), null)
})

test('variação: sinal, vírgula decimal e unidade; ausência não vira zero', () => {
  assert.equal(changeText(0.42), '+0,42%')
  assert.equal(changeText(-1.1234), '−1,12%')
  assert.equal(changeText(0), '0,00%')
  assert.equal(changeText(0.04, 'bps'), '+4 bps')
  assert.equal(changeText(-0.03, 'bps'), '−3 bps')
  assert.equal(changeText(null), null)
  assert.equal(changeText(NaN, 'bps'), null)
})

test('faixa: câmbio, paridade e juros, com tom pela direção', () => {
  const items = tapeItems(quotes, rates)
  assert.deepEqual(items.map((i) => i.label), ['USD/BRL', 'EUR/BRL', 'JPY/BRL', 'CNH/BRL', 'EUR/USD', 'Selic', 'CDI', 'DI 1 ano', 'Treasury 10a'])
  assert.equal(items[0].value, '5,0000')
  assert.equal(items[2].value, '0,03400')
  assert.equal(items[0].tone, 'up')
  assert.equal(items[1].tone, 'down')
  const parity = items.find((i) => i.key === 'EURUSD')
  assert.equal(parity.value, '1,2000')
  assert.equal(items.find((i) => i.key === 'selic').tone, 'flat')
  assert.equal(items.find((i) => i.key === 'cdi').text, null)
})

test('cotação de reserva (BCE) não exibe variação do dia nem entra na paridade', () => {
  const fb = { ...quotes, EUR: q(6, 0, { source: 'EUR', fallback: true }) }
  const items = tapeItems(fb, [])
  assert.equal(items.find((i) => i.key === 'EURBRL').text, null)
  assert.equal(items.find((i) => i.key === 'EURUSD'), undefined)
  assert.equal(kpiItems(fb, []).some((i) => i.key === 'EURUSD'), false)
})

test('sem dados: nada é inventado', () => {
  assert.deepEqual(tapeItems(null, undefined), [])
  assert.deepEqual(kpiItems(undefined, []), [])
})

test('indicadores: dólar, euro, paridade e juros do Brasil, nessa ordem', () => {
  assert.deepEqual(kpiItems(quotes, rates).map((i) => i.key), ['USDBRL', 'EURBRL', 'EURUSD', 'selic', 'cdi', 'di1'])
})

test('estado dos dados: erro vence; antigo avisa; sem cotação ainda carrega', () => {
  assert.equal(feedState({ error: 'x', aged: false, hasQuotes: true }), 'err')
  assert.equal(feedState({ error: null, aged: false, hasQuotes: false }), 'loading')
  assert.equal(feedState({ error: null, aged: true, hasQuotes: true }), 'delayed')
  assert.equal(feedState({ error: null, aged: undefined, hasQuotes: true }), 'ok')
})

const oil = { benchmark: 'Brent', kind: 'spot', unit: 'USD/barril', value: 115.22, observationDate: '2026-10-20' }

test('Brent da EIA entra na faixa com a data da observação e sem variação inventada', () => {
  const b = brentItem(oil)
  assert.equal(b.value, '115,22')
  assert.equal(b.note, '20/10')
  assert.equal(b.change, null)
  const items = tapeItems(quotes, rates, oil)
  assert.equal(items.at(-1).label, 'Brent EIA')
  assert.equal(items.at(-1).text, null)
  assert.equal(items.at(-1).tone, 'flat')
})

test('Brent com série traz a variação do dia (faixa); o card do topo agora é o IPCA', () => {
  const withPoints = { ...oil, points: [{ date: '2026-10-19', value: 118.82 }, { date: '2026-10-20', value: 115.22 }] }
  assert.ok(Math.abs(brentItem(withPoints).change - (115.22 / 118.82 - 1) * 100) < 1e-9)
  assert.equal(tapeItems(quotes, rates, withPoints).some((i) => i.key === 'BRENT'), true)
  assert.equal(kpiItems(quotes, rates, null).some((i) => i.key === 'BRENT'), false)
})

test('IPCA 12 meses no topo: valor, diferença em p.p. sobre o mês anterior e mês de referência', () => {
  const series = { points: [{ period: '2026-07', y12: 5.2 }, { period: '2026-08', y12: 4.9 }, { period: '2026-09', y12: 4.68 }] }
  const item = ipcaItem(series)
  assert.equal(item.label, 'IPCA 12m'); assert.equal(item.value, '4,68%'); assert.match(item.note, /set\/26/)
  assert.ok(Math.abs(item.change - (4.68 - 4.9)) < 1e-9)
  const k = kpiItems(quotes, rates, series)
  assert.equal(k.map((i) => i.key).join(), 'USDBRL,EURBRL,EURUSD,IPCA,selic,cdi,di1')
  const card = k.find((i) => i.key === 'IPCA')
  assert.equal(card.text, '−0,22 p.p.'); assert.equal(card.tone, 'down')
  // sem o mês anterior a variação some, sem virar zero; sem série, o card não existe
  assert.equal(ipcaItem({ points: [{ period: '2026-09', y12: 4.68 }] }).change, null)
  assert.equal(ipcaItem({ points: [] }), null)
  assert.equal(ipcaItem(null), null)
  assert.equal(changeText(0.001, 'pp'), '0,00 p.p.')
})

test('Brent inválido ou de outra série não entra', () => {
  assert.equal(brentItem(null), null)
  assert.equal(brentItem({ ...oil, kind: 'futures' }), null)
  assert.equal(brentItem({ ...oil, value: null }), null)
  assert.equal(tapeItems(quotes, [], { ...oil, unit: 'USD/m3' }).some((i) => i.key === 'BRENT'), false)
})

test('estado das fontes: prazo de atraso considera a pausa semanal real', () => {
  const now = Date.parse('2026-10-27T12:00:00Z')
  const H = 3600e3
  const rows = dataStatus([
    { key: 'a', label: 'A', at: now - 2 * H, maxAge: 6 * H, weekdays: true },
    { key: 'b', label: 'B', at: now - 9 * H, maxAge: 6 * H, weekdays: true },
    { key: 'c', label: 'C', at: new Date(now - 9 * H).toISOString(), maxAge: 6 * H, weekdays: false },
    { key: 'd', label: 'D', at: undefined, maxAge: 6 * H, weekdays: true },
  ], now, false)
  assert.deepEqual(rows.map((r) => r.state), ['ok', 'old', 'old', 'missing'])
  const sunday = Date.parse('2026-11-01T12:00:00-03:00')
  const friday = Date.parse('2026-10-30T23:00:00-03:00')
  const weekend = dataStatus([{ key: 'b', label: 'B', at: friday, maxAge: 6 * H, weekdays: true }, { key: 'q', label: 'Q', at: friday, maxAge: 6 * H, weekdays: false }], sunday, true)
  assert.deepEqual(weekend.map((r) => r.state), ['ok', 'old'])
})

test('idade em texto', () => {
  assert.equal(ageText(20e3), 'agora')
  assert.equal(ageText(5 * 60e3), 'há 5 min')
  assert.equal(ageText(3 * 3600e3), 'há 3 h')
  assert.equal(ageText(72 * 3600e3), 'há 3 dias')
  assert.equal(ageText(NaN), '—')
})

test('paridade: cotações de horários distintos não geram variação do dia', () => {
  const now = Date.now()
  const stale = { ...quotes, USD: { ...quotes.USD, timestamp: now - 6 * 3600e3 }, EUR: { ...quotes.EUR, timestamp: now } }
  const p = tapeItems(stale, []).find((i) => i.key === 'EURUSD')
  assert.equal(p.change, null)
  assert.equal(p.text, null)
  assert.equal(p.reason, 'cotações de horários distintos')
  assert.equal(kpiItems(stale, []).find((i) => i.key === 'EURUSD').text, null)
  const sync = { ...quotes, USD: { ...quotes.USD, timestamp: now }, EUR: { ...quotes.EUR, timestamp: now - 5 * 60e3 } }
  assert.ok(Number.isFinite(tapeItems(sync, []).find((i) => i.key === 'EURUSD').change))
})

test('liveCross sinaliza horários distintos e aceita cotações sem horário', () => {
  const a = { bid: 6, pct: -0.1, timestamp: 2e6 }
  assert.equal(liveCross(a, { bid: 5, pct: 0.1, timestamp: 2e6 + 29 * 60e3 }).comparable, true)
  assert.equal(liveCross(a, { bid: 5, pct: 0.1, timestamp: 2e6 + 31 * 60e3 }).comparable, false)
  assert.equal(liveCross({ bid: 6, pct: 0 }, { bid: 5, pct: 0 }).comparable, true)
  assert.deepEqual(liveCross({ bid: 0.8, pct: null }, { bid: 5, pct: 0.1 }), {
    main: 0.8 / 5, pct: null, comparable: true,
  })
})

test('variação que arredonda para zero fica neutra, sem seta de alta ou baixa', () => {
  const r = [{ key: 'cdi', label: 'CDI', value: 14.19, delta: 0.0004 }, { key: 'selic', label: 'Selic', value: 14.25, delta: -0.004 }, { key: 'di1', label: 'DI 1 ano', value: 13.8, delta: 0.006 }]
  const items = tapeItems(null, r)
  assert.deepEqual(items.map((i) => [i.tone, i.text]), [['flat', '0 bps'], ['flat', '0 bps'], ['up', '+1 bps']])
  assert.equal(changeText(0.004), '0,00%')
  assert.equal(changeText(-0.004), '0,00%')
})

test('comandos levam ao assunto certo dentro de Cenários', () => {
  assert.deepEqual(parseCommand('commodities'), { kind: 'tab', id: 'cenarios', sub: 'commodities' })
  assert.deepEqual(parseCommand('PMI'), { kind: 'tab', id: 'cenarios', sub: 'atividade' })
  assert.deepEqual(parseCommand('frete'), { kind: 'tab', id: 'cenarios', sub: 'commodities/frete' })
  assert.deepEqual(parseCommand('focus'), { kind: 'tab', id: 'cenarios', sub: 'projecoes' })
  assert.deepEqual(parseCommand('cenários'), { kind: 'tab', id: 'cenarios', sub: '' })
})

const D = (iso) => Date.parse(`${iso}T12:00:00Z`)
const NOW = D('2026-10-30')
const daily = (from, to, f) => { const out = []; for (let t = D(from); t <= D(to); t += 864e5) { const wd = new Date(t).getUTCDay(); if (wd && wd < 6) out.push([t, f(t)]) } return out }

test('minigráfico do CDI: fechamento dos 12 meses anteriores mais a última observação, só com dados reais', () => {
  const cdi = daily('2025-01-02', '2026-10-29', (t) => (t < D('2026-03-01') ? 14.9 : 14.15))
  const s = monthlyCloses(cdi, NOW)
  assert.equal(s.length, 13)
  assert.equal(s.at(-1).t, D('2026-10-29')); assert.equal(s.at(-1).bid, 14.15)
  assert.equal(s[0].bid, 14.9); assert.ok(s.every((p) => cdi.some((c) => c[0] === p.t && c[1] === p.bid)), 'cada ponto é uma observação do arquivo')
  assert.ok(s.every((p, i) => i === 0 || p.t > s[i - 1].t))
})
test('minigráfico do CDI: sem dado novo, dado parado ou pouco histórico não gera gráfico', () => {
  assert.deepEqual(monthlyCloses([], NOW), [])
  assert.deepEqual(monthlyCloses(undefined, NOW), [])
  assert.deepEqual(monthlyCloses(daily('2025-01-02', '2026-10-01', () => 14.9), NOW), [], 'última observação com mais de 10 dias')
  assert.deepEqual(monthlyCloses(daily('2026-08-03', '2026-10-29', () => 14.9), NOW), [], 'menos de 7 pontos')
  assert.deepEqual(monthlyCloses([[D('2026-10-29'), NaN], [D('2026-10-28'), null]], NOW), [])
})
test('minigráfico do CDI: mês com lacuna na fonte é descartado, não preenchido', () => {
  const cdi = [...daily('2025-10-01', '2026-03-31', () => 14.9), ...daily('2026-06-01', '2026-10-29', () => 14.15)]
  const s = monthlyCloses(cdi, NOW)
  assert.ok(s.every((p) => !(p.t > D('2026-04-10') && p.t < D('2026-05-31'))), 'abr e mai sem observação')
  assert.ok(s.length < 13 && s.length >= 7)
})
test('minigráfico da Selic: série em degraus, vale o último valor em vigor no fim de cada mês', () => {
  const selic = [[D('2023-08-02'), 13.25], [D('2025-01-29'), 12.25], [D('2025-06-18'), 15], [D('2026-03-18'), 14.5], [D('2026-10-29'), 14.5]]
  const s = monthlyCloses(selic, NOW, { step: true })
  assert.equal(s.length, 13); assert.equal(s[0].bid, 15); assert.equal(s.at(-1).bid, 14.5)
  assert.ok(s.some((p) => p.bid === 15) && s.some((p) => p.bid === 14.5))
  assert.ok(s.every((p) => [13.25, 12.25, 15, 14.5].includes(p.bid)), 'nenhum valor inventado')
})
test('minigráfico do IPCA: últimos 12 meses divulgados; poucos meses ou nulos não geram gráfico', () => {
  const pts = Array.from({ length: 20 }, (_, i) => ({ period: `${2025 + Math.floor((i + 2) / 12)}-${String(((i + 2) % 12) + 1).padStart(2, '0')}`, y12: 4 + i * 0.1 }))
  const s = ipcaSpark({ points: pts })
  assert.equal(s.length, 12); assert.equal(s.at(-1).bid, pts.at(-1).y12); assert.equal(s[0].bid, pts[8].y12)
  assert.deepEqual(ipcaSpark({ points: pts.slice(0, 5) }), [])
  assert.deepEqual(ipcaSpark({ points: [{ period: '2026-09', y12: null }] }), [])
  assert.deepEqual(ipcaSpark(null), [])
  const gap = ipcaSpark({ points: [pts[19], pts[15], pts[10], pts[18], pts[17], pts[16], pts[14], pts[13]] })
  assert.equal(gap.length, 8, 'mês ausente não é preenchido')
})
test('kpiSparks junta CDI, Selic e IPCA e devolve vazio sem dados', () => {
  assert.deepEqual(kpiSparks({}, NOW), { cdi: [], selic: [], IPCA: [] })
  const k = kpiSparks({ macro: { cdi: daily('2025-01-02', '2026-10-29', () => 14.15), selic: [[D('2025-06-18'), 15], [D('2026-10-29'), 15]] }, ipca: null }, NOW)
  assert.equal(k.cdi.length, 13); assert.equal(k.selic.length, 13); assert.deepEqual(k.IPCA, [])
})

test('cor do minigráfico de 12 meses segue o próprio gráfico', () => {
  assert.equal(sparkTone([{ bid: 14.9 }, { bid: 14.5 }]), 'down')
  assert.equal(sparkTone([{ bid: 4.2 }, { bid: 4.9 }]), 'up')
  assert.equal(sparkTone([{ bid: 14.5 }, { bid: 14.6 }, { bid: 14.5 }]), 'flat')
})

import { ibovItem, ibovSpark } from '../src/terminal.js'
import { toIndexPoints } from '../scripts/indices-lib.mjs'
test('Ibovespa: último fechamento, variação sobre o anterior e minigráfico de 30 dias; sem dado, sem cartão', () => {
  const d = (s) => Date.parse(`${s}T20:00:00Z`)
  const file = { series: { ibov: { points: [[d('2026-10-29'), 130000], [d('2026-10-30'), 127400]], stale: false } } }
  const it = ibovItem(file)
  assert.equal(it.value, '127.400'); assert.ok(Math.abs(it.change - -2) < 1e-9); assert.equal(it.note, '30/10'); assert.equal(it.unit, 'pct')
  assert.equal(ibovItem({ series: { ibov: { points: [[d('2026-10-30'), 127400]] } } }).change, null)
  assert.equal(ibovItem(null), null); assert.equal(ibovItem({ series: {} }), null)
  assert.equal(ibovSpark({ series: { ibov: { points: Array.from({ length: 40 }, (_, i) => [i, 100 + i]) } } }).length, 30)
  assert.deepEqual(toIndexPoints([[1, 127400.6], [2, 0], [3, NaN], [NaN, 5]]), [[1, 127401]])
})
test('Paridade para a Finimp: paridade ± 0,02, sem resíduo de ponto flutuante', async () => {
  const { FINIMP_MARGEM, finimpParidade } = await import('../src/terminal.js')
  assert.equal(FINIMP_MARGEM, 0.02)
  assert.deepEqual(finimpParidade(1.1172), { base: 1.1172, eurUsd: 1.1372, usdEur: 1.0972 })
  assert.deepEqual(finimpParidade(1.08999), { base: 1.09, eurUsd: 1.11, usdEur: 1.07 })
  assert.equal(finimpParidade(null), null)
})
test('paridade EUR/USD: direta quando existe e recente; cruzada como reserva', async () => {
  const { directParity } = await import('../src/terminal.js')
  const t = Date.parse('2026-11-03T14:20:00Z')
  const EUR = { bid: 6.1484, timestamp: t }, USD = { bid: 5.4981, timestamp: t }
  assert.equal(directParity({ EUR, USD, EURUSD: { bid: 1.1181, pct: 0.1, timestamp: t } }).bid, 1.1181)
  assert.equal(directParity({ EUR, USD, EURUSD: { bid: 1.1181, timestamp: t, stale: true } }), null)
  assert.equal(directParity({ EUR, USD, EURUSD: { bid: 1.1181, timestamp: t - 3600e3 } }), null) // 1 h mais velha que o EUR/BRL
  assert.equal(directParity({ EUR, USD }), null)
  const items = kpiItems({ EUR, USD, EURUSD: { bid: 1.1181, pct: 0.1, timestamp: t } }, [], null, null)
  assert.equal(items.find((i) => i.key === 'EURUSD').value, '1,1181')
})
test('calculadora da Finimp: EUR × (paridade + 0,02) vira USD; USD ÷ (paridade − 0,02) vira EUR', async () => {
  const { finimpParidade, finimpConverte } = await import('../src/terminal.js')
  const fin = finimpParidade(1.1172)
  assert.deepEqual(finimpConverte(100000, 'eur-usd', fin), { taxa: 1.1372, valor: 113720, moeda: 'USD' })
  assert.deepEqual(finimpConverte(109720, 'usd-eur', fin), { taxa: 1.0972, valor: 100000, moeda: 'EUR' })
  assert.equal(finimpConverte(0, 'eur-usd', fin), null)
  assert.equal(finimpConverte(100, 'x', fin), null)
})

test('FINIMP: ajuste absoluto de dois centavos, aplicado uma vez e sem alterar a cotação de mercado', async () => {
  const { finimpParidade, finimpConverte } = await import('../src/terminal.js')
  const t = Date.parse('2026-11-06T18:00:00Z')
  const quotes = { EUR: { bid: 6, timestamp: t }, USD: { bid: 5, timestamp: t }, EURUSD: { bid: 1.1172, pct: 0.1, timestamp: t } }
  const before = structuredClone(quotes)
  const market = () => kpiItems(quotes, [], null, null).find(i => i.key === 'EURUSD')
  const fin = finimpParidade(market().raw)
  assert.deepEqual(finimpConverte(100000, 'eur-usd', fin), { taxa: 1.1372, valor: 113720, moeda: 'USD' })
  assert.deepEqual(finimpConverte(100000, 'usd-eur', fin), { taxa: 1.0972, valor: 91141.09, moeda: 'EUR' })
  assert.equal(market().value, '1,1172')
  assert.equal(market().raw, 1.1172)
  assert.deepEqual(quotes, before)
  assert.equal(finimpConverte(100, 'usd-eur', finimpParidade(0.02)), null, 'não divide por zero')
  assert.equal(finimpConverte(100, 'usd-eur', finimpParidade(0.01)), null, 'não usa denominador negativo')
})
