import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { hookRenderer } from './helpers/hooks.mjs'
import { PODCASTS, loadLatestPodcast, podcastArtworkCandidates, safePodcastArtwork } from '../src/podcasts.js'

const NOW = Date.parse('2026-11-20T21:00:00Z')
const ns = 'http://www.itunes.com/dtds/podcast-1.0.dtd'
const image = href => ({ tag:'image', ns, attrs:{ href } })
const text = (tag, value) => ({ tag, value })
const wrap = n => {
  const children = (n.children ?? []).map(wrap)
  return { children, localName:n.tag, namespaceURI:n.ns, getAttribute:k=>n.attrs?.[k]??null, textContent:n.value,
    getElementsByTagName:k=>children.flatMap(c=>[...(c.localName===k?[c]:[]),...c.getElementsByTagName(k)]) }
}
const audioUrl = p => 'https://example.test/' + p.id + '.mp3'
const episodeArt = 'https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_episode/example.jpg'
const makeFeed = (p, ...art) => wrap({ tag:'document', children:[{ tag:'channel', children:[
  ...art.slice(0,1), {tag:'item',children:[
    text('title',p.title+' episódio'),text('pubDate',new Date(NOW-60000).toUTCString()),
    {tag:'enclosure',attrs:{url:audioUrl(p),type:'audio/mpeg'}}, ...art.slice(1)
  ]}]}] })
const parse = (p, feed) => loadLatestPodcast(p,{
  fetcher:async()=>({ok:true,text:async()=>''}), now:NOW, Parser:class {parseFromString(){return feed}}
})
test('capa de episódio usa item direto; capa de canal não vaza de item', async () => {
  const p=PODCASTS[1]
  const latest=await parse(p,makeFeed(p,image(p.artworkUrl),image(episodeArt)))
  assert.equal(latest.episode.artworkUrl,episodeArt)
  assert.equal(latest.channelArtworkUrl,p.artworkUrl)
  assert.equal(latest.episode.audioUrl,audioUrl(p))
  assert.deepEqual(podcastArtworkCandidates(episodeArt,p.artworkUrl,p.artworkUrl),[episodeArt,p.artworkUrl])
  const noChannel=await parse(p,makeFeed(p,text('description','sem capa de canal'),image(episodeArt)))
  assert.equal(noChannel.channelArtworkUrl,undefined)
  assert.equal(noChannel.episode.artworkUrl,episodeArt)
})
test('fallback RSS sem namespace e filtragem de URLs', async () => {
  const p=PODCASTS[1]
  const latest=await parse(p,makeFeed(p,{tag:'image',children:[text('url',p.artworkUrl)]},image('http://i.scdn.co/a')))
  assert.equal(latest.channelArtworkUrl,p.artworkUrl)
  assert.equal(latest.episode.artworkUrl,undefined)
  for(const bad of ['data:image/png;base64,d','https://not-allowed.test/image','https://me@i.scdn.co/a','https://i.scdn.co:9000/a']) {
    assert.equal(safePodcastArtwork(bad),null)
  }
})
const require = createRequire(import.meta.url)
const {code} = await transform(await readFile(new URL('../src/Podcast.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsx:'automatic'})
const list = n => Array.isArray(n) ? n.flatMap(list) : n?.props ? [n,...list(n.props.children)] : []

test('trocar mantém áudio/capa associados, repõe a cadeia e falha para ícone', async t => {
  const dependencies = {'./Podcast.css':{},'./podcasts.js':{
    PODCASTS,podcastArtworkCandidates,podcastDate:()=>'',episodeLabel:()=>'',podcastUrl:()=>'',loadLatestPodcast:p=>parse(p,makeFeed(p,image(p.artworkUrl),image(p===PODCASTS[0]?p.artworkUrl:episodeArt)))
  }}
  const mod={exports:{}}
  runInNewContext(code,{module:mod,exports:mod.exports,AbortController,setTimeout,clearTimeout,require:k=>dependencies[k]??require(k)})
  const Player=mod.exports.default
  const ui=hookRenderer(()=>Player()); t.after(()=>ui.close())
  await ui.settle()
  const nodes=()=>list(ui.value)
  const miniatures=()=>nodes().filter(n=>n.props.small).map(n=>Array.from(n.props.artwork))
  const art=()=>nodes().find(n=>n.props.artwork&&!n.props.small)
  const button=i=>nodes().filter(n=>n.type==='button'&&n.props.className?.startsWith('podcast-program'))[i]
  assert.equal(nodes().find(n=>n.type==='audio').props.src,audioUrl(PODCASTS[0]))
  assert.deepEqual(miniatures(),PODCASTS.map(p=>[p.artworkUrl]))
  assert.deepEqual(Array.from(art().props.artwork),[PODCASTS[0].artworkUrl])
  button(1).props.onClick(); await ui.settle()
  assert.equal(nodes().find(n=>n.type==='audio').props.src,audioUrl(PODCASTS[1]))
  const outer=art().type(art().props)
  assert.equal(outer.props['aria-hidden'],'true')
  const component=outer.props.children
  const imageUi=hookRenderer(()=>component.type(component.props)); t.after(()=>imageUi.close())
  await imageUi.settle()
  assert.equal(imageUi.value.props.src,episodeArt)
  assert.equal(imageUi.value.props.alt,'')
  assert.equal(imageUi.value.props.referrerPolicy,'no-referrer')
  const onError=imageUi.value.props.onError
  onError(); onError(); await imageUi.settle()
  assert.equal(imageUi.value.props.src,PODCASTS[1].artworkUrl)
  imageUi.value.props.onError(); await imageUi.settle()
  assert.equal(imageUi.value.type,'svg')
  button(0).props.onClick(); await ui.settle()
  assert.notEqual(art().type(art().props).props.children.key,component.key)
})
