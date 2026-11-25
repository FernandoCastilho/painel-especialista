// Teste de tela do CDC (pedido de Fernando, 25/11/2026): campos na horizontal e ocupando a largura no computador, empilhados
// no celular; sem categoria e sem coeficiente; caminhão ao lado do título; praça do contrato com feriados locais.
// Gera as capturas que vão como artefato da conferência.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.CDC_QA_OUTPUT || 'workspace-qa/cdc'

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] })
  const erros = []
  try {
    for (const [nome, viewport, colunas] of [['computador', { width: 1440, height: 1000 }, 4], ['tablet', { width: 820, height: 1100 }, 2], ['celular', { width: 390, height: 900 }, 1]]) {
      for (const tema of nome === 'tablet' ? ['light'] : ['light', 'dark']) {
        const page = await browser.newPage({ viewport, colorScheme: tema })
        page.on('pageerror', (e) => erros.push(e.message))
        await page.route('**/*', (route) => (route.request().url().startsWith(base + '/') ? route.continue() : route.abort()))
        await page.goto(`${base}/#calculadora/cdc`)
        await page.getByRole('heading', { name: 'CDC', exact: true }).waitFor()
        assert.equal(await page.locator('.cdc-screen .cdc-icon svg').count(), 1, 'caminhão ao lado do título')
        assert.equal(await page.locator('#cdc-categoria').count(), 0, 'sem o campo categoria')
        // Grade: colunas conforme a largura da tela, e o quadro de entrada ocupa a largura toda.
        const grade = page.locator('.cdc-screen .giro-form .lm > .lm-grid')
        const n = await grade.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length)
        assert.equal(n, colunas, `colunas em ${nome}: ${n}`)
        const [quadro, fluxo] = await Promise.all([page.locator('.cdc-screen .giro-form .lm').boundingBox(), page.locator('.cdc-screen .giro-flow').boundingBox()])
        assert.ok(quadro.width >= fluxo.width * 0.95, `quadro estreito em ${nome}: ${quadro.width} de ${fluxo.width}`)
        // Praça: busca por texto, como nas outras calculadoras; 15/08/2028 é feriado em Sorocaba.
        await page.fill('#cdc-praca', 'Soro')
        await page.getByRole('option', { name: 'Sorocaba (SP)' }).click()
        assert.equal(await page.inputValue('#cdc-praca'), 'Sorocaba (SP)')
        await page.getByRole('button', { name: 'Simular' }).click()
        const resultado = page.locator('.cdc-screen .giro-result')
        await resultado.getByText('Valor da parcela').waitFor()
        const texto = await resultado.innerText()
        assert.doesNotMatch(texto, /Coeficiente/, 'coeficiente fora da tela')
        assert.match(texto, /R\$\s?[\d.]+,\d{2}/)
        const largura = await page.evaluate(() => document.documentElement.scrollWidth)
        assert.ok(largura <= viewport.width + 1, `rolagem lateral em ${nome}: ${largura}px`)
        await page.screenshot({ path: path.join(out, `cdc-${nome}-${tema}.png`), fullPage: true })
        await page.close()
      }
    }
    assert.deepEqual(erros, [])
    console.log(`ok: capturas em ${out}`)
  } finally {
    await browser.close()
  }
})().catch((e) => { console.error(e); process.exit(1) })
