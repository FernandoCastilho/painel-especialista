import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
const require=createRequire(import.meta.url),{stable,unchanged}=require('../scripts/capture-stable-geometry.cjs')
test('estabilidade exige frames repetidos, não apenas uma leitura',async()=>{
 let n=0
 const target={evaluate:async fn=>fn.toString().includes('requestAnimationFrame')?null:{height:++n<3?863:950}}
 assert.deepEqual(await stable(target),{height:950});assert.equal(n,6)
})
test('mudança de dimensão ou posição de rolagem não passa',()=>{
 const before={height:950,scrollTop:130,scrollLeft:240}
 unchanged(before,{...before})
 assert.throws(()=>unchanged(before,{...before,height:863}))
 assert.throws(()=>unchanged(before,{...before,scrollLeft:0}))
})
test('protótipo exige DPR antes da navegação e mantém gate',()=>{
 const code=readFileSync(new URL('../scripts/smoke-capture-stable-dialog.cjs',import.meta.url),'utf8')
 assert.match(code,/deviceScaleFactor:2/);assert.match(code,/\{prepared:true\}/);assert.match(code,/r\.inkRecall>\.7/)
 assert.doesNotMatch(code,/setDeviceMetricsOverride/)
})
