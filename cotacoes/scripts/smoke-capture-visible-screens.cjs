const {chromium}=require('playwright'),fs=require('node:fs/promises'),assert=require('node:assert/strict')
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
     await main.locator('.screen-capture-bar .capture-button').click()
     await page.waitForFunction(()=>window.captureWrites.length>0)
     const bytes=await page.evaluate(()=>window.captureWrites.at(-1))
     const result=await proof(page,main,bytes,out,route.replaceAll('/','-')+'-'+width+'-'+theme)
     assert.deepEqual(await main.evaluate(el=>({dpr:devicePixelRatio,x:scrollX,y:scrollY,w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})),before)
     if(route==='juros')assert.ok(result.geometry.regions.some(r=>r.kind==='curva'),'Curva CDI deve estar visível para prova')
    }
   }finally{await page.close()}
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
