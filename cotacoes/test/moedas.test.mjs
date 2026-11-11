import assert from 'node:assert/strict'
import test from 'node:test'
import { MOEDAS_CATALOG, MOEDAS_SERIES as LIB_MOEDAS, TFC_SERIES as LIB_TFC, buildMoedas, fillSeriesFromPrevious, moedaUrl, parseMoeda } from '../scripts/moedas-lib.mjs'
import { GROUPS, MOEDAS_SERIES, TFC_SERIES, changePct, groupRows, pointsOf } from '../src/moedas.js'

test('catálogo da tela espelha o da coleta (códigos, nomes, tipo e unidade)', () => {
  assert.deepEqual(TFC_SERIES, LIB_TFC)
  assert.deepEqual(MOEDAS_SERIES.map(({ id, name, kind, unit }) => ({ id, name, kind, unit })), LIB_MOEDAS)
  assert.equal(MOEDAS_CATALOG.length, 24 + 10) // 24 TFC + 7 moedas + 3 TFBD (TD1, TD2, TD3)
  assert.equal(moedaUrl('C02'), 'https://www.bndes.gov.br/Moedas/umC02.txt')
  assert.ok(!TFC_SERIES.some(([id]) => id === 'C19' || id === 'C21'))
})

const TXT = '   data   ;     valor\r\n15/10/2026;       0,820000\r\n15/09/2026;-      0,320000\r\n31/02/2026;  1\r\nx;1\r\n30/10/2026;       4,275229\r\n29/10/2026;       4,273059\r\n29/10/2026;       4,273000\r\n01/01/2026;\r\n'

test('parseMoeda: sinal antes dos espaços, ordem qualquer, dia repetido (vale o último) e linhas inválidas fora', () => {
  assert.deepEqual(parseMoeda(TXT), [['2026-09-15', -0.32], ['2026-10-15', 0.82], ['2026-10-29', 4.273], ['2026-10-30', 4.275229]])
  assert.deepEqual(parseMoeda(null), [])
})

test('buildMoedas e reaproveitamento do último dado', () => {
  const out = buildMoedas({ 143: TXT, C01: null }, ['C01: HTTP 502'], 1000)
  assert.deepEqual(Object.keys(out.series), ['143'])
  const f = fillSeriesFromPrevious(out, { generatedAt: 500, series: { C01: { points: [['2026-10-29', 14.1]] } } })
  assert.equal(f.stale.C01, 500); assert.ok(f.series.C01)
})

const NOW = Date.UTC(2026, 9, 29, 15)
const data = { stale: {}, series: {
  604: { points: [['2025-10-29', 5.0], ['2026-09-29', 5.5], ['2026-10-28', 5.3346], ['2026-10-29', 5.342]] },
  143: { points: [['2026-10-28', 4.27089], ['2026-10-29', 4.273059], ['2026-10-30', 4.275229]] },
  TR1: { points: [['2026-09-01', 3.64], ['2026-10-01', 3.6], ['2026-11-01', 3.18]] },
  C01: { points: [['2026-10-28', 14.0], ['2026-10-29', 14.1]] },
} }

test('groupRows: valor vigente ignora datas futuras; variação em % para níveis e em p.p. para taxas; ausente marcado', () => {
  const m = groupRows(data, 'moedas', NOW)
  const usd = m.find((r) => r.id === '604'), selic = m.find((r) => r.id === '143'), tr = m.find((r) => r.id === 'TR1')
  assert.equal(usd.text, 'R$ 5,3420'); assert.equal(usd.day.text, '▲ +0,14%'); assert.equal(usd.year.text, '▲ +6,84%')
  assert.equal(selic.date, '2026-10-29'); assert.equal(selic.text, '4,273059')
  assert.equal(tr.date, '2026-10-01'); assert.equal(tr.text, '3,60% a.a.'); assert.equal(tr.day.text, '▼ −0,04 p.p.')
  assert.equal(m.find((r) => r.id === '024').missing, true)
  const t = groupRows(data, 'tfc', NOW)
  assert.equal(t.length, 24); assert.equal(t[0].text, '14,10% a.a.'); assert.equal(t[0].day.text, '▲ +0,10 p.p.'); assert.equal(t[0].year, null)
  assert.equal(t.filter((r) => r.missing).length, 23)
  assert.equal(groupRows(null, 'tfc', NOW).every((r) => r.missing), true)
  assert.equal(pointsOf(data, '143', NOW).length, 2); assert.equal(GROUPS.tfc.length, 24)
})

test('changePct: igual, queda e referência ausente', () => {
  assert.equal(changePct(5, ['d', 5.0001]).dir, 'same'); assert.equal(changePct(4.5, ['d', 5]).text, '▼ −10,00%'); assert.equal(changePct(4, null), null); assert.equal(changePct(4, ['d', 0]), null)
})
