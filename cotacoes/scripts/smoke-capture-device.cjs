// Experimento opt-in: screenshot do DOM original, nunca do clone de captura.
const fs=require('node:fs/promises'),path=require('node:path')
const compare=require('./capture-rgb-metrics.cjs')
const captureSpecialRegions=require('./capture-special-regions.cjs')
const nativeReference=require('./capture-native-reference.cjs')
let sequence=0
module.exports=async function deviceFidelity(page,target,bytes,selectors,{prepared=false}={}){
 const {captureSize}=await import('../src/captureImage.js')
 const geometry=await target.evaluate(el=>{const b=el.getBoundingClientRect();return {x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height,scrollHeight:el.scrollHeight,scrolled:!!(el.scrollTop||el.scrollLeft)}})
 const cssWidth=Math.ceil(geometry.width),cssHeight=Math.ceil(geometry.scrolled?geometry.height:Math.max(geometry.scrollHeight,geometry.height))
 const size=captureSize(cssWidth,cssHeight),viewport=page.viewportSize()
 const session=await page.context().newCDPSession(page)
 const originalDpr=await page.evaluate(()=>devicePixelRatio)
 const out=process.env.CAPTURE_QA_OUTPUT||'workspace-qa/capturas',prefix=`device-${++sequence}`
 await fs.mkdir(out,{recursive:true})
 try{
  if(prepared && Math.abs(originalDpr-size.scale)>1e-6)throw new Error('DPR preparado não corresponde à escala de captura')
  if(!prepared)await session.send('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:size.scale,mobile:false})
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const current=await target.evaluate(el=>{const b=el.getBoundingClientRect();return {x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height}})
  if(['x','y','width','height'].some(k=>Math.abs(current[k]-geometry[k])>.01))throw new Error('DPR alterou layout original; experimento interrompido: '+JSON.stringify({geometry,current}))
  const regions=[]
  for(const selector of selectors){
   const loc=target.locator(selector).first();await loc.waitFor();const b=await loc.boundingBox();const t=await target.boundingBox()
   regions.push({selector,x:(b.x-t.x)*size.scale,y:(b.y-t.y)*size.scale,w:b.width*size.scale,h:b.height*size.scale})
  }
  // Não mistura os eixos com a curva nem o sinal com o restante do valor.
  if(selectors.includes('h3')&&selectors.includes('.pct')){
   const special=await target.evaluate(captureSpecialRegions)
   regions.push(...special.map(r=>({...r,x:r.x*size.scale,y:r.y*size.scale,w:r.w*size.scale,h:r.h*size.scale})))
  }
  const {reference,metadata:nativeMetadata}=await nativeReference(page,session,{x:geometry.x,y:geometry.y,width:cssWidth,height:cssHeight,dpr:size.scale})
  await fs.writeFile(path.join(out,prefix+'-geometry.json'),JSON.stringify({geometry,size,nativeMetadata,regions},null,2))
  await fs.writeFile(path.join(out,prefix+'-reference.png'),reference)
  await fs.writeFile(path.join(out,prefix+'-actual.png'),Buffer.from(bytes))
  const result=await page.evaluate(async({bytes,reference,regions,source})=>{
   const decode=async b=>createImageBitmap(new Blob([new Uint8Array(b)],{type:'image/png'}))
   const [actual,expected]=await Promise.all([decode(bytes),decode(reference)])
   if(actual.width!==expected.width||actual.height!==expected.height)throw new Error('Dimensão diferente; sem reamostragem: '+JSON.stringify({actual:[actual.width,actual.height],reference:[expected.width,expected.height]}))
   const canvas=document.createElement('canvas');canvas.width=expected.width;canvas.height=expected.height
   const ctx=canvas.getContext('2d');ctx.drawImage(expected,0,0);const want=ctx.getImageData(0,0,canvas.width,canvas.height).data
   ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(actual,0,0);const got=ctx.getImageData(0,0,canvas.width,canvas.height).data
   const compare=new Function('return ('+source+')')(),args={want,width:canvas.width,height:canvas.height,regions}
   const proof=compare({...args,got}),negatives=[]
   for(const [name,selector,mode] of [['curva removida','curva-sem-eixos','erase'],['cor da curva','curva-sem-eixos','red'],['sinal alterado','sinal','erase'],['dígito alterado','digito','erase'],['título ausente','h3','erase'],['deslocamento','h3','shift']]){
    const r=regions.find(r=>r.selector===selector);if(!r)continue
    const changed=new Uint8ClampedArray(want)
    for(let y=Math.max(0,Math.ceil(r.y));y<Math.min(canvas.height,r.y+r.h);y++)for(let x=Math.max(0,Math.ceil(r.x));x<Math.min(canvas.width,r.x+r.w);x++){
     const i=(y*canvas.width+x)*4
     if(r.color&&Math.max(...r.color.map((v,c)=>Math.abs(want[i+c]-v)))>=45)continue
     for(let c=0;c<3;c++)changed[i+c]=mode==='red'?[220,20,20][c]:mode==='shift'?want[(Math.max(0,y-8)*canvas.width+Math.max(0,x-8))*4+c]:255
    }
    const metric=compare({...args,got:changed,regions:[r]})[0]
    negatives.push({name,metric,rejected:!(metric.meanError<.08&&metric.ink>20&&metric.inkRecall>.7)})
   }
   return {proof,negatives,dimensions:[actual.width,actual.height]}
  },{bytes,reference:Array.from(reference),regions,source:compare.toString()})
  await fs.writeFile(path.join(out,prefix+'-report.json'),JSON.stringify({geometry,size,nativeMetadata,regions,...result},null,2))
  if(result.negatives.some(n=>!n.rejected))throw new Error('Comparador aceitou negativo real: '+JSON.stringify(result.negatives))
  return result.proof
 }finally{
  if(!prepared)await session.send('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:originalDpr,mobile:false})
  await session.detach()
 }
}
