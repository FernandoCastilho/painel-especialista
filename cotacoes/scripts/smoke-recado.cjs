// Recado da administração: pop-up quando recado.json está ligado, espera o aviso inicial, aparece uma vez por recado e volta quando o texto muda.
const { chromium } = require('playwright'), assert = require('node:assert/strict')
;(async () => {
  const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5216'
  const { MARKET_POPUP_KEY, marketSlot } = await import('../src/marketPopup.js')
  // Segunda-feira, 9h28 de Brasília: o teste também deve funcionar com panorama pendente.
  const instant = new Date('2026-11-09T12:28:00Z'), slot = marketSlot(instant.getTime())
  assert.ok(slot, 'a fixture deve cair no horário de exibição do panorama')
  const b = await chromium.launch(require('./smoke-launch.cjs')())
  try {
    for (const width of [390, 1280]) {
      const ctx = await b.newContext({ viewport: { width, height: 800 }, serviceWorkers: 'block' }), p = await ctx.newPage(), errors = []
      p.on('pageerror', (e) => errors.push(e.message))
      await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false })) // o aviso inicial e o recado não aparecem para navegador automatizado
      // Isola a deduplicação do recado; a fila com os três conteúdos é conferida abaixo.
      await ctx.addInitScript(({ day, key, edition }) => {
        localStorage.setItem('aprender-conceito-dia', day)
        localStorage.setItem(key, edition)
      }, { day: slot.day, key: MARKET_POPUP_KEY, edition: slot.key })
      await p.clock.install({ time: instant })
      await ctx.route('**/*', (r) => r.request().url().startsWith(base) ? r.continue() : r.abort())
      // O Panorama do dia abre sozinho em dia útil, das 9h às 18h, e o recado espera ele fechar; marca a hora atual como já vista (também após localStorage.clear()).
      await ctx.addInitScript(() => { const f = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((v) => [v.type, v.value])); localStorage.setItem('painel-panorama-hora', `${f.year}-${f.month}-${f.day}T${f.hour}`) })
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
      // mesmo recado: não volta ao reabrir
      await p.reload(); await p.locator('dialog.aviso-inicial:not(.recado)').getByRole('button', { name: 'Entendi' }).click()
      await p.waitForTimeout(1500)
      assert.equal(await p.locator('dialog.recado').count(), 0, 'recado já visto não volta')
      // recado novo (texto mudou) chega sem recarregar, na próxima leitura (relê a cada minuto)
      file = { ...file, nivel: 'info', titulo: 'Novo indicador', texto: 'A aba Setores ganhou o preço do alumínio.' }
      await p.clock.fastForward('01:05')
      await p.evaluate(() => window.dispatchEvent(new Event('focus')))
      const n = p.getByRole('dialog', { name: 'Novo indicador' }); await n.waitFor({ timeout: 10000 })
      assert.match(await n.innerText(), /^Recado da administração/i)
      await p.keyboard.press('Escape'); await n.waitFor({ state: 'detached' })
      // desligado: nada aparece
      file = { ativo: false, titulo: 'x', texto: 'y' }
      await p.evaluate(() => localStorage.clear()); await p.reload(); await p.locator('dialog.aviso-inicial:not(.recado)').getByRole('button', { name: 'Entendi' }).click()
      await p.waitForTimeout(1500)
      assert.equal(await p.locator('dialog.recado').count(), 0, 'recado desligado não aparece')
      assert.deepEqual(errors, [])
      await ctx.close()
      console.log(width + ' PASS recado da administração: espera o aviso, aparece uma vez, recado novo sem recarregar, desligado não aparece')

      // Entrada nova em dia útil: nenhum conteúdo pode ocultar ou sobrepor outro modal.
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
      const pending = new Set(['conceito-diario', 'market-popup', 'recado'])
      for (let i = 0; i < 3; i++) {
        await page.clock.runFor(1500)
        await page.locator('dialog:modal').waitFor()
        assert.equal(await page.locator('dialog:modal').count(), 1, 'não há sobreposição na fila')
        const kind = await page.locator('dialog:modal').evaluate((el) => ['conceito-diario', 'market-popup', 'recado'].find((name) => el.classList.contains(name)))
        assert.ok(pending.delete(kind), 'cada conteúdo aparece uma vez: ' + kind)
        await page.keyboard.press('Escape')
      }
      await page.clock.runFor(1500)
      assert.equal(pending.size, 0, 'conceito, panorama e recado foram exibidos')
      assert.equal(await page.locator('dialog:modal').count(), 0, 'a fila terminou')
      await page.reload(); await initial.getByRole('button', { name: 'Entendi' }).click()
      await page.clock.runFor(1500)
      assert.equal(await page.locator('dialog:modal').count(), 0, 'a recarga não repete os conteúdos lidos')
      assert.deepEqual(queueErrors, [])
      await queue.close()
      console.log(width + ' PASS fila em dia útil: aviso, conceito, panorama e recado sem sobreposição ou repetição')
    }
  } finally { await b.close() }
})().catch((e) => { console.error(e); process.exit(1) })
