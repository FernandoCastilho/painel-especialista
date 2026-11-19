const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
const compare=require('./capture-rgb-metrics.cjs')
module.exports=async(page,target,bytes,out,id)=>{
 const geometry=await target.evaluate(el=>{
  const root=el.getBoundingClientRect(),regions=[]
  const add=(r,text,kind,node)=>{
   if(r.width<=0||r.height<=0)return
   if(r.left<Math.max(0,root.left)||r.right>Math.min(innerWidth,root.right)||r.top<Math.max(0,root.top)||r.bottom>Math.min(innerHeight,root.bottom))return
   for(let parent=node;parent&&el.contains(parent);parent=parent.parentElement){
    const css=getComputedStyle(parent),b=parent.getBoundingClientRect()
    if(/auto|scroll|hidden|clip/.test(css.overflowY)&&(r.top<b.top||r.bottom>b.bottom))return
    if(/auto|scroll|hidden|clip/.test(css.overflowX)&&(r.left<b.left||r.right>b.right))return
   }
   regions.push({selector:kind+':'+text,x:r.x,y:r.y,w:r.width,h:r.height,text,kind})
  }
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT)
  while(walker.nextNode()){
   const node=walker.currentNode,parent=node.parentElement,css=getComputedStyle(parent)
   if(css.visibility!=='visible'||css.display==='none'||parent.closest('[data-capture-ignore],script,style,button'))continue
   // Token inteiro incluindo sinal, vírgula, casas decimais e unidade; nunca só o primeiro dígito.
   for(const match of node.textContent.matchAll(/[+−\-▲▼■]?\s*\d[\d.,]*(?:\s*(?:%|p\.p\.))?|[▲▼■−]/g)){
    const range=document.createRange();range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length)
    add(range.getBoundingClientRect(),match[0],'numero',parent)
   }
  }
  for(const node of el.querySelectorAll('svg[role="img"] path.line'))add(node.getBoundingClientRect(),'curva','curva',node)
  return {dpr:devicePixelRatio,root:{x:root.x,y:root.y,width:root.width,height:root.height},regions}
 })
 assert.equal(geometry.dpr,2);assert.ok(geometry.regions.some(r=>r.kind==='numero'),'Há números reais integralmente visíveis')
 const png=await page.screenshot({type:'png',scale:'device',fullPage:false})
 await fs.writeFile(path.join(out,id+'-viewport.png'),png);await fs.writeFile(path.join(out,id+'-actual.png'),Buffer.from(bytes))
 const result=await page.evaluate(async({geometry,bytes,png,source})=>{
  const decode=b=>createImageBitmap(new Blob([new Uint8Array(b)],{type:'image/png'}))
  const [a,r]=await Promise.all([decode(bytes),decode(png)])
  if(a.width!==Math.ceil(geometry.root.width)*2)throw new Error('Escala da captura diferente de DPR2; não reamostrar')
  const compare=new Function('return ('+source+')')(),proof=[],negatives=[]
  for(const region of geometry.regions){
   const x=Math.floor(region.x*2),y=Math.floor(region.y*2),w=Math.ceil((region.x+region.w)*2)-x,h=Math.ceil((region.y+region.h)*2)-y
   const ax=x-Math.floor(geometry.root.x*2),ay=y-Math.floor(geometry.root.y*2)
   if(ax<0||ay<0||ax+w>a.width||ay+h>a.height)throw new Error('ROI fora do PNG: '+region.selector)
   const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d')
   ctx.drawImage(r,x,y,w,h,0,0,w,h);const want=ctx.getImageData(0,0,w,h).data
   ctx.clearRect(0,0,w,h);ctx.drawImage(a,ax,ay,w,h,0,0,w,h);const got=ctx.getImageData(0,0,w,h).data
   const regions=[{selector:region.selector,x:0,y:0,w,h}],args={want,width:w,height:h,regions}
   proof.push(compare({...args,got})[0])
   const erased=new Uint8ClampedArray(want.length).fill(255)
   negatives.push(compare({...args,got:erased})[0])
  }
  return {geometry,dimensions:{actual:[a.width,a.height],reference:[r.width,r.height]},proof,negatives}
 },{geometry,bytes,png:[...png],source:compare.toString()})
 await fs.writeFile(path.join(out,id+'-proof.json'),JSON.stringify(result,null,2))
 const passes=r=>r.referenceColors>=4&&r.samples>100&&r.meanError<.08&&r.ink>20&&r.inkRecall>.7
 for(const r of result.proof)assert.ok(passes(r),'Gate RGB preservado: '+JSON.stringify(r))
 for(const r of result.negatives)assert.ok(!passes(r),'Negativo numérico/curva deve reprovar: '+JSON.stringify(r))
 return result
}
