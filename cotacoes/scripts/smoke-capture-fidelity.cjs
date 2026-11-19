// Compare PNG gerado com screenshot independente do navegador, por região de texto/gráfico.
// Controles intencionalmente não exportados ficam invisíveis na referência, mantendo geometria.
// Título, valores e traço continuam integrais e sujeitos aos mesmos limiares.
// A comparação inclui cores, não só alfa: fundo sólido ou conteúdo ausente deve falhar.
module.exports = async function fidelity(page, target, bytes, selectors) {
 const bounds=await target.boundingBox()
 const regions=[]
 for(const selector of selectors){
  const locator=target.locator(selector).first()
  await locator.waitFor()
  const box=await locator.boundingBox()
  if(!box||box.width<10||box.height<10)throw new Error('Região de prova ausente: '+selector)
  regions.push({selector,x:box.x-bounds.x,y:box.y-bounds.y,w:box.width,h:box.height})
 }
 const reference=Array.from(await target.screenshot({animations:'disabled',style:'[data-capture-ignore], [data-capture-ignore] * { visibility: hidden !important; }'}))
 return page.evaluate(async({bytes,reference,regions})=>{
  const decode=async b=>createImageBitmap(new Blob([new Uint8Array(b)],{type:'image/png'}))
  const [actual,expected]=await Promise.all([decode(bytes),decode(reference)])
  const canvas=document.createElement('canvas');canvas.width=expected.width;canvas.height=expected.height
  const ctx=canvas.getContext('2d');ctx.drawImage(actual,0,0,canvas.width,canvas.height)
  const got=ctx.getImageData(0,0,canvas.width,canvas.height).data
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(expected,0,0)
  const want=ctx.getImageData(0,0,canvas.width,canvas.height).data
  return regions.map(r=>{
    let error=0,n=0;const colors=new Set(), histogram=new Map(), samples=[]
    // Identifica fundo dominante da região; exige coincidência nos traços/texto,
    // para que um PNG de fundo sólido não passe pela média de pixels.

    for(let y=Math.max(0,Math.ceil(r.y));y<Math.min(canvas.height,r.y+r.h);y++)
     for(let x=Math.max(0,Math.ceil(r.x));x<Math.min(canvas.width,r.x+r.w);x++){
      const i=(y*canvas.width+x)*4
      const key=[want[i]>>4,want[i+1]>>4,want[i+2]>>4].join(',')
      colors.add(key);histogram.set(key,(histogram.get(key)||0)+1);samples.push(i)
      for(let c=0;c<3;c++){error+=Math.abs(got[i+c]-want[i+c])/255;n++}
     }
    const dominant=[...histogram].sort((a,b)=>b[1]-a[1])[0][0].split(',').map(v=>Number(v)*16+8)
    let ink=0,matched=0
    for(const i of samples){
      if(Math.max(...dominant.map((v,c)=>Math.abs(want[i+c]-v)))<45)continue
      ink++
      if(Math.max(...dominant.map((_,c)=>Math.abs(want[i+c]-got[i+c])))<45)matched++
    }
    return {selector:r.selector,meanError:error/n,referenceColors:colors.size,samples:n,ink,inkRecall:ink?matched/ink:0}
  })
 },{bytes,reference,regions})
}
