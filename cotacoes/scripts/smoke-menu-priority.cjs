// Optional QA for the approved navigation hierarchy, no external state writes.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const base=(process.env.SMOKE_BASE_URL||'http://127.0.0.1:8768').replace(/\/$/,''),out=process.env.MENU_QA_OUTPUT||'workspace-qa/menu-priority'
;(async()=>{
 fs.mkdirSync(out,{recursive:true})
 const browser=await chromium.launch(require('./smoke-launch.cjs')()), report=[]
 try{
  for(const width of [390,820,1024,1440]) for(const theme of ['light','dark']){
   const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,serviceWorkers:'block'})
   const page=await context.newPage()
   await page.goto(base+'/#calculadora')
   await page.locator('.calc-catalog').waitFor()
   const notice=page.getByRole('dialog',{name:'Aviso',exact:true})
   if(await notice.isVisible()) await notice.getByRole('button',{name:'Entendi',exact:true}).click()
   await page.waitForFunction(expected=>document.documentElement.dataset.theme===expected,theme)
   const nav=page.getByRole('navigation',{name:width>=1000?'Navegação principal':'Seções',exact:true})
   const expected=width>=1000?['Mercado','Cenários','Calculadoras','Setores','Notícias','Podcast','Mais']:['Mercado','Cenários','Calculadoras','Setores','Mais']
   assert.deepEqual((await nav.locator(':scope > button, :scope > .more-tab > button').allTextContents()).map(s=>s.trim()),expected)
   await nav.getByRole('button',{name:'Mais',exact:true}).click()
   const menu=nav.getByRole('menu')
   assert.equal(await menu.getByRole('group',{name:'Acompanhar',exact:true}).count(),1)
   assert.equal(await menu.getByRole('group',{name:'Consultar',exact:true}).count(),1)
   assert.equal(await menu.getByRole('menuitem',{name:'Juros',exact:true}).count(),1)
   assert.equal(await menu.getByRole('menuitem',{name:'Notícias',exact:true}).count(),width<1000?1:0)
   const bounds=await menu.boundingBox()
   assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y>=0&&bounds.y+bounds.height<=1001)
   await page.screenshot({path:path.join(out,width+'-'+theme+'.png'),fullPage:true})
   const items=menu.getByRole('menuitem')
   assert.equal(await items.first().evaluate(n=>n===document.activeElement),true,'first item receives focus')
   await page.keyboard.press('End')
   assert.equal(await items.last().evaluate(n=>n===document.activeElement),true)
   await page.keyboard.press('ArrowDown')
   assert.equal(await items.first().evaluate(n=>n===document.activeElement),true)
   await page.keyboard.press('ArrowUp')
   assert.equal(await items.last().evaluate(n=>n===document.activeElement),true)
   await page.keyboard.press('Home')
   assert.equal(await items.first().evaluate(n=>n===document.activeElement),true)
   await page.keyboard.press('Escape')
   assert.equal(await nav.getByRole('button',{name:'Mais',exact:true}).getAttribute('aria-expanded'),'false')
   const more=nav.getByRole('button',{name:'Mais',exact:true})
   assert.equal(await more.evaluate(n=>n===document.activeElement),true,'Escape restores trigger focus')
   await more.press('ArrowUp')
   assert.equal(await menu.getByRole('menuitem').last().evaluate(n=>n===document.activeElement),true)
   await page.keyboard.press('Tab')
   assert.equal(await more.getAttribute('aria-expanded'),'false','Tab closes menu')
   // Every primary destination is a real clickable route.
   const destinations=[['Mercado','resumo'],['Cenários','cenarios'],['Calculadoras','calculadora'],['Setores','setores']]
   if(width>=1000) destinations.push(['Notícias','noticias'],['Podcast','podcast'])
   for(const [label,id] of destinations){
    await nav.getByRole('button',{name:label,exact:true}).click()
    await page.waitForURL('**/#'+id)
    assert.equal(await nav.getByRole('button',{name:label,exact:true}).getAttribute('aria-current'),'page')
   }
   const extra=[['Juros','juros'],...(width<1000?[['Notícias','noticias'],['Podcast','podcast']]:[]),['Bancos','bancos'],['Feriados','feriados'],['Aprender','aprender']]
   for(const [label,id] of extra){
    await more.click()
    await menu.getByRole('menuitem',{name:label,exact:true}).click()
    await page.waitForURL('**/#'+id)
    assert.equal(await more.getAttribute('aria-expanded'),'false')
    assert.equal(await more.evaluate(n=>n===document.activeElement),true,'selection restores trigger focus')
   }
   await page.keyboard.press('Alt+5')
   await page.waitForURL('**/#bndes')
   await page.keyboard.press('Alt+0')
   await page.waitForURL('**/#calculadora')
   assert.equal(await page.locator('.calc-catalog a[href="#bndes"]').count(),1)
   assert.ok((await page.locator('.calc-catalog button').first().innerText()).includes('BNDES'))
   await page.locator('.calc-catalog a[href="#bndes"]').click()
   await page.waitForURL('**/#bndes')
   await page.keyboard.press('Alt+0')
   await page.waitForURL('**/#calculadora')
   await page.locator('.calc-catalog button').first().click()
   await page.waitForURL('**/#calculadora/finame-materiais')
   report.push({width,theme,passed:true});await context.close()
  }
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
