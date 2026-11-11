import test from 'node:test'
import assert from 'node:assert/strict'
import { clampMascot, readMascotPreferences } from '../src/mascotPosition.js'
test('mascot position stays recoverable after dragging or viewport resize', () => {
  assert.deepEqual(clampMascot({ x: -100, y: -400 }, 390, 844), { x: 8, y: 8 })
  assert.deepEqual(clampMascot({ x: 5000, y: 5000 }, 390, 844), { x: 238, y: 608 })
  assert.deepEqual(clampMascot(null, 390, 250), { x: 238, y: 14 })
  assert.deepEqual(clampMascot({ x: NaN, y: Infinity }, 390, 844), { x: 238, y: 608 })
})
test('preferences tolerate unavailable storage and reject malformed coordinates', () => {
  assert.deepEqual(readMascotPreferences({getItem(){throw Error('blocked')}}), {hidden:false,desktop:null})
  assert.deepEqual(readMascotPreferences({getItem:()=>'{bad'}), {hidden:false,desktop:null})
  assert.deepEqual(readMascotPreferences({getItem:()=>JSON.stringify({hidden:'true',desktop:{x:'42',y:10},query:'private'})}), {hidden:false,desktop:null})
  assert.deepEqual(readMascotPreferences({getItem:()=>JSON.stringify({hidden:true,desktop:{x:42,y:10},query:'private'})}), {hidden:true,desktop:{x:42,y:10}})
})

test('mascot floats without a box and parks as a small badge at the top', async () => {
  const { readFile } = await import('node:fs/promises')
  const css = await readFile(new URL('../src/FeedbackMascot.css', import.meta.url), 'utf8')
  assert.match(css, /\.mascot-dock\{[^}]*position:fixed[^}]*background:transparent;border:0;/)
  assert.doesNotMatch(css, /\.mascot-tray\{height:250px/)
  assert.match(css, /\.mascot-restore\{position:fixed;[^}]*z-index:70/)
  assert.match(css, /\.mascot-restore-face\{[^}]*mascot-owl\.webp/)
  assert.match(css, /@media\(max-width:999px\)\{body:has\(\.mascot-tray:not\(\.mascot-tray-hidden\)\)::after\{content:'';display:block;height:210px\}\}/)
})

test('desktop movement respects the sticky header exclusion', () => {
  assert.deepEqual(clampMascot({x:8,y:8},1280,900,96), {x:8,y:96})
})
