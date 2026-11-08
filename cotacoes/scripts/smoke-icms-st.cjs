const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
;(async () => {
 const browser = await chromium.launch(require('./smoke-launch.cjs')())
 const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
 const out = process.env.ICMS_QA_OUTPUT || 'icms-qa'; fs.mkdirSync(out, { recursive: true })
 const results = []
 try {
  for (const width of [320, 390, 820, 1280]) for (const theme of ['light', 'dark']) {
   const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' })
   await context.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort())
   await context.route('**/recado.json*', r => r.fulfill({ json: { ativo: false } }))
   const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message))
   await page.goto(base + '/#aprender/substituicao-tributaria')
   await page.getByRole('heading', { name: 'Substituição tributária do ICMS', exact: true }).waitFor()
   const lesson = page.locator('.icms-lesson'), scenes = lesson.locator('.icms-flow')
   assert.equal(await scenes.count(), 2)
   assert.equal(await lesson.getByRole('button', { name: /Reproduzir|Pausar|Próxima|Anterior|Reiniciar/ }).count(), 0)
   assert.equal(await lesson.locator('.icms-actor').count(), 8)
   assert.equal(await scenes.nth(0).locator('[data-payer="true"]').count(), 1)
   assert.equal(await scenes.nth(1).locator('[data-payer="true"]').count(), 3)
   assert.equal(await lesson.evaluate(el => el.getAnimations({ subtree: true }).length), 0)
   const contrast = await lesson.evaluate(root => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const ctx = canvas.getContext('2d')
    const rgb = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3) }
    const lum = color => color.map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 }).reduce((v, c, i) => v + c * [.2126, .7152, .0722][i], 0)
    return ['.icms-deck', '.icms-headline em', '.icms-flow figcaption', '.icms-actor-name > span', '.icms-actor-tax > strong', '.icms-takeaway p:last-child', '.icms-related button'].map(selector => {
     const el = root.querySelector(selector), parents = []; let parent = el
     while (parent) { parents.unshift(parent); parent = parent.parentElement }
     ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1, 1)
     for (const node of parents) { ctx.fillStyle = getComputedStyle(node).backgroundColor; ctx.fillRect(0, 0, 1, 1) }
     const bg = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3), fg = rgb(getComputedStyle(el).color)
     const a = lum(bg), b = lum(fg)
     return { selector, ratio: +( (Math.max(a, b) + .05) / (Math.min(a, b) + .05) ).toFixed(2) }
    })
   })
   for (const item of contrast) assert.ok(item.ratio >= 4.5, `contrast ${theme} ${item.selector}: ${item.ratio}`)
   for (let i = 0; i < 2; i++) {
    const scene = scenes.nth(i); await scene.scrollIntoViewIfNeeded()
    const geometry = await scene.evaluate(el => {
     const chain = el.querySelector('.icms-chain'), fisco = el.querySelector('.icms-fisco'), cb = chain.getBoundingClientRect(), fb = fisco.getBoundingClientRect()
     const vertical = getComputedStyle(chain).gridTemplateColumns.split(' ').length === 1
     const links = [...el.querySelectorAll('.icms-tax-link')].map(link => { const b = link.getBoundingClientRect(); return vertical ? Math.abs(b.right - cb.right) : Math.abs(b.bottom - fb.top) })
     return { vertical, links, railEnd: vertical ? Math.abs(cb.bottom + parseFloat(getComputedStyle(chain).marginBottom) - fb.top) : 0 }
    })
    assert.ok(geometry.links.every(d => d <= 2), JSON.stringify(geometry)); assert.ok(geometry.railEnd <= 2)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    await scene.screenshot({ style: '.term-head, .nav-top { visibility: hidden; }', path: path.join(out, `${width}-${theme}-${i ? 'rpa' : 'st'}.png`) })
   }
   await lesson.locator('.icms-hero').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(out, `${width}-${theme}-context.png`) })
   for (const [name, selector] of [['opening', '.icms-hero'], ['numbers', '.icms-example'], ['sp', '.icms-sp'], ['closing', '.icms-takeaway']]) await lesson.locator(selector).screenshot({ style: '.term-head, .nav-top { visibility: hidden; }', path: path.join(out, `${width}-${theme}-${name}.png`) })
   const stock = lesson.locator('.icms-legal-row').nth(1)
   for (const paragraph of await stock.locator('p, dt, dd').all()) {
    await paragraph.scrollIntoViewIfNeeded()
    const visible = await paragraph.evaluate(el => { const b = el.getBoundingClientRect(), hit = document.elementFromPoint(b.x + Math.min(16, b.width / 2), b.y + Math.min(12, b.height / 2)); return { clear: el.contains(hit), hit: hit?.className || hit?.tagName, box: { x: b.x, y: b.y, width: b.width, height: b.height } } })
    assert.ok(visible.clear, 'stock text covered: ' + JSON.stringify(visible))
   }
   await stock.locator('p').first().scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(out, `${width}-${theme}-stock-viewport.png`) })
   const clipped = await lesson.evaluate(root => [...root.querySelectorAll('p, h2, h3, h4, .icms-equations, .icms-regimes')].filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1).map(el => ({ tag: el.tagName, class: el.className, text: el.textContent.slice(0, 70), width: el.clientWidth, content: el.scrollWidth })))
   assert.deepEqual(clipped, [], 'no internally clipped text or sums')
   if (width < 620) assert.equal(await lesson.locator('.icms-regimes').evaluate(el => getComputedStyle(el).display), 'block')
   const sourceToggle = lesson.getByText('Fontes e base legal', { exact: true }); await sourceToggle.focus(); await sourceToggle.press('Enter')
   assert.equal(await lesson.locator('details[open] a').count(), 4)
   await sourceToggle.press('Enter')
   await page.getByRole('searchbox', { name: 'Buscar conceito', exact: true }).fill('substituição tributária'); assert.match(await page.locator('.learn-count').innerText(), /1 conceito encontrado/)
   await page.getByRole('button', { name: 'Limpar busca', exact: true }).click()
   const related = lesson.getByRole('button', { name: /Reforma Tributária do consumo/ }); await related.focus(); await related.press('Enter')
   await page.waitForURL(/#aprender\/reforma-tributaria$/); await page.goBack(); await page.waitForURL(/#aprender\/substituicao-tributaria$/)
   await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.reload(); await lesson.waitFor()
   await scenes.nth(0).scrollIntoViewIfNeeded(); await page.waitForFunction(() => document.querySelector('.icms-flow')?.dataset.motion === 'true')
   const timing = await scenes.nth(0).evaluate(el => el.getAnimations({ subtree: true }).map(a => ({ duration: a.effect.getComputedTiming().endTime, iterations: a.effect.getComputedTiming().iterations })))
   assert.ok(timing.length > 0, 'motion is running'); assert.ok(timing.every(a => a.duration <= 3000 && a.iterations === 1))
   await scenes.nth(0).screenshot({ style: '.term-head, .nav-top { visibility: hidden; }', path: path.join(out, `${width}-${theme}-motion.png`) })
   await page.waitForFunction(() => document.querySelector('.icms-flow').getAnimations({ subtree: true }).every(a => a.playState === 'finished'))
   await lesson.locator('.icms-takeaway').scrollIntoViewIfNeeded(); await scenes.nth(0).scrollIntoViewIfNeeded()
   assert.equal(await scenes.nth(0).evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length), 0)
   await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForFunction(() => [...document.querySelectorAll('.icms-flow')].every(el => el.dataset.motion === 'false' && el.getAnimations({ subtree: true }).length === 0)); assert.equal(await lesson.evaluate(el => el.getAnimations({ subtree: true }).length), 0)
   assert.equal(await scenes.nth(0).getAttribute('data-motion'), 'false')
   assert.deepEqual(errors, []); results.push({ width, theme, status: 'pass', completeScenes: 2, taxConnections: true, stockTextVisible: true, contrast, keyboard: true, history: true, noPlayer: true, onePassUnder3Seconds: true, reducedMotion: true, overflow: false, errors })
   console.log(`PASS ICMS editorial ${width} ${theme}`); await context.close()
  }
 } catch (error) { fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack }, null, 2)); throw error } finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ results }, null, 2)); await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
