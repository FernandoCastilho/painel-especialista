import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { MOEDAS_CATALOG, SOURCE_STATUS, buildMoedas, fillSeriesFromPrevious, moedaUrl } from '../scripts/moedas-lib.mjs'
import { buildCsvs } from '../scripts/csv-lib.mjs'
import { groupRows } from '../src/moedas.js'
import { familyRows, seriesFor } from '../src/bndesView.js'
import { buildRoute, parseRoute } from '../src/bndesRoute.js'
import { sameUnit } from '../src/multiSeries.js'
import { chartLinePath } from '../src/chartLinePath.js'

// Valores sintéticos: não são cotações oficiais ou taxas padrão da calculadora.
const NOW = Date.UTC(2026, 10, 5, 15)
const data = () => buildMoedas({
  143: '04/11/2026;4,123456\n05/11/2026;4,125555\n06/11/2026;9,000000',
  LD1: '01/07/2026;0,654321\n01/10/2026;0,123456\n01/01/2027;0,777777',
}, [], NOW)

test('LD1 é sobretaxa anual distinta do índice143 no catálogo e na coleta', () => {
  assert.equal(moedaUrl('LD1'), 'https://www.bndes.gov.br/Moedas/umLD1.txt')
  assert.equal(SOURCE_STATUS.LD1.endpointConfirmed, true)
  assert.equal(SOURCE_STATUS.LD1.automaticCollectionEnabled, false)
  assert.equal(MOEDAS_CATALOG.find(s => s.id === 'LD1').unit, '% a.a.')
  assert.equal(MOEDAS_CATALOG.find(s => s.id === '143').unit, 'índice')
  assert.deepEqual(data().series.LD1.points[1], ['2026-10-01', 0.123456])
})

test('gráficos preservam unidades e precisão, excluindo observações futuras', () => {
  const selic = seriesFor('moedas', '143', null, data(), NOW)
  const lcd = seriesFor('moedas', 'LD1', null, data(), NOW)
  assert.equal(selic.unit, 'índice'); assert.equal(selic.decimals, 6)
  assert.equal(lcd.unit, '% a.a.'); assert.equal(lcd.decimals, 6)
  assert.deepEqual(lcd.list.at(-1), { period: '2026-10-01', value: 0.123456 })
  assert.equal(selic.list.at(-1).period, '2026-11-05')
  assert.equal(sameUnit([selic, lcd]), false, 'não misturar nível do índice com taxa anual')
  assert.equal(groupRows(data(), 'moedas', NOW).find(r => r.id === 'LD1').text, '0,123456% a.a.')
})

test('LD1 ausente não vira zero nem série143; retenção exige procedência validada', () => {
  assert.equal(familyRows('moedas', null, null, NOW).find(r => r.id === 'LD1').missing, true)
  assert.deepEqual(seriesFor('moedas', 'LD1', null, null, NOW).list, [])
  const previous = data()
  const next = fillSeriesFromPrevious(buildMoedas({}, ['LD1: indisponível'], NOW + 1000), previous)
  assert.equal(next.stale.LD1, NOW)
  assert.deepEqual(next.series.LD1, previous.series.LD1)
  const unverified = structuredClone(previous); delete unverified.series.LD1.sourceValidated
  assert.equal(fillSeriesFromPrevious(buildMoedas({}), unverified).series.LD1, undefined)
  assert.equal(next.stale['143'], NOW, 'retenção de fontes anteriores preservada')
  const zero = { series: { LD1: { points: [['2026-10-01', 0]] } } }
  assert.equal(groupRows(zero, 'moedas', NOW).find(r => r.id === 'LD1').missing, undefined)
  assert.equal(seriesFor('moedas', 'LD1', null, zero, NOW).list[0].value, 0)
})

test('histórico oficial LD1: nove observações negativas preservadas, sem piso zero', () => {
  const text = readFileSync(new URL('./fixtures/ld1-oficial-2026-11-05.txt', import.meta.url), 'utf8')
  const out = buildMoedas({ LD1: text }, [], NOW)
  assert.equal(out.series.LD1.points.length, 9)
  assert.deepEqual(out.series.LD1.points[0], ['2025-02-01', -0.25])
  assert.deepEqual(out.series.LD1.points.at(-1), ['2026-10-01', -0.11])
  assert.equal(out.series.LD1.sourceValidated, true)
  assert.equal(out.series.LD1.source, moedaUrl('LD1'))
  assert.equal(groupRows(out, 'moedas', NOW).find(r => r.id === 'LD1').text, '-0,110000% a.a.')
  const series = seriesFor('moedas', 'LD1', null, out, NOW)
  assert.equal(series.stepped, true)
  assert.equal(series.list.at(-1).value, -0.11)
  assert.match(buildCsvs({ moedas: out })['moedas.csv'], /LD1,SOBRETAXA LCD,2026-10-01,-0\.11,% a\.a\./)
})

test('degraus alteram só geometria e preservam path linear padrão', () => {
  const points = [{ t: 1, v: -0.25 }, { t: 2, v: -0.11 }]
  assert.equal(chartLinePath(points, x => x, y => y, 'v', true), 'M1.0,-0.3H2.0V-0.1')
  assert.equal(chartLinePath(points, x => x, y => y), 'M1.0,-0.3L2.0,-0.1')
  assert.equal(points.length, 2)
})

test('links e CSV incluem LD1 sem alterar a unidade de143', () => {
  const ids = { moedas: familyRows('moedas', null, data(), NOW).map(r => r.id) }
  const route = { family: 'moedas', id: 'LD1', preset: 12, custom: null, compare: ['143', 'LD1'] }
  assert.deepEqual(parseRoute(buildRoute(route), ids), route)
  const csv = buildCsvs({ moedas: data() })['moedas.csv']
  assert.match(csv, /LD1,SOBRETAXA LCD,2026-10-01,0\.123456,% a\.a\./)
  assert.match(csv, /143,SELIC ACUM\. D-2,2026-11-05,4\.125555,índice/)
  assert.doesNotMatch(buildCsvs({ moedas: null })['moedas.csv'], /LD1/)
})

test('tela tem atalhos de seleção143/LD1 e aviso contra custo total inferido', () => {
  const source = readFileSync(new URL('../src/Bndes.jsx', import.meta.url), 'utf8')
  assert.match(source, /Selic D-2 · 143/)
  assert.match(source, /Sobretaxa LCD · LD1/)
  assert.match(source, /não representa o custo total/)
  assert.match(source, /compare: \[\]/)
  assert.match(source, /disabled=\{!lcdComparisonAvailable\}/)
  assert.match(source, /withOfficialLcdSnapshot\(moedas\.data\)/)
  assert.match(source, /sem atualização automática; valores após essa cobertura não estão confirmados/)
  assert.match(source, /familyRows\(f\.id, bndes\.data, moedasData/)
  assert.match(source, /seriesFor\(family, id, bndes\.data, moedasData/)
  const collector = readFileSync(new URL('../scripts/moedas-collector.mjs', import.meta.url), 'utf8')
  assert.match(collector, /automaticCollectionEnabled === false\)\s*\{[\s\S]*?results\[id\] = null; errors\.push\([\s\S]*?\); continue/)
  assert.ok(collector.indexOf('automaticCollectionEnabled === false') < collector.indexOf('await fetchFn(url'))
  const writer = readFileSync(new URL('../scripts/fetch-moedas.mjs', import.meta.url), 'utf8')
  assert.match(writer, /const out = withOfficialLcdSnapshot\(fillSeriesFromPrevious/)
  assert.ok(writer.indexOf('const out = withOfficialLcdSnapshot') < writer.indexOf('await writeFile'))
})
