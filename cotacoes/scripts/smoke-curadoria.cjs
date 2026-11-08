// Dados fictícios isolados da rede; verifica apenas as quatro curadorias de sete dias.
const { chromium } = require('playwright')
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const now = Date.parse('2026-11-06T12:00:00Z'), base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8772'
const out = process.env.CURADORIA_QA_OUTPUT || path.join(__dirname, '../../qa-curadoria')
const labels = { imposto: 'Imposto', 'split-payment': 'Split payment', reforma: 'Reforma tributária', 'escala-6x1': 'Escala 6x1' }
const titles = { imposto: 'Imposto: nova regra de teste', 'split-payment': 'Split payment: impostos em teste', reforma: 'Reforma tributária: regra de teste', 'escala-6x1': 'Escala 6x1: mudança fictícia em teste' }
const fixture = mode => ({ schemaVersion: 1, windowDays: 7, generatedAt: now, topics: Object.fromEntries(Object.keys(labels).map(id => [id, { label: labels[id], checkedAt: now, lastSuccessAt: now, status: mode === 'partial' ? 'partial' : 'ok', items: mode === 'empty' ? [] : [
  { title: titles[id], t: now - 6 * 86400000, link: 'https://www.gov.br/qa/' + id, sourceUrl: 'https://www.gov.br' },
  { title: titles[id] + ' expirada', t: now - 168 * 3600000 - 1, link: 'https://www.gov.br/qa/expired-' + id, sourceUrl: 'https://www.gov.br' },
  { title: titles[id] + ' futura', t: now + 1, link: 'https://www.gov.br/qa/future-' + id, sourceUrl: 'https://www.gov.br' },
] }])) })
;(async () => {
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  fs.mkdirSync(out, { recursive: true })
  try {
    for (const width of [390, 820, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' })
      const page = await context.newPage(), errors = []
      await page.clock.setFixedTime(now)
      page.on('pageerror', error => errors.push(error.message))
      let mode = 'ok'
      await page.route('**/*', route => {
        const url = new URL(route.request().url())
        if (url.origin !== base) return route.abort()
        if (url.pathname.endsWith('/curadoria-noticias.json')) return mode === 'unavailable' ? route.fulfill({ status: 503, body: 'unavailable' }) : route.fulfill({ json: mode === 'invalid' ? {} : fixture(mode) })
        if (url.pathname.endsWith('.json')) return route.fulfill({ json: { generatedAt: now } })
        return route.continue()
      })
      await page.goto(base + '/#resumo')
      const panel = page.locator('.terminal-news')
      for (const [id, label] of Object.entries(labels)) {
        const tab = panel.getByRole('tab', { name: label, exact: true })
        await tab.click(); await tab.click()
        const list = panel.locator('.curadoria-noticias')
        await list.getByRole('link', { name: titles[id], exact: true }).waitFor()
        assert.equal(await list.getByRole('link').count(), 1)
        assert.match(await list.innerText(), /7 dias \(168 horas\)/)
        assert.doesNotMatch(await list.innerText(), /expirada|futura|120 horas|Curadoria automática|Última consulta|Última coleta completa/)
        assert.equal(await tab.getAttribute('aria-selected'), 'true')
        const box = await tab.boundingBox(); assert.ok(box.height >= 44)
        await tab.focus(); assert.equal(await tab.evaluate(node => document.activeElement === node), true)
        // A barra inferior fixa não pode impedir a leitura ou o clique após rolar.
        const article = list.getByRole('link', { name: titles[id], exact: true })
        await article.scrollIntoViewIfNeeded()
        await article.click({ trial: true })
        await page.screenshot({ path: path.join(out, `curadoria-${id}-${width}-article.png`) })
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await panel.screenshot({ path: path.join(out, `curadoria-${width}.png`) })
      await panel.getByRole('tab', { name: 'Manchetes', exact: true }).click()
      await panel.getByText(/5 dias \(120 horas\)/).waitFor()
      assert.match(await panel.innerText(), /5 dias \(120 horas\)/)
      await panel.getByRole('tab', { name: 'Split payment', exact: true }).focus(); await page.keyboard.press('Enter')
      await panel.getByRole('link', { name: titles['split-payment'], exact: true }).waitFor()
      for (const next of ['empty', 'partial', 'invalid', 'unavailable']) {
        mode = next; await page.reload()
        await panel.getByRole('tab', { name: 'Imposto', exact: true }).click()
        if (next === 'empty') await panel.getByText(/Isso não significa ausência de notícias/).waitFor()
        else if (next === 'partial') await panel.getByText(/Atualização incompleta, atrasada ou não confirmada/).waitFor()
        else await panel.getByText(/Curadoria indisponível no momento/).waitFor()
        assert.doesNotMatch(await panel.innerText(), /Curadoria automática|Última consulta|Última coleta completa/)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      }
      assert.deepEqual(errors, [])
      await context.close(); console.log(`PASS curadoria ${width}: tabs, dates, keyboard, repeated click, failure/empty/partial, overflow`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
