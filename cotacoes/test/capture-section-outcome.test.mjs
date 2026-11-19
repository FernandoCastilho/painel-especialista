import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
test('matriz observa recusa e impede reutilizar clipboard de rota anterior',()=>{
 const source=readFileSync(new URL('../scripts/smoke-capture-visible-screens.cjs',import.meta.url),'utf8')
 assert.match(source,/const countBefore=/)
 assert.match(source,/window\.captureWrites\.length>n/)
 assert.match(source,/outcome\.writes!==countBefore\+1/)
 assert.match(source,/window\.captureWrites\[n\]/)
 assert.match(source,/-outcome\.json/);assert.match(source,/-error\.png/)
 assert.doesNotMatch(source,/waitForFunction\(\(\)=>window\.captureWrites\.length>0\)/)
})
