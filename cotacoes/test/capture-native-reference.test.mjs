import test from 'node:test'
import assert from 'node:assert/strict'
import native from '../scripts/capture-native-reference.cjs'
function mock(dprs=[2,2]){
 const calls=[];let removed=false
 const page={evaluate:async fn=>fn.toString().includes('devicePixelRatio')?dprs.shift():undefined,addStyleTag:async()=>({evaluate:async()=>{removed=true}})}
 const session={send:async(method,params)=>{calls.push({method,params});return method==='Page.captureScreenshot'?{data:Buffer.from('png-fixture').toString('base64')}:{cssVisualViewport:{scale:1}}}}
 return {page,session,calls,removed:()=>removed}
}
test('captura nativa usa DPR2 com clip.scale1, sem reamostrar ou multiplicar duas vezes',async()=>{
 const m=mock(),r=await native(m.page,m.session,{x:4.5,y:100,width:358,height:503,dpr:2})
 assert.equal(r.reference.toString(),'png-fixture');assert.equal(r.metadata.before,2);assert.equal(r.metadata.after,2)
 assert.deepEqual(m.calls[1],{method:'Page.captureScreenshot',params:{format:'png',fromSurface:true,captureBeyondViewport:true,clip:{x:4.5,y:100,width:358,height:503,scale:1}}});assert.ok(m.removed())
})
test('DPR errado ou alterado falha em vez de corrigir PNG por resize',async()=>{
 let m=mock([1]);await assert.rejects(native(m.page,m.session,{dpr:2}),/antes/);assert.equal(m.calls.length,0)
 m=mock([2,1]);await assert.rejects(native(m.page,m.session,{x:0,y:0,width:358,height:503,dpr:2}),/durante/);assert.ok(m.removed())
})
