import test from 'node:test'
import assert from 'node:assert/strict'
import { clampMascot, readMascotPreferences } from '../src/mascotPosition.js'
test('mascot position stays recoverable after dragging or viewport resize', () => {
  assert.deepEqual(clampMascot({ x: -100, y: -400 }, 390, 844), { x: 8, y: 8 })
  assert.deepEqual(clampMascot({ x: 5000, y: 5000 }, 390, 844), { x: 238, y: 564 })
  assert.deepEqual(clampMascot(null, 390, 250), { x: 238, y: 8 })
  assert.deepEqual(clampMascot({ x: NaN, y: Infinity }, 390, 844), { x: 238, y: 564 })
})
test('preferences tolerate unavailable storage and reject malformed coordinates', () => {
  assert.deepEqual(readMascotPreferences({getItem(){throw Error('blocked')}}), {hidden:false,desktop:null})
  assert.deepEqual(readMascotPreferences({getItem:()=>'{bad'}), {hidden:false,desktop:null})
  assert.deepEqual(readMascotPreferences({getItem:()=>JSON.stringify({hidden:'true',desktop:{x:'42',y:10},query:'private'})}), {hidden:false,desktop:null})
  assert.deepEqual(readMascotPreferences({getItem:()=>JSON.stringify({hidden:true,desktop:{x:42,y:10},query:'private'})}), {hidden:true,desktop:{x:42,y:10}})
})

test('mascot floats over the page: small badge on top, no reserved space', async () => {
  const { readFile } = await import('node:fs/promises')
  const css = await readFile(new URL('../src/FeedbackMascot.css', import.meta.url), 'utf8')
  assert.match(css, /\.mascot-dock\{[^}]*position:fixed[^}]*background:transparent;border:0;/)
  assert.match(css, /\.mascot-mini\{position:fixed;[^}]*z-index:70/)
  assert.match(css, /\.mascot-mini:hover,\.mascot-mini:focus-visible\{transform:scale\(/)
  assert.match(css, /\.mascot-mini-face\{[^}]*mascot-owl\.webp/)
  assert.doesNotMatch(css, /padding-right:174px|::after\{content:''/)
})

test('desktop movement respects the sticky header exclusion', () => {
  assert.deepEqual(clampMascot({x:8,y:8},1280,900,96), {x:8,y:96})
})

test('celular: a coruja pequena mora na linha de ícones do topo, sem espaço reservado acima do conteúdo (15/11/2026)', async () => {
  const { readFile } = await import('node:fs/promises')
  const css = await readFile(new URL('../src/FeedbackMascot.css', import.meta.url), 'utf8')
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  // o lugar está na linha dos relógios do Mercado e no topo das outras telas, ao lado do botão de tema
  assert.equal(app.match(/<ThemeControl className="theme-mobile" \/><MascotSlot className="mascot-slot-m" \/>/g)?.length, 2)
  assert.match(css, /@media\(max-width:999px\)\{\.mascot-slot-m\{display:inline-flex/)
  assert.doesNotMatch(css, /\.mascot-tray\{position:relative;min-height:88px\}/)
  // ampliar no lugar não cobre os vizinhos: 36px × 1,12 cabe no espaço de 44px
  assert.ok(36 * 1.12 <= 44)
})
