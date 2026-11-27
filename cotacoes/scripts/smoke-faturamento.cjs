// Teste de tela do Faturamento (pedido de Fernando, 27/11/2026): copiar e baixar a imagem viram ícones discretos,
// sem texto na tela; o retorno é o ícone virar um visto. Confere a imagem copiada (1920 x 1080, com a análise)
// e gera as capturas que vão como artefato da conferência.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.FATURAMENTO_QA_OUTPUT || 'workspace-qa/faturamento'

const tamanhoPng = (buf) => ({ largura: buf.readUInt32BE(16), altura: buf.readUInt32BE(20) })

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const erros = []
  try {
    for (const [nome, viewport] of [['computador', { width: 1440, height: 1000 }], ['celular', { width: 390, height: 900 }]]) {
      for (const tema of ['light', 'dark']) {
        const context = await browser.newContext({ viewport, colorScheme: tema, acceptDownloads: true })
        await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base })
        const page = await context.newPage()
        page.on('pageerror', (e) => erros.push(`${nome} ${tema}: ${e.message}`))
        await page.route('**/*', (route) => (route.request().url().startsWith(base + '/') ? route.continue() : route.abort()))
        await page.goto(`${base}/#calculadora/faturamento`)
        await page.getByRole('button', { name: 'Usar exemplo fictício' }).click()
        const copiar = page.getByRole('button', { name: 'Copiar imagem', exact: true })
        const baixar = page.getByRole('button', { name: 'Baixar imagem (PNG)', exact: true })
        await copiar.waitFor()
        // Só ícone: nenhum texto visível nos botões e nenhum aviso escrito na tela.
        for (const b of [copiar, baixar]) {
          assert.equal((await b.innerText()).trim(), '', `${nome} ${tema}: botão com texto visível`)
          assert.equal(await b.locator('svg').count(), 1, `${nome} ${tema}: botão sem ícone`)
          const caixa = await b.boundingBox()
          assert.ok(caixa.width >= 40 && caixa.height >= 40, `${nome} ${tema}: alvo de toque pequeno (${caixa.width}x${caixa.height})`)
        }
        assert.equal(await page.getByText('Baixar PNG', { exact: true }).count(), 0, 'texto antigo Baixar PNG')
        const ferramentas = page.locator('.ft-tools')
        await ferramentas.scrollIntoViewIfNeeded()
        await ferramentas.screenshot({ path: path.join(out, `icones-${nome}-${tema}.png`) })
        if (nome === 'computador' && tema === 'light') await page.screenshot({ path: path.join(out, `tela-${nome}-${tema}.png`), fullPage: true })

        if (nome === 'computador') {
          await copiar.click()
          await page.locator('.ft-img button[aria-label="Copiar imagem"] svg path[d^="M5 12.5"]').waitFor({ timeout: 10000 })
          assert.equal(await page.getByText('Cole no PowerPoint').count(), 0, 'aviso escrito de PowerPoint')
          assert.equal(await page.locator('.ft-img + [role=status]').innerText(), 'Imagem copiada.', 'aviso só para leitor de tela')
          const status = await page.locator('.ft-img + [role=status]').boundingBox()
          assert.ok(!status || status.width <= 1, 'aviso de status visível na tela')
          await ferramentas.screenshot({ path: path.join(out, `icones-${nome}-${tema}-copiado.png`) })
          const b64 = await page.evaluate(async () => {
            const itens = await navigator.clipboard.read()
            const blob = await itens[0].getType('image/png')
            const bytes = new Uint8Array(await blob.arrayBuffer())
            let s = ''; for (const x of bytes) s += String.fromCharCode(x)
            return btoa(s)
          })
          const png = Buffer.from(b64, 'base64')
          assert.deepEqual(tamanhoPng(png), { largura: 1920, altura: 1080 }, 'tamanho da imagem copiada')
          fs.writeFileSync(path.join(out, `imagem-copiada-${tema}.png`), png)
          // O visto volta a ser o ícone de copiar.
          await page.locator('.ft-img button[aria-label="Copiar imagem"] svg rect').waitFor({ timeout: 5000 })
          const [download] = await Promise.all([page.waitForEvent('download'), baixar.click()])
          assert.equal(download.suggestedFilename(), 'faturamento-endividamento.png')
          await download.saveAs(path.join(out, `imagem-baixada-${tema}.png`))
        }
        await context.close()
        console.log(`PASS faturamento ${nome} ${tema}`)
      }
    }
    assert.deepEqual(erros, [], 'erros do navegador')
  } finally {
    await browser.close()
  }
})().catch((e) => { console.error(e); process.exit(1) })
