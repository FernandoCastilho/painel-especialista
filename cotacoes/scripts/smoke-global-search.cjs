const openCallouts = require('./smoke-aprender-disclosures.cjs')
const {chromium}=require('playwright'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const output=process.env.SEARCH_QA_OUTPUT || path.join(__dirname,'../../qa-universal');fs.mkdirSync(output,{recursive:true});
const base=process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5220';
(async()=>{const browser=await chromium.launch(require('./smoke-launch.cjs')());try{for(const width of [390,1280]){
 const context=await browser.newContext({viewport:{width,height:950},hasTouch:true,serviceWorkers:'block'}), p=await context.newPage(), errors=[], requests=[];
 // Publication dates are compared with the UI clock captured before fetching.
 // Keep both clocks aligned; generatedAt must not revive expired/undated news.
 const now=Date.now(), headline='Manchete de teste sobre crédito e inadimplência';
 await p.clock.setFixedTime(now);
 const newsFixture={generatedAt:now,news:{USD:[
   {title:headline,link:'https://example.test/current',source:'Ensaio',t:now-3600000},
   {title:'Notícia expirada de teste sobre inadimplência',link:'https://example.test/expired',source:'Ensaio',t:now-121*3600000},
   {title:'Notícia futura de teste sobre inadimplência',link:'https://example.test/future',source:'Ensaio',t:now+3600000},
   {title:'Notícia sem data de teste sobre inadimplência',link:'https://example.test/undated',source:'Ensaio'},
 ]}};
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
 await p.route('**/*',r=>{const url=new URL(r.request().url());if(url.origin!==new URL(base).origin)return r.fulfill({status:503,body:'offline'});const file=path.basename(url.pathname);if(!url.pathname.startsWith('/src/') && /\.json$/.test(file)){
   if(file==='calendar.json')return r.fulfill({status:503,body:'offline'});
   if(file==='inadimplencia.json')return r.fulfill({path:path.join(__dirname,'../public/inadimplencia.json')});
   if(file==='news.json')return r.fulfill({json:newsFixture});
   return r.fulfill({json:{generatedAt:now}});
 }return r.continue()});
 await p.goto(base+'/');await p.locator('.expandable-panel[open]').first().waitFor();assert.equal(await p.locator('.expandable-panel:modal').count(),0,'painel de mercado está no modo normal');
 await p.locator('.expandable-controls button').first().click();await p.locator('.expandable-panel:modal').waitFor();await p.keyboard.press('Control+Shift+F');assert.equal(await p.locator('.global-search-dialog[open]').count(),0,'preserva modal nativo ampliado');await p.keyboard.press('Escape');await p.locator('.expandable-panel:modal').waitFor({state:'hidden'});
 await p.evaluate(()=>{const modal=document.createElement('div');modal.id='qa-protected-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');document.body.append(modal)});await p.keyboard.press('Control+Shift+F');assert.equal(await p.locator('.global-search-dialog[open]').count(),0,'não abre sobre outro diálogo');await p.locator('#qa-protected-modal').evaluate(el=>el.remove());
 const trigger={click:()=>p.keyboard.press('Control+Shift+F')};assert.equal(await p.locator('.global-search-trigger').count(),0);await trigger.click();await p.getByRole('dialog',{name:'Buscar no painel'}).waitFor();await p.getByRole('button',{name:'Fechar busca',exact:true}).click();await p.getByRole('dialog',{name:'Buscar no painel'}).waitFor({state:'hidden'});await trigger.click();
 const dialog=p.getByRole('dialog',{name:'Buscar no painel'}), input=dialog.getByRole('searchbox');await dialog.waitFor();await input.fill('INADIMPLENCIA');
 await dialog.locator('.global-search-results[aria-busy="false"]').waitFor({state:'attached'});
 assert.equal(await dialog.getByRole('region',{name:'Resultados em Configurações'}).count(),0);
 const learn=dialog.getByRole('region',{name:'Resultados em Aprender'}); // sections with labels have region semantics
 for(const name of ['FIDC','CRI','Custo de funding'])assert.ok(await learn.getByRole('button').filter({hasText:name}).count()>0,name);
 const news=dialog.getByRole('region',{name:'Resultados em Notícias'});
 const headlineTitle=news.locator('.global-search-result > strong').filter({hasText:new RegExp(`^${headline}$`)});
 await headlineTitle.waitFor();
 assert.equal(await headlineTitle.count(),1,'a busca inclui uma manchete com o título exato publicado dentro das 120 horas');
 for(const title of newsFixture.news.USD.slice(1).map(item=>item.title))assert.equal(await dialog.getByText(title,{exact:true}).count(),0,`${title}: publicação inválida não aparece pela data de geração do arquivo`);
 await dialog.screenshot({path:path.join(output,`search-dialog-${width}.png`)});assert.ok(await dialog.locator('mark').count()>0);
 await dialog.locator('.search-coverage summary').click();assert.match(await dialog.locator('.search-coverage').innerText(),/Calendário econômico/);
 for(let i=0;i<12;i++)await p.keyboard.press('Tab');assert.ok(await p.evaluate(()=>document.querySelector('.global-search-dialog').contains(document.activeElement)));
 await input.fill('inadimplência');await learn.getByRole('button',{name:/^FIDC/}).first().click();await p.locator('.learn-card').waitFor();assert.match(p.url(),/#aprender\/fidc$/);assert.match(await p.locator('.learn-card').innerText(),/FIDC/);assert.ok(await p.locator('.search-destination mark').count()>0);
 await trigger.click();for(const term of ['Configurações','Acessos agregados ao app','Base de dados','Novidades']){await input.fill(term);await dialog.locator('.global-search-results[aria-busy="false"]').waitFor({state:'attached'});assert.equal(await dialog.getByRole('region',{name:'Resultados em Configurações'}).count(),0);assert.equal(await dialog.locator('.global-search-result').filter({hasText:/Abrir em Configurações/}).count(),0)}await input.fill('FEE ESTRUTURACAO');await dialog.getByRole('button',{name:/^Fee de estruturação/}).first().click();assert.match(p.url(),/#aprender\/fee-de-estruturacao$/);const fee=p.locator('.learn-card');await fee.waitFor();await openCallouts(p);assert.match(await fee.innerText(),/9\.900\.000/);assert.match(await fee.innerText(),/Hipotético/i);await fee.getByText('Fontes',{exact:true}).click();assert.equal(await fee.locator('a[href^="https://"]').count(),2);
 // Closing search never remounts the current calculator or changes its values.
 await p.goto(base+'/#calculadora/giro');const field=p.locator('.cx input').first();await field.fill('123456');await field.blur();const saved=await field.inputValue();await trigger.click();await input.fill('zzq-inexistente');await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await field.inputValue(),saved);assert.match(p.url(),/#calculadora\/giro$/);
 assert.ok(!requests.some(u=>new URL(u).search.includes('INADIMPLENCIA') || new URL(u).search.includes('zzq-inexistente')),'queries stay local');
 await p.goto(base+'/#cenarios/inadimplencia');await p.locator('.credit-card').first().waitFor();await p.locator('.credit-controls select').nth(1).selectOption('12');await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const svg=p.locator('.credit-panel .ml-svg');await svg.scrollIntoViewIfNeeded();const b=await svg.boundingBox();
 await p.mouse.move(b.x+b.width*.25,b.y+b.height*.5);await p.mouse.down();await p.mouse.move(b.x+b.width*.8,b.y+b.height*.5,{steps:14});await p.mouse.up();
 const summary=p.locator('.credit-panel .comparison-readout');await summary.waitFor();assert.equal(await summary.locator('.comparison-row').count(),2);assert.doesNotMatch(await summary.innerText(),/Indisponível/);
 await svg.focus();await p.keyboard.press('Escape');assert.equal(await summary.count(),0);await p.keyboard.press('Shift+End');await summary.waitFor();assert.match(await summary.innerText(),/Ano anterior/);
 await p.screenshot({path:path.join(output,`search-and-credit-${width}.png`),fullPage:true});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 await context.close();console.log('PASS busca global e seleção PF/PJ '+width);
} }finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
