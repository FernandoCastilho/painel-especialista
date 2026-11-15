const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.BANKS_QA_OUTPUT || 'workspace-qa/bancos'
;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const report = []
  try {
    for (const width of [390, 820, 1440]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' })
      const page = await context.newPage(), errors = []
      const rows = '.banks-table > thead th[data-bank]'
      const selector = '.banks-table-scroll'
      try {
        page.on('pageerror', e => errors.push(e.message))
        await page.goto(base + '/?qa=bancos#bancos', { waitUntil: 'domcontentloaded' })
        const panel = page.locator(selector)
        await panel.waitFor()
        const notice = page.getByRole('dialog', { name: 'Aviso', exact: true })
        if (await notice.isVisible()) await notice.getByRole('button', { name: 'Entendi', exact: true }).click()
        await page.waitForFunction(s => document.querySelectorAll(s).length === 7, rows)
        assert.equal(await page.locator(rows).count(), 7)
        assert.equal(await panel.getByText(/ABC Brasil|Daycoval/).count(), 0)
        assert.equal(await panel.locator('tbody tr[data-metric]').count(), 10)
        assert.equal(await panel.locator('tbody tr[data-metric=basel] td').count(), 7)
        assert.equal(await panel.locator('thead th').first().innerText(), 'Indicador')
        assert.match(await panel.innerText(), /Carteira PJ/)
        assert.match(await panel.innerText(), /Carteira PF/)
        assert.equal(await panel.getByText('Evolução dos indicadores', { exact: true }).count(), 0)
        assert.equal(await panel.getByText('Detalhes e fontes', { exact: true }).count(), 0)
        assert.ok(await panel.locator('.bank-trophy').count() > 0, 'troféus com universo comparável identificado')
        assert.doesNotMatch(await panel.locator('.bank-trophy').first().innerText(), /BC|bancos|2026/)
        assert.doesNotMatch(await panel.innerText(), /Votorantim|Fontes ⓘ|Resultado do banco|Banco Central \+ RI/)
        assert.equal(await panel.locator('.bank-identity img').count(), 7)
        await panel.locator('.bank-identity img').evaluateAll(images => Promise.all(images.map(img => img.decode())))
        assert.ok(await panel.locator('.bank-identity img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0)))
        const layout = await panel.evaluate(el => ({ headerHeight: el.querySelector('thead').getBoundingClientRect().height, firstRowHeight: el.querySelector('tbody tr').getBoundingClientRect().height, infoTargets: [...el.querySelectorAll('.bank-source-button')].map(button => ({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height})) }))
        assert.ok(layout.headerHeight <= 90, 'cabeçalho compacto até90px')
        assert.ok(layout.firstRowHeight <= 76, 'linha compacta sem redução de fonte')
        assert.ok(layout.infoTargets.every(target => target.width >= 44 && target.height >= 44), 'i mantém alvo44px')
        fs.writeFileSync(path.join(out, `${width}-${theme}-layout.json`),JSON.stringify(layout,null,2))
        const up = panel.locator('.bank-change--subiu').first()
        assert.match(await up.innerText(), /↑/)
        assert.doesNotMatch(await up.innerText(), /subiu/)
        assert.match(await panel.locator('.bank-change--caiu').first().innerText(), /↓/)
        const geometry = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth }))
        assert.ok(geometry.document <= geometry.width + 1, JSON.stringify(geometry))
        await panel.scrollIntoViewIfNeeded()
        const sticky = await panel.evaluate(element => {
          element.scrollTop = element.scrollHeight
          element.scrollLeft = element.scrollWidth
          const box = element.getBoundingClientRect()
          return { scrollable: element.scrollHeight > element.clientHeight,
            headers: [...element.querySelectorAll('thead th')].map(cell => ({ top: cell.getBoundingClientRect().top, sticky: getComputedStyle(cell).position })),
            top: box.top, firstLeft: element.querySelector('thead th').getBoundingClientRect().left, left: box.left }
        })
        assert.ok(sticky.headers.every(cell => cell.sticky === 'sticky'), 'todos os cabeçalhos ficam fixos')
        if (sticky.scrollable) assert.ok(sticky.headers.every(cell => Math.abs(cell.top - sticky.top) <= 2), 'nomes e períodos continuam visíveis após rolagem vertical')
        assert.ok(Math.abs(sticky.firstLeft - sticky.left) <= 2, 'Indicador continua visível após rolagem horizontal')
        await page.screenshot({ path: path.join(out, `${width}-${theme}-scrolled.png`), fullPage: true })
        await panel.evaluate(element => { element.scrollTop = 0; element.scrollLeft = 0 })
        await page.screenshot({ path: path.join(out, `${width}-${theme}.png`), fullPage: true })
        await page.getByLabel('Buscar banco', { exact: true }).fill('Itaú')
        await page.waitForFunction(s => document.querySelectorAll(s).length === 1, rows)
        await page.getByLabel('Provisões e inadimplência', { exact: true }).selectOption('PF')
        await panel.getByText('Provisão PF', { exact: false }).first().waitFor()
        await page.getByLabel('Evolução versus', { exact: true }).selectOption('-4')
        await panel.getByText('comparação anual', { exact: false }).first().waitFor()
        await page.getByLabel('Base de comparação', { exact: true }).selectOption('bc')
        await page.waitForFunction(s => document.querySelector(s)?.innerText.includes('2T2026'), rows)
        const historyButton = panel.getByRole('button', { name: 'Ver histórico de Basileia', exact: true })
        await historyButton.press('Enter')
        const historyPanel = page.getByRole('dialog', { name: 'Histórico de Basileia', exact: true })
        await historyPanel.getByRole('img', {name:'Basileia de Itaú',exact:false}).waitFor()
        assert.match(await historyPanel.innerText(), /sem dado/)
        await historyPanel.evaluate(element => { element.scrollTop = 0 })
        await page.screenshot({ path: path.join(out, `${width}-${theme}-history-top.png`), fullPage: false })
        await historyPanel.getByText('Valores históricos e fontes', {exact:true}).click()
        assert.ok(await historyPanel.locator('a').count() > 0)
        await page.screenshot({ path: path.join(out, `${width}-${theme}-history.png`), fullPage: true })
        const dialogGeometry = await historyPanel.evaluate(el => ({width:el.getBoundingClientRect().width,viewport:innerWidth}))
        assert.ok(dialogGeometry.width <= dialogGeometry.viewport, 'histórico cabe no dispositivo')
        await page.keyboard.press('Escape')
        await historyPanel.waitFor({state:'hidden'})
        assert.ok(await historyButton.evaluate(el => el === document.activeElement), 'histórico devolve foco à linha')
        await panel.locator('tr[data-metric=assets] td').first().click()
        await page.getByRole('dialog', {name:'Histórico de Ativos totais',exact:true}).waitFor()
        await page.keyboard.press('Escape')
        await page.getByRole('dialog', {name:'Histórico de Ativos totais',exact:true}).waitFor({state:'hidden'})
        const detail = panel.getByRole('button', { name: 'Fontes e critérios — Itaú', exact: true })
        await detail.press('Enter')
        const detailsPanel = page.getByRole('dialog', {name:'Detalhes e fontes — Itaú',exact:true})
        await detailsPanel.locator('.bank-details[open]').waitFor()
        await page.screenshot({ path: path.join(out, `${width}-${theme}-details.png`), fullPage: true })
        assert.ok(await detailsPanel.locator('.bank-details[open] a').count() > 0)
        {
          await page.keyboard.press('Escape')
          await detailsPanel.waitFor({state:'hidden'})
          assert.ok(await detail.evaluate(el => el === document.activeElement), 'fecha e restaura o foco no banco')
        }
        await page.getByLabel('Buscar banco', { exact: true }).fill('nenhum-banco')
        await page.getByText('Nenhum banco encontrado.', { exact: true }).waitFor()
        assert.deepEqual(errors, [])
        report.push({ width, theme, passed: true, checks: ['7 bancos e logotipos locais, sem ABC e Daycoval', '10 indicadores nas linhas', 'PJ/PF', 'cabeçalhos e primeira coluna fixos na rolagem', 'sem overflow da página', 'busca', 'segmento', 'anual', 'BC', 'setas direcionais', 'troféu inline, critério no histórico', 'bloco final removido', 'histórico gráfico com lacunas', 'clique na célula', 'detalhes por teclado', 'vazio', 'sem erro JS'] })
      } catch (error) {
        fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({width,theme,message:error.message,stack:error.stack},null,2))
        await page.screenshot({path:path.join(out,`${width}-${theme}-failure.png`),fullPage:true})
        throw error
      } finally { await context.close() }
    }
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
    console.log('Bancos: seis cenários passaram (390/820/1440, claro/escuro).')
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
