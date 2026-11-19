import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{viewportInvariant,validate}=require('../scripts/capture-viewport-invariant.cjs')
function png(){const b=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.write('IHDR',12);b.writeUInt32BE(780,16);b.writeUInt32BE(1900,20);return b}
test('usa somente screenshot viewport em escala device e registra ambos estados',async()=>{
 const state={dpr:2,scrollTop:130},page={screenshot:async options=>{assert.deepEqual(options,{type:'png',fullPage:false,scale:'device'});return png()}}
 const result=await viewportInvariant(page,async()=>({...state}));validate(result)
 assert.deepEqual(result.dimensions,{width:780,height:1900})
})
test('não aceita reset DPR, mudança de scroll ou escala errada',()=>{
 const before={dpr:2,scrollTop:130},dimensions={width:780,height:1900}
 for(const after of [{dpr:1,scrollTop:130},{dpr:2,scrollTop:0}])assert.throws(()=>validate({before,after,dimensions}))
 assert.throws(()=>validate({before,after:before,dimensions:{width:390,height:950}}))
})
