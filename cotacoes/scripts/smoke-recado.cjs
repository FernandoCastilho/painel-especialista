// Recado da administração: pop-up quando recado.json está ligado, espera o aviso inicial, aparece uma vez por recado e volta quando o texto muda.
// O aviso inicial só aparece na primeira visita (ou quando o texto dele muda); conceito do dia e panorama não abrem mais sozinhos.
const { chromium } = require('playwright'), assert = require('node:assert/strict')
;(async () => {
  const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5216'
  const { marketSlot } = await import('../src/marketPopup.js')
  // Segunda-feira, 9h28 de Brasília: horário de edição do panorama, que mesmo assim não abre sozinho.
  const instant = new Date('2026-11-09T12:28:00Z'), slot = marketSlot(instant.getTime())
  assert.ok(slot, 'a fixture deve cair no horário de exibição do panorama')
  const b = await chromium.launch(require('./smoke-launch.cjs')())
  try {
    for (const width of [390, 1280]) {
      const ctx = await b.newContext({ viewport: { width, height: 800 }, serviceWorkers: 'block' }), p = await ctx.newPage(), errors = []
      p.on('pageerror', (e) => errors.push(e.message))
      await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false })) // o aviso inicial e o recado não aparecem para navegador automatizado
      await p.clock.install({ time: instant })
      await ctx.route('**/*', (r) => r.request().url().startsWith(base) ? r.continue() : r.abort())
      let file = { ativo: true, nivel: 'urgente', titulo: 'Manutenção hoje', texto: 'O painel fica fora do ar das 18h às 19h.\nObrigado.' }
      await ctx.route('**/recado.json*', (r) => r.fulfill({ json: file }))
      await p.goto(base + '/#resumo')
      // primeiro o aviso inicial; o recado espera ele fechar
      const aviso = p.locator('dialog.aviso-inicial:not(.recado)'); await aviso.waitFor()
      await p.waitForTimeout(1500)
      assert.equal(await p.locator('dialog.recado').count(), 0, 'recado não se sobrepõe ao aviso inicial')
      await aviso.getByRole('button', { name: 'Entendi' }).click()
      const d = p.getByRole('dialog', { name: 'Manutenção hoje' }); await d.waitFor()
      assert.match(await d.innerText(), /urgente da administração[\s\S]*18h às 19h\.\nObrigado\./i)
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await d.getByRole('button', { name: 'Entendi' }).click(); await d.waitFor({ state: 'detached' })
      // mesmo recado: não volta ao reabrir; o aviso inicial, já lido, também não
      await p.reload(); await p.locator('.market-table').waitFor()
      await p.waitForTimeout(1500)
      assert.equal(await p.locator('dialog.recado').count(), 0, 'recado já visto não volta')
      assert.equal(await p.locator('dialog:modal').count(), 0, 'segunda visita sem pop-up')
      // recado novo (texto mudou) chega sem recarregar, na próxima leitura (relê a cada minuto)
      file = { ...file, nivel: 'info', titulo: 'Novo indicador', texto: 'A aba Setores ganhou o preço do alumínio.' }
      await p.clock.fastForward('01:05')
      await p.evaluate(() => window.dispatchEvent(new Event('focus')))
      const n = p.getByRole('dialog', { name: 'Novo indicador' }); await n.waitFor({ timeout: 10000 })
      assert.match(await n.innerText(), /^Recado da administração/i)
      await p.keyboard.press('Escape'); await n.waitFor({ state: 'detached' })
      // desligado: nada aparece (armazenamento limpo equivale a aparelho novo: o aviso inicial volta uma vez)
      file = { ativo: false, titulo: 'x', texto: 'y' }
      await p.evaluate(() => localStorage.clear()); await p.reload(); await p.locator('dialog.aviso-inicial:not(.recado)').getByRole('button', { name: 'Entendi' }).click()
      await p.waitForTimeout(1500)
      assert.equal(await p.locator('dialog.recado').count(), 0, 'recado desligado não aparece')
      assert.deepEqual(errors, [])
      await ctx.close()
      console.log(width + ' PASS recado da administração: espera o aviso, aparece uma vez, recado novo sem recarregar, desligado não aparece')

      // Entrada nova em dia útil, em horário de edição do panorama: só aviso e recado aparecem, um de cada vez.
      const queue = await b.newContext({ viewport: { width, height: 800 }, timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' })
      await queue.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }))
      await queue.route('**/*', (r) => r.request().url().startsWith(base) ? r.continue() : r.abort())
      await queue.route('**/recado.json*', (r) => r.fulfill({ json: { ativo: true, titulo: 'Recado na fila', texto: 'Aguarde a leitura dos demais conteúdos.' } }))
      const page = await queue.newPage(), queueErrors = []
      page.on('pageerror', (e) => queueErrors.push(e.message))
      await page.clock.install({ time: instant })
      await page.goto(base + '/#resumo')
      const initial = page.locator('dialog.aviso-inicial:not(.recado)')
      await initial.waitFor(); await page.clock.runFor(1500)
      assert.equal(await page.locator('dialog:modal').count(), 1, 'somente o aviso inicial está aberto')
      await initial.getByRole('button', { name: 'Entendi' }).click()
      // Depois do aviso, só o recado: conceito do dia e panorama ficam nos botões do Mercado e não entram na fila.
      await page.clock.runFor(1500)
      const only = page.getByRole('dialog', { name: 'Recado na fila' }); await only.waitFor()
      assert.equal(await page.locator('dialog:modal').count(), 1, 'não há sobreposição')
      await page.keyboard.press('Escape')
      await page.clock.runFor(5000)
      assert.equal(await page.locator('dialog:modal').count(), 0, 'nada mais abre sozinho')
      assert.equal(await page.locator('dialog.conceito-diario').count(), 0, 'conceito do dia não abre sozinho')
      assert.equal(await page.locator('dialog.market-popup').evaluate((el) => el.open), false, 'panorama não abre sozinho')
      await page.reload(); await page.locator('.market-table').waitFor()
      await page.clock.runFor(5000)
      assert.equal(await page.locator('dialog:modal').count(), 0, 'a recarga não repete aviso nem recado')
      assert.deepEqual(queueErrors, [])
      await queue.close()
      console.log(width + ' PASS entrada em dia útil: aviso e recado sem sobreposição; conceito e panorama não abrem sozinhos; nada se repete')
    }
  } finally { await b.close() }
})().catch((e) => { console.error(e); process.exit(1) })
