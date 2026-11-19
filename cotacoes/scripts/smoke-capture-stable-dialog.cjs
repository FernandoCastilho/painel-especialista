// Protótipo isolado: não substitui A/B, não altera produto ou permissões.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
const {snapshot,stable,unchanged}=require('./capture-stable-geometry.cjs')
const fidelity=require('./smoke-capture-device.cjs')
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:8768',out=process.env.CAPTURE_QA_OUTPUT||'workspace-qa/stable-dialog'
;(async()=>{
 await fs.mkdir(out,{recursive:true})
 const options=require('./capture-raster-options.cjs')(require('./smoke-launch.cjs')())
 const browser=await chromium.launch(options)
 try{
  // DPR estabelecido antes da navegação, nunca entre clique e referência.
  const page=await browser.newPage({viewport:{width:390,height:950},deviceScaleFactor:2,colorScheme:'light',reducedMotion:'reduce',serviceWorkers:'block'})
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort())
  const now=Date.now(),points=Array.from({length:12},(_,i)=>[now-(11-i)*86400000,12+i/10])
  await page.route('**/macro.json*',r=>r.fulfill({json:{generatedAt:now,cdi:points,selic:points,sofr:points,sofrAvg:[],focus:{},stale:{}}}))
  await page.addInitScript(()=>{
   window.captureWrites=[]
   Object.defineProperty(window,'ClipboardItem',{configurable:true,value:class{constructor(values){this.values=values}}})
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async items=>{const blob=await items[0].values['image/png'];window.captureWrites.push(Array.from(new Uint8Array(await blob.arrayBuffer())))}}})
  })
  await page.goto(base+'/#juros')
  await page.locator('#juros-ref-brasil').getByRole('button',{name:'Ampliar gráfico: CDI',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await dialog.locator('.capture-button').first().waitFor()
  await dialog.evaluate(async el=>{
   await document.fonts.ready
   const fixture=document.createElement('div');fixture.id='capture-scroll-fixture'
   fixture.style.cssText='width:220px;height:90px;overflow:auto;background:white;color:black'
   fixture.innerHTML='<div style="width:700px;height:320px;position:relative"><div style="position:absolute;left:260px;top:150px;background:#00aa44;color:white;font:24px monospace;padding:12px">VALOR 98765</div><div style="background:#cc0000;color:white">INÍCIO 12345</div></div>'
   el.querySelector('.expandable-body').prepend(fixture);fixture.scrollTop=130;fixture.scrollLeft=240
  })
  const before=await stable(dialog)
  assert.equal(before.dpr,2);assert.equal(before.fixture.scrollTop,130);assert.equal(before.fixture.scrollLeft,240)
  await fs.writeFile(path.join(out,'before.json'),JSON.stringify({options,browserVersion:browser.version(),before},null,2))
  await dialog.locator('.capture-button').first().click()
  await page.waitForFunction(()=>window.captureWrites.length===1)
  const bytes=await page.evaluate(()=>window.captureWrites[0]),after=await snapshot(dialog)
  await fs.writeFile(path.join(out,'actual.png'),Buffer.from(bytes))
  await fs.writeFile(path.join(out,'after.json'),JSON.stringify(after,null,2))
  unchanged(before,after)
  const proof=await fidelity(page,dialog,bytes,['#capture-scroll-fixture'],{prepared:true})
  await fs.writeFile(path.join(out,'proof.json'),JSON.stringify(proof,null,2))
  unchanged(before,await snapshot(dialog))
  for(const r of proof)assert.ok(r.referenceColors>=4&&r.samples>100&&r.meanError<.08&&r.ink>20&&r.inkRecall>.7,'mesmo gate RGB: '+JSON.stringify(r))
  console.log('PASS geometria estável e pixels de fixture rolada; não prova ainda todas as telas nem clipboard real')
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
