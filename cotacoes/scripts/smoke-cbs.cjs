const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const snapshot = require('../src/ibgeCbsSnapshot.json')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.CBS_QA_OUTPUT || 'workspace-qa/cbs'
async function run() {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] })
  const errors = []
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort())
    await page.goto(base + '/#calculadora/cbs-caixa')
    await page.getByRole('heading', { name: '3. Necessidade adicional de giro' }).waitFor()
    const referenceStatus = page.getByRole('note', { name: 'Atualização da referência IBGE' })
    assert.match(await referenceStatus.innerText(), /Atualização automática suspensa/)
    assert.match(await referenceStatus.innerText(), /Última coleta válida:/)
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme })
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 })
        await page.evaluate(() => document.fonts.ready)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow ${theme}/${width}`)
        await page.screenshot({ path: path.join(out, `${theme}-${width}.png`), fullPage: true })
      }
    }
    await page.getByText('Ajustar impostos, créditos e prazos', { exact: true }).click()
    await page.locator('#cbs-receiveDays').fill('60')
    await page.locator('#cbs-payDays').fill('90')
    await page.locator('#cbs-stockDays').fill('0')
    await page.locator('#cbs-creditDelayDays').fill('60')
    await page.locator('#cbs-splitShare').fill('100')
    assert.match(await page.locator('.cbs-result-note').innerText(), /dias no modelo/)
    await page.locator('#cbs-kind').selectOption('industria')
    assert.ok((await referenceStatus.innerText()).includes(`Base preservada · IBGE ${snapshot.datasets.find(d => d.kind === 'industria').year}`))
    await page.locator('#cbs-kind').selectOption('servicos')
    assert.match(await referenceStatus.innerText(), /Não é uma consulta em tempo real/)
    await page.locator('#cbs-regime').selectOption('simples')
    assert.equal(await page.locator('.cbs-result').count(), 0, 'Simples must not calculate regular model')
    await page.getByRole('button', { name: 'Restaurar exemplo' }).click()
    await page.locator('#cbs-receiveDays').fill('')
    assert.equal(await page.locator('.cbs-result').count(), 0, 'invalid days still calculate')
    await page.locator('#cbs-receiveDays').fill('30')
    const help = page.getByRole('button', { name: 'Ajuda: Recebimento médio', exact: true })
    await help.click()
    await page.getByRole('dialog').waitFor()
    await page.keyboard.press('Escape')
    assert.equal(await help.evaluate(element => document.activeElement === element), true)
    assert.deepEqual(errors, [])
    const result = { passed: true, views: ['light-390', 'light-1440', 'dark-390', 'dark-1440'], sourceStatus: true, sectorSwitch: true, simplesGuard: true, invalidInputGuard: true, helpEscapeFocus: true, pageErrors: errors }
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result))
  } finally { await browser.close() }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
