// Microteste de mecanismo: fixture local, sem produto, CDPSession ou override.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
const {viewportInvariant,validate}=require('./capture-viewport-invariant.cjs')
const out=process.env.CAPTURE_QA_OUTPUT||'workspace-qa/viewport-micro'
;(async()=>{
 await fs.mkdir(out,{recursive:true})
 const options=require('./smoke-launch.cjs')(),browser=await chromium.launch(options)
 try{
  const context=await browser.newContext({viewport:{width:390,height:950},deviceScaleFactor:2,reducedMotion:'reduce'})
  await context.route('**/*',route=>route.abort())
  const page=await context.newPage()
  await page.setContent(`<style>html,body{margin:0}dialog{box-sizing:border-box;position:fixed;inset:0;margin:0;width:100vw;height:100dvh;max-width:none;max-height:none;padding:0;border:0;overflow:auto}#inner{width:220px;height:90px;overflow:auto}#content{width:700px;height:320px;position:relative}#value{position:absolute;left:260px;top:150px;background:#008844;color:white;font:24px monospace}#long{height:1600px}</style><dialog><div id="inner"><div id="content"><span>INÍCIO 12345</span><span id="value">VALOR −98765,43</span></div></div><div id="long">FIM DA ÁREA</div></dialog>`)
  await page.locator('dialog').evaluate(el=>el.showModal())
  const snapshot=()=>page.evaluate(()=>{
   const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scrollTop:el.scrollTop,scrollLeft:el.scrollLeft,scrollHeight:el.scrollHeight,scrollWidth:el.scrollWidth}}
   return {dpr:devicePixelRatio,innerWidth,innerHeight,scrollX,scrollY,viewport:{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale,offsetTop:visualViewport.offsetTop,offsetLeft:visualViewport.offsetLeft},dialog:box(document.querySelector('dialog')),inner:box(document.querySelector('#inner')),value:box(document.querySelector('#value')),text:document.querySelector('#value').textContent}
  })
  await fs.writeFile(path.join(out,'process.json'),JSON.stringify({options,version:browser.version(),purpose:'mechanism only; no product fidelity approval'},null,2))
  for(const position of ['top','scrolled']){
   await page.evaluate(position=>{document.querySelector('dialog').scrollTop=position==='top'?0:40;const el=document.querySelector('#inner');el.scrollTop=position==='top'?0:130;el.scrollLeft=position==='top'?0:240},position)
   let last=null,stable=0
   for(let n=0;n<60&&stable<3;n++){
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)))
    const state=await snapshot();stable=JSON.stringify(state)===JSON.stringify(last)?stable+1:0;last=state
   }
   assert.equal(stable,3,'Layout estabilizado antes da screenshot')
   assert.equal(last.inner.scrollTop,position==='top'?0:130);assert.equal(last.inner.scrollLeft,position==='top'?0:240)
   assert.equal(last.dialog.scrollTop,position==='top'?0:40)
   const result=await viewportInvariant(page,snapshot)
   await fs.writeFile(path.join(out,position+'.png'),result.png)
   const {png,...report}=result;void png
   await fs.writeFile(path.join(out,position+'.json'),JSON.stringify(report,null,2))
   validate(result)
   console.log('PASS invariantes da screenshot viewport:',position)
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
