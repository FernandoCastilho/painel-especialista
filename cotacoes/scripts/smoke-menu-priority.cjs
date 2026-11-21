// Optional QA for the approved navigation hierarchy, no external state writes.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const base=(process.env.SMOKE_BASE_URL||'http://127.0.0.1:8768').replace(/\/$/,''),out=process.env.MENU_QA_OUTPUT||'workspace-qa/menu-priority'
;(async()=>{
 fs.mkdirSync(out,{recursive:true})
 const browser=await chromium.launch(require('./smoke-launch.cjs')()), report=[]
 try{
  for(const width of [320,390,820,1024,1440,1660,1920]) for(const theme of ['light','dark']){
   const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<=390,colorScheme:theme,serviceWorkers:'block'})
   const page=await context.newPage()
   await page.goto(base+'/#calculadora')
   await page.locator('.calc-catalog').waitFor()
   const notice=page.getByRole('dialog',{name:'Aviso',exact:true})
   if(await notice.isVisible()) await notice.getByRole('button',{name:'Entendi',exact:true}).click()
   await page.waitForFunction(expected=>document.documentElement.dataset.theme===expected,theme)
   const nav=page.getByRole('navigation',{name:width>=1000?'Navegação principal':'Seções',exact:true})
   const expected=width>=1000?['Mercado','Cenários','Juros','Calculadoras','Calculadora RPN','Setores','Notícias','Podcast','Mais']
    :width<=359?['Merc.','Cen.','Juros','Calc.','RPN','Setores','Mais']:['Mercado','Cenários','Juros','Calculadoras','RPN','Setores','Mais']
   await page.evaluate(()=>document.fonts.ready)
   if(width>=1400){
    const {flagSvg}=await import('../src/flags.js')
    const expectedClocks=[['São Paulo','BRT','BRL'],['Nova York','NYC','USD'],['Londres','LDN','GBP'],['Tóquio','TYO','JPY']].slice(0,width>=1800?4:width>=1600?2:1)
    assert.equal(await page.locator('.topbar-clocks > .topbar-clock:visible').count(),expectedClocks.length)
    for(const [city,short,code] of expectedClocks){
      const clock=page.locator('.topbar-clocks > .topbar-clock').and(page.getByTitle(city,{exact:true}))
      assert.equal((await clock.locator('b').innerText()).trim(),short)
      assert.match(await clock.innerText(),/\d{2}:\d{2}/)
      const flag=clock.locator('.topbar-clock-flag')
      assert.equal(await flag.isVisible(),true)
      assert.equal(await flag.getAttribute('aria-hidden'),'true')
      assert.ok(await flag.locator('svg').evaluate((svg,expected)=>{
        const sample=document.createElement('template'); sample.innerHTML=expected
        return svg.isEqualNode(sample.content.firstElementChild)
      },flagSvg(code,'width="13" height="9"')))
    }
   }
   assert.deepEqual((await nav.locator(':scope > button, :scope > .more-tab > button').allInnerTexts()).map(s=>s.trim()),expected)
   for(const button of await nav.locator(':scope > button, :scope > .more-tab > button').all()) {
    const bounds=await button.boundingBox()
    assert.ok(bounds.width>=44&&bounds.height>=44,`${width}/${theme}: ${await button.innerText()} touch target ${bounds.width}×${bounds.height}, expected at least 44px`)
    assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1,'primary button within viewport')
    assert.equal(await button.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'primary label not clipped')
    if(width<=390) assert.ok(await button.evaluate(el=>{
     const label=[...el.querySelectorAll(':scope > span')].find(span=>span.getClientRects().length)
     if(!label) return false
     const text=document.createRange();text.selectNodeContents(label)
     const lines=[...text.getClientRects()],target=el.getBoundingClientRect()
     return lines.length===1&&lines[0].left>=target.left-1&&lines[0].right<=target.right+1
    }),`${width}/${theme}: rótulo ${await button.innerText()} em uma linha e dentro do alvo`)
   }
   await nav.getByRole('button',{name:'Mais',exact:true}).click()
   const menu=nav.getByRole('menu')
   assert.equal(await menu.getByRole('group',{name:'Acompanhar',exact:true}).count(),width<1000?1:0)
   assert.equal(await menu.getByRole('group',{name:'Consultar',exact:true}).count(),1)
   assert.equal(await menu.getByRole('menuitem',{name:'Juros',exact:true}).count(),0)
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
   const destinations=[['Mercado','resumo'],['Cenários','cenarios'],['Juros','juros'],['Calculadoras','calculadora'],['Calculadora RPN','rpn'],['Setores','setores']]
   if(width>=1000) destinations.push(['Notícias','noticias'],['Podcast','podcast'])
   for(const [label,id] of destinations){
    await nav.getByRole('button',{name:label,exact:true}).click()
    await page.waitForURL('**/#'+id)
    assert.equal(await nav.getByRole('button',{name:label,exact:true}).getAttribute('aria-current'),'page')
    if(id==='rpn'){
     const panel=page.getByRole('region',{name:'Calculadora RPN',exact:true})
     const display=panel.getByLabel('Resultado da calculadora',{exact:true})
     const visibleText=async()=> (await display.textContent()).trim()
     await panel.waitFor()
     assert.equal(await page.locator('#conteudo h1').count(),1,'a RPN tem um único título principal')
     const heading=panel.getByRole('heading',{name:'Calculadora RPN',level:1,exact:true})
     if(width<=390){
      assert.ok(await heading.evaluate(el=>{
       const text=document.createRange();text.selectNodeContents(el)
       const lines=[...text.getClientRects()],box=el.parentElement.getBoundingClientRect()
       return lines.length===1&&lines[0].left>=box.left&&lines[0].right<=box.right
      }),`${width}/${theme}: título completo em uma linha`)
      await page.screenshot({path:path.join(out,'rpn-top-'+width+'-'+theme+'.png')})
     }
     const keypad=panel.getByRole('group',{name:'Teclado da calculadora',exact:true})
     assert.equal(await keypad.count(),1,'uma grade acessível por largura')
     const keys=keypad.getByRole('button')
     assert.equal(await keys.count(),39)
     for(const button of await keys.all()){
      const box=await button.boundingBox()
      assert.ok(box.width>=44&&box.height>=44,`${width}/${theme}: ${await button.getAttribute('data-key')} alvo ${box.width}×${box.height}`)
      assert.ok(box.x>=0&&box.x+box.width<=width+1,'tecla dentro da tela')
      assert.ok(await button.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'tecla sem corte horizontal')
     }
     const initial=await visibleText()
     await page.keyboard.press('7')
     assert.equal(await visibleText(),initial,'teclado fora da região não altera o visor')
     await panel.focus()
     for(const key of ['2','Enter','3','+']) await panel.press(key)
     assert.match(await visibleText(),/^5(?:,0+)?$/)
     const enter=panel.getByRole('button',{name:'Enter: separar os números',exact:true})
     await enter.focus()
     await page.keyboard.press('Enter')
     await panel.getByText('Pilha, registros e fluxo de caixa',{exact:true}).click()
     const stack=panel.getByRole('complementary',{name:'Pilha de valores'})
     const register=name=>stack.getByText(name,{exact:true}).locator('..').locator('dd')
     assert.match(await register('Y').innerText(),/^5(?:,0+)?$/)
     assert.match(await register('Z').innerText(),/^0(?:,0+)?$/,'Enter nativo não duplica o empilhamento')
     assert.ok(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'quadro RPN cabe no viewport')
     if(width<=390||width===1440){
      const trigger=button=>width<=390?button.tap():button.click()
      const key=id=>keypad.locator('button[data-key="'+id+'"]')
      const action=id=>trigger(key(id))
      const input=async digits=>{await panel.focus(); await panel.press('Delete'); for(const digit of digits) await panel.press(digit)}
      await input('100')
      await action('chs')
      await action('g'); await action('pv')
      await input('80')
      await action('g'); await action('pmt')
      await action('f'); await action('fv')
      assert.match(await visibleText(),/^[-−]20(?:,0+)?$/)
      const cash=panel.getByRole('group',{name:'Fluxo de caixa'})
      assert.match(await cash.innerText(),/2 registros/)
      const interest=panel.getByRole('group',{name:'Registros financeiros',exact:true}).getByText('i',{exact:true}).locator('..').locator('dd')
      const rateBefore=await interest.innerText()
      const ratesButton=panel.getByRole('button',{name:'Taxas',exact:true})
      const rates=panel.getByRole('region',{name:'Converter taxas',exact:true})
      const rateField=rates.getByRole('textbox',{name:'Taxa de origem (%)',exact:true})
      const use=rates.getByRole('button',{name:'Usar no visor',exact:true})
      await trigger(ratesButton)
      assert.equal(await rateField.evaluate(n=>n===document.activeElement),true,'foco inicial no campo')
      const origin=rates.getByRole('combobox',{name:'De',exact:true})
      const destination=rates.getByRole('combobox',{name:'Para',exact:true})
      assert.equal(await origin.inputValue(),'month','rótulo semântico exato De')
      assert.equal(await destination.inputValue(),'year','rótulo semântico exato Para')
      await rateField.fill('1,00')
      assert.match(await rates.getByLabel('Taxa equivalente',{exact:true}).innerText(),/^12,6825/)
      await rates.getByLabel('Para',{exact:true}).selectOption('day')
      assert.ok(await use.isDisabled(),'base diária deve ser explícita')
      await rates.getByLabel('Base diária',{exact:true}).selectOption('365')
      assert.ok(await use.isEnabled())
      await rates.getByLabel('Para',{exact:true}).selectOption('year')
      await page.screenshot({path:path.join(out,'rpn-taxas-'+width+'-'+theme+'.png'),fullPage:true})
      await rateField.press('Escape')
      assert.ok(await rates.isHidden())
      assert.equal(await ratesButton.evaluate(n=>n===document.activeElement),true,'Escape devolve foco')
      await trigger(ratesButton)
      assert.equal(await rateField.inputValue(),'1,00','rascunho preservado ao reabrir')
      assert.match(await visibleText(),/^[-−]20(?:,0+)?$/,'até confirmar o conversor não altera o visor')
      await trigger(use)
      assert.ok(await rates.isHidden())
      assert.match(await visibleText(),/^12,68(?:0+)?$/,'visor respeita suas casas configuradas')
      await action('f'); await action('6')
      assert.match(await visibleText(),/^12,682503$/,'cálculo não perdeu precisão no envio ao visor')
      assert.equal(await interest.innerText(),rateBefore,'sem gravar taxa convertida em i')
     }
     await page.screenshot({path:path.join(out,'rpn-'+width+'-'+theme+'.png'),fullPage:true})
    }
   }
   const extra=[...(width<1000?[['Notícias','noticias'],['Podcast','podcast']]:[]),['Bancos','bancos'],['Feriados','feriados'],['Aprender','aprender']]
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
  for(const theme of ['light','dark']) {
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:theme,serviceWorkers:'block'})
   const page=await context.newPage()
   await page.goto(base+'/#rpn')
   const panel=page.getByRole('region',{name:'Calculadora RPN',exact:true})
   const key=id=>panel.getByRole('group',{name:'Teclado da calculadora',exact:true}).locator('button[data-key="'+id+'"]')
   const result=()=>panel.getByLabel('Resultado da calculadora',{exact:true}).textContent()
   await panel.waitFor()
   await key('2').tap()
   await key('enter').tap()
   for(const [width,height] of [[844,390],[640,320],[568,280]]) {
    await page.setViewportSize({width,height})
    await page.waitForFunction(()=>{
     const wide=document.querySelector('.rpn-keypad--wide'), display=document.querySelector('.rpn-display')
     return wide?.getClientRects().length && display?.getBoundingClientRect().top>=0
    })
    const keyboard=panel.getByRole('group',{name:'Teclado da calculadora',exact:true})
    assert.equal(await keyboard.count(),1)
    assert.equal(await keyboard.getByRole('button').count(),39)
    for(const loc of [panel.getByLabel('Resultado da calculadora',{exact:true}), ...await keyboard.getByRole('button').all()]) {
     const rect=await loc.boundingBox()
     assert.ok(rect && rect.x>=0 && rect.y>=0 && rect.x+rect.width<=width+1 && rect.y+rect.height<=height,
      `${width}×${height}/${theme}: visor/tecla dentro da altura útil ${JSON.stringify(rect)}`)
     if(await loc.getAttribute('data-key')) assert.ok(rect.width>=44 && rect.height>=44,
      `${width}×${height}/${theme}: alvo ${rect.width}×${rect.height}`)
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'sem rolagem horizontal')
    await page.screenshot({path:path.join(out,`rpn-landscape-${width}-${height}-${theme}.png`)})
    report.push({width,height,theme,orientation:'landscape',passed:true})
   }
   await key('3').tap()
   await key('add').tap()
   assert.match((await result()).trim(),/^5(?:,0+)?$/,'giro preserva pilha e cálculo')
   await panel.getByRole('button',{name:'Taxas',exact:true}).tap()
   const rates=panel.getByRole('region',{name:'Converter taxas',exact:true})
   const source=rates.getByLabel('Taxa de origem (%)',{exact:true})
   assert.ok(await source.evaluate(el=>el===document.activeElement && el.getBoundingClientRect().top>=0 &&
    el.getBoundingClientRect().bottom<=innerHeight),'abertura de Taxas visível e com foco antes de digitar')
   await source.fill('1')
   assert.match(await rates.getByLabel('Taxa equivalente',{exact:true}).innerText(),/^12,6825/)
   await rates.getByRole('button',{name:'Fechar conversor',exact:true}).tap()
   assert.match((await result()).trim(),/^5(?:,0+)?$/,'conversor não altera o estado sem ação')
   const helpButton=panel.getByRole('button',{name:'Ajuda da calculadora',exact:true})
   await helpButton.tap()
   const help=panel.getByRole('region',{name:'Como usar',exact:true})
   await help.waitFor()
   assert.ok(await help.evaluate(el=>el===document.activeElement && el.getBoundingClientRect().top>=0 &&
    el.getBoundingClientRect().top<innerHeight),'ajuda visível e com foco')
   await help.getByRole('button',{name:'Fechar ajuda',exact:true}).tap()
   assert.ok(await help.isHidden())
   assert.ok(await helpButton.evaluate(el=>el===document.activeElement),'fechar ajuda devolve foco')
   await page.setViewportSize({width:390,height:844})
   const back=panel.getByRole('link',{name:'Voltar ao Mercado',exact:true})
   assert.equal(await back.count(),0,'atalho extra só na paisagem')
   assert.match((await result()).trim(),/^5(?:,0+)?$/,'voltar ao retrato preserva o visor')
   await page.setViewportSize({width:844,height:390})
   await back.tap()
   await page.waitForURL('**/#resumo')
   await page.getByRole('navigation',{name:'Seções',exact:true}).waitFor()
   await context.close()
  }
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
