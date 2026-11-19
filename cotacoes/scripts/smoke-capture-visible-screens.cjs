const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
const proof=require('./capture-visible-proof.cjs')
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:8768',out=process.env.CAPTURE_QA_OUTPUT||'workspace-qa/visible-screens'
;(async()=>{
 await fs.mkdir(out,{recursive:true})
 const options=require('./capture-raster-options.cjs')(require('./smoke-launch.cjs')()),browser=await chromium.launch(options)
 try{
  for(const width of [390,900])for(const theme of ['light','dark']){
   const page=await browser.newPage({viewport:{width,height:950},deviceScaleFactor:2,colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block'})
   try{
    await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort())
    const now=Date.now(),points=Array.from({length:12},(_,i)=>[now-(11-i)*86400000,12+i/10])
    await page.route('**/macro.json*',r=>r.fulfill({json:{generatedAt:now,cdi:points,selic:points,sofr:points,sofrAvg:[],focus:{},stale:{}}}))
    await page.addInitScript(()=>{
     window.captureWrites=[]
     Object.defineProperty(window,'ClipboardItem',{configurable:true,value:class{constructor(values){this.values=values}}})
     Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async items=>{const b=await items[0].values['image/png'];window.captureWrites.push([...new Uint8Array(await b.arrayBuffer())])}}})
    })
    for(const [route,selector] of [['juros','#juros-ref-brasil article.chart'],['resumo','.market-table'],['cenarios/projecoes','#scenarios-heading'],['cenarios/calendario','#cal-title'],['cenarios/inadimplencia','#credit-title'],['cenarios/recuperacao','#rj-history-heading'],['cenarios/atividade','#market-context-heading'],['cenarios/commodities','#commodities-context-heading'],['cenarios/indexadores','.idx-table'],['cenarios/inflacao','#outros-title']]){
     await page.goto(base+'/#'+route);await page.locator(selector).first().waitFor()
     const main=page.locator('main.app')
     await main.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))})
     const before=await main.evaluate(el=>({dpr:devicePixelRatio,x:scrollX,y:scrollY,w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height}))
     let mascotBefore=null
     if(route==='juros'&&width===390){
      const mascot=main.locator('[data-capture-ignore="mascot"] .mascot-mini-face')
      await mascot.waitFor({state:'visible'})
      mascotBefore=await mascot.evaluate(el=>{const b=el.getBoundingClientRect();return {insideMain:!!el.closest('main.app'),background:getComputedStyle(el).backgroundImage,box:{x:b.x,y:b.y,width:b.width,height:b.height}}})
      await fs.writeFile(path.join(out,`mascot-dom-${width}-${theme}.json`),JSON.stringify(mascotBefore,null,2))
      assert.equal(mascotBefore.insideMain,true)
      assert.match(mascotBefore.background,/mascot-owl.*\.webp/,'Asset local identificado no DOM real')
     }
     const countBefore=await page.evaluate(()=>window.captureWrites.length)
     await main.locator('.screen-capture-bar .capture-button').click()
     let waitingError=null
     try{
      await page.waitForFunction(n=>window.captureWrites.length>n ||
       (!document.querySelector('.screen-capture-bar .capture-button')?.disabled && !!document.querySelector('.screen-capture-bar [role="status"]')?.textContent),countBefore)
      await page.waitForFunction(()=>document.querySelector('.screen-capture-bar .capture-button')?.disabled===false)
     }catch(error){waitingError=error.message}
     const outcome=await main.evaluate(el=>{
      const button=el.querySelector('.screen-capture-bar .capture-button'),box=el.getBoundingClientRect(),css=getComputedStyle(el)
      return {writes:window.captureWrites.length,status:el.querySelector('.screen-capture-bar [role="status"]')?.textContent||'',busy:button?.disabled,geometry:{width:box.width,height:box.height,scrollHeight:el.scrollHeight,scrollWidth:el.scrollWidth,clientHeight:el.clientHeight,clientWidth:el.clientWidth,scrollTop:el.scrollTop,scrollLeft:el.scrollLeft,overflowX:css.overflowX,overflowY:css.overflowY}}
     })
     const prefix=route.replaceAll('/','-')+'-'+width+'-'+theme
     await fs.writeFile(path.join(out,prefix+'-outcome.json'),JSON.stringify({route,width,theme,countBefore,waitingError,...outcome},null,2))
     if(waitingError||outcome.writes!==countBefore+1){
      await page.screenshot({path:path.join(out,prefix+'-error.png'),fullPage:false,scale:'device'})
      throw new Error('Câmera da seção não gerou PNG novo: '+JSON.stringify({route,width,theme,countBefore,waitingError,...outcome}))
     }
     assert.match(outcome.status,/Imagem copiada/,'Status do produto confirma nova imagem')
     if(mascotBefore){
      const afterMascot=await main.locator('[data-capture-ignore="mascot"] .mascot-mini-face').evaluate(el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}})
      assert.deepEqual(afterMascot,mascotBefore.box,'Captura não muda geometria do mascote original')
     }

     const bytes=await page.evaluate(n=>window.captureWrites[n],countBefore)
     const result=await proof(page,main,bytes,out,route.replaceAll('/','-')+'-'+width+'-'+theme)
     assert.deepEqual(await main.evaluate(el=>({dpr:devicePixelRatio,x:scrollX,y:scrollY,w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})),before)
     if(route==='juros')assert.ok(result.geometry.regions.some(r=>r.kind==='curva'),'Curva CDI deve estar visível para prova')
    }
   }finally{await page.close()}
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
