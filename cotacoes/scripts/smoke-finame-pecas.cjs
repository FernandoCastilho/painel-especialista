const { chromium } = require('playwright')
const { readFile } = require('node:fs/promises')
const assert = require('node:assert/strict')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const launch = require('./smoke-launch.cjs')

async function check(page) {
  await page.route('**/bndes.json*', route => route.fulfill({ json: { schemaVersion: 1, generatedAt: Date.now(), series: { TFB_60_90: { points: [['2026-11-05', 13], ['2026-11-25', 13.5]] } } } }))
  await page.route('**/moedas.json*', route => route.fulfill({ json: { schemaVersion: 1, generatedAt: Date.now(), series: { C03: { points: [['2026-11-05', 12], ['2026-11-25', 12.5]] }, C01: { points: [['2026-11-05', 12], ['2026-11-25', 12.5]] } } } }))
  await page.route('**/curves.json*', route => route.fulfill({ json: { br: { sourceDate: '2026-11-25', compare: [{ date: '2026-11-25', label: 'Hoje' }], curves: { '2026-11-25': [[21, 12], [252, 12], [504, 13], [1008, 14], [1260, 14.5]] } } } }))
  await page.route('**/recado.json*', route => route.fulfill({ json: { ativo: false } }))
  await page.goto(base + '/#calculadora')
  const btn = page.locator('dialog.aviso-inicial:not(.recado)').getByRole('button', { name: 'Entendi' })
  if (await btn.isVisible()) await btn.click()
  await page.getByRole('button', { name: 'BNDES: abrir calculadora', exact: true }).click()
  const native = page.getByRole('button', { name: 'Baixar e-mail da cotação para o Outlook', exact: true })
  const pdf = page.getByRole('button', { name: 'Baixar e-mail com PDF em anexo para o Outlook', exact: true })
  for (const [button, type] of [[native, 'alternative'], [pdf, 'mixed']]) {
    const [file] = await Promise.all([page.waitForEvent('download'), button.click()])
    const raw = await readFile(await file.path(), 'utf8')
    assert.match(raw, new RegExp('multipart/' + type))
    if (type === 'mixed') {
      const att = /filename="[^"]+\.pdf"\r\n\r\n([\s\S]*?)\r\n--/.exec(raw)
      assert.ok(att)
      assert.match(Buffer.from(att[1], 'base64').toString('ascii'), /^%PDF-1\.4/)
      if (process.env.BNDES_QA_EML) await file.saveAs(process.env.BNDES_QA_EML)
    }
  }
  const history = page.locator('.cx-finame > details.fm-indexers-callout')
  const flow = page.locator('.cx-finame > details.bndes-flow-callout:last-child')
  assert.equal(await history.evaluate(el => el.open), false)
  assert.equal(await flow.evaluate(el => el.open), false)
  await history.locator('summary').click()
  await history.getByText(/DI no prazo de 48 meses/).waitFor()
  const curva = history.locator('svg.ml-svg')
  await curva.waitFor()
  const linhaDI = curva.locator('line[data-referencia=mercado]')
  await linhaDI.waitFor({ state: 'attached' }) // Uma linha horizontal tem caixa de geometria com altura zero.
  assert.equal(await linhaDI.getAttribute('stroke-dasharray'), '6 4')
  assert.ok(await linhaDI.evaluate(el => el.getTotalLength() > 0 && getComputedStyle(el).stroke !== 'none'))
  assert.match(await history.innerText(), /TFC:[\s\S]*diferença de −1,50 p.p. frente ao DI/)
  await page.locator('#fm-compare').check()
  assert.match(await history.innerText(), /TFB:[\s\S]*diferença de −0,50 p.p. frente ao DI/)
  await flow.locator('summary').click()
  await flow.getByRole('img', { name: /Fluxo de pagamentos/ }).waitFor()
  await flow.getByRole('combobox', { name: 'Fluxo exibido' }).selectOption('1')
  await flow.getByRole('img', { name: /Fluxo de pagamentos/ }).waitFor()
}

;(async () => {
  const browser = await chromium.launch(launch())
  try {
    for (const [width, colorScheme] of [[390, 'dark'], [1440, 'light']]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme, serviceWorkers: 'block', acceptDownloads: true })
      await check(page)
      await page.close()
      console.log('BNDES: e-mails, curva e fluxo conferidos', width, colorScheme)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
