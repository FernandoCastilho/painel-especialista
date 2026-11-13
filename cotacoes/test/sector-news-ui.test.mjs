import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { hookRenderer } from './helpers/hooks.mjs'
import * as sectorNews from '../src/sectorNews.js'
import * as newsTitle from '../src/newsTitle.js'

const require = createRequire(import.meta.url)
const now = Date.parse('2026-11-05T12:00:00Z')

async function setup(t, resource, normalize = data => data) {
  const source = await readFile(new URL('../src/SectorNews.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }, polls = []
  let clock = now
  class Clock extends Date { static now() { return clock } }
  runInNewContext(code, { module, exports: module.exports, Date: Clock, require: name => {
    if (name === './SectorNews.css') return {}
    if (name === 'react') return { ...require(name), useMemo: fn => fn() }
    if (name === './useDataFile.js') return { useDataFile: () => resource }
    if (name === './visiblePolling.js') return { DATA_POLL_MS: 60000, startVisiblePolling: fn => { polls.push(fn); return () => {} } }
    if (name === './newsWindow.js') return { NEWS_WINDOW_MS: 120 * 3600000 }
    if (name === './newsTitle.js') return newsTitle
    if (name === './insumoPresentation.js') return { publicReference: value => value?.startsWith('https://www.gov.br/') }
    if (name === './sectorNews.js') return { ...sectorNews, normalizeSectorNews: normalize }
    if (name === './Estado.jsx') return ({ children }) => createElement('p', {}, children)
    return require(name)
  } })
  const render = hookRenderer(() => module.exports.default({ id: 'teste', label: 'Tema de teste' }))
  t.after(() => render.close())
  await render.settle()
  return { html: () => renderToStaticMarkup(render.value), advance: async milliseconds => { clock += milliseconds; polls.forEach(fn => fn()); await render.settle() } }
}

test('UI distingue carregamento e falha sem expor mensagens operacionais', async t => {
  const loading = await setup(t, { status: 'loading' })
  assert.match(loading.html(), /Carregando notícias/)
  assert.ok(loading.html().includes(sectorNews.SECTOR_NEWS_COLLECTION.notice))
  const error = await setup(t, { status: 'error' })
  assert.match(error.html(), /Atualização de notícias indisponível/)
  assert.match(error.html(), /Atualização automática não confirmada nesta leitura/)
  for (const status of ['empty', 'failed', 'unavailable', 'partial']) {
    const component = await setup(t, { status: 'ok', data: { topics: { teste: { status, items: [], sources: [] } } } })
    assert.match(component.html(), status === 'failed' ? /Atualização de notícias indisponível/ : /Publicações ainda não disponíveis nesta seleção/)
    assert.doesNotMatch(component.html(), /Janela móvel|Coleta externa|Nenhuma manchete|Tentativa de coleta|Nenhuma publicação relevante/)
  }
})

test('UI atribui fonte e licença e não inventa hora para publicação informada somente por dia', async t => {
  const component = await setup(t, { status: 'ok', data: { topics: { teste: {
    status: 'partial', checkedAt: '2026-11-05T11:00:00Z', lastSuccessAt: '2026-11-05T11:00:00Z', sources: [],
    items: [{ title: 'Título sintético exclusivo do teste', link: 'https://www.gov.br/noticia', source: 'Fonte de teste', type: 'official', licenseUrl: 'https://creativecommons.org/licenses/by-nd/3.0/', publishedAt: '2026-11-03', datePrecision: 'day', collectedAt: '2026-11-05T11:00:00Z', t: Date.parse('2026-11-03T15:00:00Z') }],
  } } } })
  const html = component.html()
  assert.match(html, /03\/11\/2026/)
  assert.match(html, /dateTime="2026-11-03"/)
  assert.match(html, /Fonte de teste/)
  assert.ok(html.includes(sectorNews.SECTOR_NEWS_COLLECTION.notice))
  assert.match(html, /Licença de uso/)
  assert.ok(!html.includes('03/11/2026, 12:00'))
})

test('normalização é reaplicada após o relógio avançar com a página aberta', async t => {
  const times = []
  const component = await setup(t, { status: 'ok', data: {} }, (data, time) => { times.push(time); return { topics: { teste: { status: 'empty', items: [], sources: [] } } } })
  await component.advance(60000)
  assert.deepEqual(times, [now, now + 60000])
  assert.match(component.html(), /Notícias da semana/)
})

test('arquivo inválido mostra falha, sem simular cobertura atual', async t => {
  const component = await setup(t, { status: 'ok', data: {} }, () => { throw Error('invalid') })
  assert.match(component.html(), /Atualização de notícias indisponível/)
})

test('leitura falha com snapshot retido preserva aviso, fonte e data das publicações válidas', async t => {
  const component = await setup(t, { status: 'error', stale: true, data: { topics: { teste: {
    status: 'partial', checkedAt: '2026-11-05T11:00:00Z', lastSuccessAt: '2026-11-04T11:00:00Z',
    sources: [{ id: 'teste', label: 'Fonte sintética', status: 'failed', reason: 'Consulta falhou' }],
    items: [{ title: 'Manchete retida de teste', link: 'https://www.gov.br/retida', source: 'Fonte sintética', type: 'official', publishedAt: '2026-11-04', datePrecision: 'day', collectedAt: '2026-11-04T11:00:00Z', t: Date.parse('2026-11-04T15:00:00Z') }],
  } } } })
  const html = component.html()
  assert.match(html, /Atualização de notícias indisponível/)
  assert.match(html, /Seleção parcial/)
  assert.match(html, /Manchete retida de teste/)
  assert.match(html, /Fonte sintética/)
  assert.match(html, /04\/11\/2026/)
  assert.doesNotMatch(html, /falha de consulta|Coleta externa|Tentativa de coleta/)
})

 test('referências privadas não aparecem na lista de notícias', async t => {
  const component = await setup(t, { status: 'ok', data: { topics: { teste: { status: 'ok', items: [{ title: 'Notícia privada', link: 'https://empresa.com/noticia' }] } } } })
  assert.doesNotMatch(component.html(), /Notícia privada|empresa.com/)
})

test('falha da fonte mantém aviso mesmo quando o arquivo foi lido', async () => {
  const source = await readFile(new URL('../src/SectorNews.jsx', import.meta.url), 'utf8')
  assert.match(source, /const readError = topic\?\.status === 'failed' \|\| resource.status === 'error'/)
})

test('coleta confirmada mostra datas e contagens públicas; leitura retida mantém aviso offline', async t => {
  const data = { collection: { automaticCollectionEnabled: true, notice: 'Coleta automática institucional ativa · cobertura parcial.', checkedAt: '2026-11-05T11:00:00Z', lastSuccessAt: '2026-11-05T10:00:00Z', sourceStats: { successful: 2, notActive: 16, failed: 1, suspended: 1, pending: 5 } }, topics: { teste: { status: 'partial', items: [], sources: [{ reason: 'private operational detail' }] } } }
  const active = await setup(t, { status: 'ok', data })
  assert.match(active.html(), /Coleta automática institucional ativa/)
  assert.match(active.html(), /Verificação geral do painel/)
  assert.match(active.html(), /último sucesso geral/)
  assert.match(active.html(), /2 com consulta válida · 16 não ativadas/)
  assert.match(active.html(), /Brasília/)
  assert.match(active.html(), /Fontes do painel/)
  assert.doesNotMatch(active.html(), /private operational/)
  for (const resource of [{ status: 'error', data }, { status: 'ok', stale: true, data }]) {
    const stale = await setup(t, resource)
    assert.match(stale.html(), /Atualização automática não confirmada nesta leitura/)
    assert.doesNotMatch(stale.html(), /Coleta automática institucional ativa|Verificação geral do painel|automática institucional desativada/)
  }
})
