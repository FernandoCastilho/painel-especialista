const openCallouts = require('./smoke-aprender-disclosures.cjs')
// Regression test for the built application, using the repository's CI browser harness.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

;(async () => {
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
  const out = process.env.JUROS_QA_OUTPUT || 'juros-qa'
  fs.mkdirSync(out, { recursive: true })
  const results = []
  try {
    for (const width of [390, 768, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
      await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort())
      await context.route('**/recado.json*', route => route.fulfill({ json: { ativo: false } }))
      const page = await context.newPage(), errors = []
      page.on('pageerror', error => errors.push(error.message))
      page.setDefaultTimeout(15000)
      await page.goto(base + '/#aprender/juros-forcados')
      await page.getByRole('heading', { name: 'Controle forçado de juros: história dos países', exact: true }).waitFor()
      const cases = page.locator('.learn-history-case')
      assert.equal(await cases.count(), 6)
      assert.equal(await page.locator('.learn-history-case[open]').count(), 0)
      assert.ok((await page.locator('.learn-history-scope').innerText()).includes('1942 a 2024'))
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      await page.locator('.learn-history').screenshot({ path: path.join(out, `${width}-overview.png`) })
      let links = 0
      for (let i = 0; i < 6; i++) {
        const item = cases.nth(i), summary = item.locator('summary').first()
        await summary.click()
        assert.equal(await item.getAttribute('open'), '')
        for (const label of ['O contexto', 'Como seguraram os juros', 'O que aconteceu', 'O que a história não prova']) {
          assert.equal(await item.getByRole('heading', { name: label, exact: true }).isVisible(), true)
        }
        const sources = item.locator('.learn-history-sources a')
        links += await sources.count()
        for (const link of await sources.all()) {
          assert.match(await link.getAttribute('href'), /^https:\/\//)
          assert.equal(await link.getAttribute('rel'), 'noopener noreferrer')
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
        await item.screenshot({ path: path.join(out, `${width}-case-${i + 1}.png`) })
        await summary.press('Enter')
        assert.equal(await item.getAttribute('open'), null)
      }
      assert.equal(links, 15)
      await page.getByRole('searchbox', { name: 'Buscar conceito', exact: true }).fill('Turquia')
      assert.match(await page.locator('.learn-count').innerText(), /1 conceito encontrado/)
      await page.getByRole('button', { name: 'Limpar busca', exact: true }).click()
      await page.getByRole('searchbox', { name: 'Buscar conceito', exact: true }).fill('palavraimpossivelxyz')
      assert.match(await page.locator('.learn-count').innerText(), /Nenhum conceito encontrado/)
      await page.getByRole('button', { name: 'Limpar busca', exact: true }).click()
      await openCallouts(page, [/^Conecta com$/])
      await page.locator('.learn-conecta').getByRole('button').filter({ hasText: 'Inflação' }).click()
      await page.waitForURL(/#aprender\/inflacao$/)
      await page.goBack()
      await page.waitForURL(/#aprender\/juros-forcados$/)
      await page.getByRole('heading', { name: 'Controle forçado de juros: história dos países', exact: true }).waitFor()
      await page.reload()
      await page.getByRole('heading', { name: 'Controle forçado de juros: história dos países', exact: true }).waitFor()
      assert.equal(await page.locator('.learn-history-case').count(), 6)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      assert.deepEqual(errors, [])
      results.push({ width, cases: 6, sourceLinks: links, keyboardToggle: 'pass', search: 'pass', connections: 'pass', back: 'pass', reload: 'pass', overflow: false, errors })
      console.log(`${width} PASS juros: six cases, sources, keyboard, search, links, back, reload, no overflow`)
      await context.close()
    }
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ results }, null, 2))
    await browser.close()
  }
})().catch(error => { console.error(error); process.exit(1) })
