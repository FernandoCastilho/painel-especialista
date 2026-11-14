const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const studies = require('../src/sectorStudies/studies.json')

;(async () => {
  const { CATALOGO_SETORIAL } = await import('../src/centralSetorial.js')
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8773'
  const out = process.env.SETORES_QA_OUTPUT || 'workspace-qa/setores'
  fs.mkdirSync(out, { recursive: true })
  try {
    for (const width of [390, 820, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const now = Date.now()
      await page.clock.setFixedTime(now)
      const sectorFixture = { schemaVersion: 1, generatedAt: new Date(now).toISOString(), topics: { agricultura: { items: [] } }, sourceStates: {} }
      await page.route('**/sector-news.json*', route => route.fulfill({ json: sectorFixture }))
      // Exercise the real per-study load after reload with deterministic latency.
      // A placeholder has the same heading; only the loaded article proves readiness.
      await page.route('**/sector-studies/base-florestal-3.json*', async route => {
        const response = await route.fetch()
        await new Promise(resolve => setTimeout(resolve, 250))
        await route.fulfill({ response })
      })
      try {
        await page.goto(base + '/#setores')
        await page.locator('.central-setorial').getByRole('heading', { name: 'Explore por setor', exact: true }).waitFor()
        assert.equal(await page.getByRole('button', { name: 'Visão bancária', exact: true }).count(), 0)
        assert.equal(await page.getByRole('button', { name: 'Referência B3', exact: true }).count(), 0)
        const search = page.getByLabel('Buscar setor ou subsetor')
        await search.fill('compensados')
        await page.locator('.central-setorial').getByRole('button', { name: 'Compensados', exact: true }).click()
        await page.waitForURL('**/#setores/topico/base-florestal/3')
        const detail = page.locator('.central-detail')
        await detail.getByRole('heading', { name: 'Compensados', exact: true }).waitFor()
        await page.reload()
        await detail.getByRole('heading', { name: 'Compensados', exact: true }).waitFor()
        assert.match(page.url(), /#setores\/topico\/base-florestal\/3$/)
        const compensados = studies.find(study => study.group === 'base-florestal' && study.topicIndex === 3)
        if (compensados) {
          await detail.locator('.sector-study').waitFor()
          assert.equal(await detail.locator('.sector-study').count(), 1)
          assert.equal(await detail.locator('.study-canvas-questions > li').count(), compensados.canvasQuestions.length)
        } else {
          assert.equal(await detail.locator('ol > li').count(), 8)
          assert.match(await detail.innerText(), /Estudo setorial não incluído/)
        }
        await page.waitForFunction(() => document.activeElement?.classList.contains('central-surface'))
        // O detalhe deve ser levado ao campo visual, especialmente na tela estreita.
        const visible = await detail.evaluate(el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight })
        assert.equal(visible, true, 'resultado selecionado visível sem rolagem manual')
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'sem transbordamento horizontal')
        await page.screenshot({ path: path.join(out, `central-${width}.png`), fullPage: true })

        await search.fill('infraestrutura digital')
        await page.getByRole('button', { name: 'Integração de TI e infraestrutura digital', exact: true }).click()
        await page.waitForURL('**/#setores/topico/tic/0')
        await detail.getByRole('heading', { name: 'Integração de TI e infraestrutura digital', exact: true }).waitFor()
        assert.equal(await page.locator('.central-catalog').count(), 0, 'estudo ocupa a largura sem catálogo lateral')
        assert.equal(await page.getByLabel('Trocar subsetor', { exact: true }).count(), 1)
        assert.equal(await detail.locator('.study-chart').count(), 2)
        assert.equal(await detail.getByRole('navigation', { name: 'Capítulos do estudo' }).count(), 0, 'sem atalhos de capítulos')
        await detail.locator('#tic-cenarios > summary').click()
        assert.match(page.url(), /#setores\/topico\/tic\/0$/)
        assert.equal(await detail.locator('#tic-cenarios').getAttribute('open'), '')
        const cloud = detail.locator('.study-chart').first()
        await cloud.getByRole('combobox').selectOption('1')
        assert.match(await cloud.locator('.study-bars').innerText(), /36/)
        await cloud.getByRole('combobox').selectOption('2')
        await cloud.getByText('Ver todos os dados e método', { exact: true }).click()
        assert.equal(await cloud.locator('tbody tr').count(), 4)
        await page.reload()
        await detail.getByRole('heading', { name: 'Integração de TI e infraestrutura digital', exact: true }).waitFor()
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'estudo TIC sem transbordamento')
        await page.screenshot({ path: path.join(out, `tic-${width}.png`), fullPage: true })

        await search.fill('móveis')
        const moveis = page.locator('.central-setorial').getByRole('button', { name: 'Móveis', exact: true })
        await moveis.focus(); await page.keyboard.press('Enter')
        await page.waitForURL('**/#setores/topico/base-florestal/5')
        await detail.getByRole('heading', { name: 'Móveis', exact: true }).waitFor()
        await page.goBack(); await page.waitForURL('**/#setores/topico/tic/0')
        await page.waitForFunction(() => document.querySelector('.central-search input')?.value === 'móveis')
        await page.getByRole('button', { name: 'Limpar busca', exact: true }).click()
        await detail.getByRole('heading', { name: 'Integração de TI e infraestrutura digital', exact: true }).waitFor()
        await page.goForward(); await page.waitForURL('**/#setores/topico/base-florestal/5')
        await detail.getByRole('heading', { name: 'Móveis', exact: true }).waitFor()

        await page.keyboard.press('Control+Shift+F')
        const dialog = page.getByRole('dialog', { name: 'Buscar no painel' })
        await dialog.getByRole('searchbox').fill('compensados')
        const result = dialog.getByRole('region', { name: 'Resultados em Setores' }).getByRole('button', { name: /Compensados/i }).first()
        await result.waitFor()
        await result.focus(); await page.keyboard.press('Enter')
        await page.waitForURL('**/#setores/topico/base-florestal/3')
        await detail.getByRole('heading', { name: 'Compensados', exact: true }).waitFor()

        await page.goto(base + '/#setores/agricultura')
        const coverage = page.getByRole('region', { name: 'Notícias da semana · Agricultura e insumos agrícolas', exact: true })
        await coverage.getByRole('status').filter({ hasText: /^Publicações ainda não disponíveis nesta seleção\.$/ }).waitFor()
        assert.equal(await coverage.locator('.sector-news-list').count(), 0, 'não inventa notícias ausentes')
        assert.doesNotMatch(await coverage.innerText(), /Arquivo de notícias inválido|Nenhuma manchete relevante encontrada nas fontes consultadas/)
        assert.equal(await coverage.getByRole('link').count(), 0, 'fixture sem consulta bem-sucedida não atribui fontes a notícias inexistentes')
        const dateLabel = value => new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        assert.equal(await coverage.locator('.sector-news-meta').first().innerText(), `Publicações de ${dateLabel(now - 120 * 3600000)} a ${dateLabel(now)}.`)

        await page.goto(base + '/#setores/b3/financeiro')
        await page.locator('.central-setorial > p[role="status"]').filter({ hasText: /antiga classificação B3 foi substituída/ }).waitFor()
        await page.locator('.central-folder').first().waitFor()
        assert.equal(await page.locator('.central-folder').count(), CATALOGO_SETORIAL.length)
        assert.equal(await page.locator('.central-detail').count(), 0)
        assert.equal(await page.getByRole('button', { name: 'Referência B3', exact: true }).count(), 0)
        for (const button of await page.locator('.central-setorial button:visible').all()) {
          const box = await button.boundingBox()
          assert.ok(box && box.height >= 44, `alvo menor que 44px: ${await button.innerText()}`)
        }
        await page.locator('.central-setorial').getByRole('button', { name: 'Cobre', exact: true }).click()
        await page.waitForURL('**/#setores/cobre')
        await page.locator('.setores .desk-panel').waitFor()
        assert.equal(await page.locator('.sector-profile').count(), 0)
        assert.equal(await page.locator('.central-catalog').count(), 0, 'insumo usa a largura com navegação pelo caminho')
        assert.equal(await detail.locator('.setores .desk-panel').count(), 1, 'insumo aparece no painel de conteúdo')
        assert.equal(await page.locator('.central-breadcrumb [aria-current="page"]').innerText(), 'Cobre')
        if (width >= 840) {
          const surface = await page.locator('.central-surface').boundingBox()
          const content = await detail.boundingBox()
          assert.ok(Math.abs(content.width - surface.width) <= 1, 'insumo ocupa a largura da área de leitura')
          assert.ok(Math.abs(content.x - surface.x) <= 1, 'conteúdo alinhado à área de leitura')
        }
        await page.getByRole('button', { name: 'Todos os setores', exact: true }).click()
        await page.locator('.central-folder').first().waitFor()
        await page.getByRole('button', { name: 'Alumínio', exact: true }).click()
        await page.waitForURL('**/#setores/aluminio')
        assert.equal(await page.locator('.central-catalog').count(), 0)
        await page.goBack()
        await page.waitForURL('**/#setores/central')
        await page.goBack()
        await page.waitForURL('**/#setores/cobre')
        assert.equal(await page.locator('.central-breadcrumb [aria-current="page"]').innerText(), 'Cobre')
        await page.goto(base + '/#setores/veiculos-pesados')
        await page.waitForURL('**/#setores/veiculos-pesados')
        await page.getByRole('region', { name: 'Indicadores de veículos pesados' }).waitFor()
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'roteiro sem transbordamento horizontal')
        assert.deepEqual(errors, [])
        console.log(`PASS central setorial ${width}`)
      } catch (error) {
        await page.screenshot({ path: path.join(out, `central-erro-${width}.png`), fullPage: true }).catch(() => {})
        throw error
      } finally { await page.close() }
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })

