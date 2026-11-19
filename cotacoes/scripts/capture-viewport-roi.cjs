const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
const compare=require('./capture-rgb-metrics.cjs')
module.exports=async(page,target,bytes,out,id)=>{
 const geometry=await target.evaluate(el=>{
  const t=el.getBoundingClientRect(),f=el.querySelector('#capture-scroll-fixture').getBoundingClientRect()
  return {dpr:devicePixelRatio,target:{x:t.x,y:t.y},fixture:{x:f.x,y:f.y,width:f.width,height:f.height}}
 })
 assert.equal(geometry.dpr,2)
 const reference=await page.screenshot({type:'png',scale:'device',fullPage:false})
 await fs.writeFile(path.join(out,`viewport-${id}.png`),reference)
 const result=await page.evaluate(async({bytes,reference,geometry,source})=>{
  const decode=async b=>createImageBitmap(new Blob([new Uint8Array(b)],{type:'image/png'}))
  const [a,r]=await Promise.all([decode(bytes),decode(reference)])
  if(r.width!==780||r.height!==1900)throw new Error('Viewport PNG inesperado')
  const f=geometry.fixture,t=geometry.target
  // Recorte inteiro no bitmap, SEM redimensionamento: rejeita fase fracionária diferente.
  const rx=f.x*2,ry=f.y*2,ax=(f.x-t.x)*2,ay=(f.y-t.y)*2,w=f.width*2,h=f.height*2
  if(![rx,ry,ax,ay,w,h].every(Number.isInteger))throw new Error('ROI fracionária; não arredondar para forçar correspondência')
  if(rx<0||ry<0||rx+w>r.width||ry+h>r.height||ax<0||ay<0||ax+w>a.width||ay+h>a.height)throw new Error('ROI fora dos bitmaps')
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d')
  ctx.drawImage(r,rx,ry,w,h,0,0,w,h);const want=ctx.getImageData(0,0,w,h).data
  ctx.clearRect(0,0,w,h);ctx.drawImage(a,ax,ay,w,h,0,0,w,h);const got=ctx.getImageData(0,0,w,h).data
  const cmp=new Function('return ('+source+')')(),regions=[{selector:'fixture-valor-visivel',x:0,y:0,w,h}]
  const proof=cmp({want,got,width:w,height:h,regions})
  const blank=new Uint8ClampedArray(want.length).fill(255),negative=cmp({want,got:blank,width:w,height:h,regions})[0]
  return {geometry,dimensions:{actual:[a.width,a.height],reference:[r.width,r.height]},proof,negative}
 },{bytes,reference:[...reference],geometry,source:compare.toString()})
 await fs.writeFile(path.join(out,`roi-${id}.json`),JSON.stringify(result,null,2))
 assert.ok(!(result.negative.meanError<.08&&result.negative.ink>20&&result.negative.inkRecall>.7),'Rejeita ROI apagada; demais negativos A/B preservados')
 return result.proof
}
