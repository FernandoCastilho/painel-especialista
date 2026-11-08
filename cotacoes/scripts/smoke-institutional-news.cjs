// Replays the committed real institutional snapshot; never requests its source sites.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.INSTITUTIONAL_NEWS_QA_OUTPUT || 'workspace-qa/institutional-news'
const inputPath = path.join(__dirname, '../public/sector-news.json')
const snapshot = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const clock = Date.parse(snapshot.delivery?.publishedAt) + 60000
assert.ok(Number.isFinite(clock), 'baseline precisa de publicação real confirmada')
const localTime = value => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const { normalizeSectorNews } = await import(pathToFileURL(path.join(__dirname, '../src/sectorNews.js')).href)
  const expected = normalizeSectorNews(snapshot, clock)
  assert.equal(expected.collection.automaticCollectionEnabled, true, 'baseline real deve ter coleta confirmada')
  const report = { passed: false, snapshot: 'public/sector-news.json', snapshotPublishedAt: snapshot.delivery.publishedAt,
    replayClock: new Date(clock).toISOString(), replayNotice: 'Relógio de teste fixo um minuto após a publicação real para repetir a validação sem renovar as datas das notícias. Não representa uma nova coleta.', scenarios: [] }
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  let currentPage
  try {
    for (const width of [390, 1440]) for (const theme of ['light', 'dark']) for (const mode of ['confirmed', 'invalid-delivery', 'read-failure']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' })
      const errors = [], blockedOrigins = new Set()
      try {
        await context.addInitScript(fixed => {
          const RealDate = Date
          globalThis.Date = class extends RealDate {
            constructor(...args) { super(...(args.length ? args : [fixed])) }
            static now() { return fixed }
          }
        }, clock)
        await context.route('**/*', route => {
          const url = new URL(route.request().url())
          if (url.origin !== new URL(base).origin) { blockedOrigins.add(url.origin); return route.abort() }
          if (url.pathname.endsWith('/sector-news.json')) {
            if (mode === 'read-failure') return route.fulfill({ status: 503, contentType: 'text/plain', body: 'Unavailable in isolated browser test' })
            const data = structuredClone(snapshot)
            if (mode === 'invalid-delivery') data.delivery.receipt = ''
            return route.fulfill({ json: data })
          }
          return route.continue()
        })
        const page = await context.newPage()
        currentPage = page
        page.on('pageerror', error => errors.push(error.message))
        for (const id of ['agricultura', 'petroleo']) {
          await page.goto(`${base}/#setores/${id}`, { waitUntil: 'domcontentloaded' })
          const notice = page.getByRole('dialog', { name: 'Aviso', exact: true })
          if (await notice.isVisible()) await notice.getByRole('button', { name: 'Entendi', exact: true }).click()
          const panel = page.locator('.sector-news')
          await panel.waitFor()
          await panel.getByRole('heading', { name: `Notícias da semana · ${expected.topics[id].label}`, exact: true }).waitFor()
          if (mode === 'read-failure') {
            await panel.getByText('Atualização de notícias indisponível nesta leitura.', { exact: true }).waitFor()
            assert.match(await panel.innerText(), /Atualização automática não confirmada nesta leitura/)
            assert.doesNotMatch(await panel.innerText(), /Coleta automática institucional ativa|automática institucional desativada/)
          } else {
            await panel.getByText(mode === 'confirmed' ? expected.collection.notice : 'Atualização automática institucional desativada. Esta seleção usa publicações já verificadas; consulte os links das fontes.', { exact: true }).waitFor()
            if (mode === 'confirmed') {
              const text = await panel.innerText(), stats = expected.collection.sourceStats
              assert.match(text, /Verificação geral do painel/)
              assert.match(text, /Fontes do painel/)
              assert.ok(text.includes(`${stats.successful} com consulta válida · ${stats.notActive} não ativadas`))
              for (const stamp of [expected.collection.checkedAt, expected.collection.lastSuccessAt]) {
                assert.equal(await panel.locator(`time[datetime="${stamp}"]`).innerText(), localTime(stamp))
              }
              assert.match(text, /Brasília/)
            } else assert.doesNotMatch(await panel.innerText(), /Coleta automática institucional ativa|Verificação geral do painel|Fontes do painel/)
            const items = expected.topics[id].items
            if (items.length) await panel.locator('.sector-news-list > li').first().waitFor()
            assert.equal(await panel.locator('.sector-news-list > li').count(), items.length)
            if (items.length) assert.equal(await panel.getByRole('list', { name: `${expected.topics[id].label}: notícias da semana`, exact: true }).count(), 1)
            for (const [index, item] of items.entries()) {
              const row = panel.locator('.sector-news-list > li').nth(index)
              const original = snapshot.topics[id].items.find(raw => raw.link === item.link)
              assert.ok(original, 'item precisa existir no snapshot real')
              const link = row.getByRole('link', { name: original.title, exact: true })
              assert.equal(await link.getAttribute('href'), original.link)
              const layout = await row.evaluate(element => {
                const headline = element.querySelector(':scope > a').getBoundingClientRect()
                const metadata = [...element.querySelectorAll(':scope > small')].map(small => ({ display: getComputedStyle(small).display, top: small.getBoundingClientRect().top }))
                return { headlineBottom: headline.bottom, metadata, overflow: element.scrollWidth > element.clientWidth + 1 }
              })
              assert.ok(layout.metadata.length > 0 && layout.metadata.every(meta => meta.display === 'block'), 'fonte/data/licença ocupam linhas próprias')
              assert.ok(layout.metadata.every(meta => meta.top >= layout.headlineBottom - 1), 'metadados ficam abaixo do título')
              assert.equal(layout.overflow, false, 'título e metadados não excedem a linha')
              const stamp = item.datePrecision === 'day' ? original.publishedAt : new Date(item.t).toISOString()
              assert.equal(await row.locator('time').getAttribute('datetime'), stamp)
              assert.equal(await row.locator('time').innerText(), item.datePrecision === 'day' ? original.publishedAt.split('-').reverse().join('/') : new Date(item.t).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }))
            }
          }
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'sem overflow horizontal da página')
          await panel.scrollIntoViewIfNeeded()
          const name = `${id}-${width}-${theme}-${mode}`
          await panel.screenshot({ path: path.join(out, `${name}.png`) })
          report.scenarios.push({ id, width, theme, mode, passed: true, itemCount: await panel.locator('.sector-news-list > li').count(), blockedOrigins: [...blockedOrigins] })
        }
        assert.deepEqual(errors, [], 'sem erros JavaScript')
      } catch (error) {
        await currentPage?.screenshot({ path: path.join(out, `${width}-${theme}-${mode}-failure.png`), fullPage: true }).catch(() => {})
        throw error
      } finally { await context.close(); currentPage = null }
    }
    report.passed = true
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify({ passed: true, scenarios: report.scenarios.length, replayClock: report.replayClock, report: path.join(out, 'report.json') }))
  } catch (error) {
    await currentPage?.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {})
    fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ ...report, error: error.message }, null, 2))
    throw error
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
