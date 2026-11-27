// Largura das calculadoras (pedido de 27/11/2026): em monitor grande o conteúdo fica em 1366 px, centralizado; o cabeçalho
// e a faixa de cotações seguem na largura toda. Em notebook (1280/1366) e no celular nada muda. Gera capturas para conferência.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.CALC_LARGURA_QA_OUTPUT || 'calc-largura-qa'

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  try {
    for (const [width, height] of [[2560, 1080], [1920, 1080], [1366, 768], [1280, 800], [390, 844]]) {
      const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce' })
      const page = await ctx.newPage()
      for (const [rota, nome] of [['cambio-futuro', 'cambio-futuro'], ['', 'lista']]) {
        await page.goto(`${base}/#calculadora${rota ? '/' + rota : ''}`)
        await page.locator(rota ? '#cf-f-title' : '.calc-catalog').first().waitFor()
        await page.evaluate(() => document.fonts.ready)
        const g = await page.evaluate(() => {
          const main = document.querySelector('main.app.app-calculators').getBoundingClientRect()
          const head = document.querySelector('.panel-header').getBoundingClientRect()
          return { viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, main: main.width, left: main.x, head: head.width }
        })
        const label = `${nome} ${width}px`
        const expected = Math.min(g.viewport, 1366)
        assert.ok(Math.abs(g.main - expected) <= 2, `${label}: largura do conteúdo ${JSON.stringify(g)}`)
        assert.ok(Math.abs(g.left - (g.viewport - g.main) / 2) <= 1, `${label}: conteúdo centralizado ${JSON.stringify(g)}`)
        assert.ok(Math.abs(g.head - g.viewport) <= 2, `${label}: cabeçalho e cotações na largura toda ${JSON.stringify(g)}`)
        assert.ok(g.scroll <= g.viewport + 1, `${label}: sem rolagem lateral ${JSON.stringify(g)}`)
        await page.screenshot({ path: path.join(out, `${nome}-${width}.png`) })
        console.log(label, JSON.stringify(g))
      }
      await ctx.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
