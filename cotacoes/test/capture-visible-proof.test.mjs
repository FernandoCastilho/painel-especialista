import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
test('prova preserva tokens completos, referência viewport e gate RGB',()=>{
 const source=readFileSync(new URL('../scripts/capture-visible-proof.cjs',import.meta.url),'utf8')
 assert.match(source,/match\[0\]\.length/);assert.match(source,/scale:'device',fullPage:false/)
 assert.match(source,/r\.inkRecall>\.7/);assert.match(source,/r\.ink>20/)
 assert.match(source,/drawImage\(r,x,y,w,h,0,0,w,h\)/)
 assert.doesNotMatch(source,/CDPSession|setDeviceMetricsOverride/)
})
