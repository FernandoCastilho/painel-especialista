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

  const numbered = panel.locator('.rj-sector-cell[data-label-mode="number"]').first()
  await numbered.waitFor()
  assert.match((await numbered.textContent()).trim(), /^\d[\d.]*$/)
  const accessibleName = await numbered.getAttribute('aria-label')
  assert.match(accessibleName, /menções \(/)
  await numbered.focus()
  const sectorTip = panel.locator('.rj-map-wrap').nth(1).getByRole('tooltip')
  await sectorTip.waitFor()
  assert.ok(accessibleName.startsWith(await sectorTip.locator('strong').innerText()))
  assert.match(await sectorTip.innerText(), /menç(ão|ões).*do recorte/)
  await page.screenshot({path:path.join(out, `recovery-tooltip-${width}-${colorScheme}.png`), fullPage:true})
  await page.keyboard.press('Escape')
  await sectorTip.waitFor({state:'hidden'})
  // Every rendered label fits the actual cell at this viewport, with legible font size.
  const labels = await panel.locator('.rj-sector-cell').evaluateAll(cells => cells.map(cell => {
    const rect=cell.querySelector('rect').getBoundingClientRect()
    const text=cell.querySelector('text')
    if(!text)return null
    const bounds=text.getBoundingClientRect()
    return {inside:bounds.left>=rect.left-1&&bounds.right<=rect.right+1&&bounds.top>=rect.top-1&&bounds.bottom<=rect.bottom+1,
      font:Number.parseFloat(getComputedStyle(text).fontSize)*text.getScreenCTM().a}
  }).filter(Boolean))
  assert.ok(labels.length > 0)
  assert.ok(labels.every(label => label.inside && label.font >= 12.9), JSON.stringify(labels))
  await panel.locator('.rj-sector-legend summary').click()
  assert.equal(await panel.getByRole('list', {name:'Legenda completa de setores'}).locator('button').count(), await panel.locator('.rj-sector-cell').count())
  await panel.locator('.rj-sector-legend summary').click()
  if(width <= 390){
    await numbered.tap()
    await sectorTip.waitFor()
    assert.equal(await panel.locator('.rj-chips button').count(), 1)
    await panel.getByRole('heading', {name:'Distribuição por setor',exact:true}).tap()
    await sectorTip.waitFor({state:'hidden'})
    await panel.getByRole('button', {name:'Limpar seleção',exact:true}).click()
  }else{
    await numbered.hover()
    await sectorTip.hover()
    await page.waitForTimeout(220)
    assert.equal(await sectorTip.isVisible(), true, 'tooltip stays open while hovered')
    await page.mouse.move(0,0)
    await sectorTip.waitFor({state:'hidden'})
  }
  await panel.getByRole('button', {name:'Próxima', exact:true}).click()
  assert.match(await panel.locator('.rj-pagination').innerText(), /Página 2 de 16/)
  await panel.locator('.rj-state[aria-label^="São Paulo"]').click()
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
  console.log(`PASS recuperação judicial · mapa, setores, filtros e referências · ${width}px ${colorScheme}`)
}

;(async () => {
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  try {
    for (const width of [320, 390, 1280]) for(const theme of ['light','dark']) await smoke(browser, width, theme)
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exit(1) })
