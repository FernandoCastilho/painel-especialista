// Teste de tela da TV ao vivo (pedido de Fernando, 28/11/2026): botão TV ao lado de Mais, escolha do canal antes de
// carregar o vídeo, tamanhos P/M/G, TV aberta ao trocar de seção e fechar. O YouTube é simulado: o teste não
// comprova que a transmissão está no ar, só a montagem da tela e o endereço pedido. Gera as capturas do artefato.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.TV_QA_OUTPUT || 'workspace-qa/tv'

const TELAS = [
  ['notebook-1366', { width: 1366, height: 768 }, 'dark'],
  ['notebook-1280', { width: 1280, height: 800 }, 'light'],
  ['tablet-820', { width: 820, height: 1180 }, 'light'],
  ['celular-390', { width: 390, height: 844 }, 'dark'],
  ['celular-360', { width: 360, height: 740 }, 'light'],
]
const VIDEO_FALSO = '<body style="margin:0;display:grid;place-items:center;height:100vh;background:#111;color:#eee;font:16px sans-serif">Vídeo do YouTube (simulado no teste)</body>'

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const erros = [], pedidos = []
  try {
    for (const [nome, viewport, tema] of TELAS) {
      const celular = viewport.width < 500
      const context = await browser.newContext({ viewport, colorScheme: tema, isMobile: celular, hasTouch: celular, deviceScaleFactor: celular ? 2 : 1 })
      const page = await context.newPage()
      page.on('pageerror', e => erros.push(`${nome}: ${e.message}`))
      await page.route('**/*', route => {
        const url = route.request().url()
        if (url.startsWith(base + '/')) return route.continue()
        if (url.startsWith('https://www.youtube.com/embed/live_stream')) { pedidos.push(url); return route.fulfill({ contentType: 'text/html', body: VIDEO_FALSO }) }
        return route.abort()
      })
      await page.goto(`${base}/#resumo`)
      const aviso = page.getByRole('dialog', { name: 'Aviso', exact: true })
      if (await aviso.isVisible().catch(() => false)) await page.keyboard.press('Escape')
      await page.evaluate(() => document.fonts.ready)

      const botao = page.locator('[data-tv-trigger]:visible')
      assert.equal(await botao.count(), 1, `${nome}: um botão TV visível`)
      const caixaBotao = await botao.boundingBox()
      assert.ok(caixaBotao.width >= 36 && caixaBotao.height >= 36, `${nome}: botão TV pequeno demais ${JSON.stringify(caixaBotao)}`)
      assert.ok(caixaBotao.x + caixaBotao.width <= viewport.width, `${nome}: botão TV fora da tela`)
      const mais = await page.locator('.more-tab > button:visible').boundingBox()
      assert.ok(Math.abs(mais.y - caixaBotao.y) < 12 && caixaBotao.x > mais.x, `${nome}: TV deve ficar logo depois de Mais`)

      await botao.click()
      const tv = page.getByRole('dialog', { name: 'TV ao vivo' })
      await tv.waitFor()
      assert.equal(await tv.locator('iframe').count(), 0, `${nome}: vídeo não carrega antes da escolha`)
      await page.screenshot({ path: path.join(out, `${nome}-escolha.png`) })

      await tv.getByRole('button', { name: /CNN Brasil/ }).click()
      await tv.locator('iframe').waitFor()
      assert.match(await tv.locator('iframe').getAttribute('src'), /channel=UCvdwhh_fDyWccR42-rReZLw.*mute=1/)
      await page.waitForTimeout(300)
      await page.screenshot({ path: path.join(out, `${nome}-cnn-pequena.png`) })

      await tv.getByRole('button', { name: /Bloomberg TV/ }).click()
      await tv.getByRole('button', { name: 'TV grande' }).click()
      await page.waitForTimeout(300)
      const caixa = await tv.boundingBox()
      assert.ok(caixa.x >= 0 && caixa.y >= 0 && caixa.x + caixa.width <= viewport.width && caixa.y + caixa.height <= viewport.height, `${nome}: TV sai da tela ${JSON.stringify(caixa)}`)
      if (viewport.width < 1000) {
        const menu = await page.locator('.nav-top').boundingBox()
        assert.ok(caixa.y + caixa.height <= menu.y + 1, `${nome}: TV cobre o menu de baixo (TV ${JSON.stringify(caixa)}, menu ${JSON.stringify(menu)})`)
      }
      await page.screenshot({ path: path.join(out, `${nome}-bloomberg-grande.png`) })

      // Continua aberta e tocando ao trocar de seção.
      await page.evaluate(() => { location.hash = '#juros' })
      await page.waitForTimeout(500)
      assert.equal(await tv.locator('iframe').count(), 1, `${nome}: TV some ao trocar de seção`)
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert.ok(sobra <= 0, `${nome}: rolagem lateral de ${sobra}px`)
      await page.screenshot({ path: path.join(out, `${nome}-outra-secao.png`) })

      await tv.getByRole('button', { name: 'Fechar TV' }).click()
      assert.equal(await page.getByRole('dialog', { name: 'TV ao vivo' }).count(), 0, `${nome}: TV não fechou`)
      await context.close()
    }
    assert.deepEqual(erros, [])
    assert.ok(pedidos.some(u => u.includes('UCIALMKvObZNtJ6AmdCLP7Lg')), 'Bloomberg pedida pelo canal')
    console.log(`TV ao vivo: ${TELAS.length} telas conferidas, capturas em ${out}`)
  } finally {
    await browser.close()
  }
})().catch(e => { console.error(e); process.exit(1) })
