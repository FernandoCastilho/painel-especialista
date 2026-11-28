// Teste de tela do ícone do WhatsApp (pedido de Fernando, 28/11/2026): no BNDES e no CDC, copiar a cotação como imagem
// não mostra mais aviso escrito ("Cole na conversa do WhatsApp"); o retorno é o ícone virar um visto, como no Faturamento.
// Confere dica (title), rótulo acessível, a imagem copiada e gera as capturas que vão como artefato da conferência.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.WHATSAPP_QA_OUTPUT || 'workspace-qa/whatsapp'
const ROTULO = 'Copiar a cotação como imagem para o WhatsApp'

// Sem service worker: senão ele atende os .json antes das rotas de teste e a cotação do BNDES não aparece.
async function dadosBndes(page) {
  await page.route('**/bndes.json*', (r) => r.fulfill({ json: { schemaVersion: 1, generatedAt: Date.now(), series: { TFB_60_90: { points: [['2026-11-05', 13], ['2026-11-25', 13.5]] } } } }))
  await page.route('**/moedas.json*', (r) => r.fulfill({ json: { schemaVersion: 1, generatedAt: Date.now(), series: { C03: { points: [['2026-11-05', 12], ['2026-11-25', 12.5]] }, C01: { points: [['2026-11-05', 12], ['2026-11-25', 12.5]] } } } }))
  await page.route('**/curves.json*', (r) => r.fulfill({ json: { br: { sourceDate: '2026-11-25', compare: [{ date: '2026-11-25', label: 'Hoje' }], curves: { '2026-11-25': [[21, 12], [252, 12], [504, 13], [1008, 14], [1260, 14.5]] } } } }))
  await page.route('**/macro.json*', (r) => r.fulfill({ json: { generatedAt: Date.now(), cdi: [[Date.UTC(2026, 10, 5), 14.9], [Date.UTC(2026, 10, 25), 14.9]], selic: [[Date.UTC(2026, 10, 5), 15]], focus: null, ptax: {} } }))
  await page.route('**/recado.json*', (r) => r.fulfill({ json: { ativo: false } }))
}

async function abrirBndes(page) {
  await dadosBndes(page)
  await page.goto(base + '/#calculadora')
  const ok = page.locator('dialog.aviso-inicial:not(.recado)').getByRole('button', { name: 'Entendi' })
  if (await ok.isVisible()) await ok.click()
  await page.getByRole('button', { name: 'BNDES: abrir calculadora', exact: true }).click()
}

async function abrirCdc(page) {
  await page.goto(`${base}/#calculadora/cdc`)
  await page.getByRole('heading', { name: 'CDC', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Tabela de funding: colar ou atualizar' }).click()
  const dialogo = page.locator('.cdc-funding-dialog')
  await dialogo.getByRole('textbox', { name: 'Custo ao ano em 48 meses' }).fill('15,58')
  await dialogo.getByLabel('Válido até').fill('2999-12-31')
  await dialogo.getByRole('button', { name: 'Usar esta tabela' }).click()
  await page.getByText('sobre funding de 15,58% a.a.').waitFor()
  await page.getByRole('button', { name: 'Simular' }).click()
  await page.locator('.cdc-screen .giro-result').getByText('Valor da parcela').waitFor()
}

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const erros = []
  try {
    for (const [calc, abrir] of [['bndes', abrirBndes], ['cdc', abrirCdc]]) {
      for (const [nome, viewport] of [['computador', { width: 1440, height: 1000 }], ['celular', { width: 390, height: 900 }]]) {
        for (const tema of ['light', 'dark']) {
          const context = await browser.newContext({ viewport, colorScheme: tema, serviceWorkers: 'block' })
          await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base })
          const page = await context.newPage()
          page.on('pageerror', (e) => erros.push(`${calc} ${nome} ${tema}: ${e.message}`))
          await page.route('**/*', (route) => (route.request().url().startsWith(base + '/') ? route.continue() : route.abort()))
          await abrir(page)
          const botao = page.getByRole('button', { name: ROTULO, exact: true })
          await botao.waitFor()
          assert.equal(await botao.getAttribute('title'), ROTULO, `${calc} ${nome} ${tema}: sem dica ao passar o mouse`)
          assert.equal((await botao.innerText()).trim(), '', `${calc} ${nome} ${tema}: botão com texto visível`)
          assert.equal(await botao.locator('svg').count(), 1, `${calc} ${nome} ${tema}: botão sem ícone`)
          const caixa = page.locator('.bndes-whatsapp')
          await caixa.scrollIntoViewIfNeeded()
          await caixa.screenshot({ path: path.join(out, `${calc}-${nome}-${tema}.png`) })

          await botao.click()
          await botao.locator('svg path[d^="M5 12.5"]').waitFor({ timeout: 10000 })
          assert.equal(await page.getByText('Cole na conversa do WhatsApp').count(), 0, `${calc} ${nome} ${tema}: aviso escrito do WhatsApp`)
          const status = caixa.locator('[role=status]')
          assert.equal(await status.innerText(), 'Imagem copiada.', `${calc} ${nome} ${tema}: aviso só para leitor de tela`)
          const quadro = await status.boundingBox()
          assert.ok(!quadro || quadro.width <= 1, `${calc} ${nome} ${tema}: aviso de status visível na tela`)
          await caixa.screenshot({ path: path.join(out, `${calc}-${nome}-${tema}-copiado.png`) })
          const tipos = await page.evaluate(async () => (await navigator.clipboard.read())[0].types)
          assert.ok(tipos.includes('image/png'), `${calc} ${nome} ${tema}: imagem não foi para a área de transferência`)
          // O visto volta a ser o ícone do WhatsApp.
          await botao.locator('svg path[d^="M3.5 20.5"]').waitFor({ timeout: 5000 })
          await context.close()
          console.log(`PASS whatsapp ${calc} ${nome} ${tema}`)
        }
      }
    }
    assert.deepEqual(erros, [], 'erros do navegador')
  } finally {
    await browser.close()
  }
})().catch((e) => { console.error(e); process.exit(1) })
