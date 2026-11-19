// Captura do DOM original pelo protocolo público Chromium, no DPR já configurado.
// Não passa pelo preparador de screenshots do Playwright nem escala uma imagem pronta.
module.exports=async function nativeReference(page,session,{x,y,width,height,dpr}){
 const before=await page.evaluate(()=>devicePixelRatio)
 if(Math.abs(before-dpr)>1e-6)throw new Error(`DPR nativo inesperado antes: ${before}; esperado ${dpr}`)
 const style=await page.addStyleTag({content:'[data-capture-ignore], [data-capture-ignore] * {visibility:hidden!important}'})
 try{
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const layout=await session.send('Page.getLayoutMetrics')
  const result=await session.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:true,clip:{x,y,width,height,scale:1}})
  const after=await page.evaluate(()=>devicePixelRatio)
  if(Math.abs(after-dpr)>1e-6)throw new Error(`DPR alterado durante screenshot: ${before} → ${after}`)
  return {reference:Buffer.from(result.data,'base64'),metadata:{before,after,clip:{x,y,width,height,scale:1},visualViewport:layout.visualViewport,cssVisualViewport:layout.cssVisualViewport,cssLayoutViewport:layout.cssLayoutViewport}}
 }finally{await style.evaluate(el=>el.remove())}
}
