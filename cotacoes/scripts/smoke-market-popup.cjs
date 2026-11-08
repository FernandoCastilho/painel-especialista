const { chromium } = require('playwright')
const assert = require('node:assert/strict'), fs=require('node:fs')
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:8793'
const out=process.env.POPUP_QA_OUTPUT||'popup-qa'
const real=process.env.POPUP_REAL_DATA==='1'
let instant=new Date('2026-11-06T15:00:00Z')
const raw=(code,codein,bid,pct)=>({code,codein,bid:String(bid),ask:String(bid+.001),high:String(bid*1.01),low:String(bid*.99),pctChange:String(pct),varBid:String(bid*.01),timestamp:String(instant.getTime()/1000)})
const quotes={USDBRL:raw('USD','BRL',5.28,.46),EURBRL:raw('EUR','BRL',5.74,.31),JPYBRL:raw('JPY','BRL',.032,.1),USDCNH:raw('USD','CNH',7.23,.18)}
const curves={generatedAt:instant.getTime(),br:{compare:[{id:'hoje',date:'2026-11-06'},{id:'d1',date:'2026-11-05'}],curves:{'2026-11-06':[[63,12.1],[126,12.15],[252,12.2],[504,12.35],[756,12.55],[1008,12.65],[1260,12.85]],'2026-11-05':[[63,12],[126,12.1],[252,12.15],[503,12.28],[755,12.50],[1007,12.6],[1259,12.75]]}}}
const oil={benchmark:'Brent',kind:'spot',unit:'USD/barril',points:Array.from({length:20},(_,i)=>({date:'2026-10-'+String(12+i).padStart(2,'0'),value:80-i*.15+Math.sin(i)*.4}))}
const intraday={generatedAt:instant.getTime(),series:Object.fromEntries(['USD','EUR','CNH','JPY'].map(code=>[code,{points:Array.from({length:25},(_,i)=>[instant.getTime()-(24-i)*300000,({USD:5.28,EUR:5.74,CNH:.73,JPY:.032}[code])*(.995+i*.0002+Math.sin(i)*.0005)])}]))}
;(async()=>{
 if(real){
  const {marketSlot}=await import('../src/marketPopup.js')
  instant=new Date(new Date().toISOString().slice(0,10)+'T15:00:00Z')
  for(let n=0;n<370&&!marketSlot(instant.getTime());n++)instant=new Date(instant.getTime()+86400000)
 }
 fs.mkdirSync(out,{recursive:true})
 const browser=await chromium.launch(require('./smoke-launch.cjs')())
 const report=[], colors=[]
 try{
 for(const width of [390,820,1280])for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width,height:900},timezoneId:'Asia/Tokyo',colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block'})
  await ctx.addInitScript(({theme,day})=>{
   Object.defineProperty(navigator,'webdriver',{get:()=>false})
   localStorage.setItem('painel-theme',theme)
   localStorage.setItem('aprender-conceito-dia',day)
  },{theme,day:instant.toISOString().slice(0,10)})
  if(!real){
   await ctx.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort())
   await ctx.route('**/json/last/**',r=>r.fulfill({json:quotes}))
   await ctx.route('**/quotes.json*',r=>r.fulfill({json:{generatedAt:instant.getTime(),quotes}}))
   await ctx.route('**/intraday.json*',r=>r.fulfill({json:intraday}))
   await ctx.route('**/curves.json*',r=>r.fulfill({json:curves}))
   await ctx.route('**/oil.json*',r=>r.fulfill({json:oil}))
  }
  await ctx.route('**/recado.json*',r=>r.fulfill({json:{ativo:false}}))
  const p=await ctx.newPage(),errors=[]
  p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message))
  await p.clock.install({time:instant})
  await p.goto(base+'/#resumo')
  const modal=p.locator('dialog.market-popup')
  const aviso=p.locator('dialog.aviso-inicial:not(.recado)')
  await aviso.waitFor()
  assert.equal(await modal.evaluate(e=>e.open),false,'aguarda aviso inicial')
  assert.equal(await p.locator('#market-popup-title').count(),1,'título existe antes da abertura')
  assert.equal(await p.locator('#market-popup-note').count(),1,'descrição existe antes da abertura')
  await aviso.getByRole('button',{name:'Entendi'}).click()
  await p.waitForFunction(()=>document.querySelector('.market-popup')?.open)
  await p.clock.runFor(1200)
  await p.waitForTimeout(250)
  assert.equal(await p.locator('dialog:modal').count(),1)
  assert.match(await modal.ariaSnapshot(), /dialog "Panorama do dia"/)
  assert.equal(await modal.locator('.mp-card').count(),5)
  if(!real){await modal.locator('.mp-usd strong').filter({hasText:'5,2800'}).waitFor();assert.match(await modal.innerText(),/12,35%/)}
  const style=await modal.evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color,card:getComputedStyle(e.querySelector('.mp-card')).backgroundImage}))
  colors.push({width,theme,...style})
  assert.equal(style.background,'rgb(255, 255, 255)')
  assert.equal(style.color,'rgb(8, 13, 53)')
  assert.equal(await modal.evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'sem overflow horizontal no modal')
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await modal.screenshot({path:out+'/'+width+'-'+theme+'.png'})
  // O botão permanece alcançável após rolar, com alvo de pelo menos 44px.
  await modal.evaluate(e=>e.scrollTop=e.scrollHeight)
  const box=await modal.getByRole('button',{name:'Fechar panorama'}).boundingBox()
  assert.ok(box.width>=44&&box.height>=44&&box.y>=0&&box.y+box.height<=900)
  await p.keyboard.press('Tab');assert.equal(await modal.evaluate(e=>e.contains(document.activeElement)),true)
  await p.keyboard.press('Shift+Tab');assert.equal(await modal.evaluate(e=>e.contains(document.activeElement)),true)
  const url=p.url()
  await p.keyboard.press('Escape');await p.clock.runFor(1200)
  assert.equal(await modal.evaluate(e=>e.open),false)
  assert.equal(p.url(),url)
  assert.notEqual(await p.evaluate(()=>document.activeElement.tagName),'BODY')
  await p.reload();await aviso.getByRole('button',{name:'Entendi'}).click();await p.clock.runFor(1200)
  assert.equal(await modal.evaluate(e=>e.open),false,'não repete ao recarregar')
  if(width===1280&&theme==='light'&&!real){
   await p.clock.setFixedTime(new Date('2026-11-06T16:00:00Z'));await p.clock.runFor(1200)
   await p.waitForFunction(()=>document.querySelector('.market-popup').open)
   assert.match(await modal.locator('.mp-edition').innerText(),/13h/)
   await modal.getByRole('button',{name:'Fechar panorama'}).click()
   await p.clock.setFixedTime(new Date('2026-11-06T21:00:00Z'));await p.clock.runFor(1200)
   await p.waitForFunction(()=>document.querySelector('.market-popup').open)
   await modal.getByRole('button',{name:'Fechar panorama'}).click()
   await p.clock.setFixedTime(new Date('2026-11-06T21:01:00Z'));await p.clock.runFor(1200)
   assert.equal(await modal.evaluate(e=>e.open),false)
   for(const date of ['2026-11-07','2026-11-20']){
    await p.evaluate(date=>localStorage.setItem('aprender-conceito-dia',date),date)
    await p.clock.setFixedTime(new Date(date+'T15:00:00Z'));await p.clock.runFor(1200)
    assert.equal(await modal.evaluate(e=>e.open),false,'sábado/feriado: '+date)
   }
   // Um diálogo alheio bloqueia a edição seguinte; nada empilha.
   await p.evaluate(()=>localStorage.setItem('aprender-conceito-dia','2026-11-23'))
   await p.clock.setFixedTime(new Date('2026-11-23T14:59:59Z'))
   await p.evaluate(()=>{const d=document.createElement('dialog');d.id='qa-other';d.textContent='Outro diálogo';document.body.append(d);d.showModal()})
   await p.clock.setFixedTime(new Date('2026-11-23T15:00:00Z'));await p.clock.runFor(1200)
   assert.equal(await modal.evaluate(e=>e.open),false)
   await p.evaluate(()=>document.querySelector('#qa-other').remove())
   await p.clock.runFor(1200)
   await p.waitForFunction(()=>document.querySelector('.market-popup').open)
   await p.keyboard.press('Escape')
  }
  assert.deepEqual(errors,[])
  report.push({width,theme,pass:true,syntheticData:!real})
  await ctx.close()
  console.log(width+' '+theme+' PASS')
 }
 for(const width of [390,820,1280]){
  const [a,b]=colors.filter(x=>x.width===width)
  assert.equal(a.background,b.background);assert.equal(a.color,b.color);assert.equal(a.card,b.card)
 }
 fs.writeFileSync(out+'/report.json',JSON.stringify({report,colors},null,2))
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)})
