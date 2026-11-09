// Synthetic regression fixtures, not a validation of live provider prices.
const { chromium } = require('playwright')
const fs = require('node:fs')
const assert = require('node:assert/strict')
;(async () => {
  const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8772'
  const out = process.env.INTRADAY_QA_OUTPUT || 'intraday-qa'
  fs.mkdirSync(out, { recursive: true })
  const now = Date.parse('2026-11-09T14:40:00Z'), first = Date.parse('2026-11-09T10:00:16Z'), generatedAt = Date.parse('2026-11-09T11:20:16Z')
  const b = await chromium.launch(require('./smoke-launch.cjs')())
  const results = []
  try {
    for (const width of [390, 1280]) {
      const context = await b.newContext({ viewport: { width, height: 1000 }, timezoneId: width === 390 ? 'Asia/Tokyo' : 'UTC', serviceWorkers: 'block', reducedMotion: 'reduce' })
      const page = await context.newPage(), errors = []
      page.on('pageerror', e => errors.push(e.message))
      await page.clock.install({ time: now })
      let fresh = false, failed = false
      await context.route('**/*', route => {
        const u = new URL(route.request().url()), name = u.pathname.split('/').pop()
        if (name === 'intraday.json') {
          if (failed) return route.fulfill({ status: 503, body: 'offline fixture' })
          const points = fresh ? [[first, 5.5031], [now, 5.4931]] : [[first, 5.5031]]
          return route.fulfill({ json: { generatedAt: fresh ? now : generatedAt, source: 'Fixture sintética', series: Object.fromEntries(['USD', 'EUR', 'JPY', 'CNH'].map(c => [c, { points }])) } })
        }
        if (name === 'quotes.json') return route.fulfill({ json: { generatedAt, quotes: Object.fromEntries(Object.entries({ USDBRL: 5.5031, EURBRL: 6.16, JPYBRL: .0348, USDCNH: 6.67 }).map(([p, bid]) => [p, { bid: String(bid), ask: String(bid * 1.001), high: String(bid * 1.01), low: String(bid * .99), varBid: '0', pctChange: '0', timestamp: String(first / 1000) }])) } })
        if (u.origin === base) return route.continue()
        return route.abort()
      })
      await page.goto(base + '/#resumo')
      const table = page.getByRole('table', { name: 'Câmbio em reais · últimas referências disponíveis' })
      await table.locator('tbody').first().locator('.market-price').click()
      const detail = page.getByRole('dialog', { name: 'detalhes da moeda', exact: true })
      await detail.waitFor()
      await detail.getByRole('button', { name: 'Dia (intraday)', exact: true }).click()
      await detail.getByText(/Uma única amostra disponível/).waitFor()
      assert.equal(await detail.locator('article.chart header .pct').count(), 0)
      assert.match(await detail.innerText(), /mais de 10 minutos/)
      assert.match(await detail.innerText(), /coleta está atrasada/)
      assert.match(await detail.innerText(), /07:00/)
      assert.match(await detail.innerText(), /08:20/)
      await detail.getByText('Ver tabela (1 amostra)', { exact: true }).click()
      assert.match(await detail.locator('table').innerText(), /07:00:16/)
      assert.equal(await detail.evaluate(el => el.scrollWidth > el.clientWidth + 1), false)
      await detail.evaluate(el => { const note = document.createElement('p'); note.textContent = 'QA · DADOS SINTÉTICOS'; el.prepend(note) })
      await detail.screenshot({ animations: 'disabled', path: `${out}/${width}-single-sample.png` })
      await page.keyboard.press('Escape')
      await detail.waitFor({ state: 'hidden' })
      await page.getByRole('button', { name: 'Comparar moedas', exact: true }).click()
      const staleCompare = page.getByRole('dialog', { name: 'Comparar moedas', exact: true })
      await staleCompare.waitFor()
      await staleCompare.getByText(/USD:.*mais de 10 minutos/).waitFor()
      const oldSource = await staleCompare.locator('.terminal-chart-source').innerText()
      assert.match(oldSource, /USD:.*última amostra em.*EUR:.*última amostra em/)
      await staleCompare.getByRole('button', { name: 'EUR', exact: true }).click()
      assert.match(await staleCompare.innerText(), /mais de 10 minutos/)
      assert.match(await staleCompare.innerText(), /coleta está atrasada/)
      assert.equal(await staleCompare.locator('.sec-head h3 .pct').count(), 0)
      assert.match(await staleCompare.locator('.terminal-chart-source').innerText(), /última amostra em.*arquivo gerado em/)
      await staleCompare.screenshot({ animations: 'disabled', path: `${out}/${width}-comparison-stale.png` })
      await page.keyboard.press('Escape')
      await staleCompare.waitFor({ state: 'hidden' })
      await table.locator('tbody').first().locator('.market-price').click()
      await detail.waitFor()
      fresh = true
      // A shared response may fill the cache after a poll. Cross two polling boundaries.
      await page.clock.runFor(121000)
      await detail.getByText('Ver tabela (2 amostras)', { exact: true }).waitFor()
      assert.match(await detail.locator('article.chart header .pct').innerText(), /-0,18%/)
      assert.equal(await detail.getByText(/mais de 10 minutos/).count(), 0)
      failed = true
      // A shared response may fill the cache after a poll. Cross two polling boundaries.
      await page.clock.runFor(121000)
      await detail.getByText(/Não foi possível atualizar. Mantida a última série/).waitFor()
      assert.equal(await detail.getByText('Ver tabela (2 amostras)', { exact: true }).count(), 1)
      failed = false
      // A shared response may fill the cache after a poll. Cross two polling boundaries.
      await page.clock.runFor(121000)
      await detail.getByText(/Não foi possível atualizar. Mantida a última série/).waitFor({ state: 'detached' })
      await page.keyboard.press('Escape')
      await detail.waitFor({ state: 'hidden' })
      await page.getByRole('button', { name: 'Comparar moedas', exact: true }).click()
      const compare = page.getByRole('dialog', { name: 'Comparar moedas', exact: true })
      await compare.waitFor()
      await compare.getByRole('button', { name: 'EUR', exact: true }).click()
      await compare.locator('.resumo-chart svg[tabindex]').waitFor()
      assert.match(await compare.locator('.terminal-chart-source').innerText(), /USD:.*última amostra em.*EUR:.*última amostra em/)
      assert.match(await compare.locator('.terminal-chart-source').innerText(), /última amostra em.*arquivo gerado em/)
      await page.keyboard.press('Escape')
      await compare.waitFor({ state: 'hidden' })
      assert.deepEqual(errors, [])
      results.push({ width, timezone: width === 390 ? 'Asia/Tokyo' : 'UTC', passed: true, syntheticFixtures: true, errors, checks: ['single sample without zero return', 'sample vs file timestamp', 'source and collection age', 'recovery', 'network failure retention', 'Escape and repeated dialogs', 'comparison timestamps', 'no dialog overflow'] })
      await context.close()
    }
    fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2))
    console.log(JSON.stringify(results, null, 2))
  } finally { await b.close() }
})().catch(e => {
  const out = process.env.INTRADAY_QA_OUTPUT || 'intraday-qa'
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(`${out}/failure.txt`, e.stack || String(e))
  console.error(e)
  process.exit(1)
})
