import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {hasFlag} from '../src/flags.js'
const read=filename=>readFile(new URL('../src/'+filename,import.meta.url),'utf8')
test('desktop clocks use the zone flags and preserve their abbreviations',async()=>{
  const top=await read('TopBar.jsx')
  const zones=await read('Clock.jsx')
  for(const [code,short] of [['BRL','BRT'],['USD','NYC'],['GBP','LDN'],['JPY','TYO']]){
    assert.ok(hasFlag(code),code)
    assert.ok(top.includes(`['${code}', '${short}']`),short)
    assert.ok(zones.includes(`${code}: { flag: '${code}'`),code)
  }
  assert.match(top,/<Flag code=\{ZONES\[code\]\.flag\}/)
  assert.match(top,/<b>\{short\}<\/b>/)
})
test('responsive clock selectors do not hide the nested flag',async()=>{
  const css=await read('Terminal.css')
  assert.doesNotMatch(css,/\.topbar-clocks span:nth-child/)
  assert.match(css,/\.topbar-clocks > \.topbar-clock:nth-child/)
})
