// Cenários › Juros bancários: abre no celular, tablet, notebook e tela grande, nos dois temas; troca público, modalidade,
// filtro de grandes bancos e as caixas de lista com busca (modalidade e banco); confere que nada vaza para os lados e guarda as telas.
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
    for (const width of [390, 820, 1280, 1366, 1920]) for (const theme of ['light', 'dark']) {
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
        // Abre nos grandes bancos e, para empresas, no ACC.
        assert.match(await caption(), /^Empresas · ACC · pós \(moeda estrangeira\) · 6 de 34 instituições/)
        assert.equal(await panel.getByRole('button', { name: 'Grandes bancos' }).getAttribute('aria-pressed'), 'true')
        assert.ok(await panel.locator('.jb-table tbody img.jb-logo').count() === await panel.locator('.jb-table tbody tr').count(), 'só grandes bancos, todos com logotipo')
        const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
        assert.equal(await noOverflow(), true, 'sem rolagem lateral')
        await page.screenshot({ path: path.join(out, `${width}-${theme}-empresas.png`), fullPage: false })
        // Modalidade: um clique abre a lista inteira; digitar filtra sem acento.
        const modalidade = panel.getByRole('combobox', { name: 'Modalidade' })
        await modalidade.click()
        assert.equal(await panel.locator('#jb-modalidade-opcoes [role=option]').count(), 12)
        await page.screenshot({ path: path.join(out, `${width}-${theme}-lista-modalidade.png`), fullPage: false })
        await modalidade.fill('dupli')
        assert.equal(await panel.locator('#jb-modalidade-opcoes [role=option]').count(), 1)
        await modalidade.press('Enter')
        assert.match(await caption(), /Desconto de duplicatas · pré · 7 de 58 instituições/)
        await panel.getByRole('button', { name: 'Todas' }).click()
        assert.match(await caption(), /Desconto de duplicatas · pré · 58 instituições/)
        // Banco: um clique abre todas as instituições da modalidade; digitar acha o banco.
        const banco = panel.getByRole('combobox', { name: 'Banco' })
        await banco.click()
        assert.equal(await panel.locator('#jb-banco-opcoes [role=option]').count(), 59)
        await banco.fill('banrisul')
        await page.screenshot({ path: path.join(out, `${width}-${theme}-lista-banco.png`), fullPage: false })
        await panel.locator('#jb-banco-opcoes [role=option]').first().click()
        assert.equal(await panel.locator('.jb-table tbody tr').count(), 1)
        assert.equal(await banco.inputValue(), 'Banrisul')
        await banco.click()
        await panel.locator('#jb-banco-opcoes [role=option]', { hasText: 'Todas as instituições' }).click()
        assert.match(await caption(), /Desconto de duplicatas · pré · 58 instituições/)
        await modalidade.click()
        await modalidade.press('Escape')
        assert.equal(await panel.locator('#jb-modalidade-opcoes').count(), 0)
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
