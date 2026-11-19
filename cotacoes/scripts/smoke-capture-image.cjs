// PNG real no Chromium; clipboard simulado para não tocar a área de transferência do executor.
// Não prova colagem no sistema operacional. Rodar somente contra prévia/CI.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const fidelity = require('./smoke-capture-fidelity.cjs')
const out = process.env.CAPTURE_QA_OUTPUT || 'workspace-qa/capturas'
;(async()=>{
 await fs.mkdir(out,{recursive:true})
 const browser=await chromium.launch(require('./smoke-launch.cjs')())
 try {
  for(const width of [390,1440]) for(const theme of ['light','dark']){
   const page=await browser.newPage({viewport:{width,height:950},colorScheme:theme,serviceWorkers:'block',reducedMotion:'reduce'})
   try{
    await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort())
    const now=Date.now(), points=Array.from({length:12},(_,i)=>[now-(11-i)*86400000,12+i/10])
    await page.route('**/macro.json*',r=>r.fulfill({json:{generatedAt:now,cdi:points,selic:points,sofr:points,sofrAvg:[],focus:{},stale:{}}}))
    await page.addInitScript(()=>{
      window.captureWrites=[]
      class Item { constructor(values){this.values=values} }
      Object.defineProperty(window,'ClipboardItem',{configurable:true,value:Item})
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async items=>{
       if(window.captureDenied) throw new Error('Permissão de cópia negada.')
       const blob=await items[0].values['image/png']
       const bytes=Array.from(new Uint8Array(await blob.arrayBuffer()))
       window.captureWrites.push(bytes)
      }}})
    })
    await page.goto(base+'/#juros')
    const chart=page.locator('#juros-ref-brasil article.chart')
    await chart.locator('svg[role="img"]').first().waitFor()
    await chart.getByRole('button',{name:/Copiar imagem:/}).click()
    await page.waitForFunction(()=>window.captureWrites.length===1)
    assert.match(await chart.innerText(),/Imagem copiada/)
    const bytes=await page.evaluate(()=>window.captureWrites[0])
    assert.deepEqual(bytes.slice(0,8),[137,80,78,71,13,10,26,10])
    await chart.screenshot({path:path.join(out,`cdi-${width}-${theme}-reference.png`)})
    const proof=await fidelity(page,chart,bytes,['h3','.pct','svg[role="img"]'])
    for(const region of proof){
      assert.ok(region.referenceColors>=4 && region.samples>100, 'referência contém texto ou gráfico: '+JSON.stringify(region))
      assert.ok(region.meanError<0.08 && region.ink>20 && region.inkRecall>0.7,'fidelidade de texto/gráfico: '+JSON.stringify(region))
    }
    await fs.writeFile(path.join(out,`cdi-${width}-${theme}-fidelity.json`),JSON.stringify(proof,null,2))
    await fs.writeFile(path.join(out,`cdi-${width}-${theme}.png`),Buffer.from(bytes))
    await page.locator('#juros-ref-brasil').getByRole('button',{name:'Ampliar gráfico: CDI',exact:true}).click()
    const dialog=page.getByRole('dialog')
    await dialog.locator('.capture-button').first().waitFor()
    await dialog.locator('.capture-button').first().click()
    await page.waitForFunction(()=>window.captureWrites.length===2)
    // Regressão de rolagem vertical e horizontal, com conteúdo distinguível.
    await dialog.evaluate(el=>{
      const fixture=document.createElement('div');fixture.id='capture-scroll-fixture'
      fixture.style.cssText='width:220px;height:90px;overflow:auto;background:white;color:black'
      fixture.innerHTML='<div style="width:700px;height:320px;position:relative"><div style="position:absolute;left:260px;top:150px;background:#00aa44;color:white;font:24px monospace;padding:12px">VALOR 98765</div><div style="background:#cc0000;color:white">INÍCIO 12345</div></div>'
      el.querySelector('.expandable-body').prepend(fixture)
      fixture.scrollTop=130;fixture.scrollLeft=240
    })
    await dialog.locator('.capture-button').first().click()
    await page.waitForFunction(()=>window.captureWrites.length===3)
    const scrolledBytes=await page.evaluate(()=>window.captureWrites[2])
    const scrollProof=await fidelity(page,dialog,scrolledBytes,['#capture-scroll-fixture'])
    assert.ok(scrollProof[0].referenceColors>=4 && scrollProof[0].meanError<0.08 && scrollProof[0].ink>20 && scrollProof[0].inkRecall>0.7,'rolagem fiel: '+JSON.stringify(scrollProof))
    await fs.writeFile(path.join(out,`rolagem-${width}-${theme}.png`),Buffer.from(scrolledBytes))
    await page.evaluate(()=>window.captureDenied=true)
    await dialog.locator('.capture-button').first().click()
    await dialog.getByRole('status').filter({hasText:'Permissão de cópia negada.'}).waitFor()
    assert.equal(await page.evaluate(()=>window.captureWrites.length),3)
    await page.screenshot({path:path.join(out,`detalhe-${width}-${theme}.png`),fullPage:true})
    console.log('PASS captura PNG gráfico/detalhe/rolagem/recusa',width,theme)
    await page.evaluate(()=>window.captureDenied=false)
    for(const [route,selector] of [['resumo','.market-table'],['juros','#juros-ref-brasil article.chart'],['cenarios/calendario','.cen-nav']]){
      await page.goto(base+'/#'+route)
      await page.locator(selector).first().waitFor()
      const main=page.locator('main.app')
      const before=await page.evaluate(()=>window.captureWrites.length)
      await main.locator('.screen-capture-bar .capture-button').click()
      await page.waitForFunction(n=>window.captureWrites.length===n+1,before)
      const screenBytes=await page.evaluate(()=>window.captureWrites.at(-1))
      await main.screenshot({path:path.join(out,`tela-${route.replaceAll('/','-')}-${width}-${theme}-reference.png`)})
      const screenProof=await fidelity(page,main,screenBytes,[selector])
      for(const region of screenProof)assert.ok(region.referenceColors>=4 && region.meanError<0.08 && region.ink>20 && region.inkRecall>0.7,'tela fiel: '+route+' '+JSON.stringify(region))
      const name=route.replaceAll('/','-')
      await fs.writeFile(path.join(out,`tela-${name}-${width}-${theme}.png`),Buffer.from(screenBytes))
      await fs.writeFile(path.join(out,`tela-${name}-${width}-${theme}.json`),JSON.stringify(screenProof,null,2))
    }
   } finally {await page.close()}
  }
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)})
