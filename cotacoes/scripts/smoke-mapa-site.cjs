// Teste de tela do Mapa do site (pedido de Fernando, 27/11/2026): mapa mental fixo, com a coruja no centro e os
// quatro ramos até o último item. Confere que cabe na largura em notebook, tela grande, tablet e celular, que as
// curvas ligam a coruja aos ramos no computador, que os links levam à tela certa e que o item está no menu Mais.
// 28/11: abre recolhido, setas e Expandir/Recolher tudo, coruja no meio da tela ao rolar, e capturas da moldura
// azul (atual) comparada com a anterior. Gera as capturas que vão como artefato da conferência.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.MAPA_SITE_QA_OUTPUT || 'workspace-qa/mapa-site'

const TELAS = [
  ['notebook-1366', { width: 1366, height: 768 }, ['dark', 'light']],
  ['notebook-1280', { width: 1280, height: 800 }, ['dark']],
  ['tela-grande-2560', { width: 2560, height: 1440 }, ['dark']],
  ['tablet-820', { width: 820, height: 1180 }, ['light']],
  ['celular-390', { width: 390, height: 844 }, ['dark', 'light']],
]

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const erros = []
  try {
    for (const [nome, viewport, temas] of TELAS) {
      for (const tema of temas) {
        const celular = viewport.width < 500
        const context = await browser.newContext({ viewport, colorScheme: tema, isMobile: celular, hasTouch: celular, deviceScaleFactor: celular ? 2 : 1 })
        const page = await context.newPage()
        page.on('pageerror', (e) => erros.push(`${nome} ${tema}: ${e.message}`))
        await page.route('**/*', (route) => (route.request().url().startsWith(base + '/') ? route.continue() : route.abort()))
        await page.goto(`${base}/#mapa`)
        await page.locator('.site-map').waitFor()
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(300)
        // Abre recolhido: só os quatro ramos, nenhum item à vista.
        const inicio = await page.evaluate(() => ({
          abertas: document.querySelectorAll('.sm-toggle[aria-expanded="true"]').length,
          visiveis: [...document.querySelectorAll('.site-map .sm-tree a')].filter(a => a.getClientRects().length).length,
        }))
        assert.deepEqual(inicio, { abertas: 0, visiveis: 0 }, `${nome}: deveria abrir recolhido`)
        await page.screenshot({ path: path.join(out, `${nome}-${tema}-recolhido.png`), fullPage: true })
        if (tema === temas[0]) {
          await page.evaluate(() => document.querySelector('.site-map').classList.remove('sm-azul'))
          await page.screenshot({ path: path.join(out, `${nome}-${tema}-recolhido-sem-azul.png`), fullPage: true })
          await page.evaluate(() => document.querySelector('.site-map').classList.add('sm-azul'))
        }
        // Teclado: a seta do primeiro ramo abre com Enter e mostra os itens dele.
        const seta = page.locator('.sm-card-head .sm-toggle').first()
        await seta.focus()
        await page.keyboard.press('Enter')
        assert.equal(await seta.getAttribute('aria-expanded'), 'true', `${nome}: seta pelo teclado`)
        assert.ok(await page.locator('.sm-card').first().locator('.sm-tree a').first().isVisible(), `${nome}: ramo aberto mostra os itens`)
        await page.getByRole('button', { name: 'Expandir tudo' }).click()
        assert.equal(await page.locator('.sm-toggle[aria-expanded="false"]').count(), 0, `${nome}: Expandir tudo`)
        await page.waitForTimeout(200)
        const medida = await page.evaluate(() => ({
          sobra: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          curvas: document.querySelectorAll('.sm-curve').length,
          ramos: document.querySelectorAll('.sm-card').length,
          links: document.querySelectorAll('.site-map a').length,
          cortados: [...document.querySelectorAll('.site-map a')].filter(a => a.scrollWidth > a.clientWidth + 1 || a.getBoundingClientRect().right > document.documentElement.clientWidth).map(a => a.textContent).slice(0, 5),
          coruja: !!document.querySelector('.sm-owl img')?.naturalWidth,
        }))
        assert.ok(medida.sobra <= 0, `${nome}: rolagem lateral de ${medida.sobra}px`)
        assert.equal(medida.ramos, 4, `${nome}: ramos`)
        assert.ok(medida.links > 150, `${nome}: só ${medida.links} links`)
        assert.deepEqual(medida.cortados, [], `${nome}: itens cortados`)
        assert.ok(medida.coruja, `${nome}: coruja não carregou`)
        assert.equal(medida.curvas, viewport.width >= 1000 ? 4 : 0, `${nome}: curvas da coruja aos ramos`)
        await page.screenshot({ path: path.join(out, `${nome}-${tema}-expandido.png`), fullPage: true })
        if (tema === temas[0]) {
          await page.screenshot({ path: path.join(out, `${nome}-${tema}-primeira-tela.png`) })
          await page.evaluate(() => document.querySelector('.site-map').classList.remove('sm-azul'))
          await page.screenshot({ path: path.join(out, `${nome}-${tema}-expandido-sem-azul.png`), fullPage: true })
          await page.evaluate(() => document.querySelector('.site-map').classList.add('sm-azul'))
        }
        if (viewport.width >= 1000 && await page.evaluate(() => document.querySelector('.sm-board').offsetHeight > innerHeight * 1.3)) {
          // A coruja acompanha a rolagem e fica perto do meio da tela; as curvas vão junto.
          await page.evaluate(() => { const b = document.querySelector('.sm-board').getBoundingClientRect(); window.scrollTo(0, window.scrollY + b.top + b.height / 2 - innerHeight / 2) })
          await page.waitForTimeout(250)
          const owl = await page.evaluate(() => { const r = document.querySelector('.sm-center').getBoundingClientRect(); return { meio: r.top + r.height / 2, tela: innerHeight, curvas: document.querySelectorAll('.sm-curve').length } })
          assert.ok(Math.abs(owl.meio - owl.tela / 2) < owl.tela * 0.2, `${nome}: coruja fora do meio da tela (${Math.round(owl.meio)} de ${owl.tela})`)
          assert.equal(owl.curvas, 4, `${nome}: curvas ao rolar`)
          if (tema === temas[0]) await page.screenshot({ path: path.join(out, `${nome}-${tema}-rolando.png`) })
          await page.evaluate(() => window.scrollTo(0, 0))
        }
        await page.getByRole('button', { name: 'Recolher tudo' }).click()
        assert.equal(await page.locator('.sm-toggle[aria-expanded="true"]').count(), 0, `${nome}: Recolher tudo`)
        await page.getByRole('button', { name: 'Expandir tudo' }).click()

        if (nome === 'notebook-1366' && tema === 'dark') {
          // Link direto: calculadora e quadro de Juros (rola até o quadro).
          const giro = page.locator('.site-map a[href="#calculadora/giro"]')
          await giro.click()
          await page.waitForFunction(() => location.hash === '#calculadora/giro', null, { timeout: 8000 }).catch(async (e) => {
            const caixa = await giro.boundingBox().catch(() => null)
            const alvo = caixa && await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el && `${el.tagName}.${el.className} "${el.textContent.slice(0, 40)}"` }, [caixa.x + caixa.width / 2, caixa.y + caixa.height / 2])
            throw new Error(`clique em Capital de Giro não abriu a calculadora: endereço ${await page.evaluate(() => location.hash)}, caixa ${JSON.stringify(caixa)}, no ponto ${alvo}, erros ${JSON.stringify(erros)} (${e.message})`)
          })
          await page.goto(`${base}/#mapa`)
          await page.locator('.site-map a', { hasText: 'Cupom cambial' }).first().click()
          await page.waitForFunction(() => location.hash === '#juros')
          await page.waitForFunction(() => { const el = document.getElementById('juros-curva-cc'); return el && el.getBoundingClientRect().top < 200 }, null, { timeout: 8000 })
          // Menu Mais leva ao mapa.
          await page.goto(`${base}/#resumo`)
          await page.getByRole('button', { name: /^Mais/ }).filter({ visible: true }).first().click()
          await page.getByRole('menuitem', { name: /Mapa do site/ }).click()
          await page.waitForFunction(() => location.hash === '#mapa')
        }
        await context.close()
      }
    }
    assert.deepEqual(erros, [], 'erros na página')
    console.log('Mapa do site: ok em', TELAS.map(t => t[0]).join(', '))
  } finally {
    await browser.close()
  }
})().catch((e) => { console.error(e); process.exit(1) })
