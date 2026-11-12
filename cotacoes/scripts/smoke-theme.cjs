// Verify real rendered colors and live OS preference changes, using isolated browser contexts.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { buildSync } = require('esbuild')
const { widths, headerMatrix } = require('./smoke-calculator-matrix.cjs')

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.THEME_QA_OUTPUT || 'workspace-qa/theme'

// The current Mercado screen no longer mounts OilTile. Verify the existing widget
// component in an isolated test page, without restoring the retired product flow.
const widgetHarness = buildSync({
  stdin: {
    contents: `import {createElement} from 'react';
      import {createRoot} from 'react-dom/client';
      import OilLiveQuote from './OilLiveQuote.jsx';
      import {connectSystemTheme} from './systemTheme.js';
      connectSystemTheme();
      createRoot(document.getElementById('widget-root')).render(createElement(OilLiveQuote));`,
    resolveDir: path.resolve(__dirname, '../src'),
    loader: 'js',
  },
  bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }, minify: true,
}).outputFiles[0].text
const widgetPage = '<!doctype html><html><head><meta name="theme-color" content="#050505"></head><body><div id="widget-root"></div><script src="./__theme-widget-test.js"></script></body></html>'
const widgetUrl = new URL('__theme-widget-test.html', `${base.replace(/\/$/, '')}/`).href

async function colors(page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const resolve = value => {
      const sample = document.createElement('span'); sample.style.color = value
      document.body.append(sample); const result = getComputedStyle(sample).color; sample.remove(); return result
    }
    const l = color => {
      const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4)
      return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]
    }
    const contrast = (a, b) => (Math.max(l(a), l(b)) + .05) / (Math.min(l(a), l(b)) + .05)
    const card = resolve('var(--card)'), bg = getComputedStyle(document.body).backgroundColor
    const tokens = Object.fromEntries(['--fg', '--mut', '--amber', '--up', '--down', '--currency-usd', '--currency-eur', '--currency-jpy', '--currency-cnh', '--currency-par'].map(key => {
      const color = resolve(`var(${key})`)
      return [key, { color, ratio: contrast(color, card) }]
    }))
    const selected = [...document.querySelectorAll('.cx .seg button[aria-pressed=true]')].map(button => {
      const style = getComputedStyle(button)
      return { text: button.textContent.trim(), color: style.color, background: style.backgroundColor, ratio: contrast(style.color, style.backgroundColor) }
    })
    const sectionTabs = [...document.querySelectorAll('.cen-nav button, .seg.bn-fam button')].filter(button => button.getClientRects().length).map(button => {
      let node = button, background
      while (node) {
        background = getComputedStyle(node).backgroundColor
        if (background !== 'transparent' && background !== 'rgba(0, 0, 0, 0)') break
        node = node.parentElement
      }
      const color = getComputedStyle(button).color
      return { text: button.textContent.trim(), color, background, ratio: contrast(color, background) }
    })
    const renderedSeries = [...document.querySelectorAll('.plot .line')].map(line => ({ color:getComputedStyle(line).stroke, ratio:contrast(getComputedStyle(line).stroke, card) }))
    const refreshLayout = [...document.querySelectorAll('.refresh-wrap')].filter(wrap => wrap.getClientRects().length).map(wrap => {
      const stamp = wrap.querySelector('.refresh-stamp'), button = wrap.querySelector('.refresh-btn')
      if (!stamp || !button) return null
      const box = stamp.getBoundingClientRect(), action = button.getBoundingClientRect(), container = wrap.getBoundingClientRect()
      // The text itself can spill outside a correctly sized grid cell.
      const textRects = [...stamp.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()).flatMap(node => {
        const range = document.createRange(); range.selectNodeContents(node)
        return [...range.getClientRects()]
      })
      return {
        label:button.getAttribute('aria-label'), width:action.width, height:action.height,
        textOutside:textRects.some(text => text.left < box.left - 1 || text.right > box.right + 1 || text.left < container.left - 1 || text.right > container.right + 1),
        textOverButton:textRects.some(text => Math.min(text.right, action.right) - Math.max(text.left, action.left) > 1 && Math.min(text.bottom, action.bottom) - Math.max(text.top, action.top) > 1),
      }
    }).filter(Boolean)
    return { theme:document.documentElement.dataset.theme, scheme:root.colorScheme, bg, tokens, selected, sectionTabs, renderedSeries, refreshLayout,
      horizontal:document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }
  })
}

async function assertTheme(page, theme, label) {
  await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme)
  const result = await colors(page)
  assert.equal(result.scheme, theme, `${label}: native controls follow system`)
  assert.equal(result.horizontal, false, `${label}: no document overflow`)
  for (const key of ['--fg', '--mut', '--amber']) assert.ok(result.tokens[key].ratio >= 4.5, `${label}: ${key} text contrast ${result.tokens[key].ratio}`)
  for (const key of ['--up', '--down', '--currency-usd', '--currency-eur', '--currency-jpy', '--currency-cnh', '--currency-par']) assert.ok(result.tokens[key].ratio >= 3, `${label}: ${key} data contrast ${result.tokens[key].ratio}`)
  for (const selected of result.selected) assert.ok(selected.ratio >= 4.5, `${label}: selection ${selected.text} contrast ${selected.ratio}`)
  for (const tab of result.sectionTabs) assert.ok(tab.ratio >= 4.5, `${label}: tab ${tab.text} contrast ${tab.ratio}`)
  for (const series of result.renderedSeries) assert.ok(series.ratio >= 3, `${label}: graph line contrast ${series.ratio}`)
  for (const refresh of result.refreshLayout) {
    assert.equal(refresh.textOutside, false, `${label}: timestamp stays inside its cell (${refresh.label})`)
    assert.equal(refresh.textOverButton, false, `${label}: timestamp does not overlap refresh (${refresh.label})`)
    assert.ok(refresh.width >= 44 && refresh.height >= 44, `${label}: refresh keeps 44px target (${refresh.label})`)
  }
  return result
}

async function assertSectorHeader(page, initial) {
  const header = page.locator('main.app .top:has(.theme-mobile)')
  await header.locator('.laser-btn').waitFor()
  await page.evaluate(() => document.fonts.ready)
  const geometry = await header.evaluate(element => {
    const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, height: r.height } }
    const title = element.querySelector('h1')
    return { viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth,
      title: { ...box(title), text: title.textContent.trim(), nowrap: getComputedStyle(title).whiteSpace === 'nowrap', clipped: title.scrollWidth > title.clientWidth + 1 },
      controls: [...element.querySelectorAll('.avisos-btn, .laser-btn, .theme-trigger')].filter(node => node.getClientRects().length).map(node => ({ label: node.getAttribute('aria-label'), ...box(node) })) }
  })
  assert.equal(geometry.title.text, 'Central de setores')
  assert.equal(geometry.title.nowrap, false, 'Setores320: title can wrap')
  assert.equal(geometry.title.clipped, false, 'Setores320: full title is visible')
  assert.ok(geometry.document <= geometry.viewport + 1, 'Setores320: no horizontal document overflow')
  assert.equal(geometry.controls.length, 3, 'Setores320: all three controls are visible')
  for (const control of geometry.controls) {
    assert.ok(control.width >= 43.9 && control.height >= 43.9, `${control.label}: 44px target`)
    assert.ok(control.left >= -1 && control.right <= geometry.viewport + 1, `${control.label}: inside viewport`)
    assert.ok(control.left >= geometry.title.right - 1, `${control.label}: no title overlap`)
  }
  await page.screenshot({ path: path.join(out, `setores-${initial}-320-header.png`), fullPage: true })
  const control = header.locator('.theme-control'), trigger = control.locator('.theme-trigger')
  await trigger.click()
  const menu = control.getByRole('group', { name: 'Aparência do painel' })
  await menu.waitFor()
  const menuBox = await menu.boundingBox()
  assert.ok(menuBox.x >= -1 && menuBox.x + menuBox.width <= geometry.viewport + 1, 'theme menu fits Setores320')
  for (const option of await menu.getByRole('button').all()) {
    const rect = await option.boundingBox()
    assert.ok(rect.width >= 43.9 && rect.height >= 43.9, 'theme options retain 44px targets')
  }
  await page.keyboard.press('Escape')
  assert.equal(await trigger.evaluate(node => node === document.activeElement), true, 'Escape restores theme trigger focus')
  await trigger.click()
  const other = initial === 'dark' ? 'light' : 'dark'
  await control.getByRole('button', { name: other === 'light' ? 'Claro' : 'Escuro', exact: true }).click()
  await assertTheme(page, other, `Setores320 manual ${other}`)
  assert.equal(await trigger.evaluate(node => node === document.activeElement), true, 'manual choice restores focus')
  await page.screenshot({ path: path.join(out, `setores-${initial}-320-manual.png`), fullPage: true })
  await trigger.click()
  await control.getByRole('button', { name: /Automático/ }).click()
  await assertTheme(page, initial, 'Setores320 automatic restored')
  return { route: 'setores', width: 320, theme: initial, status: 'pass', geometry }
}

;(async () => {
  fs.mkdirSync(out, { recursive:true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')()), report = [], diagnostics = [], headerScenarios = []
  let currentPage
  try {
    for (const width of widths) for (const initial of ['dark', 'light']) {
      const context = await browser.newContext({ viewport:{width,height:1000}, colorScheme:initial, reducedMotion:'reduce', serviceWorkers:'block' })
      const now = Date.now(), date = new Date(now).toISOString().slice(0, 10), points = [[now - 864e5 * 3, 12], [now - 864e5, 12.2]]
      const quotes = Object.fromEntries(['USDBRL', 'EURBRL', 'JPYBRL', 'USDCNH'].map(code => [code, { code:code.slice(0, 3), codein:code.slice(3), bid:code === 'JPYBRL' ? '.035' : '5', ask:code === 'JPYBRL' ? '.0351' : '5.01', high:code === 'JPYBRL' ? '.036' : '5.1', low:code === 'JPYBRL' ? '.034' : '4.9', pctChange:'1', varBid:'.01', timestamp:String(Math.floor(now / 1000)) }]))
      const curve = { compare:[{id:'hoje',date,label:'Hoje'}], curves:{[date]:[[21,12],[252,13],[504,13.2]]} }
      const fixtures = {
        'quotes.json':{generatedAt:now,quotes},
        'macro.json':{generatedAt:now,cdi:points,selic:points,sofr:points,sofrAvg:[],focus:null,ptax:{},ptaxHist:{}},
        'curves.json':{generatedAt:now,br:curve,cc:curve,us:{...curve,curves:{[date]:[[1,4.1,'1a'],[2,4.2,'2a'],[10,4.4,'10a']]}}},
        'oil.json':{generatedAt:now,benchmark:'Brent',kind:'spot',unit:'USD/barril',points:[{date,value:70}],sourceName:'Fixture de teste'},
        'news.json':{generatedAt:now,news:{}},
      }
      await context.route('**/*', route => {
        const url = new URL(route.request().url()), name = url.pathname.split('/').pop()
        if (name === '__theme-widget-test.html') return route.fulfill({contentType:'text/html',body:widgetPage})
        if (name === '__theme-widget-test.js') return route.fulfill({contentType:'text/javascript',body:widgetHarness})
        if (fixtures[name]) return route.fulfill({json:fixtures[name]})
        if (url.hostname === 'economia.awesomeapi.com.br') return route.fulfill({json:quotes})
        if (url.hostname === 'widgets.tradingview-widget.com') return route.fulfill({contentType:'text/javascript',body:''})
        // Conteúdo externo simulado; o teste de tema cobre o painel e seu arquivo local.
        if (url.origin === 'https://trends.google.com' && url.pathname === '/trends/embed/explore/TIMESERIES') return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html lang="pt-BR"><body><p>Gráfico simulado somente para teste de integração.</p></body></html>'})
        return url.origin === new URL(base).origin ? route.continue() : route.abort()
      })
      const page = await context.newPage(), errors = []
      currentPage = page
      page.on('pageerror', error => {
        errors.push(error.message)
        diagnostics.push({kind:'pageerror',width,initial,message:error.message})
        console.error(`Theme ${initial} ${width}: ${error.message}`)
      })
      page.on('console', message => {
        if (message.type() !== 'error' || !page.url().includes('__theme-widget-test.html')) return
        diagnostics.push({kind:'console',width,initial,message:message.text()})
        console.error(`Widget ${initial} ${width}: ${message.text()}`)
      })
      for (const [route, selector] of [['resumo','.terminal-desk'],['calculadora/giro','.cx #cx-value'],['aprender','.learn'],['juros','.executive-rates__table tbody tr'],['cenarios/commodities','.cen-nav button'], ...(width === 320 ? [['setores','main.app .top h1']] : [])]) {
        await page.goto(`${base}/#${route}`); await page.locator(selector).first().waitFor()
        const label = `${initial}-${width}-${route.replace('/', '-')}`
        report.push({ label, ...await assertTheme(page, initial, label) })
        if (route === 'setores') headerScenarios.push(await assertSectorHeader(page, initial))
        if (route === 'calculadora/giro') {
          await page.locator('#cx-value').fill('250.000,00')
          const before = await page.locator('.cx-matrix').innerText()
          const other = initial === 'dark' ? 'light' : 'dark'
          await page.emulateMedia({colorScheme:other})
          report.push({ label:`${label}-live`, ...await assertTheme(page, other, `${label} live`) })
          assert.equal(await page.locator('#cx-value').inputValue(), '250.000,00', 'live switch keeps input')
          assert.equal(await page.locator('.cx-matrix').innerText(), before, 'live switch keeps financial results')
          await page.emulateMedia({colorScheme:initial})
          await assertTheme(page, initial, label)
          const help = page.getByRole('button', {name:/^Ajuda:/}).first()
          await help.focus()
          await help.hover()
          const previewId = await help.getAttribute('aria-describedby')
          assert.ok(previewId, 'hovered help identifies its own preview')
          await page.locator(`[role="tooltip"][id="${previewId}"]`).waitFor()
        }
        await page.screenshot({path:path.join(out, `${label}.png`), fullPage:true})
        if (route === 'calculadora/giro') await page.keyboard.press('Escape')
        if (route === 'resumo') {
          await page.getByRole('tab', {name:'Google Trends',exact:true}).click()
          await page.locator('.google-trends').waitFor()
          await page.locator('.google-trends iframe.trends-live-chart').waitFor()
          await page.locator('.google-trends .trends-archive > summary').click()
          await page.getByRole('img', {name:/Interesse em capital de giro/}).waitFor()
          await assertTheme(page, initial, `${label} trends`)
          await page.screenshot({path:path.join(out, `${initial}-${width}-trends.png`),fullPage:true})
        }
      }
      await page.goto(widgetUrl)
      const widget = page.locator('.oil-live-quote tv-single-ticker')
      await widget.waitFor({state:'attached'})
      assert.equal(await widget.getAttribute('theme'), initial)
      assert.equal(await widget.getAttribute('symbol'), 'TVC:UKOIL')
      const other = initial === 'dark' ? 'light' : 'dark'
      await page.emulateMedia({colorScheme:other})
      await page.waitForFunction(expected => document.querySelector('tv-single-ticker')?.getAttribute('theme') === expected, other)
      assert.equal(await widget.count(), 1, 'live switch replaces the widget without duplicates')
      assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), other === 'light' ? '#f5f4f0' : '#050505')
      assert.deepEqual(errors, [], `${initial} ${width}: browser errors`)
      await context.close()
    }
    const result = {passed:true, checks:['initial dark/light','320/390/768/1024/1440px', 'Setores320 title and three 44px controls', 'manual theme and Escape focus','rendered contrast','selected controls','live preference change','input and result preservation','isolated widget component live theme','browser chrome'], expectedHeaders: headerMatrix, headerScenarios, report}
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify({passed:true,checks:result.checks,scenarios:report.length,report:path.join(out, 'report.json')}))
  } catch (error) {
    await currentPage?.screenshot({path:path.join(out, 'failure.png'),fullPage:true}).catch(() => {})
    fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({message:error.message,diagnostics,expectedHeaders:headerMatrix,headerScenarios,report}, null, 2))
    throw error
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
