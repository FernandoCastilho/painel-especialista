// Real study content, isolated news fixtures; no external submissions.
const { chromium } = require('playwright')
const assert = require('node:assert/strict'), fs = require('node:fs')
const studies = require('../src/sectorStudies/studies.json')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.SECTOR_GRAPH_QA_OUTPUT || 'workspace-qa/sector-graph'
let activePage
const progress=[]
;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  try {
    for (const width of [320, 390, 1280]) for (const theme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: {width,height:1000}, colorScheme:theme, reducedMotion:'reduce', serviceWorkers:'block' })
      const errors=[]; const page=await ctx.newPage(); activePage=page; page.on('pageerror',e=>errors.push(e.message))
      await ctx.route('**/*', route=> {
        const url=new URL(route.request().url()), name=url.pathname.split('/').at(-1)
        if(url.origin!==new URL(base).origin) return route.abort()
        if(url.pathname.includes('/sector-studies/')) {
          const study=studies.find(s=>`${s.group}-${s.topicIndex}.json`===name)
          return route.fulfill({json:study || {}})
        }
        if(name.endsWith('.json')) return route.fulfill({json:name==='recado.json'?{ativo:false}:{generatedAt:Date.now()}})
        return route.continue()
      })
      progress.push(`${width}-${theme}: start`); await page.goto(`${base}/#setores/topico/transporte-logistica/1`)
      const notice=page.getByRole('dialog',{name:'Aviso',exact:true})
      if(await notice.isVisible()) await notice.getByRole('button',{name:'Entendi',exact:true}).click()
      const map=page.locator('.knowledge-map')
      await map.getByRole('heading',{name:'Conexões · Transporte de madeira',exact:true}).waitFor()
      assert.equal(await page.evaluate(()=>document.querySelector('.study-canvas-details').nextElementSibling.classList.contains('knowledge-map')),true)
      assert.ok(await map.locator('.km-node').count()>=3)
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
      await page.waitForFunction(()=>document.querySelector('.km-stage')?.dataset.cameraFitting !== 'true')
      await map.evaluate(el => el.scrollIntoView({block:'start'}))
      await page.screenshot({path:`${out}/${width}-${theme}.png`})
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false)
      // As opções do mapa começam recolhidas nos estudos; o grafo aparece sem menus.
      assert.equal(await map.locator('.km-controls').getAttribute('open'),null)
      assert.equal(await map.getByRole('button',{name:'Lista',exact:true}).isVisible(),false)
      await map.locator('.km-controls > summary').click()
      progress.push('list'); await map.getByRole('button',{name:'Lista',exact:true}).click()
      await map.locator('.km-list-item').filter({hasText:'Base florestal e madeira'}).click()
      await map.getByRole('button',{name:'Voltar ao setor',exact:true}).click()
      assert.ok(await map.locator('.km-list-item').count()>=3)
      progress.push('empty search'); await map.getByRole('searchbox',{name:'Buscar no mapa',exact:true}).fill('zzzsemresultado')
      // Selected anchor is intentionally retained; deselect first to test a true empty result.
      if(width<=600) await map.locator('.km-detail-toggle').click()
      await map.getByRole('button',{name:'Fechar detalhes',exact:true}).click()
      progress.push('empty search'); await map.getByRole('searchbox',{name:'Buscar no mapa',exact:true}).fill('zzzsemresultado')
      await map.getByText('Nenhum ponto encontrado. Ajuste a busca ou os filtros.').waitFor()
      await map.getByRole('button',{name:'Voltar ao setor',exact:true}).click()
      progress.push('fullscreen'); await map.getByRole('button',{name:'Tela cheia',exact:true}).click()
      await map.getByRole('button',{name:'Sair da tela cheia',exact:true}).waitFor()
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
      await page.keyboard.press('Escape')
      await page.waitForFunction(()=>!document.querySelector('.knowledge-map.is-fullscreen'))
      await map.locator('.km-list-item').filter({hasText:'Base florestal e madeira'}).click()
      if(width<=600) await map.locator('.km-detail-toggle').click()
      progress.push('open sector'); await map.getByRole('button',{name:'Abrir setor ↗',exact:true}).click()
      await page.waitForURL('**/#setores/pasta/base-florestal')
      await page.goBack()
      await map.getByRole('heading',{name:'Conexões · Transporte de madeira',exact:true}).waitFor()
      await page.goto(`${base}/#setores/topico/tic/0`)
      await map.getByRole('heading',{name:/Conexões ·/}).waitFor()
      assert.notEqual(await map.getByRole('heading',{level:2}).textContent(),'Conexões · Transporte de madeira')
      await page.goto(`${base}/#aprender/mapa`)
      await map.getByRole('heading',{name:'Mapa do conhecimento',exact:true}).waitFor()
      // no celular o mapa completo abre na Lista; o grafo continua a um toque
      if(width<700){ assert.equal(await map.getByRole('button',{name:'Lista',exact:true}).getAttribute('aria-pressed'),'true'); await map.getByRole('button',{name:'Grafo',exact:true}).click() }
      assert.ok(await map.locator('.km-node').count()>130)
      assert.deepEqual(errors,[])
      console.log(`PASS ${width} ${theme}: order, context, list, reset, empty, fullscreen, routing/back, TIC, Aprender isolation`)
      await ctx.close()
    }
  } catch(error) {
    fs.writeFileSync(`${out}/failure.json`,JSON.stringify({progress,error:String(error),stack:error.stack,url:activePage?.url()},null,2))
    await activePage?.screenshot({path:`${out}/failure.png`}).catch(()=>{})
    throw error
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exitCode=1})
