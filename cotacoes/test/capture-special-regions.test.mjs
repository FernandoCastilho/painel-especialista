import test from 'node:test'
import assert from 'node:assert/strict'
import capture from '../scripts/capture-special-regions.cjs'
const text=t=>({nodeType:3,textContent:t})
function fixture(nodes,stroke='rgb(15, 128, 128)'){
 const oldDoc=globalThis.document,oldStyle=globalThis.getComputedStyle,seen=[]
 const box=()=>({x:10,y:20,width:100,height:50})
 globalThis.getComputedStyle=()=>({stroke})
 globalThis.document={createRange:()=>({setStart(node,index){assert.ok(index>=0&&index<node.textContent.length);seen.push(node.textContent[index])},setEnd(){},getBoundingClientRect:()=>({x:20,y:30,width:8,height:16})})}
 const el={getBoundingClientRect:box,querySelector:s=>s==='.pct'?{childNodes:nodes}:{getBoundingClientRect:box}}
 try{return {regions:capture(el),seen}}finally{if(oldDoc===undefined)delete globalThis.document;else globalThis.document=oldDoc;if(oldStyle===undefined)delete globalThis.getComputedStyle;else globalThis.getComputedStyle=oldStyle}
}
test('sinal e número em nós React separados produzem regiões corretas',()=>{
 const {regions,seen}=fixture([text('▲'),text(' '),text('1,10'),text(' p.p.'),{nodeType:1,textContent:'no período'}])
 assert.deepEqual(seen,['▲','1']);assert.deepEqual(regions.map(r=>r.selector),['curva-sem-eixos','sinal','digito']);assert.deepEqual(regions[0].color,[15,128,128])
})
test('texto unido também funciona, inclusive negativo',()=>assert.deepEqual(fixture([text('▼ 2,30 p.p.')]).seen,['▼','2']))
test('região ausente ou cor inválida falha honestamente, nunca pula',()=>{
 assert.throws(()=>fixture([text('▲')]),/digito ausente/)
 assert.throws(()=>fixture([text('1,10')]),/sinal ausente/)
 assert.throws(()=>fixture([text('▲ 1,10')],'none'),/cor da curva/)
})
