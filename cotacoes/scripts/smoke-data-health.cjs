// Dados fictícios: horários e avisos, sem certificar preços reais.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict')
;(async()=>{
 const browser=await chromium.launch(require('./smoke-launch.cjs')()),base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:8768',out=process.env.HEALTH_QA_OUTPUT||path.join(process.env.WORKSPACE_QA_OUTPUT||os.tmpdir(),'health');fs.mkdirSync(out,{recursive:true});const results=[]
 const now=Date.UTC(2026,10,2,17),old=now-4*3600000,day=86400000
 const raw=(bid,t,spread)=>({bid:String(bid),ask:String(bid+spread),high:String(bid*1.02),low:String(bid*.98),pctChange:'0',varBid:'0',timestamp:String(t/1000)})
 const quotes={USDBRL:raw(5.4,old,.001),EURBRL:raw(6.1,now,.001),JPYBRL:raw(.035,now,.0001),USDCNH:raw(6.65,old,.001)}
 const macro={generatedAt:now,cdi:[[now-2*day,13.65],[now-day,13.65]],selic:[[now-90*day,13.75]],sofr:[[now-day,3.95]],sofrAvg:[],focus:null,ptax:{},ptaxHist:{},stale:{cdi:old},errors:[]}
 const empty={generatedAt:now,series:{},points:[],news:{USD:[],EUR:[],JPY:[],CNH:[]},events:[],holidays:[],curves:{},compare:[]}
 const assertPageLayout=async(p,stage)=>{
  const geometry=await p.evaluate(()=>{
   const scroller=document.querySelector('.config-gov').closest('.config-scroll'),table=document.querySelector('.config-gov'),box=scroller.getBoundingClientRect()
   const outside=[...document.querySelectorAll('body *')].filter(node=>{
    const r=node.getBoundingClientRect();if(!r.width||!r.height||r.right<=innerWidth&&r.left>=0)return false
    for(let parent=node.parentElement;parent;parent=parent.parentElement){const overflow=getComputedStyle(parent).overflowX,bounds=parent.getBoundingClientRect();if(['auto','scroll','hidden','clip'].includes(overflow)&&bounds.left>=0&&bounds.right<=innerWidth)return false}
    return true
   }).slice(0,12).map(node=>({element:node.tagName,class:node.className,right:node.getBoundingClientRect().right,width:node.getBoundingClientRect().width}))
   return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,scrollX,scroller:{left:box.left,right:box.right,width:box.width,scrollWidth:scroller.scrollWidth},tableWidth:table.getBoundingClientRect().width,outside}
  })
  assert.equal(geometry.documentWidth>geometry.width,false,`${stage}: página sem rolagem lateral; ${JSON.stringify(geometry)}`)
  assert.ok(geometry.scroller.left>=0&&geometry.scroller.right<=geometry.width,`${stage}: rolagem da tabela contida no painel; ${JSON.stringify(geometry)}`)
 }
 try{for(const width of [390,820,1440]){
  const ctx=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:now})
  let freightReads = 0
  await ctx.route('**/*',route=>{
   const u=new URL(route.request().url()),file=u.pathname.split('/').pop()
   if(file==='freight-jp.json')freightReads++
   if(file==='quotes.json')return route.fulfill({json:{generatedAt:now,source:'AwesomeAPI',quotes}})
   if(file==='macro.json')return route.fulfill({json:macro})
   if(file==='curves.json')return route.fulfill({json:{generatedAt:now,br:null,cc:null,us:null}})
   if(u.hostname==='economia.awesomeapi.com.br')return route.fulfill({json:quotes})
   if(u.origin===base&&file.endsWith('.json'))return route.fulfill({json:empty})
   if(u.origin===base)return route.continue();return route.abort()
  })
  try{
   await p.goto(base+'/#config');const notice=p.getByRole('button',{name:'Entendi',exact:true});if(await notice.count())await notice.click()
   const feed=p.locator('.topbar-feed');await feed.filter({hasText:'Dado antigo'}).waitFor({state:'attached'});assert.match(await feed.textContent(),/10:00/);assert.doesNotMatch(await feed.textContent(),/14:00/)
   const toggle=p.getByRole('button',{name:'Consultar estado das fontes'});await toggle.waitFor();assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(freightReads,0);await Promise.all([p.waitForRequest(r=>new URL(r.url()).pathname.endsWith('/freight-jp.json')),toggle.click()]);assert.equal(await toggle.getAttribute('aria-expanded'),'true')
   const rows=p.locator('#config-fontes tbody tr'),fx=rows.filter({hasText:'Câmbio (USD, EUR, JPY, CNH e EUR/USD)'});await fx.waitFor();assert.equal(await fx.count(),1)
   for(const text of [/Dado antigo/i,/Conferido no painel/,/Referência mais antiga/,/10:00/,/14:00/])assert.match(await fx.innerText(),text)
   const summary=fx.locator('summary');await summary.scrollIntoViewIfNeeded();const bounds=await summary.boundingBox();assert.ok(bounds&&bounds.height>=44);await summary.click()
   for(const text of [/Arquivo gerado/,/Última leitura bem-sucedida/,/USD\/BRL:/])assert.match(await fx.innerText(),text)
   await assertPageLayout(p,'detalhes de câmbio abertos, antes da captura')
   // A linha desktop pode exceder o viewport dentro do scroller. Captura a tela real sem expandir a área via CDP.
   await p.screenshot({path:path.join(out,width+'-cambio.png')})
   const cdi=rows.filter({hasText:'CDI, Selic, PTAX, SOFR e Focus'});assert.equal(await cdi.count(),1);assert.match(await cdi.innerText(),/Atualização parcial/i);assert.doesNotMatch(await cdi.locator('[data-label="Estado"]').innerText(),/Atualizado|Sem alerta/i);await cdi.locator('summary').click();assert.match(await cdi.innerText(),/Parte dos dados foi mantida|falha na coleta/);await assertPageLayout(p,'detalhes de CDI abertos, antes da captura');await p.screenshot({path:path.join(out,width+'-parcial.png')});await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await assertPageLayout(p,'detalhes de CDI abertos, depois da captura');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   await p.goto(base+'/#resumo');await p.getByRole('heading',{name:/Mercado hoje/i}).first().waitFor();await feed.filter({hasText:'Dado antigo'}).waitFor({state:'attached'});assert.match(await feed.textContent(),/10:00/);assert.match(await p.locator('.status.src').first().innerText(),/Referência mais antiga/);assert.match(await p.locator('.status.src').first().innerText(),/Conferido no painel/);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:path.join(out,width+'-mercado.png')});quotes.USDCNH.timestamp=String(now/1000);await p.reload();await feed.filter({hasText:'Atualização parcial'}).waitFor({state:'attached'});quotes.USDCNH.timestamp=String(old/1000);assert.deepEqual(errors,[]);results.push({width,passed:true,checks:['estado igual no cabeçalho e Config','consulta14h e referência10h','arquivo recente com retenção parcial','detalhes44px','sem erro e sem overflow'],errors})
  }catch(e){await p.screenshot({path:path.join(out,width+'-failure.png')}).catch(()=>{});throw e}finally{await ctx.close()}
 }fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2))}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)})
