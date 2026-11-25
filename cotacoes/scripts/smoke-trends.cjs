const { chromium } = require('playwright')
const fs = require('node:fs')
const assert = require('node:assert/strict')

;(async () => {
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5279'
  const out = process.env.TRENDS_QA_OUTPUT || 'workspace-qa/trends'
  const labels = ['Moedas', 'Manchetes', 'Imposto', 'Split payment', 'Reforma tributária', 'Escala 6x1']
  fs.mkdirSync(out, { recursive: true })
  try {
    for (const width of [390, 1280, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1100 }, serviceWorkers: 'block' })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const origin = new URL(base).origin
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
      await page.goto(base + '/#resumo')
      const noticias = page.locator('.market-terminal .terminal-news')
      await noticias.getByRole('tab', { name: 'Moedas', exact: true }).waitFor()
      assert.deepEqual((await noticias.getByRole('tab').allTextContents()).map(label => label.trim()), labels)
      for (const label of labels) {
        const tab = noticias.getByRole('tab', { name: label, exact: true })
        await tab.click()
        assert.equal(await tab.getAttribute('aria-selected'), 'true')
        assert.equal(await noticias.locator('.google-trends').count(), 0)
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      assert.deepEqual(errors, [])
      await noticias.screenshot({ path: `${out}/${width}-mercado-sem-trends.png` })
      await page.close()
      console.log(`Mercado ${width}px: seis abas operacionais, sem Google Trends ou overflow`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
