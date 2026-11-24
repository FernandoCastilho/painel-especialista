import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const fonte = (arquivo) => readFileSync(new URL(`../src/${arquivo}`, import.meta.url), 'utf8')

test('tela cheia abre no documento inteiro e sincroniza a saída pelo navegador', () => {
  const barra = fonte('TopBar.jsx')
  assert.match(barra, /document\.documentElement\.requestFullscreen\(\)/)
  assert.match(barra, /document\.exitFullscreen\(\)/)
  assert.match(barra, /addEventListener\('fullscreenchange'/)
  assert.doesNotMatch(barra, /if \(focusMode\) return/)
})

test('tela cheia não tem layout que esconda menus ou cotações do aplicativo', () => {
  assert.doesNotMatch(fonte('App.jsx'), /data-focus-mode/)
  assert.doesNotMatch(fonte('TopBar.css'), /data-focus-mode/)
})
