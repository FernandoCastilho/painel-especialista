const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.CREDIT_QA_OUTPUT || 'workspace-qa/credit'
;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] })
  const errors = []
  let page
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.on('pageerror', e => errors.push(e.message))
    await page.route('**/*', route => {
      if (new URL(route.request().url()).pathname.endsWith('/macro.json')) return route.fulfill({ json: { generatedAt: Date.now(), cdi: [[Date.now() - 86400000, 12]] } })
      return route.request().url().startsWith(base + '/') ? route.continue() : route.abort()
    })
    await page.goto(`${base}/#calculadora/comparador-credito`)
    await page.locator('#credit-title').waitFor()
    assert.equal(await page.locator('.credit-errors').count(), 0)
    const row = label => page.locator('.credit-results').first().locator('tr').filter({ has: page.getByRole('rowheader', { name: label, exact: true }) })
    assert.equal(await row('Valor contratado').locator('td').count(), 2)
    assert.equal(await row('Valor contratado').locator('td').first().innerText(), await row('Valor contratado').locator('td').last().innerText())
    await page.locator('#credit-B-rate').fill('2')
    assert.notEqual(await row('Custo sobre o líquido').locator('td').first().innerText(), await row('Custo sobre o líquido').locator('td').last().innerText())
    await page.locator('#credit-A-value').fill('')
    assert.equal(await page.locator('.credit-results').count(), 0, 'invalid input must hide stale outputs')
    await page.locator('#credit-A-value').fill('500.000,00')
    await page.locator('.credit-proposal').first().getByText('Encargos, garantia e calendário', { exact: true }).click()
    await page.locator('#credit-A-guaranteeValue').fill('750.000,00')
    assert.match(await row('Cobertura nominal').innerText(), /150%/)
    await page.getByLabel('Comparar pelo mesmo valor líquido', { exact: true }).check()
    const nets = await row('Valor líquido recebido').locator('td').allTextContents()
    assert.equal(nets[0], nets[1]); assert.match(nets[0], /500.000,00/)
    await page.locator('#credit-B-rateType').selectOption('cdi')
    await page.getByRole('heading', { name: 'Cenários do CDI' }).waitFor()
    const original = await row('Custo sobre o líquido').locator('td').last().innerText()
    await page.getByRole('button', { name: 'Alta', exact: true }).click()
    assert.notEqual(original, await row('Custo sobre o líquido').locator('td').last().innerText())
    await page.getByLabel('Informar referência manual', { exact: true }).check()
    assert.equal(await page.locator('.credit-results').count(), 0)
    await page.getByLabel('CDI base (% a.a.)', { exact: true }).fill('12')
    await page.getByRole('button', { name: 'Base', exact: true }).click()
    await page.getByLabel('Conferi todos os encargos e as convenções para esta simulação.', { exact: true }).check()
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme })
      for (const width of [390, 820, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        await page.evaluate(() => document.fonts.ready)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow ${theme}/${width}`)
        await page.screenshot({ path: path.join(out, `${theme}-${width}.png`), fullPage: true })
      }
    }
    const trigger = page.getByRole('button', { name: 'Apresentar comparação', exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Comparador de Crédito' })
    await dialog.waitFor()
    await page.screenshot({ path: path.join(out, 'presentation.png'), fullPage: true })
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true)
    await trigger.click(); await dialog.getByRole('button', { name: 'Fechar ×' }).click()
    await trigger.click(); await page.evaluate(() => { location.hash = '#calculadora' })
    await dialog.waitFor({ state: 'hidden' })
    await page.goBack(); await page.locator('#credit-title').waitFor()
    await page.goForward(); await page.getByRole('heading', { name: 'Calculadoras', exact: true }).waitFor()
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, checks: ['dual proposals', 'invalid outputs hidden', 'guarantee coverage', 'net equivalence', 'CDI scenarios/manual empty', '390/820/1440 light/dark', 'presentation Escape/close/focus/history'], errors }, null, 2))
    console.log('Credit comparator browser checks passed')
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {}); fs.writeFileSync(path.join(out, 'failure.txt'), String(error)) }
    throw error
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
