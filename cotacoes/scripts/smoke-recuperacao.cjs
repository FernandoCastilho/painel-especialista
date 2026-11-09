const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5220'
const out = process.env.SEARCH_QA_OUTPUT || path.join(__dirname, '../../qa-universal')
const dist = process.env.SMOKE_LOCAL_DIST ? path.resolve(__dirname, '../dist') : null
const fixtures = ['recuperacao.json', 'recuperacao-historico.json']
const published = JSON.parse(fs.readFileSync(path.join(__dirname,'../public/recuperacao-historico.json'), 'utf8'))
const referenceDate = '2026-11-09'
const historicalFixture = { ...published, editions: published.editions.filter(date => date <= referenceDate),
  records: published.records.filter(row => row.date <= referenceDate) }
fs.mkdirSync(out, { recursive: true })

async function smoke(browser, width) {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, serviceWorkers: 'block' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    const file = path.basename(url.pathname)
    if (url.origin !== new URL(base).origin) return route.fulfill({status:503, body:'offline'})
    if (!url.pathname.startsWith('/src/') && file.endsWith('.json')) {
      if (file === 'recuperacao-historico.json') return route.fulfill({json:historicalFixture})
      return fixtures.includes(file) ? route.fulfill({path:path.join(__dirname,'../public',file)}) : route.fulfill({json:{generatedAt:Date.now()}})
    }
    if (dist) {
      const artifact = path.resolve(dist, '.' + (url.pathname === '/' ? '/index.html' : url.pathname))
      if (!artifact.startsWith(dist + path.sep) || !fs.existsSync(artifact)) return route.fulfill({status:404})
      return route.fulfill({path:artifact})
    }
    return route.continue()
  })
  await page.goto(base + '/#cenarios/recuperacao')
  const panel = page.locator('.rj-history')
  await panel.getByRole('img', {name:'Mapa do Brasil por unidade da federação'}).waitFor()
  assert.equal(await panel.locator('.rj-state').count(), 27)
  assert.match(await panel.locator('.rj-kpis').innerText(), /160/)
  assert.match(await panel.locator('.rj-kpis').innerText(), /552/)
  assert.equal(await panel.locator('tbody tr').count(), 10)
  await panel.getByRole('button', {name:'Próxima', exact:true}).click()
  assert.match(await panel.locator('.rj-pagination').innerText(), /Página 2 de 16/)
  await panel.locator('.rj-pin circle').first().click({ force:true })
  await panel.getByRole('button', {name:'Ver Brasil', exact:true}).waitFor()
  await panel.getByRole('button', {name:'Ver Brasil', exact:true}).click()
  await panel.getByLabel('Selecionar UF').selectOption('Sem UF')
  assert.match(await panel.locator('.rj-kpis').innerText(), /67/)
  await panel.getByRole('button', {name:'Limpar seleção', exact:true}).click()
  await panel.locator('.rj-sector-cell rect').first().click({ force:true })
  assert.equal(await panel.locator('.rj-chips button').count(), 1)
  await panel.getByRole('button', {name:'Limpar seleção', exact:true}).click()
  await panel.getByLabel('Mês final', {exact:true}).selectOption('11')
  assert.match(await panel.locator('.rj-filters').innerText(), /09\/11\/2026/)
  assert.match(await panel.locator('.rj-kpis').innerText(), /09\/11\/2025/)
  await panel.getByLabel('Mês final', {exact:true}).selectOption('10')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({path:path.join(out, `recovery-history-${width}.png`), fullPage:true})

  const details = page.locator('.rj-weekly-detail')
  await details.locator(':scope > summary').click()
  const weekly = details.locator('.recovery-panel')
  assert.match(await weekly.innerText(), /Dados semanais por setor ainda indisponíveis/)
  const input = weekly.getByLabel('Escolher semana de recuperação judicial')
  const original = await input.inputValue()
  await weekly.getByRole('button', {name:'Semana anterior',exact:true}).click()
  assert.notEqual(await input.inputValue(), original)
  await weekly.getByRole('button', {name:'Próxima semana',exact:true}).click()
  assert.equal(await input.inputValue(), original)
  await weekly.getByRole('button', {name:'Ver referências em Base de dados'}).click()
  assert.match(page.url(), /#config$/)
  assert.deepEqual(errors, [])
  await page.close()
  console.log(`PASS recuperação judicial · mapa, setores, filtros e referências · ${width}px`)
}

;(async () => {
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  try {
    for (const width of [390, 1280]) await smoke(browser, width)
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exit(1) })
