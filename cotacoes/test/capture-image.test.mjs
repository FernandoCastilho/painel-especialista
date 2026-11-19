import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { captureSize, copyCapture } from '../src/captureImage.js'
test('PNG tem resolução para notebook sem exceder memória ou reduzir leitura demais',()=>{
 assert.deepEqual(captureSize(960,600),{width:1920,height:1200,scale:2})
 for(const [w,h] of [[0,400],[1000,20000],[12000,10000]]) assert.throws(()=>captureSize(w,h))
})
test('copia PNG só após a resolução e confirma sucesso somente depois da escrita',async()=>{
 const blob=new Blob(['fixture'],{type:'image/png'}),target={}
 let called=false
 class Item { constructor(types){this.types=types} }
 await copyCapture(target,{Item,render:async t=>{assert.equal(t,target);return blob},clipboard:{write:async items=>{
   assert.equal(await items[0].types['image/png'],blob);called=true
 }}})
 assert.equal(called,true)
})
test('recusa e indisponibilidade de clipboard não simulam sucesso nem envio',async()=>{
 await assert.rejects(copyCapture({}, {clipboard:null,Item:null}),/não permite/)
 class Item { constructor(){} }
 await assert.rejects(copyCapture({}, {Item,render:async()=>new Blob(),clipboard:{write:async()=>{throw new Error('negado')}}}),/negado/)
})
test('telas e detalhes têm câmera, sem tocar cálculo ou compartilhar externamente',async()=>{
 const app=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8')
 assert.match(app,/\['resumo', 'juros', 'cenarios'\]\.includes\(tab\).*screen-capture-bar/)
 const expanded=await readFile(new URL('../src/Expandable.jsx',import.meta.url),'utf8')
 assert.match(expanded,/<CaptureButton label=\{label/)
 const explain=await readFile(new URL('../src/Explain.jsx',import.meta.url),'utf8')
 assert.match(explain,/grafico && <CaptureButton/)
 const engine=await readFile(new URL('../src/captureImage.js',import.meta.url),'utf8')
 assert.doesNotMatch(engine,/fetch\(|navigator\.share|\.click\(\)/)
})
test('rolagem usa viewport SVG e deslocamentos serializáveis, não scrollTop no clone',async()=>{
 const src=await readFile(new URL('../src/captureImage.js',import.meta.url),'utf8')
 assert.match(src,/content.setAttribute\('x', String\(-node.scrollLeft\)\)/)
 assert.match(src,/content.setAttribute\('y', String\(-node.scrollTop\)\)/)
 assert.match(src,/viewport.style.overflow = 'hidden'/)
})
