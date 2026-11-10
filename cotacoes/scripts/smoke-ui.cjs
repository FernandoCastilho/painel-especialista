// Smoke opcional, com fixtures sintéticas: exige Playwright e navegador no executor.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
;(async()=>{
 const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
 const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})})
 try {
 const context = await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'})
 const errors=[], chunks=[]
 const page=await context.newPage()
 page.on('pageerror',e=>errors.push(e.message))
 page.on('request',r=>{if(r.url().includes('/assets/'))chunks.push(r.url())})
 const now=Date.now(),day=86400000,date=new Date(now).toISOString().slice(0,10)
 const pts=[[now-3*day,12],[now-day,12.1]]
 const curve={compare:[{id:'hoje',date,label:'Hoje'}],curves:{[date]:[[21,12],[252,13],[504,13.2]]}}
 const fixtures={
  'macro.json':{generatedAt:now,cdi:pts,selic:[[now-30*day,15]],sofr:[[now-3*day,4.2],[now-day,4.1]],sofrAvg:[],focus:null,ptax:{},ptaxHist:{}},
  'curves.json':{generatedAt:now,br:curve,cc:curve,us:{...curve,curves:{[date]:[[1,4.1,'1a'],[2,4.2,'2a'],[10,4.4,'10a']]}}},
  'news.json':{generatedAt:now,news:{}},
  'intraday.json':{generatedAt:now,resolution:'5 min',source:'Fixture de teste',series:Object.fromEntries(['USD','EUR','JPY','CNH'].map(c=>[c,{points:[[now-600000,5],[now-300000,5.1],[now,5.2]]}]))},
 }
 await context.route('**/*',route=>{
  const url=new URL(route.request().url()),name=url.pathname.split('/').pop()
  if(url.hostname==='economia.awesomeapi.com.br')return route.fulfill({json:Object.fromEntries(['USDBRL','EURBRL','JPYBRL','USDCNH'].map(c=>[c,{bid:c==='JPYBRL'?'.035':'5',ask:c==='JPYBRL'?'.0351':'5.01',high:c==='JPYBRL'?'.036':'5.1',low:c==='JPYBRL'?'.034':'4.9',pctChange:'1',timestamp:String(now/1000)}]))})
  if(fixtures[name])return route.fulfill({json:fixtures[name]})
  if(url.origin===new URL(base).origin)return route.continue()
  return route.abort()
 })
 await page.goto(`${base}/#resumo`)
 await page.getByRole('button',{name:'Dólar americano: abrir gráfico',exact:true}).waitFor()
 const holidays=page.locator('details.holiday-notice')
 assert.equal(await holidays.evaluate(el=>el.open),false,'feriados inicialmente recolhidos')
 const holidaySummary=holidays.locator('summary')
 assert.equal(await holidaySummary.innerText(),'Feriados nos próximos 30 dias')
 await holidaySummary.click()
 assert.equal(await holidays.evaluate(el=>el.open),true,'feriados abrem por clique')
 assert.doesNotMatch(await holidays.innerText(),/referência financeira|primeiro:|China: nenhum feriado/)
 await holidaySummary.focus();await page.keyboard.press('Space')
 assert.equal(await holidays.evaluate(el=>el.open),false,'feriados fecham pelo teclado')
 await page.keyboard.press('Enter')
 assert.equal(await holidays.evaluate(el=>el.open),true,'feriados reabrem pelo teclado')
 await page.keyboard.press('Enter')
 assert.equal(await holidays.evaluate(el=>el.open),false,'feriados recolhem novamente')
 for(const label of ['Juros','Feriados','Cenários','Notícias','Mercado hoje']){
  await page.getByRole('navigation',{name:/Navegação principal|Seções/}).getByRole('button',{name:{'Configurações':/^Config(urações)?$/,'Mercado hoje':/^Mercado( hoje)?$/}[label]??label,exact:true}).click()
  await page.waitForTimeout(200)
  assert.equal(await page.getByRole('heading',{name:'Não foi possível exibir esta tela'}).count(),0,label)
 }
 assert.equal(await page.getByRole('navigation',{name:/Navegação principal|Seções/}).getByRole('button',{name:/^Config(urações)?$/}).count(),0,'Config oculta no menu')
 assert.equal(await page.getByRole('navigation',{name:/Navegação principal|Seções/}).getByRole('button',{name:'Calculadoras',exact:true}).count(),0,'Calculadoras oculta no menu')
 await page.goto(`${base}/#calculadora`)
 await page.getByRole('button',{name:'Capital de Giro: abrir calculadora',exact:true}).waitFor()
 await page.goto(`${base}/#config`);await page.waitForTimeout(300);assert.equal(await page.getByRole('heading',{name:'Não foi possível exibir esta tela'}).count(),0,'#config abre')
 await page.goto(`${base}/#resumo`);await page.getByRole('button',{name:'Dólar americano: abrir gráfico',exact:true}).waitFor()
 await page.getByRole('button',{name:'Dólar americano: abrir gráfico',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'detalhes da moeda'})
 await dialog.waitFor({state:'visible'})
 const plot=dialog.locator('svg[tabindex="0"]').first()
 await plot.waitFor();await plot.focus();await page.keyboard.press('End')
 assert.match(await dialog.locator('.chart-access-text[role="status"]').innerText(),/Cotação/)
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'})
 await page.getByRole('navigation',{name:/Navegação principal|Seções/}).getByRole('button',{name:'Juros',exact:true}).click()
 const cdi=page.locator('.plot svg[tabindex="0"]').first()
 await cdi.waitFor();await cdi.focus();await page.keyboard.press('End')
 assert.match(await page.locator('.chart-access-text[role="status"]').first().innerText(),/CDI/)
 const curveRegion=page.locator('.curve').filter({has:page.locator('svg[aria-label^="Curva de juros:"]')}).first()
 const curvePlot=curveRegion.locator('svg[tabindex="0"]')
 await curvePlot.focus();await page.keyboard.press('End')
 assert.match(await curveRegion.locator('.chart-access-text[role="status"]').first().innerText(),/13,20/)
 await page.getByRole('navigation',{name:/Navegação principal|Seções/}).getByRole('button',{name:'Cenários',exact:true}).click()
 await page.waitForURL('**/#cenarios');await page.goBack();await page.waitForURL('**/#juros')
 assert.equal(await page.getByRole('navigation',{name:/Navegação principal|Seções/}).getByRole('button',{name:'Juros',exact:true}).getAttribute('aria-current'),'page')
 await page.goForward();await page.waitForURL('**/#cenarios')
 await page.goto(`${base}/#cenarios/calendario`)
 await page.locator('#cal-title').waitFor();await page.waitForTimeout(300)
 assert.match(await page.locator('#cal-title').innerText(),/Calendário econômico/)
 assert.equal(await page.getByRole('heading',{name:'Não foi possível exibir esta tela'}).count(),0)
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,checks:['abas lazy e acesso direto a Calculadoras','modal moeda Escape','teclado gráfico CDI','teclado curva DI','Back/Forward','deep link do calendário'],pageErrors:errors,assetRequests:chunks.length}))
 } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exit(1)})
