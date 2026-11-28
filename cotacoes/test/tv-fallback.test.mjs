import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TV_CANAIS } from '../src/tvCanais.js'
const read = name => readFileSync(new URL('../src/'+name, import.meta.url), 'utf8')

test('oferece páginas oficiais que abrem sem depender do embed genérico', () => {
  assert.deepEqual(TV_CANAIS.map(c => c.oficial), [
    'https://www.cnnbrasil.com.br/ao-vivo/',
    'https://www.bloomberg.com/live/us',
  ])
  assert.ok(read('TvDock.jsx').includes('href={canal.oficial}'))
})

test('player pequeno mantém a altura mínima de 200px exigida pelo YouTube', () => {
  assert.match(read('TvDock.css'), /\.tv-dock-screen\s*\{[^}]*min-block-size:\s*200px/)
})

test('selecionar um canal não é prova de transmissão no ar', () => {
  assert.doesNotMatch(read('TvDock.jsx'), /className="tv-dock-live"/)
})
