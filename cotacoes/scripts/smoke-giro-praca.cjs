const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const launch = require('./smoke-launch.cjs')
const path = require('node:path')
const fs = require('node:fs')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5318'

;(async () => {
  const browser = await chromium.launch(launch())
  try {
    for (const mobile of [false, true]) {
      const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' })
      if (process.env.PRACA_STATIC_DIST) {
        const root = path.resolve(process.env.PRACA_STATIC_DIST)
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }
        await page.route(new URL(base).origin + '/**', route => {
          const url = new URL(route.request().url())
          const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname))
          if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404 })
          return route.fulfill({ path: file, contentType: types[path.extname(file)] })
        })
      }
      await page.goto(base + '/#calculadora/giro')
      const giro = page.locator('.giro-screen')
      await giro.locator('.lm-details > summary').click()
      const field = giro.getByRole('combobox', { name: 'Praça do contrato', exact: true })
      await field.waitFor({ timeout: 5000 })
      assert.equal(await field.inputValue(), 'Nacional (BR)')
      await field.fill('soroc')
      assert.deepEqual(await giro.getByRole('listbox').getByRole('option').allTextContents(), ['Sorocaba (SP)'])
      if (mobile) await page.getByRole('option', { name: 'Sorocaba (SP)', exact: true }).tap()
      else { await field.press('ArrowDown'); await field.press('Enter') }
      assert.equal(await field.inputValue(), 'Sorocaba (SP)')
      assert.match(await giro.locator('.lm-details > summary').innerText(), /Sorocaba/)
      await field.fill('nao existe')
      await giro.getByText('Nenhuma praça cadastrada encontrada.', { exact: true }).waitFor()
      await field.press('Escape')
      assert.equal(await field.inputValue(), 'Sorocaba (SP)')
      await field.fill('sao paulo')
      assert.equal(await page.getByRole('option', { name: 'São Paulo · capital', exact: true }).count(), 1)
      if (process.env.PRACA_SCREENSHOT && !mobile) await giro.locator('.lm').screenshot({ path: process.env.PRACA_SCREENSHOT })
      await field.press('Tab')
      assert.equal(await field.inputValue(), 'Sorocaba (SP)')
      await page.reload()
      await giro.locator('.lm-details > summary').click()
      assert.equal(await field.inputValue(), 'Sorocaba (SP)')
      await giro.getByRole('button', { name: 'Limpar', exact: true }).click()
      assert.equal(await field.inputValue(), 'Nacional (BR)')
      await page.close()
    }
    console.log('Busca da praça: teclado, toque, acentos, busca vazia, escolha persistida e limpeza OK')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
