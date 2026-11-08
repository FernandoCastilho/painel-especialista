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
  for (const width of [390, 820, 1280]) for (const theme of ['light', 'dark']) {
   const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' })
   await context.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort())
   await context.route('**/recado.json*', r => r.fulfill({ json: { ativo: false } }))
   const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message))
   await page.goto(base + '/#aprender/substituicao-tributaria')
   await page.getByRole('heading', { name: 'Substituição tributária do ICMS', exact: true }).waitFor()
   const lesson = page.locator('.icms-lesson'), stage = page.locator('.icms-stage')
   assert.equal(await stage.getAttribute('data-playing'), 'false'); assert.equal(await lesson.getByRole('button', { name: 'Reproduzir', exact: true }).count(), 0)
   for (const mode of ['Com ST · antecipação', 'Sem ST · exemplo no RPA']) {
    await lesson.getByRole('button', { name: mode, exact: true }).click()
    assert.equal(await lesson.locator('.icms-node').count(), 4)
    for (let step = 0; step < 4; step++) {
     assert.equal(await stage.getAttribute('data-step'), String(step))
     assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
     if (step < 3) await lesson.getByRole('button', { name: 'Próxima etapa', exact: true }).click()
    }
    await stage.screenshot({ style: '.nav-top nav.tabs { visibility: hidden; }', path: path.join(out, `${width}-${theme}-${mode.startsWith('Com') ? 'st' : 'normal'}.png`) })
    const reset = lesson.getByRole('button', { name: 'Reiniciar', exact: true }); await reset.scrollIntoViewIfNeeded(); assert.ok(await reset.evaluate(el => { const b = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)) })); await reset.focus(); await reset.press('Enter')
    assert.equal(await stage.getAttribute('data-step'), '0')
   }
   await lesson.locator('.icms-transcript summary').click(); assert.equal(await lesson.locator('.icms-transcript li').count(), 8)
   await lesson.locator('.icms-transcript summary').press('Enter')
   await lesson.locator('.icms-sp').screenshot({ style: '.nav-top nav.tabs { visibility: hidden; }', path: path.join(out, `${width}-${theme}-sp.png`) })
   await page.getByRole('searchbox', { name: 'Buscar conceito', exact: true }).fill('substituição tributária')
   assert.match(await page.locator('.learn-count').innerText(), /1 conceito encontrado/)
   await page.getByRole('button', { name: 'Limpar busca', exact: true }).click()
   await page.locator('.learn-conecta').getByRole('button').filter({ hasText: 'Reforma Tributária' }).click()
   await page.waitForURL(/#aprender\/reforma-tributaria$/); await page.goBack(); await page.waitForURL(/#aprender\/substituicao-tributaria$/)
   await page.reload(); await stage.waitFor(); assert.equal(await stage.getAttribute('data-step'), '0')
   await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.locator('.icms-stage[data-reduced="false"]').waitFor()
   await lesson.getByRole('button', { name: 'Reproduzir', exact: true }).click()
   assert.equal(await stage.getAttribute('data-playing'), 'true')
   assert.ok(await lesson.evaluate(el => el.getAnimations({ subtree: true }).length > 0))
   await lesson.getByRole('button', { name: 'Pausar', exact: true }).click()
   assert.equal(await stage.getAttribute('data-playing'), 'false')
   await page.clock.install(); await lesson.getByRole('button', { name: 'Reproduzir', exact: true }).click()
   for (let step = 1; step <= 3; step++) { await page.clock.fastForward(8100); assert.equal(await stage.getAttribute('data-step'), String(step)) }
   await page.clock.fastForward(8100); assert.equal(await stage.getAttribute('data-playing'), 'false')
   await lesson.getByRole('button', { name: 'Reproduzir novamente', exact: true }).click(); assert.equal(await stage.getAttribute('data-step'), '0')
   await page.emulateMedia({ reducedMotion: 'reduce' }); await page.locator('.icms-stage[data-reduced="true"][data-playing="false"]').waitFor(); assert.equal(await stage.getAttribute('data-playing'), 'false')
   assert.equal(await lesson.evaluate(el => el.getAnimations({ subtree: true }).length), 0)
   assert.deepEqual(errors, []); results.push({ width, theme, status: 'pass', manualSteps: 8, keyboard: true, history: true, reload: true, motion: true, reducedMotion: true, autoStop: true, overflow: false, errors })
   console.log(`PASS ICMS ${width} ${theme}`); await context.close()
  }
 } finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ results }, null, 2)); await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
