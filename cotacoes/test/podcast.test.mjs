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
async function renderPodcast(t, loader, programs = catalog.PODCASTS) {
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  const deps = { react: React, './podcasts.js': { ...catalog, PODCASTS: programs, loadLatestPodcast: loader }, './Podcast.css': {} }
  runInNewContext(code, { module, exports: module.exports, require: name => deps[name] ?? require(name), AbortController, setTimeout, clearTimeout })
  const render = hookRenderer(() => module.exports.default())
  t.after(() => render.close())
  await render.settle()
  return { render, all: type => nodes(render.value).filter(n => n.type === type) }
}
test('player único seleciona todo cadastro, sem autoplay; mantém fontes e atualização', async t => {
  let calls = 0
  const { render, all } = await renderPodcast(t, async p => { calls++; return { episode: { ...episode, audioUrl: episode.audioUrl + '?' + p.id }, checkedAt: now } })
  assert.equal(calls, 2)
  assert.equal(all('audio').length, 1)
  assert.equal(all('audio')[0].props.preload, 'none')
  assert.equal(all('audio')[0].props.autoPlay, undefined)
  assert.equal(all('iframe').length, 0)
  assert.equal(all('button').filter(n => n.props['aria-pressed'] !== undefined).length, PODCASTS.length)
  assert.match(all('audio')[0].props.src, /morning-call$/)
  const programs = () => all('button').filter(n => n.props['aria-pressed'] !== undefined)
  programs()[1].props.onClick(); await render.settle()
  assert.equal(all('audio').length, 1)
  assert.match(all('audio')[0].props.src, /itau-views$/)
  assert.equal(programs()[1].props['aria-pressed'], true)
  assert.equal(all('a')[0].props.href, podcastUrl(PODCASTS[1]))
  all('audio')[0].props.onError(); await render.settle()
  assert.ok(all('p').some(n => String(n.props.children).includes('O áudio não carregou')))
  all('button').find(n => n.props.children === 'Atualizar episódios').props.onClick(); await render.settle()
  assert.equal(calls, 4)
  assert.equal(all('audio').length, 1)
})
test('contrato dos controles com elemento de áudio simulado: play, pausa, limites, velocidade e volume', async t => {
  const { render, all } = await renderPodcast(t, async () => ({ episode, checkedAt: now }))
  let plays = 0, pauses = 0
  const player = { paused: true, currentTime: 0, duration: 100, playbackRate: 1, volume: 1, pause() { this.paused = true; pauses++ }, async play() { this.paused = false; plays++ } }
  all('audio')[0].ref.current = player
  all('audio')[0].props.onLoadedMetadata({currentTarget:player}); await render.settle()
  const button = label => all('button').find(n => n.props['aria-label'] === label)
  await button('Reproduzir episódio').props.onClick()
  assert.equal(plays, 1)
  all('audio')[0].props.onPlaying(); await render.settle()
  await button('Pausar episódio').props.onClick(); assert.equal(pauses, 1)
  all('audio')[0].props.onPause(); await render.settle()
  button('Voltar 15 segundos').props.onClick(); assert.equal(player.currentTime, 0)
  button('Avançar 30 segundos').props.onClick(); assert.equal(player.currentTime, 30)
  player.currentTime = 95; all('audio')[0].props.onTimeUpdate({currentTarget:player}); await render.settle()
  button('Avançar 30 segundos').props.onClick(); assert.equal(player.currentTime, 100)
  all('select')[0].props.onChange({target:{value:'1.5'}}); assert.equal(player.playbackRate, 1.5)
  all('input').find(n => n.props['aria-label'] === 'Volume').props.onChange({target:{value:'0.25'}}); assert.equal(player.volume, .25)
  player.play = async () => { throw Error('blocked') }
  await button('Reproduzir episódio').props.onClick(); await render.settle()
  assert.ok(all('p').some(n => String(n.props.children).includes('O áudio não carregou')))
})
test('falha de uma fonte preserva cadastro e permite selecionar a outra', async t => {
  const { render, all } = await renderPodcast(t, async p => {
    if (p.id === 'morning-call') throw new Error('offline')
    return { episode, checkedAt: now }
  })
  assert.equal(all('audio').length, 0)
  assert.ok(all('p').some(n => String(n.props.children).includes('Não foi possível consultar')))
  all('button').filter(n => n.props['aria-pressed'] !== undefined)[1].props.onClick(); await render.settle()
  assert.equal(all('audio').length, 1)
  assert.equal(all('a')[0].props.href, podcastUrl(PODCASTS[1]))
})

test('novo programa cadastrado aparece e alimenta o mesmo player sem nova interface', async t => {
  const third = { ...PODCASTS[0], id: 'terceiro-teste', title: 'Programa de teste', appleId: '1234567890' }
  const programs = [...PODCASTS, third]
  const { render, all } = await renderPodcast(t, async p => ({ episode: { ...episode, audioUrl: episode.audioUrl + '?' + p.id }, checkedAt: now }), programs)
  const buttons = () => all('button').filter(n => n.props['aria-pressed'] !== undefined)
  assert.equal(buttons().length, 3)
  buttons()[2].props.onClick(); await render.settle()
  assert.equal(buttons()[2].props['aria-pressed'], true)
  assert.equal(all('audio').length, 1)
  assert.match(all('audio')[0].props.src, /terceiro-teste$/)
  assert.equal(all('a')[0].props.href, podcastUrl(third))
})
