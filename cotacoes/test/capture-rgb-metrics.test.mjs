import test from 'node:test'
import assert from 'node:assert/strict'
import compare from '../scripts/capture-rgb-metrics.cjs'
const width=40,height=30,regions=[{selector:'curva',x:0,y:0,w:40,h:30,color:[10,120,120]}]
const want=new Uint8Array(width*height*4).fill(255)
for(let x=5;x<35;x++){const i=(15*width+x)*4;want[i]=10;want[i+1]=want[i+2]=120}
const measure=got=>compare({got,want,width,height,regions})[0]
test('RGB idêntico preserva recall 1',()=>assert.equal(measure(want).inkRecall,1))
test('curva ausente ou com cor incorreta não passa por ter os mesmos eixos',()=>{
 const blank=new Uint8Array(want.length).fill(255),red=want.slice()
 for(let x=5;x<35;x++){const i=(15*width+x)*4;red[i]=220;red[i+1]=red[i+2]=20}
 assert.equal(measure(blank).inkRecall,0);assert.equal(measure(red).inkRecall,0)
})
