const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.BANKS_QA_OUTPUT || 'workspace-qa/bancos'
;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const report = []
  try {
    for (const width of [390, 820, 1440]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' })
      const page = await context.newPage(), errors = []
      try {
      page.on('pageerror', e => errors.push(e.message))
      await page.goto(base + '/?qa=bancos#bancos', { waitUntil: 'domcontentloaded' })
      await page.locator('.banks-table').waitFor()
      const notice = page.getByRole('dialog', { name: 'Aviso', exact: true })
      if (await notice.isVisible()) await notice.getByRole('button', { name: 'Entendi', exact: true }).click()
      assert.equal(await page.locator('.banks-table > tbody > tr').count(), 10)
      const labels = await page.locator('.banks-table > thead th').allTextContents()
      assert.ok(labels.indexOf('Carteira PJR$ bi') < labels.indexOf('Carteira PFR$ bi'))
      assert.ok(await page.getByRole('heading', { name: 'Bancos · capital, crédito e resultado' }).isVisible())
      const geometry = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth }))
      assert.ok(geometry.document <= geometry.width + 1, JSON.stringify(geometry))
      await page.screenshot({ path: path.join(out, `${width}-${theme}.png`), fullPage: true })
      await page.getByLabel('Buscar banco', { exact: true }).fill('Itaú')
      await page.waitForFunction(() => document.querySelectorAll('.banks-table > tbody > tr').length === 1)
      assert.equal(await page.locator('.banks-table > tbody > tr').count(), 1)
      await page.getByLabel('Provisões e inadimplência', { exact: true }).selectOption('PF')
      await page.getByRole('columnheader', {name:/Provisão PF/}).waitFor()
      assert.match(await page.locator('.banks-table > thead').innerText(), /Provisão PF/)
      await page.getByLabel('Evolução versus', { exact: true }).selectOption('-4')
      assert.match(await page.locator('.banks-summary').innerText(), /3T2025/)
      await page.getByLabel('Base de comparação', { exact: true }).selectOption('bc')
      await page.waitForFunction(() => document.querySelector('.banks-table > tbody > tr > th')?.innerText.includes('2T2026'))
      assert.match(await page.locator('.banks-table > tbody > tr > th').innerText(), /2T2026/)
      const detail = page.getByText('Detalhes e fontes — Itaú', { exact: true })
      await detail.press('Enter')
      assert.equal(await page.locator('.bank-details[open]').count(), 1)
      await page.screenshot({ path: path.join(out, `${width}-${theme}-details.png`), fullPage: true })
      assert.ok(await page.locator('.bank-details[open] a').count() > 0)
      await page.getByLabel('Buscar banco', { exact: true }).fill('nenhum-banco')
      await page.getByText('Nenhum banco encontrado.', { exact: true }).waitFor()
      assert.ok(await page.getByText('Nenhum banco encontrado.', { exact: true }).isVisible())
      assert.deepEqual(errors, [])
      report.push({ width, theme, passed: true, checks: ['10 bancos', 'PJ/PF', 'sem overflow da página', 'busca', 'segmento', 'anual', 'BC', 'detalhes por teclado', 'vazio', 'sem erro JS'] })
      } catch (error) {
        fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({width,theme,message:error.message,stack:error.stack},null,2))
        await page.screenshot({path:path.join(out,`${width}-${theme}-failure.png`),fullPage:true})
        throw error
      } finally { await context.close() }
    }
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
    console.log('Bancos: seis cenários passaram (390/820/1440, claro/escuro).')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
