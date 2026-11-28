// Cenários › Juros bancários: abre no celular, tablet, notebook e tela grande, nos dois temas; troca público, modalidade,
// filtro de grandes bancos e busca; confere que nada vaza para os lados e guarda as telas.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.JUROS_BANCARIOS_QA_OUTPUT || 'workspace-qa/juros-bancarios'
;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  try {
    for (const width of [390, 820, 1366, 1920]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' })
      const page = await context.newPage(), errors = []
      page.on('pageerror', e => errors.push(e.message))
      try {
        await page.goto(base + '/#cenarios/juros-bancarios', { waitUntil: 'domcontentloaded' })
        const panel = page.locator('.jb-panel')
        await panel.locator('.jb-table tbody tr').first().waitFor({ timeout: 30000 })
        // A faixa de assuntos traz Juros bancários entre Projeções e Calendário econômico.
        const tabs = await page.locator('button', { hasText: /^(Projeções|Juros bancários|Calendário econômico)$/ }).allTextContents()
        assert.deepEqual(tabs.slice(0, 3), ['Projeções', 'Juros bancários', 'Calendário econômico'])
        const caption = () => panel.locator('.jb-table caption').textContent()
        assert.match(await caption(), /^Empresas · Capital de giro acima de 365 dias · pré · 46 instituições/)
        assert.ok(await panel.locator('img.jb-logo').count() > 0, 'logotipos dos bancos')
        const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
        assert.equal(await noOverflow(), true, 'sem rolagem lateral')
        await page.screenshot({ path: path.join(out, `${width}-${theme}-empresas.png`), fullPage: false })
        await panel.getByRole('button', { name: 'Grandes bancos' }).click()
        assert.match(await caption(), /de 46 instituições/)
        assert.ok(await panel.locator('.jb-table tbody img.jb-logo').count() === await panel.locator('.jb-table tbody tr').count(), 'só grandes bancos, todos com logotipo')
        await panel.getByRole('button', { name: 'Todas' }).click()
        await panel.getByLabel('Modalidade').fill('Desconto de duplicatas · pré')
        assert.match(await caption(), /Desconto de duplicatas · pré · 58 instituições/)
        await panel.getByLabel('Buscar banco').fill('banrisul')
        assert.equal(await panel.locator('.jb-table tbody tr').count(), 1)
        await panel.getByLabel('Buscar banco').fill('')
        await panel.getByRole('button', { name: 'Pessoas' }).click()
        assert.match(await caption(), /^Pessoas · Crédito pessoal não consignado · pré · \d+ instituições/)
        assert.equal(await noOverflow(), true, 'sem rolagem lateral em pessoas')
        await page.screenshot({ path: path.join(out, `${width}-${theme}-pessoas.png`), fullPage: false })
        assert.deepEqual(errors, [])
        console.log(`PASS ${width} ${theme}`)
      } finally { await context.close() }
    }
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
