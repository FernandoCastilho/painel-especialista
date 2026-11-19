import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PODCASTS, podcastUrl, latestEpisode, episodeLabel, parsePodcastFeed, loadLatestPodcast } from '../src/podcasts.js'
import { APP_SECTIONS } from '../src/appSections.js'
import { parseCommand } from '../src/terminal.js'
import React from 'react'
import * as catalog from '../src/podcasts.js'
import { transform } from 'esbuild'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { hookRenderer } from './helpers/hooks.mjs'
const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../src/Podcast.jsx', import.meta.url), 'utf8')
const now = Date.parse('2026-11-18T13:00:00Z')
const episode = { title: 'Episódio de hoje', publishedAt: '2026-11-18T10:00:00Z', type: 'full', audioUrl: 'https://example.com/audio.mp3', mime: 'audio/mpeg' }
test('Podcast contém os programas solicitados e seus feeds públicos', () => {
  assert.deepEqual(PODCASTS.map(p => p.appleId), ['1495352313', '1464605101'])
  assert.equal(new Set(PODCASTS.map(p => p.id)).size, 2)
  for (const p of PODCASTS) {
    assert.equal(new URL(podcastUrl(p)).hostname, 'podcasts.apple.com')
    assert.equal(new URL(p.feedUrl).hostname, 'anchor.fm')
  }
})
test('Podcast está no menu e no comando de navegação', () => {
  assert.equal(APP_SECTIONS.find(p => p.id === 'podcast').label, 'Podcast')
  assert.ok(!APP_SECTIONS.find(p => p.id === 'podcast').oculto)
  assert.deepEqual(parseCommand('PODCAST'), { kind: 'tab', id: 'podcast', sub: '' })
  assert.match(readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8'), /tab === 'podcast' && <Podcast/)
})
test('seleção usa data, não posição; ignora trailer, futuro, data inválida e áudio inseguro', () => {
  const older = { ...episode, title: 'Anterior', publishedAt: '2026-11-17T10:00:00Z' }
  const invalid = [
    { ...episode, type: 'trailer' }, { ...episode, title: 'Trailer do programa', type: '' },
    { ...episode, publishedAt: '2026-11-19T10:00:00Z' }, { ...episode, publishedAt: 'inválida' },
    { ...episode, audioUrl: 'javascript:alert(1)' }, { ...episode, audioUrl: 'https://user:pass@example.com/a' },
    { ...episode, mime: 'video/mp4' }, { ...episode, title: '' },
  ]
  assert.equal(latestEpisode([older, ...invalid, episode], now), episode)
  assert.equal(latestEpisode(invalid, now), null)
  assert.equal(latestEpisode([], now), null)
  assert.equal(latestEpisode([{ ...older, type: '' }], now).title, 'Anterior')
})
test('Hoje respeita data em Brasília e não rotula episódio antigo como atual', () => {
  assert.equal(episodeLabel(episode, now), 'Publicado hoje (na consulta)')
  assert.equal(episodeLabel({ ...episode, publishedAt: '2026-11-18T01:00:00Z' }, now), 'Mais recente encontrado')
  assert.equal(episodeLabel(episode, Date.parse('2026-11-19T13:00:00Z')), 'Mais recente encontrado')
})
// Adaptador DOM mínimo testa o contrato de extração; não substitui parser XML do navegador.
const item = {
  getElementsByTagName(tag) {
    if (tag === 'enclosure') return [{ getAttribute: key => ({ url: episode.audioUrl, type: episode.mime })[key] }]
    const value = { title: episode.title, pubDate: episode.publishedAt, 'itunes:episodeType': episode.type }[tag]
    return value ? [{ textContent: value }] : []
  },
}
class Parser {
  parseFromString(xml, type) {
    assert.equal(type, 'application/xml')
    return { getElementsByTagName: tag => tag === 'parsererror' ? (xml === 'bad' ? [{}] : []) : tag === 'item' ? [item] : [] }
  }
}
test('feed extrai título, data, tipo e enclosure; rejeita XML inválido', () => {
  assert.deepEqual(parsePodcastFeed('ok', Parser), [episode])
  assert.throws(() => parsePodcastFeed('bad', Parser), /Feed inválido/)
})
test('consulta renova chave de cache, omite credenciais e propaga falhas sem episódio inventado', async () => {
  const result = await loadLatestPodcast(PODCASTS[0], { now, Parser, fetcher: async (url, options) => {
    assert.equal(new URL(url).searchParams.get('t'), String(Math.floor(now / 60000)))
    assert.equal(options.credentials, 'omit')
    return { ok: true, text: async () => 'ok' }
  } })
  assert.deepEqual(result, { episode, checkedAt: now })
  await assert.rejects(loadLatestPodcast(PODCASTS[0], { now, Parser, fetcher: async () => ({ ok: false }) }), /indisponível/)
})
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []
async function renderPodcast(t, loader) {
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  const deps = { react: React, './podcasts.js': { ...catalog, loadLatestPodcast: loader }, './Podcast.css': {} }
  runInNewContext(code, { module, exports: module.exports, require: name => deps[name] ?? require(name), AbortController, setTimeout, clearTimeout })
  const render = hookRenderer(() => module.exports.default())
  t.after(() => render.close())
  await render.settle()
  return { render, all: type => nodes(render.value).filter(n => n.type === type) }
}
test('título e data independem do player; abrir, trocar, fechar, erro e atualização', async t => {
  let calls = 0
  const { render, all } = await renderPodcast(t, async p => { calls++; return { episode: { ...episode, audioUrl: episode.audioUrl + '?' + p.id }, checkedAt: now } })
  assert.equal(calls, 2)
  assert.equal(all('audio').length, 0)
  assert.equal(all('h3').length, 2)
  assert.equal(all('time').length, 2)
  assert.equal(all('iframe').length, 0)
  assert.equal(all('a').length, 2)
  all('button')[1].props.onClick(); await render.settle()
  assert.equal(all('audio').length, 1)
  assert.equal(all('audio')[0].props.preload, 'none')
  assert.equal(all('audio')[0].props.autoPlay, undefined)
  assert.equal(all('audio')[0].props.controls, true)
  assert.match(all('audio')[0].props.src, /morning-call$/)
  all('button')[2].props.onClick(); await render.settle()
  assert.equal(all('audio').length, 1)
  assert.match(all('audio')[0].props.src, /itau-views$/)
  all('audio')[0].props.onError(); await render.settle()
  assert.ok(all('p').some(n => n.props.children === 'O áudio não carregou. Use o link do programa abaixo.'))
  all('button')[2].props.onClick(); await render.settle()
  assert.equal(all('audio').length, 0)
  all('button')[1].props.onClick(); await render.settle()
  all('button')[0].props.onClick(); await render.settle()
  assert.equal(calls, 4)
  assert.equal(all('audio').length, 0)
})
test('falha de uma fonte não impede outra; erro não inventa edição de hoje', async t => {
  const { all } = await renderPodcast(t, async p => {
    if (p.id === 'morning-call') throw new Error('offline')
    return { episode, checkedAt: now }
  })
  assert.equal(all('h3').length, 1)
  assert.equal(all('audio').length, 0)
  assert.ok(all('p').some(n => String(n.props.children).includes('Não foi possível consultar')))
  assert.equal(all('a').length, 2)
})
