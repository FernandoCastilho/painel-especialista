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

async function smoke(browser, width, colorScheme) {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme, hasTouch:width <= 390, serviceWorkers: 'block' })
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
  await panel.getByRole('group', {name:'Mapa do Brasil por unidade da federação'}).waitFor()
  assert.equal(await panel.locator('.rj-state').count(), 27)
  assert.match(await panel.locator('.rj-kpis').innerText(), /160/)
  assert.match(await panel.locator('.rj-kpis').innerText(), /552/)
  assert.equal(await panel.locator('tbody tr').count(), 10)
  // Keyboard and pointer details are available without changing the filters.
  const firstState = panel.locator('.rj-state[aria-label^="Acre"]')
  await firstState.focus()
  const stateTip = panel.locator('.rj-map-wrap').first().getByRole('tooltip')
  await stateTip.waitFor()
  assert.match(await stateTip.innerText(), /Acre · AC/)
  assert.ok(await firstState.getAttribute('aria-describedby'))
  await page.keyboard.press('Escape')
  await stateTip.waitFor({state:'hidden'})
  assert.equal(await panel.locator('.rj-chips button').count(), 0)
  await page.keyboard.press('Enter')
  await panel.getByRole('button', {name:'Ver Brasil', exact:true}).waitFor()
  assert.equal(await panel.locator('.rj-state').count(), 1, 'zoom only exposes visible state to keyboard')
  await page.keyboard.press('Space')
  assert.equal(await panel.locator('.rj-state').count(), 27)
  await page.keyboard.press('Escape')

  const ranking = panel.getByRole('list', {name:'Ranking de setores por menções'})
  const bars = ranking.getByRole('button')
  const firstSector = bars.first()
  const expand = panel.getByRole('button', {name:/Ver todos os 74 setores|Ver apenas os primeiros setores/})
  assert.equal(await bars.count(), 8)
  assert.match(await firstSector.innerText(), /Transporte rodoviário de carga.*internacional/s)
  assert.match(await firstSector.innerText(), /18 menções.*11,3%/s)
  await expand.click()
  assert.equal(await expand.getAttribute('aria-expanded'), 'true')
  assert.equal(await bars.count(), 74)
  const counts = await ranking.locator('strong').evaluateAll(labels => labels.map(label => parseInt(label.textContent, 10)))
  assert.ok(counts.every((count, index) => index === 0 || counts[index - 1] >= count))
  await expand.click()
  assert.equal(await bars.count(), 8)
  assert.equal(await expand.getAttribute('aria-expanded'), 'false')

  if(width <= 390){
    await firstSector.tap()
  }else{
    await firstSector.focus()
    await page.keyboard.press('Enter')
  }
  assert.equal(await firstSector.getAttribute('aria-pressed'), 'true')
  assert.match(await panel.locator('.rj-kpis').innerText(), /18/)
  assert.equal(await panel.locator('.rj-chips button').count(), 1)
  await firstSector.click()
  assert.equal(await firstSector.getAttribute('aria-pressed'), 'false')
  assert.equal(await panel.locator('.rj-chips button').count(), 0)
  assert.equal(await page.getByText('Como interpretar a base histórica', {exact:true}).count(), 1)
  assert.equal(await page.getByText('Conferência semanal e cadastro de referência', {exact:true}).count(), 1)
  await panel.getByRole('button', {name:'Próxima', exact:true}).click()
  assert.match(await panel.locator('.rj-pagination').innerText(), /Página 2 de 16/)
  await panel.locator('.rj-state[aria-label^="São Paulo"]').click()
  await panel.getByRole('button', {name:'Ver Brasil', exact:true}).waitFor()
  await panel.getByRole('button', {name:'Ver Brasil', exact:true}).click()
  await panel.getByLabel('Selecionar UF').selectOption('Sem UF')
  assert.match(await panel.locator('.rj-kpis').innerText(), /67/)
  await panel.getByRole('button', {name:'Limpar seleção', exact:true}).click()
  await panel.getByLabel('Selecionar setor').selectOption({label:'Sem setor (11)'})
  assert.equal(await panel.locator('.rj-chips button').count(), 1)
  await panel.getByRole('button', {name:'Limpar seleção', exact:true}).click()
  await panel.getByLabel('Mês final', {exact:true}).selectOption('11')
  assert.match(await panel.locator('.rj-filters').innerText(), /09\/11\/2026/)
  assert.match(await panel.locator('.rj-kpis').innerText(), /09\/11\/2025/)
  await panel.getByLabel('Mês final', {exact:true}).selectOption('10')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({path:path.join(out, `recovery-history-${width}-${colorScheme}.png`), fullPage:true})

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
  console.log(`PASS recuperação judicial · mapa, ranking setorial e filtros · ${width}px ${colorScheme}`)
}

;(async () => {
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  try {
    for (const width of [320, 390, 1280]) for(const theme of ['light','dark']) await smoke(browser, width, theme)
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exit(1) })
