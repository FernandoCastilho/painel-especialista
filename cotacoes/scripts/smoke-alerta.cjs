// APIs de notificação simuladas: nenhuma notificação real nem pedido nativo é enviado.
// Confere a faixa e sua persistência, autorização tardia, dispensa e retry em celular e desktop.
const { chromium } = require('playwright'), assert = require('node:assert/strict')
const { mkdir } = require('node:fs/promises')
const path = require('node:path')
const now = Date.parse('2026-11-05T18:00:00Z'), first = Date.parse('2026-11-05T12:00:00Z') // 15h e 9h em Brasília
const raw = (bid, previous = bid) => ({ bid: String(bid), ask: String(bid * 1.0003), high: String(bid * 1.01), low: String(bid * .99), pctChange: String((bid / previous - 1) * 100), varBid: String(bid - previous), timestamp: String((now - 60000) / 1000) })
const quotes = { generatedAt: now - 60000, source: 'AwesomeAPI', rejected: {}, quotes: { USDBRL: raw(5.5, 5.48), EURBRL: raw(6.15, 6.14), JPYBRL: raw(.0347), USDCNH: raw(6.67) } }
// A primeira amostra de hoje tem o preço atual: só o fechamento anterior pode disparar USD.
const points = (base, last) => [[first - 300000, 4], [first, base], [now - 60000, last]]
const intraday = { generatedAt: now - 60000, resolution: '5 min', series: { USD: { points: points(5.5, 5.5) }, EUR: { points: points(6.15, 6.15) }, JPY: { points: [] }, CNH: { points: [] } } }
const id = '2026-11-05:USD:alta'
;(async () => {
  const b = await chromium.launch(require('./smoke-launch.cjs')()), base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5216'
  const out = process.env.SMOKE_OUT || path.join(process.cwd(), 'qa-output', 'alerta')
  await mkdir(out, { recursive: true })
  const capture = async (p, name) => {
    // Captura a partir do topo: o cabeçalho fixo não deve cobrir a faixa após cliques que rolam a página.
    await p.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }))
    await p.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await p.screenshot({ path: path.join(out, name), fullPage: true })
  }
  const start = async (width, permission = 'default', fail = false) => {
    const ctx = await b.newContext({ viewport: { width, height: 850 }, serviceWorkers: 'block' })
    await ctx.addInitScript(({ permission, fail }) => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
      localStorage.setItem('aprender-conceito-dia', '2026-11-05')
      if (!sessionStorage.getItem('qa-notification')) sessionStorage.setItem('qa-notification', JSON.stringify({ permission, fail, result: 'granted', requests: 0, attempts: 0, sent: [] }))
      const read = () => JSON.parse(sessionStorage.getItem('qa-notification'))
      const write = (value) => sessionStorage.setItem('qa-notification', JSON.stringify(value))
      class FakeNotification {
        static get permission() { return read().permission }
        static async requestPermission() { const s = read(); s.requests++; s.permission = s.result; write(s); return s.permission }
        constructor(title, options) {
          const s = read(); s.attempts++; write(s)
          if (s.fail) throw new Error('Falha sintética de envio')
          s.sent.push({ title, ...options }); write(s)
        }
      }
      Object.defineProperty(window, 'Notification', { value: FakeNotification, configurable: true })
      // Garante o caminho simulado mesmo se o navegador já tiver um service worker registrado.
      if (navigator.serviceWorker) navigator.serviceWorker.getRegistration = async () => undefined
      window.qaNotification = { read, patch: (change) => write({ ...read(), ...change }) }
    }, { permission, fail })
    await ctx.route('**/*', (r) => r.request().url().startsWith(base) ? r.continue() : r.abort())
    await ctx.route('**/recado.json*', (r) => r.fulfill({ json: { ativo: false } }))
    await ctx.route('**/quotes.json*', (r) => r.fulfill({ json: quotes }))
    await ctx.route('**/intraday.json*', (r) => r.fulfill({ json: intraday }))
    const p = await ctx.newPage(), errors = []
    p.on('pageerror', (e) => errors.push(e.message))
    await p.clock.setFixedTime(now)
    const enter = async (reload = false) => {
      if (reload) await p.reload(); else await p.goto(base + '/#resumo')
      await p.locator('dialog.aviso-inicial:not(.recado)').getByRole('button', { name: 'Entendi' }).click()
      // A entrada em dia útil às 15h abre o panorama. Fechar pela UI antes de testar a faixa.
      if (!reload) {
        const panorama = p.getByRole('dialog', { name: 'Panorama do dia', exact: true })
        await panorama.waitFor()
        assert.equal(await p.locator('dialog:modal').count(), 1, 'panorama não empilha com o aviso')
        await panorama.getByRole('button', { name: 'Fechar panorama' }).click()
        await panorama.waitFor({ state: 'hidden' })
      }
      await p.locator('.alerta-variacao').waitFor()
    }
    const ledger = () => p.evaluate(() => window.qaNotification.read())
    const saved = () => p.evaluate((id) => JSON.parse(localStorage.getItem('alerta-variacao') || '{}')[id], id)
    const checkBanner = async () => {
      const items = p.locator('.alerta-var-item'); await items.waitFor()
      assert.equal(await items.count(), 1, 'euro dentro do limite não deve disparar')
      assert.match(await items.innerText(), /Dólar em alta de 0,36% em relação ao fechamento anterior da fonte \(5,4800 → 5,5000/)
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'faixa sem rolagem lateral')
    }
    const finish = async () => { assert.deepEqual(errors, []); await ctx.close() }
    await enter()
    return { p, enter, ledger, saved, checkBanner, finish }
  }
  try {
    for (const width of [390, 1280]) {
      // Convite e faixa sobrevivem ao reload horas após a primeira amostra do dia.
      let s = await start(width)
      await s.checkBanner()
      assert.equal((await s.ledger()).attempts, 0)
      await capture(s.p, `alerta-${width}-permissao-pendente.png`)
      await s.enter(true); await s.checkBanner()
      assert.equal((await s.ledger()).attempts, 0)
      await s.p.getByRole('button', { name: 'Permitir notificações de câmbio' }).click()
      await s.p.waitForFunction(() => window.qaNotification.read().sent.length === 1)
      assert.ok((await s.saved()).sistemaEnviadoEm > 0, 'só persiste depois da aceitação pela API')
      assert.equal((await s.ledger()).requests, 1, 'pedido somente pelo clique')
      await s.enter(true); await s.checkBanner()
      assert.equal((await s.ledger()).attempts, 1, 'reload não duplica envio aceito')
      await s.p.getByRole('button', { name: 'Dispensar alerta do dólar' }).click()
      await s.p.locator('.alerta-var-item').waitFor({ state: 'detached' })
      // Depois da dispensa não resta faixa: a permissão já está concedida.
      await s.p.reload()
      await s.p.locator('dialog.aviso-inicial:not(.recado)').getByRole('button', { name: 'Entendi' }).click()
      await s.p.locator('.market-table').waitFor()
      // Espera as fixtures de cotação/intraday terminarem antes de verificar ausência.
      await s.p.waitForLoadState('networkidle')
      assert.equal(await s.p.locator('.alerta-var-item').count(), 0)
      assert.equal((await s.saved()).dispensado, true)
      assert.equal((await s.ledger()).attempts, 1)
      await s.finish()

      // Adiar/bloquear não marca entrega; voltar à aba com permissão concedida reprocessa.
      s = await start(width)
      await s.checkBanner()
      await s.p.evaluate(() => window.qaNotification.patch({ result: 'default' }))
      await s.p.getByRole('button', { name: 'Permitir notificações de câmbio' }).click()
      assert.equal((await s.ledger()).attempts, 0)
      assert.equal(await s.saved(), undefined)
      await s.p.evaluate(() => { window.qaNotification.patch({ permission: 'denied' }); window.dispatchEvent(new Event('focus')) })
      await s.p.getByText('Notificações bloqueadas.', { exact: true }).waitFor()
      await s.checkBanner()
      await capture(s.p, `alerta-${width}-bloqueado.png`)
      await s.p.evaluate(() => { window.qaNotification.patch({ permission: 'granted' }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')) })
      await s.p.waitForFunction(() => window.qaNotification.read().sent.length === 1)
      assert.equal((await s.ledger()).attempts, 1, 'eventos de retorno não duplicam notificação')
      await s.finish()

      // Falha permanece explícita, sem deduplicar uma entrega inexistente; retry é verificável.
      s = await start(width, 'granted', true)
      await s.checkBanner()
      const retry = s.p.getByRole('button', { name: 'Tentar enviar novamente' }); await retry.waitFor()
      assert.equal((await s.ledger()).attempts, 1)
      assert.equal(await s.saved(), undefined)
      await capture(s.p, `alerta-${width}-falha-envio.png`)
      await s.p.evaluate(() => window.qaNotification.patch({ fail: false }))
      await retry.click()
      await s.p.waitForFunction(() => window.qaNotification.read().sent.length === 1)
      await retry.waitFor({ state: 'detached' })
      assert.ok((await s.saved()).sistemaEnviadoEm > 0)
      assert.equal((await s.ledger()).attempts, 2)
      await s.enter(true); await s.checkBanner()
      assert.equal((await s.ledger()).attempts, 2)
      await capture(s.p, `alerta-${width}-envio-recuperado.png`)
      await s.finish()
      // A cotação envelhece sem nova leitura: permissão/retry não podem enviar o alerta vencido.
      for (const retryExpired of [false, true]) {
        s = await start(width, retryExpired ? 'granted' : 'default', retryExpired)
        await s.checkBanner()
        const action = s.p.getByRole('button', { name: retryExpired ? 'Tentar enviar novamente' : 'Permitir notificações de câmbio' })
        await action.waitFor()
        await s.p.clock.setFixedTime(now + 540001) // timestamp original now-60000: idade 10min + 1ms
        await s.p.evaluate(() => window.qaNotification.patch({ fail: false }))
        await action.click()
        await s.p.locator('.alerta-var-item').waitFor({ state: 'detached' })
        assert.equal((await s.ledger()).sent.length, 0, 'cotação vencida não é despachada')
        assert.equal((await s.ledger()).attempts, retryExpired ? 1 : 0, 'não inicia uma nova tentativa com dado vencido')
        assert.equal(await s.saved(), undefined, 'cotação vencida não consome a deduplicação')
        await s.finish()
      }
      console.log(`${width} PASS alerta após9h, fechamento-anterior, permissão tardia/externa, dispensa/reload, falha/retry, deduplicação e expiração no envio`)

    }
  } finally { await b.close() }
})().catch((e) => { console.error(e); process.exit(1) })
