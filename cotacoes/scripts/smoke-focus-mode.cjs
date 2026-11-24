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
      const fitaVisivel = await page.locator('.tape').isVisible()
      assert.equal(fitaVisivel, width >= 700, 'respeita a disposição normal das cotações para cada largura')
      assert.equal(await page.evaluate(() => document.fullscreenEnabled), true)
      await toggle.click()
      await page.waitForFunction(() => document.fullscreenElement === document.documentElement)

      const exit = page.getByRole('button', { name: 'Sair da tela cheia', exact: true })
      await exit.waitFor()
      assert.equal(await originalButton.getAttribute('aria-pressed'), 'true')
      assert.equal(await nav.isVisible(), true, 'menu deve continuar no topo')
      assert.equal(await page.locator('.tape').isVisible(), fitaVisivel, 'tela cheia não muda a disposição das cotações')
      assert.equal(await page.locator('.calc-catalog').isVisible(), true)
      assert.equal(page.url(), originalPage)
      const navTop = await nav.boundingBox()
      const rect = await exit.boundingBox()
      assert.ok(navTop && navTop.y < 180 && rect && rect.y < 180, 'menu e ícone continuam no topo')
      await nav.getByRole('button', { name: 'Cenários' }).click()
      await page.waitForURL('**/#cenarios')
      assert.equal(await page.evaluate(() => document.fullscreenElement === document.documentElement), true)
      await nav.getByRole('button', { name: 'Calculadoras' }).click()
      await page.waitForURL('**/#calculadora')

      await exit.click()
      await page.waitForFunction(() => !document.fullscreenElement)
      await toggle.waitFor()
      assert.equal(await originalButton.getAttribute('aria-pressed'), 'false')
      assert.equal(await nav.isVisible(), true)
      assert.equal(page.url(), originalPage)

      await toggle.click()
      await page.waitForFunction(() => document.fullscreenElement === document.documentElement)
      await page.evaluate(() => document.exitFullscreen())
      await toggle.waitFor()
      assert.equal(await originalButton.getAttribute('aria-pressed'), 'false', 'saída pelo navegador ressincroniza o botão')
      await page.close()
      console.log(`OK ${width}px: tela cheia nativa, menus visíveis, retorno pelo ícone e sincronização ao sair`)
    }
  } finally { await browser.close() }
})().catch((error) => { console.error(error); process.exitCode = 1 })
