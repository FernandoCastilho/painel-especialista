const { chromium } = require('playwright')
const fs = require('node:fs')
const assert = require('node:assert/strict')
;(async () => {
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5279'
  const out = process.env.TRENDS_QA_OUTPUT || 'workspace-qa/trends'
  fs.mkdirSync(out, { recursive: true })
  try {
    for (const width of [390, 1280, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1100 }, serviceWorkers: 'block' })
      const errors = []
      page.on('pageerror', e => errors.push(e.message))
      const origin = new URL(base).origin
      // Fixtures sintéticas: este smoke testa integração/layout, não disponibilidade do Google.
      let payload = { generatedAt: Date.now(), stale: false, items: [{ title: 'Dólar e Selic', publishedAt: Date.now() - 3600000, traffic: '20K+', groups: ['juros'] }, { title: 'BNDES', publishedAt: Date.now() - 3600000, groups: ['investimento'] }, { title: 'Crédito empresarial', publishedAt: Date.now() - 3600000, groups: ['credito'] }, { title: 'Reforma tributária', publishedAt: Date.now() - 3600000, groups: ['reforma'] }] }
      await page.route('**/*', route => {
        const url = new URL(route.request().url())
        if (url.pathname.endsWith('/trends.json')) return route.fulfill({ json: payload })
        if (url.origin === 'https://trends.google.com' && url.pathname === '/trends/embed/explore/TIMESERIES') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<html lang="pt-BR"><body><p>Gráfico simulado somente para teste de integração.</p></body></html>' })
        return url.origin === origin ? route.continue() : route.abort()
      })
      await page.goto(base)
      await page.getByRole('tab', { name: 'Google Trends', exact: true }).click()
      const panel = page.locator('.google-trends')
      await panel.getByRole('heading', { name: 'O que está despertando atenção' }).waitFor()
      await panel.locator('iframe.trends-live-chart').waitFor()
      assert.equal(await panel.locator('.trends-highlights article').count(), 3)
      const explore = new URL(await panel.locator('.trends-chart-link').getAttribute('href'))
      assert.equal(explore.searchParams.get('geo'), 'BR')
      assert.match(await panel.innerText(), /não é coletado nem armazenado pelo painel/)
      for (const name of ['Investimento', 'Juros, câmbio e comex', 'Custos', 'Reforma tributária', 'Crédito e caixa']) {
        await panel.getByRole('button', { name, exact: true }).click()
        assert.equal(await panel.getByRole('button', { name, exact: true }).getAttribute('aria-pressed'), 'true')
        assert.match(await panel.innerText(), /Hipótese para a conversa/)
        assert.equal(await panel.locator('iframe.trends-live-chart').count(), 1)
        assert.match(await panel.locator('iframe').getAttribute('title'), new RegExp(name))
        assert.equal(await panel.locator('figure svg:visible').count(), 0)
        const url = new URL(await panel.locator('iframe').getAttribute('src'))
        const request = JSON.parse(url.searchParams.get('req'))
        assert.equal(request.comparisonItem.length, 3)
        assert.ok(request.comparisonItem.every(item => item.geo === 'BR' && item.time === 'today 3-m'))
      }
      await panel.getByRole('combobox').selectOption('today 12-m')
      assert.match(await panel.locator('iframe').getAttribute('title'), /12 meses/)
      assert.ok(JSON.parse(new URL(await panel.locator('iframe').getAttribute('src')).searchParams.get('req')).comparisonItem.every(item => item.time === 'today 12-m'))
      assert.equal(await panel.locator('figure svg:visible').count(), 0)
      await panel.getByRole('combobox').selectOption('today 3-m')
      await panel.locator('.trends-archive > summary').click()
      assert.match(await panel.innerText(), /Não atualiza automaticamente/)
      assert.equal(await panel.locator('figure svg:visible').count(), 1)
      await panel.locator('.trends-archive > summary').click()
      assert.equal(await panel.locator('figure svg:visible').count(), 0)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      assert.deepEqual(errors, [])
      await panel.screenshot({ path: `${out}/${width}-trends.png` })
      // Uma leitura atrasada continua com a data original; a primeira falha fica indisponível.
      payload = { ...payload, generatedAt: Date.parse('2026-11-03T12:00:00Z'), stale: true }
      await page.reload()
      await page.getByRole('tab', { name: 'Google Trends', exact: true }).click()
      await panel.getByText(/Exibindo a última coleta válida, com a data original/).waitFor()
      assert.match(await panel.innerText(), /03\/11\/2026/)
      payload = { generatedAt: Date.now(), stale: false, items: [] }
      await page.reload()
      await page.getByRole('tab', { name: 'Google Trends', exact: true }).click()
      await panel.getByText('Nenhuma busca relacionada aos temas comerciais nesta coleta.', { exact: true }).waitFor()
      payload = { generatedAt: null, stale: true, items: [] }
      await page.reload()
      await page.getByRole('tab', { name: 'Google Trends', exact: true }).click()
      await panel.getByText('Tendências ainda indisponíveis.', { exact: true }).waitFor()
      assert.deepEqual(errors, [])
      await page.close()
      console.log(`Trends ${width}px: incorporação, grupos, períodos, arquivo, retenção, ausência e overflow OK`)
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
