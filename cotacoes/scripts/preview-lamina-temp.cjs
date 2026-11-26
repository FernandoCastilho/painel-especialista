// Temporário: capturas da lâmina com fichas coletadas agora na CVM e o resto da base publicada. Sai antes de juntar.
const { chromium } = require('playwright')
const fs = require('node:fs')
const out = process.env.OUT
const site = 'https://fernandocastilho.github.io/painel-especialista'
const casos = [['lamina', '44.315.864/0001-78'], ['ficha-garb', '54.496.707/0001-60'], ['garb-120880', '00.828.941/0001-18']]
;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  for (const width of [1280, 390]) {
    for (const [nome, cnpj] of casos) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block', deviceScaleFactor: 1 })
      page.setDefaultTimeout(60000)
      await page.route(url => url.pathname.includes('/cvm/') && !url.pathname.includes('/cvm/fichas/'), async route => {
        const arquivo = new URL(route.request().url()).pathname.split('/cvm/')[1]
        await route.fulfill({ response: await route.fetch({ url: site + '/cvm/' + arquivo }) })
      })
      await page.goto('http://127.0.0.1:8768/#calculadora/investimentos')
      const region = page.getByRole('region', { name: 'Investimentos', exact: true })
      await region.getByRole('button', { name: 'Consultar fundos', exact: true }).click()
      const busca = region.getByRole('region', { name: 'Buscar fundos na CVM' }).getByRole('searchbox')
      await busca.fill(cnpj)
      const lista = region.getByRole('list', { name: 'Fundos encontrados' })
      await lista.getByRole('button').first().click()
      const lamina = region.locator('section.inv-lamina')
      await lamina.waitFor()
      await page.waitForFunction(() => !document.querySelector('section.inv-lamina [role=status]')?.textContent.includes('Carregando'))
      await page.waitForTimeout(1500)
      await page.evaluate(() => document.querySelectorAll('*').forEach(el => {
        const p = getComputedStyle(el).position
        if (p === 'fixed' || p === 'sticky') el.style.position = 'static'
      }))
      await lamina.screenshot({ path: `${out}/${nome}-${width}.png` })
      await region.screenshot({ path: `${out}/${nome}-pagina-${width}.png` })
      console.log(nome.toUpperCase(), width, (await lamina.innerText()).replace(/\s+/g, ' ').slice(0, 600))
      await page.close()
    }
  }
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
