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
  await ctx.addInitScript(({theme})=>{
   Object.defineProperty(navigator,'webdriver',{get:()=>false})
   localStorage.setItem('painel-theme',theme)
  },{theme})
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
  const button=p.locator('.panorama-trigger')
  const idle=async(message)=>{await p.clock.runFor(3000);await p.waitForTimeout(150);assert.equal(await p.locator('dialog:modal').count(),0,message)}
  // Primeira visita em horário de edição: só o aviso de entrada. O Panorama espera o clique.
  await aviso.waitFor()
  assert.equal(await modal.evaluate(e=>e.open),false,'não abre junto com o aviso')
  assert.equal(await p.locator('#market-popup-title').count(),1,'título existe antes da abertura')
  assert.equal(await p.locator('#market-popup-note').count(),1,'descrição existe antes da abertura')
  await aviso.getByRole('button',{name:'Entendi'}).click()
  await idle('depois do aviso, nada abre sozinho')
  await button.waitFor()
  assert.match(await button.innerText(),/Panorama do dia/,'botão com o nome escrito em todas as larguras')
  assert.equal(await button.getAttribute('aria-label'),'Panorama do dia (edição nova)')
  assert.equal(await button.locator('.sinal-novo').count(),1,'ponto discreto de edição nova')
  const trigger=await button.boundingBox()
  assert.ok(trigger.width>=44&&trigger.height>=44,'botão com alvo de 44px')
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'botão não cria rolagem lateral')
  await button.click()
  await p.waitForFunction(()=>document.querySelector('.market-popup')?.open)
  await p.waitForTimeout(250)
  assert.equal(await p.locator('dialog:modal').count(),1)
  assert.match(await modal.ariaSnapshot(), /dialog "Panorama do dia"/)
  assert.equal(await modal.locator('.mp-card').count(),5)
  if(!real){await modal.locator('.mp-usd strong').filter({hasText:'5,2800'}).waitFor();assert.match(await modal.innerText(),/12,35%/);assert.match(await modal.locator('.mp-edition').innerText(),/Edição das 12h/)}
  assert.match(await modal.locator('#market-popup-note').innerText(),/só abre quando você pede/)
  const style=await modal.evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color,card:getComputedStyle(e.querySelector('.mp-card')).backgroundImage}))
  colors.push({width,theme,...style})
  assert.equal(style.background,'rgb(255, 255, 255)')
  assert.equal(style.color,'rgb(8, 13, 53)')
  assert.equal(await modal.evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'sem overflow horizontal no modal')
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await modal.screenshot({path:out+'/'+width+'-'+theme+'.png'})
  if(width===1280){
   for(const viewport of [{width:1366,height:650},{width:1170,height:635},{width:1024,height:600}]){
    await p.setViewportSize(viewport)
    const layout=await modal.evaluate(e=>{
     const bounds=e.getBoundingClientRect()
     const visible=[...e.querySelectorAll('.mp-card,.mp-summary,.mp-footnote')].every(item=>{
      const rect=item.getBoundingClientRect()
      return rect.top>=bounds.top&&rect.bottom<=bounds.bottom&&rect.left>=bounds.left&&rect.right<=bounds.right
        &&item.scrollHeight<=item.clientHeight+1&&item.scrollWidth<=item.clientWidth+1
     })
     return {visible,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,top:bounds.top,bottom:bounds.bottom}
    })
    const size=viewport.width+'x'+viewport.height
    assert.ok(layout.visible&&layout.scrollHeight<=layout.clientHeight+1&&layout.top>=0&&layout.bottom<=viewport.height,
     size+' exibe cartões, resumo e rodapé sem rolagem: '+JSON.stringify(layout))
    await modal.screenshot({path:out+'/'+size+'-'+theme+'.png'})
   }
   await p.setViewportSize({width,height:900})
  }
  // O botão permanece alcançável após rolar, com alvo de pelo menos 44px.
  await modal.evaluate(e=>e.scrollTop=e.scrollHeight)
  const box=await modal.getByRole('button',{name:'Fechar panorama'}).boundingBox()
  assert.ok(box.width>=44&&box.height>=44&&box.y>=0&&box.y+box.height<=900)
  await p.keyboard.press('Tab');assert.equal(await modal.evaluate(e=>e.contains(document.activeElement)),true)
  await p.keyboard.press('Shift+Tab');assert.equal(await modal.evaluate(e=>e.contains(document.activeElement)),true)
  const url=p.url()
  await p.keyboard.press('Escape');await p.waitForTimeout(150)
  assert.equal(await modal.evaluate(e=>e.open),false)
  assert.equal(p.url(),url)
  assert.equal(await button.evaluate(e=>e===document.activeElement),true,'foco volta ao botão que abriu')
  assert.equal(await button.locator('.sinal-novo').count(),0,'ponto apaga depois de abrir')
  assert.equal(await button.getAttribute('aria-label'),'Panorama do dia')
  // Segunda visita: nem aviso, nem panorama; a edição já aberta não reacende o ponto.
  await p.reload();await button.waitFor()
  await idle('segunda visita sem pop-up')
  assert.equal(await aviso.count(),0,'aviso não volta com o mesmo texto')
  assert.equal(await button.locator('.sinal-novo').count(),0)
  if(width===1280&&theme==='light'&&!real){
   const open=async()=>{await button.click();await p.waitForFunction(()=>document.querySelector('.market-popup').open)}
   const closed=async(message)=>{await p.clock.runFor(61000);await p.waitForTimeout(150);assert.equal(await modal.evaluate(e=>e.open),false,message)}
   // Virada da hora com o Painel aberto: o ponto reacende, nada abre.
   await p.clock.setFixedTime(new Date('2026-11-06T16:00:00Z'));await closed('13h não abre sozinho')
   assert.equal(await button.locator('.sinal-novo').count(),1,'edição das 13h acende o ponto')
   await open()
   assert.match(await modal.locator('.mp-edition').innerText(),/Edição das 13h/)
   await modal.getByRole('button',{name:'Fechar panorama'}).click()
   await p.clock.setFixedTime(new Date('2026-11-06T21:00:00Z'));await closed('18h não abre sozinho')
   assert.equal(await button.locator('.sinal-novo').count(),1,'última edição, às 18h')
   await open()
   assert.match(await modal.locator('.mp-edition').innerText(),/Edição das 18h/)
   await modal.getByRole('button',{name:'Fechar panorama'}).click()
   // Fora do horário das edições: sem ponto, mas o botão continua abrindo o panorama com os últimos dados.
   await p.clock.setFixedTime(new Date('2026-11-06T21:01:00Z'));await closed('depois das 18h')
   assert.equal(await button.locator('.sinal-novo').count(),0)
   await open()
   assert.match(await modal.locator('.mp-edition').innerText(),/Fora do horário das edições/)
   assert.equal(await modal.locator('.mp-card').count(),5)
   await p.keyboard.press('Escape')
   for(const date of ['2026-11-07','2026-11-20']){
    await p.clock.setFixedTime(new Date(date+'T15:00:00Z'));await closed('sábado/feriado: '+date)
    assert.equal(await button.locator('.sinal-novo').count(),0,'sem edição em '+date)
   }
   // Dia útil seguinte com outro diálogo aberto: o panorama continua sem abrir e não empilha.
   await p.clock.setFixedTime(new Date('2026-11-23T15:00:00Z'))
   await p.evaluate(()=>{const d=document.createElement('dialog');d.id='qa-other';d.textContent='Outro diálogo';document.body.append(d);d.showModal()})
   await closed('não abre sobre outro diálogo')
   assert.equal(await p.locator('dialog:modal').count(),1)
   await p.evaluate(()=>document.querySelector('#qa-other').remove())
   await closed('nem depois que o outro diálogo fecha')
   assert.equal(await button.locator('.sinal-novo').count(),1)
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
