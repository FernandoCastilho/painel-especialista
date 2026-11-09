import test from 'node:test'
import assert from 'node:assert/strict'
import { clampMascot, readMascotPreferences } from '../src/mascotPosition.js'
test('mascot position stays recoverable after dragging or viewport resize', () => {
  assert.deepEqual(clampMascot({ x: -100, y: -400 }, 390, 844), { x: 8, y: 8 })
  assert.deepEqual(clampMascot({ x: 5000, y: 5000 }, 390, 844), { x: 238, y: 620 })
  assert.deepEqual(clampMascot(null, 390, 250), { x: 238, y: 26 })
  assert.deepEqual(clampMascot({ x: NaN, y: Infinity }, 390, 844), { x: 238, y: 620 })
})
test('preferences tolerate unavailable storage and reject malformed coordinates', () => {
  assert.deepEqual(readMascotPreferences({getItem(){throw Error('blocked')}}), {hidden:false,desktop:null})
  assert.deepEqual(readMascotPreferences({getItem:()=>'{bad'}), {hidden:false,desktop:null})
  assert.deepEqual(readMascotPreferences({getItem:()=>JSON.stringify({hidden:'true',desktop:{x:'42',y:10},query:'private'})}), {hidden:false,desktop:null})
  assert.deepEqual(readMascotPreferences({getItem:()=>JSON.stringify({hidden:true,desktop:{x:42,y:10},query:'private'})}), {hidden:true,desktop:{x:42,y:10}})
})

test('mobile mascot is isolated below fixed navigation', async () => {
  const { readFile } = await import('node:fs/promises')
  const css = await readFile(new URL('../src/FeedbackMascot.css', import.meta.url), 'utf8')
  assert.match(css, /@media\(max-width:999px\)\{\.mascot-tray\{height:250px;isolation:isolate;z-index:0;/)
})

test('desktop movement respects the sticky header exclusion', () => {
  assert.deepEqual(clampMascot({x:8,y:8},1280,900,96), {x:8,y:96})
})
