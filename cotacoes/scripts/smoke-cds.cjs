// CDS Brasil 5 anos: confere a coleta (página local que só mostra o número depois de carregar, como a fonte real) e a tela
// (linha abaixo do yuan em Mercado hoje e cartão no Panorama do dia) em notebook e celular. Dados fictícios de teste.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http')
const { execFileSync } = require('node:child_process')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.CDS_QA_OUTPUT || 'cds-qa'
const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function paginaFonte(observedAt) {
  const d = new Date(observedAt), p = (n) => String(n).padStart(2, '0')
  const texto = `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
  return `<!doctype html><html><body><p>Last Update: <span id="d">-- --- ----, --:--</span> GMT+0</p>
<p>the Brazil 5 Years Credit Default Swap (CDS) value stands at <span id="v">----</span> basis points.</p>
<script>setTimeout(function(){document.getElementById('d').textContent=${JSON.stringify(texto)};document.getElementById('v').textContent='162.85'},400)</script></body></html>`
}

async function coleta() {
  const observedAt = Date.now() - 3600000
  const server = http.createServer((req, res) => {
    if (req.url === '/bloqueado') { res.writeHead(403); return res.end('acesso negado') }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(paginaFonte(observedAt))
  })
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
  const url = `http://127.0.0.1:${server.address().port}`
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cds-'))
  const run = (pagina) => execFileSync(process.execPath, ['scripts/fetch-cds.mjs'], { encoding: 'utf8', env: { ...process.env, DATA_DIR: dir, CDS_URL: url + pagina, PLAYWRIGHT_DIR: process.cwd(), CHROME_PATH: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome' } })
  const ler = () => JSON.parse(fs.readFileSync(path.join(dir, 'cds.json'), 'utf8'))
  try {
    console.log(run('/fonte').trim())
    let d = ler()
    assert.equal(d.value, 162.85, 'leu o número depois de a página carregar')
    assert.equal(Math.floor(d.observedAt / 60000), Math.floor(observedAt / 60000), 'horário da página')
    assert.equal(d.error, null)
    assert.match(run('/fonte'), /menos de 2 h/, 'não visita de novo antes de 2 h')
    fs.writeFileSync(path.join(dir, 'cds.json'), JSON.stringify({ ...d, lastAttemptAt: Date.now() - 3 * 3600000 }))
    run('/bloqueado')
    d = ler()
    assert.equal(d.value, 162.85, 'bloqueio mantém o último dado válido')
    assert.match(d.error, /HTTP 403/)
  } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }) }
}

const raw = (code, codein, bid, pct) => ({ code, codein, bid: String(bid), ask: String(bid + 0.001), high: String(bid * 1.01), low: String(bid * 0.99), pctChange: String(pct), varBid: String(bid * 0.01), timestamp: String(Math.floor(Date.now() / 1000)) })
const quotes = { USDBRL: raw('USD', 'BRL', 5.28, 0.46), EURBRL: raw('EUR', 'BRL', 5.74, 0.31), JPYBRL: raw('JPY', 'BRL', 0.032, 0.1), USDCNH: raw('USD', 'CNH', 7.23, 0.18) }
function cdsFixture(value = 162.85) {
  const end = Date.now() - 2 * 3600000
  const history = Array.from({ length: 20 }, (_, i) => { const t = end - (19 - i) * 864e5; return { date: new Date(t - 3 * 3600000).toISOString().slice(0, 10), value: i === 19 ? value : +(150 + i * 0.7 + Math.sin(i) * 2).toFixed(2), observedAt: t } })
  return { generatedAt: new Date(end).toISOString(), lastAttemptAt: end, source: { name: 'World Government Bonds' }, unit: 'pb', value, observedAt: end, reference: { date: history.at(-2).date, value: 165 }, error: null, history }
}

async function tela() {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  try {
    for (const [width, height] of [[1280, 800], [1366, 768], [390, 844]]) {
      const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce' })
      let cds = cdsFixture()
      await ctx.route('**/*', (r) => {
        const u = new URL(r.request().url()), name = u.pathname.split('/').pop()
        if (name === 'cds.json') return cds ? r.fulfill({ json: cds }) : r.fulfill({ status: 404, body: '' })
        if (name === 'quotes.json') return r.fulfill({ json: { generatedAt: Date.now(), quotes } })
        if (name === 'recado.json') return r.fulfill({ json: { ativo: false } })
        return u.origin === base ? r.continue() : r.abort()
      })
      const p = await ctx.newPage(), errors = []
      p.on('pageerror', (e) => errors.push(e.message))
      await p.goto(base + '/#resumo')
      const aviso = p.locator('dialog.aviso-inicial[open]:not(.recado)')
      if (await aviso.isVisible({ timeout: 3000 }).catch(() => false)) await aviso.getByRole('button', { name: 'Entendi' }).click()
      const table = p.getByRole('table', { name: 'Câmbio em reais · últimas referências disponíveis' })
      const row = table.locator('tbody.market-cds')
      await row.waitFor()
      assert.equal(await table.locator('tbody').count(), 5, 'quatro moedas e o CDS')
      assert.equal(await table.locator('tbody').last().evaluate((e) => e.classList.contains('market-cds')), true, 'CDS logo abaixo do yuan')
      assert.match(await table.locator('tbody').nth(3).innerText(), /CNH/)
      const texto = (await row.innerText()).replace(/\s+/g, ' ')
      assert.match(texto, /CDS 5 anos/); assert.match(texto, /162,85 pb/); assert.match(texto, /−2,15 pb/); assert.match(texto, /−1,30%/)
      assert.match(texto, /World Government Bonds · não oficial · \d{2}\/\d{2} \d{2}:\d{2}/)
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'sem rolagem lateral na página')
      await p.locator('.market-terminal').evaluate((el) => el.scrollIntoView())
      await p.locator('.market-terminal').screenshot({ path: `${out}/${width}-mercado-hoje.png` })
      if (width < 650) {
        const wrap = p.locator('.market-table-wrap')
        await wrap.screenshot({ path: `${out}/${width}-tabela.png` })
        await wrap.evaluate((e) => { e.scrollLeft = e.scrollWidth })
        await wrap.screenshot({ path: `${out}/${width}-tabela-direita.png` })
        await wrap.evaluate((e) => { e.scrollLeft = 0 })
      }
      // Panorama do dia: o CDS no lugar do Brent.
      await p.locator('.panorama-trigger').click()
      const modal = p.locator('dialog.market-popup')
      await modal.locator('.mp-cds').getByText('162,85 pb').waitFor()
      assert.equal(await modal.locator('.mp-brent').count(), 0, 'Brent saiu do Panorama')
      assert.match(await modal.locator('.mp-cds').innerText(), /CDS BRASIL 5 ANOS[\s\S]*não oficial/)
      assert.match(await modal.locator('.mp-summary').innerText(), /CDS Brasil 5 anos: −2,15 pb/)
      await modal.screenshot({ path: `${out}/${width}-panorama.png` })
      await modal.getByRole('button', { name: 'Fechar panorama' }).click()
      // Dado estranho ou ausente: a linha some (e o Panorama mostra o cartão sem número).
      for (const [caso, valor] of [['fora-da-faixa', cdsFixture(5000)], ['sem-arquivo', null]]) {
        cds = valor
        await p.reload()
        await table.locator('tbody').nth(3).waitFor()
        await p.waitForTimeout(800)
        assert.equal(await table.locator('tbody.market-cds').count(), 0, `linha some: ${caso}`)
      }
      assert.deepEqual(errors, [])
      console.log(`${width}px: CDS abaixo do yuan, Panorama com CDS, linha some com dado estranho`)
      await ctx.close()
    }
  } finally { await browser.close() }
}

;(async () => { await coleta(); await tela() })().catch((e) => { console.error(e); process.exit(1) })
