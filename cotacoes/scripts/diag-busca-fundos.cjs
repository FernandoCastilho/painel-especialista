// Diagnóstico temporário: busca de fundos com o catálogo real publicado.
const { chromium } = require('playwright')
const zlib = require('node:zlib')
const base = 'http://127.0.0.1:8768'
const pub = 'https://fernandocastilho.github.io/painel-especialista/cvm/'

async function nodeSearch() {
  const manifest = await (await fetch(pub + 'manifest.json')).json()
  const gz = Buffer.from(await (await fetch(pub + manifest.files.catalogo)).arrayBuffer())
  console.log('catalogo bytes', gz.length)
  const items = JSON.parse(zlib.gunzipSync(gz))
  console.log('itens', items.length, 'exemplo', JSON.stringify(items[0]), JSON.stringify(items[items.length - 1]))
  const tipos = {}
  for (const it of items) for (let i = 0; i < 6; i++) tipos[i + ':' + (it[i] === null ? 'null' : typeof it[i])] = (tipos[i + ':' + (it[i] === null ? 'null' : typeof it[i])] || 0) + 1
  console.log('tipos', JSON.stringify(tipos))
  const { buscarFundos, prepararBuscaCvm } = await import('../src/fundosCvm.js')
  let t = Date.now(); prepararBuscaCvm(items); console.log('preparar ms', Date.now() - t)
  for (const q of ['Sa', 'San', 'Sant', 'Santander', 'santander', 'Itaú', 'BTG', 'XP', 'Bradesco']) {
    t = Date.now()
    try {
      const r = buscarFundos(items, q)
      console.log('busca', q, r.length, Date.now() - t, 'ms', r.slice(0, 3).map(x => x[1]).join(' | '))
    } catch (e) { console.log('ERRO busca', q, e.stack) }
  }
  console.log('com santander no nome', items.filter(x => /santander/i.test(x[1])).length)
}

async function browserSearch() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' })
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.type(), m.text().slice(0, 400)) })
    page.on('pageerror', e => console.log('pageerror', e.stack?.slice(0, 800)))
    page.on('requestfailed', r => console.log('falhou', r.url().slice(0, 200), r.failure()?.errorText))
    await page.route('**/cvm/**', async route => {
      const nome = new URL(route.request().url()).pathname.split('/cvm/')[1]
      const t = Date.now()
      const r = await route.fetch({ url: pub + nome, timeout: 60000 })
      console.log('cvm', nome.slice(0, 40), r.status(), Date.now() - t, 'ms')
      await route.fulfill({ response: r })
    })
    await page.goto(base + '/#calculadora/investimentos')
    const region = page.getByRole('region', { name: 'Investimentos', exact: true })
    for (const aba of ['Comparar ativos', 'Consultar fundos', 'Simular carteira']) {
      await region.getByRole('button', { name: aba, exact: true }).click()
      const box = region.getByRole('searchbox').first()
      await box.waitFor({ timeout: 15000 }).catch(e => console.log('sem campo', aba, e.message))
      const t = Date.now()
      await box.pressSequentially('Santander', { delay: 80 }).catch(e => console.log('digitar', aba, e.message))
      for (const espera of [1000, 4000, 10000]) {
        await page.waitForTimeout(espera)
        const txt = (await region.innerText()).replace(/\s+/g, ' ')
        const i = txt.indexOf('Santander')
        console.log('[' + width + '] ' + aba + ' +' + (Date.now() - t) + 'ms:', txt.slice(Math.max(0, i - 100), i + 900))
      }
      const shot = await page.screenshot({ type: 'jpeg', quality: 45 })
      console.log('SHOT ' + width + ' ' + aba + ' ' + shot.toString('base64'))
      await box.fill('')
    }
    await page.close()
  }
  await browser.close()
}

nodeSearch().then(browserSearch).catch(e => { console.log('FALHA', e.stack); process.exitCode = 1 })
