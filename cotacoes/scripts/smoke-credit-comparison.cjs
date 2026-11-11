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
    const compare = () => page.getByRole('button', { name: /Comparar modalidades/ }).click()
    const row = label => page.locator('.credit-results').first().locator('tr').filter({ has: page.getByRole('rowheader', { name: label, exact: true }) })
    // Duas comparações no início; o usuário escolhe de 2 a 5.
    assert.equal(await page.locator('.credit-card').count(), 2)
    assert.equal(await page.locator('.credit-results').count(), 0, 'resultado só depois de comparar')
    await page.getByRole('button', { name: '4', exact: true }).click()
    assert.equal(await page.locator('.credit-card').count(), 4)
    // Modalidade de cada coluna: troca para BNDES e confere os campos próprios.
    await page.locator('#credit-c2-modality').selectOption('bndes')
    await page.locator('#credit-c2-bCost').waitFor()
    await page.locator('#credit-c3-modality').selectOption('finimp')
    await page.locator('#credit-c3-fRate').waitFor()
    await page.locator('#credit-c4-modality').selectOption('conta-garantida')
    await page.locator('#credit-c4-cRate').waitFor()
    await compare()
    assert.equal(await row('Valor contratado').locator('td').count(), 4)
    assert.match(await page.locator('.credit-results thead').first().innerText(), /BNDES[\s\S]*FINIMP[\s\S]*Conta Garantida/)
    // Condição inválida esconde o resultado antigo.
    await page.locator('#credit-c1-rate').fill('')
    assert.equal(await page.locator('.credit-results').count(), 0, 'edição esconde resultado antigo')
    assert.ok(await page.locator('.credit-card-error').count() >= 1)
    await page.locator('#credit-c1-rate').fill('1,45')
    // Mesmo valor líquido.
    await page.getByLabel('Comparar pelo mesmo valor líquido', { exact: true }).check()
    await compare()
    const nets = await row('Valor líquido recebido').locator('td').allTextContents()
    assert.equal(new Set(nets).size, 1); assert.match(nets[0], /500.000,00/)
    await page.getByLabel('Comparar pelo mesmo valor líquido', { exact: true }).uncheck()
    // Cenários do CDI aparecem só com coluna pós-CDI.
    assert.equal(await page.getByRole('heading', { name: 'Cenários do CDI' }).count(), 0)
    await page.locator('#credit-c1-modality').selectOption('giro-cdi')
    await page.getByRole('heading', { name: 'Cenários do CDI' }).waitFor()
    await page.getByLabel('Informar referência manual', { exact: true }).check()
    await page.getByLabel('CDI base (% a.a.)', { exact: true }).fill('12')
    await page.getByRole('button', { name: 'Base', exact: true }).click()
    await page.getByRole('button', { name: '2', exact: true }).click()
    await compare()
    // Res. CMN 4.881, art. 5º: pós-CDI mostra o CET da parte fixa e, à parte, o custo com CDI projetado (que não é CET).
    const cetFixed = await row('CET estimado · parte fixa (regra do BC) · a.a.').locator('td').allTextContents()
    const projected = await row('Custo com CDI projetado · a.a. (não é CET)').locator('td').allTextContents()
    const rate = text => Number(text.match(/[\d.,]+(?=%)/)[0].replace(/\./g, '').replace(',', '.'))
    assert.ok(rate(cetFixed[0]) < rate(projected[0]), 'pós-CDI: CET da parte fixa abaixo do custo com CDI')
    assert.equal(rate(cetFixed[1]), rate(projected[1]), 'prefixado: os dois números coincidem')
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
    await page.screenshot({ path: path.join(out, 'presentation.png') })
    for (const width of [390, 820, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await dialog.evaluate(el => { el.scrollTop = 0 })
      const bounds = await dialog.boundingBox()
      assert.equal(Math.round(bounds.x), 0)
      assert.equal(Math.round(bounds.y), 0)
      assert.equal(Math.round(bounds.width), width)
      assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), true)
      await page.screenshot({ path: path.join(out, `presentation-${width}-top.png`) })
      await dialog.evaluate(el => { el.scrollTop = el.scrollHeight })
      await page.screenshot({ path: path.join(out, `presentation-${width}-bottom.png`) })
    }
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true)
    await trigger.click(); await dialog.getByRole('button', { name: 'Fechar ×' }).click()
    await trigger.click(); await page.evaluate(() => { location.hash = '#calculadora' })
    await dialog.waitFor({ state: 'hidden' })
    await page.goBack(); await page.locator('#credit-title').waitFor()
    await page.goForward(); await page.locator('#calc-title').waitFor()
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, checks: ['2 a 5 colunas', 'modalidade por coluna', 'invalid outputs hidden', 'net equivalence', 'CDI scenarios', '390/820/1440 light/dark', 'presentation Escape/close/focus/history'], errors }, null, 2))
    console.log('Credit comparator browser checks passed')
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {}); fs.writeFileSync(path.join(out, 'failure.txt'), String(error)) }
    throw error
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
