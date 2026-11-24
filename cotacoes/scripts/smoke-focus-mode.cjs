const assert = require('node:assert/strict')
const path = require('node:path')
const { chromium } = require('playwright')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8787/'

;(async () => {
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  try {
    for (const width of [320, 390, 820, 1000, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 840 }, serviceWorkers: 'block' })
      if (process.env.SMOKE_DIST_DIR) {
        const origin = new URL(base).origin
        const dist = path.resolve(process.env.SMOKE_DIST_DIR)
        await page.route(origin + '/**', async (route) => {
          const url = new URL(route.request().url())
          try { await route.fulfill({ path: path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname) }) }
          catch { await route.fulfill({ status: 404 }) }
        })
      }
      await page.goto(base + '#calculadora')
      await page.locator('.calc-catalog').waitFor()
      const notice = page.getByRole('dialog', { name: 'Aviso', exact: true })
      if (await notice.isVisible()) await notice.getByRole('button', { name: 'Entendi', exact: true }).click()

      const nav = page.locator(width >= 1000 ? '.topbar nav' : '.nav-top nav')
      const toggle = page.getByRole('button', { name: 'Ativar tela cheia', exact: true })
      assert.equal(await nav.isVisible(), true)
      await toggle.waitFor({ timeout: 3000 })
      const originalButton = await toggle.elementHandle()
      const originalPage = page.url()
      await toggle.click()

      const exit = page.getByRole('button', { name: 'Sair da tela cheia', exact: true })
      await exit.waitFor()
      assert.equal(await originalButton.getAttribute('aria-pressed'), 'true')
      assert.equal(await exit.getAttribute('aria-pressed'), 'true')
      assert.equal(await nav.isVisible(), false)
      assert.equal(await page.locator('.tape').isVisible(), false)
      assert.equal(await page.locator('.calc-catalog').isVisible(), true)

      await page.keyboard.press('Escape')
      await page.keyboard.press('Alt+1')
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      const rect = await exit.boundingBox()
      assert.ok(rect && rect.y >= 0 && rect.y + rect.height <= 840 && rect.x + rect.width <= width)
      assert.equal(page.url(), originalPage)
      assert.equal(await nav.isVisible(), false)

      await exit.click()
      assert.equal(await originalButton.getAttribute('aria-pressed'), 'false')
      assert.equal(await nav.isVisible(), true)
      assert.equal(page.url(), originalPage)
      await page.close()
      console.log(`OK ${width}px: entrada, navegação oculta, Esc não sai, saída pelo mesmo botão`)
    }
  } finally { await browser.close() }
})().catch((error) => { console.error(error); process.exitCode = 1 })
