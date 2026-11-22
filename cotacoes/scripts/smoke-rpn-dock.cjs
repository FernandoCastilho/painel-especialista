const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const {readFile}=require('node:fs/promises'); const path=require('node:path'); const root=path.resolve('dist'); const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'};
const base = new URL(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768')

async function test(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 500, serviceWorkers: 'block' })
  try {
    await context.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.origin !== base.origin) return route.abort()
      if (!process.env.SMOKE_DIST) return route.continue()
      const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname))
      if (!file.startsWith(root + path.sep)) return route.abort()
      try { return route.fulfill({ body: await readFile(file), contentType: types[path.extname(file)] }) }
      catch { return route.fulfill({ status: 404, body: '' }) }
    })
    const page = await context.newPage()
    page.setDefaultTimeout(5000)
    await page.goto(new URL('#rpn', base).href)
    const panel = page.getByRole('region', { name: 'Calculadora RPN', exact: true })
    await panel.waitFor()
    if (width >= 1000) {
      const shortcut = page.locator('.topbar-tabs > button').first()
      assert.equal(await shortcut.getAttribute('aria-label'), 'Calculadora RPN')
      assert.equal((await shortcut.innerText()).trim(), '')
      assert.equal(await shortcut.locator('.nav-rpn-icon').isVisible(), true)
      assert.equal(await shortcut.getAttribute('aria-current'), 'page')
    }
    assert.equal(await panel.getByRole('button', { name: 'Tela cheia', exact: true }).count(), 0)
    const tape = panel.locator('.rpn-history')
    if (width < 1120) await panel.getByRole('button', { name: 'Histórico de contas' }).click()
    const draft = tape.locator('.rpn-tape-draft output')
    await panel.focus()
    for (const [key, value] of [['1','1'], ['2','12'], [',','12,'], ['5','12,5']]) {
      await page.keyboard.press(key)
      assert.equal(await draft.textContent(), value)
    }
    await page.keyboard.press('Enter')
    await panel.getByRole('button', { name: 'Fixar como janela flutuante' }).click()
    const floating = page.getByRole('dialog', { name: 'Calculadora RPN flutuante' })
    await floating.waitFor()
    const visibleWide = panel.locator('.rpn-keypad--wide')
    assert.equal(await visibleWide.isVisible(), width >= 1000, 'desktop flutuante conserva a grade horizontal')
    await page.waitForFunction(() => document.activeElement?.classList.contains('rpn-workspace'))
    await page.keyboard.press('3')
    assert.equal(await draft.textContent(), '3')
    await page.evaluate(() => { location.hash = 'juros' })
    await page.locator('main[data-tab="juros"]').waitFor()
    assert.equal(await draft.textContent(), '3')
    if (process.env.RPN_QA_OUTPUT && width >= 1000) {
      await floating.screenshot({ path: path.join(process.env.RPN_QA_OUTPUT, 'hp12c-desktop-flutuante.png') })
    }
    const target = await floating.boundingBox()
    assert.ok(target.x >= 0 && target.y >= 0 && target.x + target.width <= width && target.y + target.height <= height)
    if (width >= 750) {
      const handle = await floating.locator('.rpn-float-bar span').boundingBox()
      await page.mouse.move(handle.x + 20, handle.y + 12)
      await page.mouse.down()
      await page.mouse.move(handle.x - 80, handle.y - 60, { steps: 5 })
      await page.mouse.up()
      assert.ok((await floating.boundingBox()).x < target.x, 'a janela pode ser arrastada')
    }
    await panel.focus()
    await page.keyboard.press('+')
    assert.equal(await draft.count(), 0)
    assert.equal((await tape.locator('ol li').first().innerText()).split('\n')[0], '12,5 + 3 = 15,5')
    await floating.getByRole('button', { name: 'Recolher calculadora' }).click()
    await floating.waitFor({ state: 'hidden' })
    assert.equal(await page.getByRole('button', { name: 'Abrir calculadora flutuante', exact: true }).count(), 0)
    await page.evaluate(() => { location.hash = 'rpn' })
    await page.locator('main[data-tab="rpn"]').waitFor()
    await panel.getByRole('button', { name: 'Fixar como janela flutuante' }).click()
    await floating.waitFor()
    assert.match(await tape.innerText(), /12,5 \+ 3 = 15,5/)
    await page.evaluate(() => { location.hash = 'rpn' })
    await page.locator('main[data-tab="rpn"]').waitFor()
    await floating.getByRole('button', { name: 'Voltar à calculadora na página' }).click()
    await floating.waitFor({ state: 'hidden' })
    assert.match(await tape.innerText(), /12,5 \+ 3 = 15,5/)
    if (width < 500) {
      await page.setViewportSize({ width: 844, height: 390 })
      await page.waitForFunction(() => document.querySelector('.rpn-workspace')?.dataset.rpnMobileCompact === 'true')
      assert.equal(await panel.locator('.rpn-keypad--wide').isVisible(), true)
      await page.waitForFunction(() => {
        const bezel = document.querySelector('.rpn-bezel')?.getBoundingClientRect()
        const keypad = document.querySelector('.rpn-keypad--wide')?.getBoundingClientRect()
        return bezel?.top >= 0 && keypad?.bottom <= innerHeight
      })
      assert.equal(await page.getByRole('navigation', { name: 'Seções', exact: true }).isVisible(), false)
      if (process.env.RPN_QA_OUTPUT) {
        await page.screenshot({ path: path.join(process.env.RPN_QA_OUTPUT, 'hp12c-celular-paisagem.png') })
      }
      await page.setViewportSize({ width: 390, height: 844 })
      await page.waitForFunction(() => !document.querySelector('.rpn-workspace')?.dataset.rpnMobileCompact)
      assert.equal(await panel.locator('.rpn-keypad--portrait').isVisible(), true)
      assert.match(await tape.innerText(), /12,5 \+ 3 = 15,5/)
    }
    console.log('Fita, navegação, recolher e reabrir: ' + width + '×' + height)
  } finally { await context.close() }
}

;(async () => {
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  try {
    await test(browser, 1440, 900)
    await test(browser, 390, 844)
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
