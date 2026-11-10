const openCallouts = require('./smoke-aprender-disclosures.cjs')
// Read-only browser verification of the delivered UI. No source fixtures or notification grants.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const base = (process.env.SMOKE_PUBLISHED_URL || process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768').replace(/\/$/, '')
const out = process.env.PUBLISHED_QA_OUTPUT || 'workspace-qa/published'
const links = {
  'Materiais Industrializados': 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/finame-materiais-industrializados',
  'Máquinas e Equipamentos': 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/bndes-finame-bk-aquisicao-comercializacao',
}
;(async () => {
  const { CONCEITOS, porTopico } = await import('../src/educacao.js')
  const topicCount = porTopico(CONCEITOS).length
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const report = []
  let page
  try {
    for (const width of [390, 820, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce', serviceWorkers: 'block', permissions: [] })
      page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const visit = async (route, selector) => {
        await page.goto(base + '/?qa=' + Date.now() + '#' + route, { waitUntil: 'domcontentloaded' })
        await page.locator(selector).first().waitFor()
        const notice = page.getByRole('dialog', { name: 'Aviso', exact: true })
        if (await notice.isVisible()) await notice.getByRole('button', { name: 'Entendi', exact: true }).click()
        await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
      }
      const contained = async label => {
        const geometry = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth }))
        assert.ok(geometry.document <= geometry.width + 1, label + ': ' + JSON.stringify(geometry))
      }

      await visit('calculadora/cbs-caixa', '.cbs-annual-chart')
      // Nome do painel no ar: aba do navegador em toda largura; marca do topo onde a barra aparece.
      assert.equal(await page.title(), 'PEME · Painel Especializado no Mercado', 'nome na aba do navegador')
      if (width >= 1000) {
        assert.equal((await page.locator('.topbar-brand').innerText()).trim(), 'PEME', 'marca do topo')
        assert.equal(await page.locator('.topbar-brand').getAttribute('title'), 'Painel Especializado no Mercado', 'nome completo ao passar o mouse')
      }
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      assert.equal(await page.locator('.cbs-annual-chart').isVisible(), true)
      assert.deepEqual(await page.locator('.cbs-annual-chart text').allTextContents(), months)
      assert.equal(await page.locator('.cbs-chart-dot').count(), 12)
      const initialReading = await page.locator('.cbs-month-reading').innerText()
      await page.locator('.cbs-month-editor > summary').click()
      await page.locator('#cbs-month-1').fill('2.000.000,00')
      await page.getByRole('button', { name: 'Fev', exact: true }).click()
      assert.match(await page.locator('.cbs-month-reading').innerText(), /2\.000\.000,00/)
      await page.getByRole('button', { name: 'Jan', exact: true }).click()
      assert.equal(await page.locator('.cbs-month-reading').innerText(), initialReading)
      await page.locator('#cbs-month-1').fill('0')
      assert.equal(await page.locator('.cbs-chart-dot').count(), 11)
      await page.getByRole('button', { name: 'Fev', exact: true }).click()
      assert.match(await page.locator('.cbs-month-reading').innerText(), /Faturamento inv/)
      await page.locator('.cbs-month-editor button').click()
      assert.equal(await page.locator('.cbs-chart-dot').count(), 12)
      await page.locator('.cbs-month-editor > summary').click()
      await contained('CBS Jan-Dez')
      await page.screenshot({ path: path.join(out, width + '-cbs-jan-dez.png'), fullPage: true })
      report.push({ width, feature: 'CBS Jan-Dez', passed: true, checks: ['12 meses abertos', 'editar fevereiro preserva janeiro', 'mes invalido deixa lacuna', 'restaurar 12 pontos', 'sem overflow'] })

      await visit('calculadora/finimp', '#fi-currency')
      assert.deepEqual(await page.locator('#fi-currency option').allTextContents(), ['USD', 'EUR', 'JPY', 'CNH', 'BRL'])
      for (const code of ['JPY', 'CNH']) {
        await page.locator('#fi-currency').selectOption(code)
        assert.equal(await page.locator('#fi-currency').inputValue(), code)
      }
      await contained('FINIMP')
      await page.screenshot({ path: path.join(out, width + '-finimp.png') })

      await visit('calculadora/conta-garantida', '#cg-rate')
      assert.equal(await page.locator('#cg-status, #cg-rateBase, #cg-conversion').count(), 0)
      assert.equal(await page.locator('#cg-taxProfile').count(), 1)
      assert.equal(await page.getByLabel('Taxa do contrato (% a.m.)', { exact: true }).count(), 1)
      await contained('Conta Garantida')

      await visit('aprender', '.knowledge-map')
      await page.locator('.km-node').first().waitFor()
      assert.equal(await page.getByRole('button', { name: 'Mapa do conhecimento', exact: true }).getAttribute('aria-pressed'), 'true')
      assert.equal(await page.getByRole('navigation', { name: 'Explorar Aprender', exact: true }).getByRole('button', { name: 'Conceitos', exact: true }).getAttribute('aria-pressed'), 'false')
      assert.equal(await page.locator('.learn-list').count(), 0)
      assert.equal(await page.getByRole('group', { name: 'Mostrar no mapa', exact: true }).getByRole('button').count(), 3)
      assert.equal(await page.getByRole('button', { name: 'Voltar à matriz', exact: true }).count(), 1)
      await contained('Mapa do conhecimento')
      await page.screenshot({ path: path.join(out, width + '-mapa-conhecimento.png') })

      await visit('aprender/conceitos', '.learn-group')
      assert.equal(await page.locator('.learn-group').count(), topicCount)
      assert.equal(await page.locator('.learn-group[open]').count(), 0)
      await page.getByRole('button', { name: 'Expandir todas', exact: true }).click()
      await page.waitForFunction(count => document.querySelectorAll('.learn-group[open]').length === count, topicCount)
      for (const term of ['Escala 6x1', 'Reforma tributária', 'Split payment', 'Dividendos', 'CET', 'Controle forçado de juros']) {
        assert.equal(await page.locator('.learn-list li button').filter({ hasText: new RegExp(term, 'i') }).count(), 1, term)
      }
      assert.equal(await page.locator('.learn-list li').count(), CONCEITOS.length)
      assert.deepEqual((await page.locator('.learn-list li button b').allTextContents()).sort(), CONCEITOS.map(concept => concept.nome.replace(/ \(.*\)/, '')).sort())
      assert.equal(await page.locator('.learn-list li button').filter({ hasText: 'Regime FÁCIL' }).count(), 1)
      await page.locator('.learn-list li button').filter({ has: page.getByText('CET', { exact: true }) }).click()
      await page.locator('.learn-detail h2', { hasText: 'CET (Custo Efetivo Total)' }).waitFor()
      await openCallouts(page)
      assert.match(await page.locator('.learn-detail').innerText(), /13,40% ao ano/)
      await page.locator('.learn-detail summary', { hasText: /^Versão precisa$/ }).click()
      assert.match(await page.locator('.learn-detail [role="math"]').innerText(), /dj − d0.*365/)
      await page.locator('.learn-detail summary', { hasText: /^Fontes$/ }).click()
      assert.equal(await page.locator('.learn-detail a[href="https://www.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolu%C3%A7%C3%A3o4881.pdf"]').count(), 1)
      await contained('CET em Aprender')
      await page.screenshot({ path: path.join(out, width + '-cet.png'), fullPage: true })
      await page.getByRole('button', { name: 'Recolher todas', exact: true }).click()
      await page.waitForFunction(() => document.querySelectorAll('.learn-group[open]').length === 0)
      await contained('Aprender')
      await page.screenshot({ path: path.join(out, width + '-aprender.png') })

      await visit('bndes', '.bn')
      for (const [name, href] of Object.entries(links)) {
        const link = page.getByRole('navigation', { name: 'Linhas oficiais BNDES' }).getByRole('link', { name: new RegExp(name) })
        assert.equal(await link.count(), 1)
        assert.equal(await link.getAttribute('href'), href)
      }
      await contained('BNDES')
      await page.screenshot({ path: path.join(out, width + '-bndes.png') })

      await visit('resumo', '#r-moedas')
      await page.getByRole('tab', { name: 'Google Trends', exact: true }).click()
      await page.locator('.google-trends').waitFor()
      assert.match(await page.locator('.google-trends').innerText(), /8h e 15h/)
      await contained('Google Trends')

      await visit('config', '.config-gov')
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
      await contained('Configurações')
      const refresh = page.getByRole('button', { name: 'Atualizar Governança dos dados', exact: true })
      await refresh.locator('..').locator('.refresh-stamp').waitFor()
      const box = await refresh.boundingBox()
      assert.ok(box && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= width + 1, 'Governança: botão inteiro dentro da tela')
      await page.screenshot({ path: path.join(out, width + '-config.png') })
      assert.deepEqual(errors, [])
      report.push({ width, passed: true, checks: ['FINIMP JPY/CNH', 'Conta Garantida % a.m. e IOF', 'Aprender abre mapa com pontos, filtros e retorno à matriz', `Aprender ${CONCEITOS.length}/${topicCount}, CET, história dos juros e categorias`, 'dois links BNDES', 'Google Trends', 'tema automático', 'Governança sem overflow'], errors })
      await context.close()
      page = null
    }
    const cetReport = []
    for (const width of [390, 1440]) for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme, reducedMotion: 'reduce', serviceWorkers: 'block', permissions: [] })
      page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(base + '/?qa=' + Date.now() + '#aprender/cet', { waitUntil: 'domcontentloaded' })
      const notice = page.getByRole('dialog', { name: 'Aviso', exact: true })
      if (await notice.isVisible()) await notice.getByRole('button', { name: 'Entendi', exact: true }).click()
      const card = page.locator('.learn-card.is-focus')
      await card.getByRole('heading', { name: 'CET (Custo Efetivo Total)', exact: true }).waitFor()
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, colorScheme)
      await openCallouts(page)
      await card.getByText('Versão precisa', { exact: true }).click()
      await card.getByText('Fontes', { exact: true }).click()
      const formula = card.locator('.learn-formula')
      assert.match(await formula.innerText(), /dj − d0.*365/)
      assert.match(await card.innerText(), /13,40% ao ano/)
      const source = card.getByRole('link', { name: /Banco Central.*4.881/ })
      assert.equal(await source.getAttribute('href'), 'https://www.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolu%C3%A7%C3%A3o4881.pdf')
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }))
      const formulaGeometry = await formula.evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth }))
      assert.ok(geometry.scroll <= width + 1, JSON.stringify(geometry))
      assert.ok(formulaGeometry.scroll <= formulaGeometry.client + 1, JSON.stringify(formulaGeometry))
      await page.screenshot({ path: path.join(out, `cet-${width}-${colorScheme}-conteudo.png`), fullPage: true })
      const go = card.locator('.learn-go')
      // Confira o fim real da página: a rolagem mínima de scrollIntoView pode parar atrás da barra fixa.
      await page.evaluate(async () => { window.scrollTo({ top: document.scrollingElement.scrollHeight, behavior: 'instant' }); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
      const endState = await go.evaluate(el => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { visible: r.top >= 0 && r.bottom <= innerHeight && !!hit && el.contains(hit), top: r.top, bottom: r.bottom, viewport: innerHeight, hit: hit?.className, scrollTop: document.scrollingElement.scrollTop } })
      await page.screenshot({ path: path.join(out, `cet-${width}-${colorScheme}-fim.png`) })
      assert.equal(endState.visible, true, `ação final do CET alcançável a ${width}px/${colorScheme}: ${JSON.stringify(endState)}`)
      const help = card.getByRole('button', { name: 'Sobre CET (Custo Efetivo Total)', exact: true })
      // A ajuda flutuante fecha ao rolar: estabilize a posição antes de focar e abrir pelo teclado.
      await help.scrollIntoViewIfNeeded()
      await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
      await help.focus()
      await page.keyboard.press('Enter')
      const tooltip = page.getByRole('tooltip')
      await tooltip.waitFor()
      assert.match(await tooltip.innerText(), /30 dias e limite pactuado/)
      assert.match(await tooltip.innerText(), /ME e EPP/)
      const tooltipGeometry = await tooltip.boundingBox()
      assert.ok(tooltipGeometry && tooltipGeometry.x >= 0 && tooltipGeometry.x + tooltipGeometry.width <= width + 1, 'ajuda CET dentro da tela')
      await page.screenshot({ path: path.join(out, `cet-${width}-${colorScheme}-ajuda.png`) })
      await page.keyboard.press('Escape')
      await tooltip.waitFor({ state: 'hidden' })
      assert.deepEqual(errors, [])
      cetReport.push({ width, colorScheme, passed: true, geometry, formulaGeometry, errors })
      await context.close()
      page = null
    }
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ base, checkedAt: new Date().toISOString(), report, cetReport }, null, 2))
    console.log('PASS CET em Aprender: ' + JSON.stringify(cetReport))
    require('node:child_process').execFileSync(process.execPath, [require('node:path').join(__dirname, 'smoke-discount-iof.cjs')], { stdio: 'inherit', env: process.env })
    console.log('PASS versão entregue: ' + JSON.stringify(report))
    require('node:child_process').execFileSync(process.execPath, [require('node:path').join(__dirname, 'smoke-tic-animation.cjs')], { stdio: 'inherit', env: process.env })
  } catch (error) {
    await page?.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {})
    throw error
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
