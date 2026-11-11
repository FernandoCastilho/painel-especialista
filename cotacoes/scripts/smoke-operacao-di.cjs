// Conferência de navegador da calculadora Operação x DI (#calculadora/operacao-di).
// Regras de crédito de 11/11/2026: vencimento em feriado vai para o próximo dia útil, juros pré por dias corridos,
// IOF e tarifas na liberação, CET da Res. CMN 4.881/2020 e, no pós-fixado, CET da parte fixa com o custo projetado à parte.
// Números esperados recalculados aqui, sem o código do painel; curva plana de 14% a.a. e feriados listados à mão.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.OPERACAO_DI_QA_OUTPUT || 'workspace-qa/operacao-di'
const BASE_DATE = '2026-11-11'
const normalize = text => text.replace(/\s+/g, ' ').trim()
const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s+/g, ' ')
const pct = v => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

// Liberação 11/11/2026, vencimento contratado 01/01/2027 (feriado) → 04/01/2027: 54 dias corridos.
// Dias úteis em (11/11/2026, 04/01/2027], sem 20/11, 25/12 e 01/01: 12 em novembro, 22 em dezembro, 1 em janeiro = 35.
const DAYS = 54, DU = 35, VALUE = 1e6, FEES = 1000
const IOF = VALUE * 0.0038 + VALUE * 0.000082 * DAYS
const NET = VALUE - IOF - FEES
const cetOf = payment => (payment / NET) ** (365 / DAYS) - 1

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const errors = []
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
      page.on('pageerror', e => errors.push(`${width}: ${e.message}`))
      await page.route('**/curves.json*', route => route.fulfill({ json: {
        generatedAt: Date.now(),
        br: { compare: [{ id: 'hoje', date: BASE_DATE, label: 'Hoje' }], curves: { [BASE_DATE]: [[21, 14], [126, 14], [252, 14], [504, 14]] } },
      } }))
      await page.goto(`${base}/#calculadora/operacao-di`)
      const section = page.locator('main.app section.cx').first()
      await section.waitFor()
      await section.locator('.cx-matrix').waitFor()
      const row = label => section.locator('.cx-matrix tbody tr').filter({ has: page.getByRole('rowheader', { name: label, exact: true }) }).locator('td').first()

      // Crédito prefixado a 2% a.m. com tarifa de R$ 1.000.
      await section.locator('#od-value').fill('1.000.000,00')
      await section.getByRole('button', { name: 'a.m.', exact: true }).click()
      await section.locator('#od-rate').fill('2,00')
      await section.locator('#od-end').fill('2027-01-01')
      await section.locator('#od-fees').fill('1.000,00')
      await section.locator('#od-profile').waitFor()
      assert.match(normalize(await section.locator('.cx-hint').first().innerText()), /35 dias úteis, 54 dias corridos\. Vencimento em dia não útil: passa para 04\/01\/2027\./)
      assert.equal(normalize(await row('IOF na liberação').innerText()), brl(IOF))
      assert.equal(normalize(await row('Tarifas na liberação').innerText()), brl(FEES))
      assert.equal(normalize(await row('Valor líquido liberado').innerText()), brl(NET))
      assert.equal(normalize(await row('Juros').innerText()), brl(VALUE * (1.02 ** (DAYS / 30) - 1)))
      const cet = section.locator('.od-cet')
      assert.equal(normalize(await cet.locator('dt').first().textContent()), 'CET')
      assert.match(normalize(await cet.locator('dd').first().innerText()), new RegExp(`^${pct(cetOf(VALUE * 1.02 ** (DAYS / 30))).replace('.', '\\.')} a\\.a\\.`))
      assert.equal(await cet.locator('dt').count(), 1, 'prefixado: só o CET')
      assert.match(normalize(await section.locator('.status').last().innerText()), /CET pela Res\. CMN 4\.881\/2020/)
      await page.screenshot({ path: path.join(out, `credito-pre-${width}.png`), fullPage: true })

      // CDI + 2% a.a.: CET da parte fixa (regra do BC) e custo com o CDI projetado à parte.
      await section.getByRole('button', { name: 'CDI + spread', exact: true }).click()
      await section.locator('#od-rate').fill('2,00')
      const labels = (await cet.locator('dt').allTextContents()).map(normalize)
      assert.deepEqual(labels, ['CET · parte fixa (regra do BC)', 'Custo com CDI projetado'])
      const values = (await cet.locator('dd').allInnerTexts()).map(normalize)
      assert.ok(values[0].startsWith(`${pct(cetOf(VALUE * 1.02 ** (DU / 252)))} a.a.`), values[0])
      assert.ok(values[1].startsWith(`${pct(cetOf(VALUE * (1.14 * 1.02) ** (DU / 252)))} a.a.`), values[1])
      assert.match(values[1], /não é CET/)
      await page.screenshot({ path: path.join(out, `credito-spread-${width}.png`), fullPage: true })

      // Aplicação: sem IOF, tarifas nem CET (convenção de renda fixa, sem mudança).
      await section.getByRole('button', { name: 'Aplicação (rendimento)', exact: true }).click()
      assert.equal(await section.locator('.od-cet').count(), 0)
      assert.equal(await section.locator('#od-fees').count(), 0)
      assert.match(normalize(await section.locator('.status').last().innerText()), /Sem IOF, IR e tarifas/)

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert.ok(overflow <= 1, `${width}: rolagem horizontal de ${overflow}px`)
      await page.close()
      console.log(`PASS operacao-di ${width}`)
    }
    assert.deepEqual(errors, [], 'erros do navegador')
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exit(1) })
