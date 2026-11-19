import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
test('referência CDI usa API única e recortes nativos com gate preservado',()=>{
 const roi=readFileSync(new URL('../scripts/capture-viewport-roi.cjs',import.meta.url),'utf8')
 const smoke=readFileSync(new URL('../scripts/smoke-capture-real-dialog.cjs',import.meta.url),'utf8')
 assert.match(roi,/scale:'device',fullPage:false/);assert.doesNotMatch(roi,/CDPSession|setDeviceMetricsOverride/)
 assert.match(roi,/every\(Number.isInteger\)/);assert.match(roi,/drawImage\(r,rx,ry,w,h,0,0,w,h\)/)
 assert.match(smoke,/for\(const offset of \[0,40\]\)/);assert.match(smoke,/Valor inteiro visível/)
 assert.match(smoke,/r\.inkRecall>\.7/);assert.match(roi,/negative\.inkRecall>\.7/)
})
