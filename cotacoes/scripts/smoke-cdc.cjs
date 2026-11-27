// Teste de tela do CDC (pedido de Fernando, 25/11/2026): campos na horizontal e ocupando a largura no computador, empilhados
// no celular; sem categoria e sem coeficiente; caminhão ao lado do título; vencimento no dia do contrato, sem praça.
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
        assert.equal(await page.getByText('Para ver o spread').count(), 0, 'sem o aviso do spread embaixo da taxa')
        // Grade: colunas conforme a largura da tela, e o quadro de entrada ocupa a largura toda.
        const grade = page.locator('.cdc-screen .giro-form .lm > .lm-grid')
        const n = await grade.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length)
        assert.equal(n, colunas, `colunas em ${nome}: ${n}`)
        const [quadro, fluxo] = await Promise.all([page.locator('.cdc-screen .giro-form .lm').boundingBox(), page.locator('.cdc-screen .giro-flow').boundingBox()])
        assert.ok(quadro.width >= fluxo.width * 0.95, `quadro estreito em ${nome}: ${quadro.width} de ${fluxo.width}`)
        // Sem praça do contrato: o vencimento fica no dia do contrato (decisão de Fernando, 26/11/2026).
        assert.equal(await page.locator('#cdc-praca').count(), 0, 'sem o campo de praça no CDC')
        // Custo digitado no "!" (um ou outro com a tabela colada): 48 meses a 15,58% a.a. vira o funding do prazo de 48.
        await page.getByRole('button', { name: 'Tabela de funding: colar ou atualizar' }).click()
        const dialogo = page.locator('.cdc-funding-dialog')
        assert.equal(await dialogo.getByRole('textbox', { name: /^Custo ao ano em/ }).count(), 8, 'campos ao ano de 12 a 72 meses')
        assert.equal(await dialogo.getByRole('textbox', { name: /^Custo ao mês em/ }).count(), 8, 'campos ao mês de 12 a 72 meses')
        await dialogo.getByRole('textbox', { name: 'Custo ao ano em 48 meses' }).fill('15,58')
        await dialogo.getByRole('textbox', { name: 'Custo ao mês em 12 meses' }).fill('1,13')
        assert.equal(await dialogo.getByRole('textbox', { name: 'Custo ao ano em 12 meses' }).isDisabled(), true, 'ao mês preenchido trava o ao ano do mesmo prazo')
        await page.screenshot({ path: path.join(out, `cdc-funding-${nome}-${tema}.png`) })
        // Validade obrigatória no custo digitado (pedido de Fernando, 26/11/2026): sem ela, não salva e avisa.
        await dialogo.getByRole('button', { name: 'Usar esta tabela' }).click()
        await dialogo.getByText('Informe até quando vale o funding').waitFor()
        await dialogo.getByLabel('Válido até').fill('2999-12-31')
        await dialogo.getByRole('button', { name: 'Usar esta tabela' }).click()
        await page.getByText('sobre funding de 15,58% a.a.').waitFor()
        // Fica salvo no navegador: recarregando a página, o funding continua até a validade.
        await page.reload()
        await page.getByText('sobre funding de 15,58% a.a.').waitFor()
        await page.getByRole('button', { name: 'Simular' }).click()
        const resultado = page.locator('.cdc-screen .giro-result')
        await resultado.getByText('Valor da parcela').waitFor()
        const texto = await resultado.innerText()
        assert.doesNotMatch(texto, /Coeficiente/, 'coeficiente fora da tela')
        assert.match(texto, /R\$\s?[\d.]+,\d{2}/)
        const largura = await page.evaluate(() => document.documentElement.scrollWidth)
        assert.ok(largura <= viewport.width + 1, `rolagem lateral em ${nome}: ${largura}px`)
        await page.screenshot({ path: path.join(out, `cdc-${nome}-${tema}.png`), fullPage: true })
        // Validade vencida: ao abrir, o funding se apaga e a tela avisa; pelo spread não calcula.
        await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cdc-funding')); localStorage.setItem('cdc-funding', JSON.stringify({ ...s, validoAte: '2020-01-01' })) })
        await page.reload()
        await page.getByText('A tabela de funding venceu em 01/01/2020 e foi apagada').waitFor()
        assert.equal(await page.evaluate(() => localStorage.getItem('cdc-funding')), null, 'funding vencido apagado')
        await page.locator('#cdc-modo').selectOption('spread')
        await page.getByRole('button', { name: 'Simular' }).click()
        await resultado.getByText('O funding venceu em 01/01/2020').waitFor()
        await page.close()
      }
    }
    assert.deepEqual(erros, [])
    console.log(`ok: capturas em ${out}`)
  } finally {
    await browser.close()
  }
})().catch((e) => { console.error(e); process.exit(1) })
