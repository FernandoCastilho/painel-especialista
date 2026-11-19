import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
const require=createRequire(import.meta.url),options=require('../scripts/capture-raster-options.cjs')
test('modo normal conserva exatamente opções e argumentos',()=>{
 const original={headless:true,args:['--example']}
 assert.equal(options(original,{}),original)
 assert.equal(options(original,{CAPTURE_REFERENCE_MODE:'device'}),original)
 assert.deepEqual(original.args,['--example'])
})
test('B acrescenta somente flag LCD a uma cópia; exige opt-in device',()=>{
 const original={headless:true,args:['--example']}
 assert.deepEqual(options(original,{CAPTURE_REFERENCE_MODE:'device',CAPTURE_TEXT_RASTER:'grayscale'}),{headless:true,args:['--example','--disable-lcd-text']})
 assert.deepEqual(original.args,['--example'])
 assert.throws(()=>options(original,{CAPTURE_TEXT_RASTER:'grayscale'}),/exige referência device/)
 assert.throws(()=>options(original,{CAPTURE_TEXT_RASTER:'typo'}),/inválido/)
})
test('workflow conserva A e legado, separa B e recolhe artefato existente',()=>{
 const workflow=readFileSync(new URL('../../.github/workflows/cotacoes-ci.yml',import.meta.url),'utf8')
 const job=workflow.split('  clipboard-capture:')[1].split('  bndes-workspace:')[0]
 assert.equal((job.match(/CAPTURE_TEXT_RASTER: grayscale/g)||[]).length,3)
 assert.match(job,/id: real_dialog/)
 assert.match(job,/qa-clipboard-capture\/real-dialog/)
 assert.match(job,/id: stable_dialog/)
 assert.match(job,/qa-clipboard-capture\/stable-dialog/)
 assert.match(job,/id: device_reference/)
 assert.match(job,/id: grayscale_reference/)
 assert.match(job,/qa-clipboard-capture\/device-reference/)
 assert.match(job,/qa-clipboard-capture\/device-grayscale/)
 assert.match(job,/name: clipboard-capture-design/)
 assert.doesNotMatch(job,/continue-on-error/)
})
