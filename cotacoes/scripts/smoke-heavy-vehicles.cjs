const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const NEWS_CLOCK = Date.parse('2026-11-05T15:00:00Z')
const sectorNewsFixture = now => {
  const stamp = new Date(now).toISOString()
  const item = (title, hoursAgo, slug) => ({ title, sourceId: 'mdic', type: 'comunicado', licenseUrl: 'https://creativecommons.org/licenses/by-nd/3.0/', link: `https://www.gov.br/mdic/pt-br/assuntos/noticias/qa-${slug}`, publishedAt: new Date(now - hoursAgo * 3600000).toISOString(), collectedAt: stamp })
  return {
    schemaVersion: 1, generatedAt: stamp, windowDays: 5,
    sourceStates: { mdic: { status: 'ok', checkedAt: stamp, lastSuccessAt: stamp, reason: 'Fixture sintética do teste; não é publicação real.' } },
    topics: { 'veiculos-pesados': { items: [item('QA: notícia fictícia de emplacamento de caminhões', 1, 'caminhoes-atual'), item('QA: notícia expirada de emplacamento de caminhões', 121, 'caminhoes-expirada')] } },
  }
}
;(async () => {
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5220', out = process.env.SEARCH_QA_OUTPUT || '../qa-heavy'
  fs.mkdirSync(out, { recursive: true })
  try {
    for (const width of [390, 820, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: true, serviceWorkers: 'block' }), errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.clock.setFixedTime(NEWS_CLOCK)
      let mode = 'ok'
      await page.route('**/heavy-vehicles.json*', route => mode === 'error' ? route.fulfill({ status: 503, body: 'unavailable' }) : route.fulfill({ path: path.join(__dirname, '../public/heavy-vehicles.json') }))
      await page.route('**/sector-news.json*', route => route.fulfill({ json: sectorNewsFixture(NEWS_CLOCK) }))
      await page.goto(base + '/#setores/veiculos-pesados')
      const panel = page.getByRole('region', { name: 'Indicadores de veículos pesados' })
      await panel.waitFor(); await panel.locator('article').first().waitFor()
      assert.equal(await panel.locator('article').count(), 6)
      assert.match(await panel.innerText(), /setembro de 2026/)
      assert.match(await panel.innerText(), /OUT\/2026/)
      assert.match(await panel.locator('article').nth(2).innerText(), /-1,3%[\s\S]*\+15,0%/)
      assert.equal(await page.getByRole('heading', { name: 'Veículos pesados', exact: true }).count(), 1)
      const publications = page.locator('.setores .sector-news-list > li')
      await publications.first().waitFor()
      assert.equal(await publications.count(), 1, 'somente notícia de caminhões nas últimas 120h')
      assert.match(await publications.innerText(), /QA: notícia fictícia/)
      assert.doesNotMatch(await page.locator('.setores .sector-news').innerText(), /notícia expirada/)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.screenshot({ path: path.join(out, 'setor-' + width + '.png'), fullPage: true })
      await page.goto(base + '/#resumo')
      const terminal = page.locator('.terminal-news')
      await terminal.getByRole('tab', { name: 'Veículos pesados', exact: true }).click()
      await terminal.locator('.heavy-vehicles article').first().waitFor()
      assert.equal(await terminal.locator('.heavy-cards article').count(), 6)
      await terminal.locator('.sector-news-list > li').first().waitFor()
      assert.match(await terminal.innerText(), /QA: notícia fictícia/)
      assert.equal(await terminal.locator('.sector-news-list > li').count(), 1)
      assert.doesNotMatch(await terminal.locator('.sector-news').innerText(), /notícia expirada/)
      const names = await terminal.locator('.desk-tabs button').allTextContents()
      if (names.length) assert.match(names.at(-1), /Veículos pesados/)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await terminal.screenshot({ path: path.join(out, 'noticias-' + width + '.png') })
      await page.keyboard.press('Control+Shift+F')
      const dialog = page.getByRole('dialog', { name: 'Buscar no painel' })
      await dialog.getByRole('searchbox').fill('veiculos pesados')
      await dialog.getByRole('region', { name: 'Resultados em Setores' }).getByRole('button').first().click()
      assert.match(page.url(), /#setores\/veiculos-pesados/)
      mode = 'error'
      await page.locator('.setores .refresh-btn').first().click()
      await page.locator('.heavy-vehicles').getByText(/Mantida a última referência validada/).waitFor()
      assert.equal(await page.locator('.heavy-vehicles article').count(), 6)
      assert.deepEqual(errors, [])
      await page.close(); console.log('PASS veículos pesados ' + width)
    }
    const page = await browser.newPage({ serviceWorkers: 'block' })
    await page.route('**/heavy-vehicles.json*', route => route.fulfill({ json: { generatedAt: null, indicators: [] } }))
    await page.goto(base + '/#setores/veiculos-pesados')
    await page.getByText('Indicadores indisponíveis. Consulte a publicação oficial.').waitFor()
    assert.equal(await page.locator('.heavy-vehicles article').count(), 0)
    await page.close()
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
