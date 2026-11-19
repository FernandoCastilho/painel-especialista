// Opt-in: altera SOMENTE o clipboard do runner descartável autorizado.
// Sem mocks, grantPermissions, configurações persistentes ou clipboard.read.
// Verifica o PNG recebido por evento paste provocado por Control+V real do navegador.
const {chromium}=require('playwright')
const assert=require('node:assert/strict')
const fs=require('node:fs/promises'),path=require('node:path')
if(process.env.REAL_CLIPBOARD!=='1')throw new Error('Defina REAL_CLIPBOARD=1 somente no runner descartável autorizado.')
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:8768'
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Teste restrito à prévia local do runner.')
;(async()=>{
 const browser=await chromium.launch(require('./smoke-launch.cjs')())
 const context=await browser.newContext({viewport:{width:1440,height:950},serviceWorkers:'block',reducedMotion:'reduce'})
 try{
  const page=await context.newPage()
  await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort())
  const now=Date.now(),points=Array.from({length:12},(_,i)=>[now-(11-i)*86400000,12+i/10])
  await page.route('**/macro.json*',r=>r.fulfill({json:{generatedAt:now,cdi:points,selic:points,sofr:points,sofrAvg:[],focus:{},stale:{}}}))
  await page.goto(base+'/#juros')
  const chart=page.locator('#juros-ref-brasil article.chart')
  await chart.locator('svg[role="img"]').first().waitFor()
  await chart.getByRole('button',{name:/Copiar imagem:/}).click()
  await chart.getByRole('status').filter({hasText:'Imagem copiada.'}).waitFor()
  await page.evaluate(()=>{
   const field=document.createElement('div');field.id='paste-proof';field.contentEditable='true'
   field.setAttribute('aria-label','Destino local de teste de colagem')
   field.style.cssText='position:fixed;top:10px;left:10px;background:white;color:black;z-index:999999;padding:10px'
   field.textContent='Cole aqui';document.body.append(field)
   field.addEventListener('paste',async event=>{
    event.preventDefault()
    const file=[...event.clipboardData.files].find(f=>f.type==='image/png')
    if(!file){window.pasteProof={error:'Evento paste sem PNG'};return}
    const bytes=Array.from(new Uint8Array(await file.arrayBuffer()))
    const bitmap=await createImageBitmap(file)
    window.pasteProof={bytes,width:bitmap.width,height:bitmap.height,type:file.type,trusted:event.isTrusted}
   })
  })
  await page.locator('#paste-proof').click()
  await page.keyboard.press('Control+V')
  await page.waitForFunction(()=>window.pasteProof)
  const proof=await page.evaluate(()=>window.pasteProof)
  assert.equal(proof.error,undefined)
  assert.equal(proof.trusted,true,'paste originado do navegador, não dispatchEvent')
  assert.equal(proof.type,'image/png')
  assert.ok(proof.width>200&&proof.height>100)
  assert.deepEqual(proof.bytes.slice(0,8),[137,80,78,71,13,10,26,10])
  const out=process.env.CAPTURE_QA_OUTPUT||'workspace-qa/capturas'
  await fs.mkdir(out,{recursive:true})
  await fs.writeFile(path.join(out,'colagem-real.png'),Buffer.from(proof.bytes))
  await fs.writeFile(path.join(out,'colagem-real.json'),JSON.stringify({...proof,bytes:undefined},null,2))
  console.log('PASS PNG recebido por Control+V real no runner descartável.')
 }finally{await context.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)})
