const captureControls = require('./smoke-capture-controls.cjs')
// Seleção de trecho no gráfico: arrastar marca o intervalo (linhas pontilhadas), mostra a variação e compara com o ano anterior.
const { chromium } = require('playwright'), assert = require('node:assert/strict')
;(async () => {
  const b = await chromium.launch({ channel: process.env.SMOKE_CHANNEL || 'msedge', headless: true }), base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5216'
  try {
    for (const width of [390, 1440]) {
      const p = await b.newPage({ viewport: { width, height: 1100 }, serviceWorkers: 'block' }), errors = []
      p.on('pageerror', (e) => errors.push(e.message))
      // o histórico do Brent abre da tabela de Cenários › Commodities (gráfico compartilhado com as demais referências)
      await p.goto(base + '/#cenarios/commodities')
      await p.getByRole('button', { name: 'Petróleo Brent: abrir gráfico e histórico' }).click()
      const d = p.getByRole('dialog', { name: /histórico de Petróleo Brent/i })
      await d.waitFor()
      await d.getByRole('group', { name: 'Período da referência' }).getByRole('button', { name: '12 meses', exact: true }).click()
      // quadro modal com câmera e "Fechar"; filtros (período e escala) num único bloco acima do gráfico
      await captureControls(d)
      assert.equal(await d.locator('.chart-filters').count(), 1)
      await p.waitForTimeout(600) // a janela termina de abrir
      const full = await d.boundingBox()
      // celular: tela inteira; computador (≥ 900 px): janela no centro da tela, ampla mas sem ocupar a tela toda
      if (width >= 900) assert.ok(Math.abs(full.width - Math.min(1120, width - 64)) <= 1 && Math.abs((full.x + full.width / 2) - width / 2) <= 1 && full.y >= 31 && full.height <= (await p.evaluate(() => innerHeight)) - 63, `detalhe em janela central (${JSON.stringify(full)})`)
      else assert.ok(Math.abs(full.width - width) <= 1 && full.x <= 1 && full.height >= 1099, `detalhe em tela inteira no celular (${JSON.stringify(full)})`)
      assert.ok((await d.locator('.chart-filters').boundingBox()).y < (await d.locator('.plot svg').first().boundingBox()).y, 'filtros acima do gráfico')
      const svg = d.locator('.plot svg').first()
      await svg.waitFor(); await svg.scrollIntoViewIfNeeded()
      const bb = await svg.boundingBox()
      assert.equal(await d.locator('.sel-line').count(), 0)
      await p.mouse.move(bb.x + bb.width * 0.55, bb.y + 100); await p.mouse.down()
      await p.mouse.move(bb.x + bb.width * 0.7, bb.y + 100, { steps: 6 }); await p.mouse.move(bb.x + bb.width * 0.9, bb.y + 100, { steps: 6 }); await p.mouse.up()
      const panel = d.locator('.sel-panel'); await panel.waitFor()
      assert.equal(await d.locator('.sel-line').count(), 4, 'duas linhas pontilhadas em cada seleção')
      assert.equal(await d.locator('.sel-chord').count(), 2, 'linha pontilhada da variação em cada seleção')
      assert.equal(await d.locator('.sel-label').count(), 2, 'variação no topo de cada seleção')
      assert.match(await panel.innerText(), /Trecho .*[+−]\d+,\d{2}% · [+−]\d+,\d{2}/)
      assert.match(await panel.innerText(), /Ano anterior .*diferença/)
      assert.equal(await d.locator('.sel-prior').count(), 1, 'seleção do ano anterior no mesmo gráfico')
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      // Escape limpa a seleção sem fechar o diálogo; clique simples também limpa
      await svg.focus(); await p.keyboard.press('Escape')
      assert.equal(await panel.count(), 0); assert.equal(await d.isVisible(), true)
      await p.mouse.move(bb.x + bb.width * 0.3, bb.y + 100); await p.mouse.down(); await p.mouse.move(bb.x + bb.width * 0.5, bb.y + 100, { steps: 6 }); await p.mouse.up()
      await panel.waitFor()
      await p.mouse.click(bb.x + bb.width * 0.4, bb.y + 100)
      assert.equal(await panel.count(), 0)
      // teclado: Shift + setas seleciona
      await svg.focus(); await p.keyboard.press('Home'); await p.keyboard.down('Shift'); for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowRight'); await p.keyboard.up('Shift')
      await panel.waitFor()
      // trecho sem ano anterior avisa em vez de inventar
      assert.match(await panel.innerText(), /Ano anterior/)
      await d.getByRole('button', { name: 'Fechar detalhes', exact: true }).click()
      await d.waitFor({ state: 'hidden' })
      assert.deepEqual(errors, [])
      console.log(width + ' PASS arrastar/linhas/variação/ano anterior/Escape/clique/Shift+setas')
      await p.close()
    }
  } finally { await b.close() }
})().catch((e) => { console.error(e); process.exit(1) })
