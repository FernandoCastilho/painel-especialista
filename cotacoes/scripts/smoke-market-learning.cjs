// Supplemental read-only QA. Uses the same local build/Chrome as the existing CI smoke job.
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const base = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768').replace(/\/$/, '')
const out = process.env.MARKET_LEARNING_QA_OUTPUT || path.join(process.env.SEARCH_QA_OUTPUT || 'workspace-qa', 'market-learning')
;(async () => {
 fs.mkdirSync(out, { recursive: true })
 const browser = await chromium.launch(require('./smoke-launch.cjs')())
 try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const now = Date.now()
  const items = Array.from({ length: 18 }, (_, i) => ({ title: `QA fictício ${i + 1}: mercado de moedas e atividade econômica`, link: `https://example.invalid/qa-market-${i}`, source: 'Fixture de teste', t: now - i * 60000 }))
  await page.route('**/*', route => {
   const url = new URL(route.request().url())
   if (url.pathname.endsWith('/temas.json')) return route.fulfill({ json: { generatedAt: now, temas: { 'moeda-usd': { label: 'Dólar', items } } } })
   return url.origin === new URL(base).origin ? route.continue() : route.abort()
  })
  await page.goto(base + '/#resumo')
  const panel = page.locator('.market-news-adaptive')
  await panel.waitFor()
  await panel.getByRole('link', { name: /QA fictício 18:/ }).waitFor()
  assert.equal(await panel.locator('a[href^="https://example.invalid/qa-market-"]').count(), 18)
  assert.equal(await panel.locator('.reforma-list').evaluate(el => getComputedStyle(el).maxHeight), 'none', 'one scroll owner for loaded news')
  const check = async label => {
   await page.waitForFunction(() => {
    const el = document.querySelector('.market-news-adaptive'), v = el.style.getPropertyValue('--market-news-height')
    const dialog = el.closest('dialog.is-dialog'), h = innerHeight, top = el.getBoundingClientRect().top
    const budget = Math.floor(Math.min(h, dialog ? dialog.getBoundingClientRect().bottom : h) - Math.max(0, top) - 24)
    return budget < 180 ? !v : Math.abs(parseFloat(v) - budget) <= 1
   })
   assert.equal(await panel.evaluate(el => getComputedStyle(el).minHeight), '0px')
   await page.screenshot({ path: path.join(out, label + '.png'), fullPage: true })
  }
  await check('normal')
  await page.getByRole('button', { name: 'Maximizar Mercado hoje', exact: true }).click()
  await check('maximized')
  await page.getByRole('dialog', { name: 'Mercado hoje', exact: true }).evaluate(el => { el.scrollTop = 100 })
  await check('dialog-scroll')
  await page.getByRole('button', { name: 'Restaurar Mercado hoje', exact: true }).click()
  await check('restored')
  await page.goto(base + '/#aprender/ambidestria-organizacional')
  await page.getByRole('heading', { name: 'Ambidestria organizacional', exact: true }).waitFor()
  assert.equal(await page.locator('a[href="https://www.gsb.stanford.edu/faculty-research/working-papers/organizational-ambidexterity-past-present-future"]').count(), 1)
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({ path: path.join(out, 'ambidestria-mobile.png'), fullPage: true })
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, checks: ['18 synthetic news items loaded', 'news viewport budget', 'maximize/restore', 'dialog scroll', 'ambidestria route/source/mobile'] }, null, 2))
 } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
