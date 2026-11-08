import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { collectTrends, parseTrends, TRENDS_RSS } from '../scripts/trends-lib.mjs'
import { preserveForTrends } from '../scripts/preserve-for-trends.mjs'
import { RETAIN_FILES, createWeeklySnapshot } from '../scripts/weekly-data.mjs'
import { weeklyFixture } from './helpers/weekly-package.mjs'
import { groupsForTrend, exploreUrl, trendEmbedUrl, TREND_GROUPS, TREND_PERIODS, validTrendData, trendsOld, TREND_MAX_AGE_MS } from '../src/trends.js'
import { TREND_SNAPSHOT, SNAPSHOT_START, SNAPSHOT_AT } from '../src/trendsSnapshot.js'

const rss = '<rss><channel><item><title><![CDATA[Dólar &amp; Selic]]></title><pubDate>Tue, 03 Nov 2026 12:00:00 GMT</pubDate><ht:approx_traffic>20K+</ht:approx_traffic></item></channel></rss>'
const previous = { generatedAt: 100, items: [{ title: 'BNDES', publishedAt: 90, groups: ['investimento'] }] }

test('RSS oficial preserva data, volume e classificação; não completa com temas aleatórios', () => {
  const [item] = parseTrends(rss)
  assert.equal(item.title, 'Dólar & Selic')
  assert.equal(item.traffic, '20K+')
  assert.deepEqual(item.groups, ['juros'])
  assert.equal(item.publishedAt, Date.parse('2026-11-03T12:00:00Z'))
  assert.deepEqual(groupsForTrend('futebol ao vivo'), [])
  assert.deepEqual(groupsForTrend('Reforma tributária CBS e IBS'), ['reforma'])
  assert.deepEqual(groupsForTrend('Financiamento de máquinas BNDES'), ['investimento'])
})
test('falha HTTP, HTML/reCAPTCHA ou RSS inválido mantém último snapshot e data original', async () => {
  for (const response of [{ ok: false, status: 429 }, { ok: true, text: async () => '<html>reCAPTCHA</html>' }, { ok: true, text: async () => '<rss><channel></channel></rss>' }]) {
    const result = await collectTrends({ previous, now: 300, fetchImpl: async () => response })
    assert.equal(result.generatedAt, 100)
    assert.equal(result.checkedAt, 300)
    assert.equal(result.stale, true)
    assert.deepEqual(result.items, previous.items)
  }
})
test('primeira falha ou retenção inválida não fabrica data nem itens; sucesso avança a coleta', async () => {
  for (const invalid of [null, {}, { generatedAt: null, items: [] }, { generatedAt: 100, items: [{ title: 'inválido' }] }]) {
    const failure = await collectTrends({ previous: invalid, now: 300, fetchImpl: async () => { throw Error('offline') } })
    assert.equal(failure.generatedAt, null)
    assert.deepEqual(failure.items, [])
  }
  let url
  const result = await collectTrends({ now: 400, fetchImpl: async target => { url = target; return { ok: true, text: async () => rss } } })
  assert.equal(url, TRENDS_RSS)
  assert.equal(result.source, TRENDS_RSS)
  assert.equal(result.generatedAt, 400)
  assert.equal(result.checkedAt, 400)
  assert.equal(result.stale, false)
  assert.equal(result.region, 'BR')
  assert.ok(validTrendData(result))
})
test('coleta e atualização no navegador não substituem a data de origem por uma data nova', () => {
  assert.ok(validTrendData(previous))
  assert.equal(trendsOld(previous, 100 + TREND_MAX_AGE_MS), false)
  assert.equal(trendsOld(previous, 101 + TREND_MAX_AGE_MS), true)
  assert.equal(trendsOld({ generatedAt: null }), true)
  assert.equal(trendsOld({ generatedAt: '2026-11-03T12:00:00Z' }, Date.parse('2026-11-04T14:00:00Z')), true)
  assert.equal(validTrendData({ ...previous, items: [{ ...previous.items[0], groups: ['grupo-inexistente'] }] }), false)
  assert.equal(validTrendData({ ...previous, items: [null] }), false)
})
test('Explore usa recorte brasileiro e parâmetros codificados; snapshots reais têm escala e período fixos', () => {
  const url = new URL(exploreUrl(['capital de giro', 'BNDES'], 'today 12-m'))
  assert.equal(url.searchParams.get('geo'), 'BR')
  assert.equal(url.searchParams.get('date'), 'today 12-m')
  assert.equal(url.searchParams.get('q'), 'capital de giro,BNDES')
  assert.equal(SNAPSHOT_AT, '2026-11-03T13:33:00-03:00')
  assert.deepEqual(Object.keys(TREND_SNAPSHOT), ['credito', 'investimento', 'juros'])
  for (const series of Object.values(TREND_SNAPSHOT)) {
    assert.equal(series.values.length, 92)
    assert.ok(series.values.every(v => Number.isInteger(v) && v >= 0 && v <= 100))
    assert.equal(new Date(Date.parse(SNAPSHOT_START) + (series.values.length - 1) * 86400000).toISOString().slice(0, 10), '2026-11-02')
  }
})
test('atualização exclusiva de Trends conserva cada outra base byte a byte, após validar todos os downloads', async () => {
  const fixture = weeklyFixture()
  const trends = JSON.stringify({ generatedAt: 600, items: [], stale: false })
  const loaded = [], saved = {}
  const retained = await preserveForTrends({ readTrends: async () => trends, load: async file => { loaded.push(file); return fixture[file] }, save: async (file, text) => { assert.equal(loaded.length, RETAIN_FILES.length - 1); saved[file] = text } })
  assert.equal(saved['trends.json'], trends)
  for (const file of RETAIN_FILES.filter(file => file !== 'trends.json')) assert.equal(saved[file], fixture[file], file)
  assert.deepEqual(saved, retained)
  assert.equal(Object.keys(createWeeklySnapshot(retained)).length, RETAIN_FILES.length)
})
test('falha isolada ao preservar outra base aborta antes de escrever em qualquer arquivo', async () => {
  const fixture = weeklyFixture(), saved = []
  await assert.rejects(preserveForTrends({ readTrends: async () => fixture['trends.json'], load: async file => file === 'news.json' ? '<html>offline</html>' : fixture[file], save: async file => saved.push(file) }), /news.json/)
  assert.deepEqual(saved, [])
})
test('subaba Trends mantém Moedas e Veículos pesados e documenta os limites do histórico', async () => {
  const resumo = await readFile(new URL('../src/Resumo.jsx', import.meta.url), 'utf8')
  assert.match(resumo, /newsTab === 'trends' \? <GoogleTrends \/>/)
  for (const id of ['moedas', 'reforma', 'eleicoes', 'trends', 'veiculos-pesados']) assert.ok(resumo.includes(`id: '${id}'`))
  const ui = await readFile(new URL('../src/GoogleTrends.jsx', import.meta.url), 'utf8')
  assert.match(ui, /Não atualiza automaticamente/)
  assert.match(ui, /não é coletado nem armazenado pelo painel/)
  assert.match(ui, /O painel não consegue confirmar o conteúdo carregado pelo Google/)
  assert.match(ui, /Hipótese para a conversa/)
})
test('incorporação oficial cobre cinco grupos, três termos e dois períodos sem API privada', () => {
  assert.equal(TREND_GROUPS.length, 5)
  for (const group of TREND_GROUPS) for (const period of TREND_PERIODS) {
    const url = new URL(trendEmbedUrl(group.id, period))
    assert.equal(url.origin, 'https://trends.google.com')
    assert.equal(url.pathname, '/trends/embed/explore/TIMESERIES')
    assert.equal(url.searchParams.get('tz'), '180')
    assert.equal(url.searchParams.get('hl'), 'pt-BR')
    const req = JSON.parse(url.searchParams.get('req'))
    assert.deepEqual(req, { comparisonItem: group.terms.map(keyword => ({ keyword, geo: 'BR', time: period })), category: 0, property: '' })
    const explore = new URLSearchParams(url.searchParams.get('eq'))
    assert.equal(explore.get('q'), group.terms.join(','))
    assert.equal(explore.get('date'), period)
    assert.equal(explore.get('geo'), 'BR')
  }
  assert.throws(() => trendEmbedUrl('desconhecido'), /inválido/)
  assert.throws(() => trendEmbedUrl('credito', 'today 5-y'), /inválido/)
})
test('cron exclusivo de Trends não consulta outras fontes e confere a retenção depois do build', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8')
  assert.match(workflow, /cron: '0 11,18 \* \* \*'/)
  assert.ok(workflow.indexOf('run: node scripts/fetch-trends.mjs') < workflow.indexOf('run: node scripts/preserve-for-trends.mjs'))
  for (const block of workflow.split('\n      - ')) {
    if (/run: node scripts\/(?:fetch-(?!trends)[\w-]+|export-csv)\.mjs/.test(block)) assert.ok(block.includes("github.event.schedule != '0 11,18 * * *'"), block.split('\n')[0])
  }
  const verify = workflow.indexOf('run: node scripts/weekly-data.mjs')
  assert.ok(verify > workflow.indexOf('run: npm run build'))
  assert.ok(verify < workflow.indexOf('uses: actions/upload-pages-artifact'))
  assert.ok(workflow.slice(workflow.lastIndexOf('\n      - ', verify), verify).includes("github.event.schedule == '0 11,18 * * *'"))
})
