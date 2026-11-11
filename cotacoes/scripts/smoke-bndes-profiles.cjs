// QA das novas telas, separado do smoke geral para preservar integrações concorrentes.
// Execute em CI contra build servido. Não consulta taxas externas nem altera dados publicados.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { widths, profileRoutes } = require('./smoke-calculator-matrix.cjs')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.BNDES_PROFILES_QA_OUTPUT || 'workspace-qa/bndes-profiles'
;(async () => {
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  fs.mkdirSync(out, { recursive: true })
  const report = [], failures = []
  try {
    for (const width of widths) {
      const cases = profileRoutes.map(route => ({ route, width, status: 'not_run' }))
      report.push(...cases)
      const page = await browser.newPage({ viewport: { width, height: 1000 }, serviceWorkers: 'block' })
      try {
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort())
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const screenshot = async name => page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: true })
      const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      const help = async title => {
        const button = page.getByRole('button', { name: 'Ajuda: ' + title, exact: true })
        await button.click()
        await page.getByRole('dialog', { name: title, exact: true }).waitFor()
        await page.keyboard.press('Escape')
        await page.getByRole('dialog', { name: title, exact: true }).waitFor({ state: 'hidden' })
      }
      await page.goto(base + '/#calculadora')
      await page.getByRole('button', { name: 'BNDES: abrir calculadora', exact: true }).click()
      assert.equal(await page.getByRole('button', { name: /Exemplo conferido/ }).count(), 0, 'Exemplo conferido fora do topo da calculadora (11/11/2026)')
      await page.evaluate(() => { location.hash = '#calculadora/bndes-credito-tfb' }) // registro interno: segue pelo endereço direto e pela busca
      await page.waitForURL('**/#calculadora/bndes-credito-tfb')
      const tfb = page.locator('section[aria-labelledby="tfb-heading"]')
      await tfb.locator('tbody tr').last().waitFor()
      assert.equal(await tfb.locator('tbody tr').count(), 34)
      assert.match(await tfb.innerText(), /20,1569%/)
      assert.match(await tfb.innerText(), /2\.905\.817,27/)
      assert.match(await tfb.locator('tbody tr').first().innerText(), /152\.520,44/)
      assert.match(await tfb.locator('tbody tr').last().locator('td').last().innerText(), /R\$\s*0,00/)
      await help('Escopo da conferência')
      await help('Datas, centavos e base dos juros')
      await noOverflow(); await screenshot('tfb-parcelas')
      await tfb.getByRole('button', { name: 'Caixa e encargos', exact: true }).click()
      assert.equal(await tfb.locator('tbody tr').count(), 35)
      assert.match(await tfb.locator('tbody tr').first().innerText(), /94\.182,73/)
      assert.match(await tfb.locator('tbody tr').nth(1).innerText(), /2\.200,00/)
      await noOverflow(); await screenshot('tfb-caixa')
      cases[0].status = 'pass'
      await page.getByRole('button', { name: 'Simular financiamento', exact: true }).click()
      await page.locator('#bw-profile').selectOption('bndes-tlp-exigivel')
      const tlp = page.locator('section[aria-labelledby="tlp-heading"]')
      await tlp.getByRole('button', { name: 'Calcular projeção exigível' }).click()
      await tlp.getByRole('alert').waitFor()
      assert.equal(await tlp.locator('tbody tr').count(), 0)
      for (const [id, value] of Object.entries({amount:'10.000,00', release:'2026-10-15', j:'5', jSource:'Cenário sintético de QA, não cotação', bndes:'2', agent:'3', ipca:'4', schedule:'2027-10-15;252;C\n2028-10-16;252;A', scheduleSource:'Cronograma sintético de teste'})) await tlp.locator('#tlp-' + id).fill(value)
      for (const id of ['jConfirmed','scenarioConfirmed','scheduleConfirmed']) await tlp.locator('#tlp-' + id).check()
      await tlp.getByRole('button', { name: 'Calcular projeção exigível' }).click()
      await tlp.locator('tbody tr').first().waitFor()
      assert.equal(await tlp.locator('tbody tr').count(), 2)
      assert.match(await tlp.locator('tbody tr').first().locator('td').last().innerText(), /10\.000,00/)
      assert.match(await tlp.innerText(), /12\.945,10/)
      // CET da Res. CMN 4.881 (J + spreads, sem IPCA) e custo com o IPCA do cenário.
      assert.match(await tlp.locator('.tlp-cet').innerText(), /CET · parte fixa \(regra do BC\)[\s\S]*10,28% a\.a\.[\s\S]*Custo com IPCA projetado[\s\S]*14,69% a\.a\./i)
      await help('TLP exigível: regra e limite da projeção')
      await help('Como informar o cronograma')
      await noOverflow(); await screenshot('tlp-projecao')
      await tlp.locator('#tlp-agent').fill('')
      assert.equal(await tlp.locator('tbody tr').count(), 0, 'editar elimina resultado anterior')
      await tlp.getByRole('button', { name: 'Calcular projeção exigível' }).click()
      assert.match(await tlp.getByRole('alert').innerText(), /Spread do agente/)
      for (const id of ['j','bndes','agent']) await tlp.locator('#tlp-' + id).fill('0')
      await tlp.locator('#tlp-ipca').fill('-10')
      await tlp.getByRole('button', { name: 'Calcular projeção exigível' }).click()
      assert.equal(await tlp.locator('tbody tr').count(), 0, 'editar J/IPCA revoga confirmação e bloqueia novo resultado')
      assert.match(await tlp.getByRole('alert').innerText(), /confirme/i)
      for (const id of ['jConfirmed','scenarioConfirmed','scheduleConfirmed']) await tlp.locator('#tlp-' + id).check()
      await tlp.getByRole('button', { name: 'Calcular projeção exigível' }).click()
      await tlp.locator('tbody tr').first().waitFor()
      assert.match(await tlp.locator('tbody tr').first().locator('td').last().innerText(), /9\.000,00/)
      assert.match(await tlp.innerText(), /8\.100,00/)
      await screenshot('tlp-negativo')
      await page.goto(base + '/#calculadora/finame-materiais')
      const fm = page.locator('.cx-finame')
      await fm.locator('#fm-custo').selectOption('tlp')
      assert.equal(await fm.locator('.fm-grade,.fm-fluxo-panel,#fm-ipca').count(), 0)
      await fm.getByRole('link', { name: 'Abrir projeção TLP exigível' }).click()
      await page.waitForURL('**/#calculadora/bndes-tlp-exigivel')
      assert.equal(await page.locator('#tlp-amount').inputValue(), '', 'não transfere condições do Finame')
      // As duas rotas novas também são encontráveis pela busca global do build.
      for (const [query, title, route] of [['BNDES Crédito TFB', 'BNDES Crédito TFB: conferência do exemplo de 34 parcelas', 'bndes-credito-tfb'], ['TLP exigível', 'BNDES TLP exigível: projeção e cronograma', 'bndes-tlp-exigivel']]) {
        await page.keyboard.press('Control+Shift+F')
        const search = page.getByRole('dialog', { name: 'Buscar no painel' })
        await search.getByRole('searchbox').fill(query)
        await search.getByRole('button').filter({ hasText: title }).first().click()
        await page.waitForURL('**/#calculadora/' + route)
      }
      assert.deepEqual(errors, [])
      cases[1].status = 'pass'
      } catch (error) {
        for (const record of cases) if (record.status !== 'pass') { record.status = 'fail'; record.message = error.message }
        failures.push(`${width}: ${error.message}`)
        await page.screenshot({ path: path.join(out, `failure-${width}.png`), fullPage: true }).catch(() => {})
      } finally { await page.close() }
    }
    assert.deepEqual(failures, [], 'perfis BNDES nas cinco larguras')
    console.log('PASS perfis BNDES: TFB 34 linhas/caixa; TLP exigível, negativa e bloqueios; 320/390/768/1024/1440 px')
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
