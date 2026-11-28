// Teste de tela da TV ao vivo (pedido de Fernando, 28/11/2026): botão TV ao lado de Mais (no celular, dentro do Mais), escolha do canal antes de
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

      // Computador: botão TV logo depois de Mais. Celular e tablet: o menu de baixo não tem espaço para mais um
      // botão de 44 px, então a TV é o último item do Mais.
      const mais = page.locator('.more-tab > button:visible')
      const caixaMais = await mais.boundingBox()
      if (viewport.width >= 1000) {
        const botao = page.locator('.nav-tv:visible')
        assert.equal(await botao.count(), 1, `${nome}: um botão TV visível`)
        const caixaBotao = await botao.boundingBox()
        assert.ok(caixaBotao.width >= 44 && caixaBotao.height >= 44, `${nome}: botão TV pequeno demais ${JSON.stringify(caixaBotao)}`)
        assert.ok(caixaBotao.x + caixaBotao.width <= viewport.width, `${nome}: botão TV fora da tela`)
        assert.ok(Math.abs(caixaMais.y - caixaBotao.y) < 12 && caixaBotao.x > caixaMais.x, `${nome}: TV deve ficar logo depois de Mais`)
        await botao.click()
      } else {
        assert.equal(await page.locator('.nav-tv:visible').count(), 0, `${nome}: sem botão TV no menu de baixo`)
        await mais.click()
        const item = page.getByRole('menuitem', { name: 'TV ao vivo' })
        const caixaItem = await item.boundingBox()
        assert.ok(caixaItem.height >= 44 && caixaItem.y >= 0, `${nome}: item TV do Mais ${JSON.stringify(caixaItem)}`)
        await item.click()
      }
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
        const menu = await page.locator('.nav-top > nav').boundingBox()
        assert.ok(caixa.y + caixa.height <= menu.y + 1, `${nome}: TV cobre o menu de baixo (TV ${JSON.stringify(caixa)}, menu ${JSON.stringify(menu)})`)
      }
      await page.screenshot({ path: path.join(out, `${nome}-bloomberg-grande.png`) })

      // Arrastar pela barra de cima (pedido de Fernando, 28/11/2026): a TV vai para onde a pessoa soltar e não sai da tela.
      await tv.getByRole('button', { name: 'TV pequena' }).click()
      await page.waitForTimeout(200)
      const antes = await tv.boundingBox()
      const alca = await tv.locator('.tv-dock-title').boundingBox()
      const destino = { x: Math.min(viewport.width - 40, antes.x + antes.width / 2 + 120), y: Math.max(60, antes.y - 160) }
      await page.mouse.move(alca.x + 10, alca.y + alca.height / 2)
      await page.mouse.down()
      await page.mouse.move(destino.x, destino.y, { steps: 8 })
      await page.mouse.up()
      const depois = await tv.boundingBox()
      assert.ok(Math.abs(depois.x - antes.x) > 30 || Math.abs(depois.y - antes.y) > 30, `${nome}: TV não se moveu (${JSON.stringify(antes)} → ${JSON.stringify(depois)})`)
      assert.ok(depois.x >= 0 && depois.y >= 0 && depois.x + depois.width <= viewport.width + 1 && depois.y + depois.height <= viewport.height + 1, `${nome}: TV arrastada saiu da tela ${JSON.stringify(depois)}`)
      // Arrastar para longe do canto: fica presa na borda.
      await page.mouse.move(alca.x + 10 + (depois.x - antes.x), depois.y + 20)
      await page.mouse.down()
      await page.mouse.move(viewport.width + 300, viewport.height + 300, { steps: 6 })
      await page.mouse.up()
      const borda = await tv.boundingBox()
      assert.ok(borda.x + borda.width <= viewport.width + 1 && borda.y + borda.height <= viewport.height + 1, `${nome}: TV passou da borda ${JSON.stringify(borda)}`)
      if (viewport.width < 1000) {
        const menu = await page.locator('.nav-top > nav').boundingBox()
        assert.ok(borda.y + borda.height <= menu.y + 1, `${nome}: TV arrastada cobre o menu de baixo`)
      }
      // Teclado: setas no puxador movem; Home volta ao canto de origem.
      const puxador = tv.getByRole('button', { name: /Mover TV/ })
      await puxador.focus()
      const comTeclado = await tv.boundingBox()
      await page.keyboard.press('ArrowUp')
      const subiu = await tv.boundingBox()
      assert.ok(subiu.y < comTeclado.y, `${nome}: seta para cima não moveu a TV`)
      await page.screenshot({ path: path.join(out, `${nome}-arrastada.png`) })
      await page.keyboard.press('Home')
      await page.waitForTimeout(100)
      const canto = await tv.boundingBox()
      assert.ok(Math.abs(canto.x - antes.x) < 2 && Math.abs(canto.y + canto.height - (antes.y + antes.height)) < 2, `${nome}: Home não voltou ao canto (${JSON.stringify(canto)} × ${JSON.stringify(antes)})`)
      assert.ok(await tv.getByRole('link', { name: 'Abrir Bloomberg TV no YouTube' }).isVisible(), `${nome}: botão do YouTube visível`)

      // Continua aberta e tocando ao trocar de seção.
      await page.evaluate(() => { location.hash = '#juros' })
      await page.waitForTimeout(500)
      assert.equal(await tv.locator('iframe').count(), 1, `${nome}: TV some ao trocar de seção`)
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert.ok(sobra <= 0, `${nome}: rolagem lateral de ${sobra}px`)
      await page.screenshot({ path: path.join(out, `${nome}-outra-secao.png`) })

      await tv.getByRole('button', { name: 'Fechar TV' }).click()
      assert.equal(await page.getByRole('dialog', { name: 'TV ao vivo' }).count(), 0, `${nome}: TV não fechou`)
      assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-tv-trigger')), true, `${nome}: foco volta para TV ou Mais`)
      await context.close()
    }
    assert.deepEqual(erros, [])
    assert.ok(pedidos.some(u => u.includes('UCIALMKvObZNtJ6AmdCLP7Lg')), 'Bloomberg pedida pelo canal')
    console.log(`TV ao vivo: ${TELAS.length} telas conferidas, capturas em ${out}`)
  } finally {
    await browser.close()
  }
})().catch(e => { console.error(e); process.exit(1) })
