const { chromium } = require('playwright')
const assert = require('node:assert/strict')

async function conferir() {
  const base = process.env.SMOKE_BASE_URL
  assert.ok(base, 'Informe a URL do painel')
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  try {
    for (const [width, nome] of [[390, 'celular'], [1440, 'desktop']]) {
      const page = await browser.newPage({ viewport: { width, height: 950 }, serviceWorkers: 'block' })
      if (new URL(base).hostname === '127.0.0.1') {
        const data = { generatedAt: Date.now(), series: { C03: { points: [['2026-11-06', 12]] } } }
        await page.route('**/moedas.json*', route => route.fulfill({ json: data }))
        await page.route('**/bndes.json*', route => route.fulfill({ json: data }))
        const date = '2026-11-06'
        await page.route('**/curves.json*', route => route.fulfill({ json: { generatedAt: Date.now(), br: { sourceDate: date, compare: [{ id: 'hoje', date }], curves: { [date]: [[252, 14], [504, 13], [1008, 12]] } } } }))
      }
      await page.goto(base.replace(/\/$/, '') + '/#calculadora', { waitUntil: 'domcontentloaded' })
      const entendi = page.getByRole('button', { name: 'Entendi', exact: true }).first()
      await entendi.click({ timeout: 8000 }).catch(() => {})
      await page.getByRole('button', { name: 'BNDES: abrir calculadora', exact: true }).click()
      const grafico = page.locator('.cx-finame .fp svg[aria-label^="Fluxo"]')
      await grafico.scrollIntoViewIfNeeded()
      const box = await grafico.boundingBox()
      const y = box.y + box.height * 0.6
      await page.mouse.move(box.x + box.width * 0.25, y)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * 0.65, y, { steps: 15 })
      await page.mouse.up()
      assert.match(await page.locator('.fp-tip-trecho').innerText(), /Parcelas:[\s\S]*Juros:[\s\S]*Principal:/)
      const ref = page.locator('.cx-finame > .rm:last-child')
      assert.match(await ref.innerText(), /DI x pré[\s\S]*48 meses/i)
      assert.ok(await ref.locator('svg').count(), 'curva desenhada')
      const link = page.locator('#fm-result .credit-email')
      const href = await link.getAttribute('href')
      assert.ok(href.length <= 2000)
      assert.equal(new URL(href).origin, 'https://outlook.office.com')
      if (process.env.FINAME_CAPTURAS) await page.screenshot({ path: '../docs/qa/bndes-finame-' + nome + '-fluxo.png', fullPage: true })
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin })
      const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()])
      await popup.close()
      const copiado = await page.evaluate(() => navigator.clipboard.readText())
      assert.match(copiado, /48 · \d{4}-\d{2}-\d{2}/)
      await page.close()
      console.log(nome, 'arrasto, curva e envelope conferidos')
    }
  } finally { await browser.close() }
}
conferir().catch(error => { console.error(error); process.exitCode = 1 })
