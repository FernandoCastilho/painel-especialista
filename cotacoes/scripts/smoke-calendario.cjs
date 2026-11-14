// Calendário econômico (Cenários › Calendário econômico): filtros de período, impacto e país; dia agrupado; horário de Brasília.
const { chromium } = require('playwright'), assert = require('node:assert/strict')
;(async () => {
  const b = await chromium.launch(require('./smoke-launch.cjs')()), base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5216'
  try {
    for (const width of [390, 1280]) {
      const now = Date.now(), h = 3600e3
      const ev = (src, country, dt, title, impact, forecast = null, previous = null) => ({ src, country, currency: 'X', t: now + dt, title, impact, forecast, previous, actual: null })
      const file = { schemaVersion: 1, generatedAt: now, sources: { ff: { ok: true, n: 4 }, bls: { ok: true, n: 1 }, bea: { ok: true, n: 0 }, fomc: { ok: true, n: 0 } }, stale: {}, events: [
        ev('ff', 'EU', 2 * h, 'CPI Flash Estimate y/y', 'high', '2.1%', '2.0%'), ev('ff', 'JP', 3 * h, 'Tokyo Core CPI', 'medium', '1.8%', '1.7%'),
        ev('ff', 'GB', 4 * h, 'Retail Sales', 'low', '0.2%', '0.1%'), ev('bls', 'US', 5 * h, 'CPI: inflação ao consumidor (EUA)', 'high'), ev('ff', 'AU', 6 * h, 'Trade Balance', 'high', '4.0B', '3.9B'), ev('ff', 'NZ', 7 * h, 'Xyz Gadget Index', 'high') ] }
      const p = await b.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' }), errors = []
      p.on('pageerror', (e) => errors.push(e.message))
      await p.route('**/calendar.json*', (r) => r.fulfill({ json: file }))
      await p.goto(base + '/#cenarios/calendario')
      const sec = p.locator('.calendario'); await sec.waitFor()
      const table = sec.locator('.cal-table')
      const f = sec.getByRole('group', { name: 'Período do calendário' })
      // Near midnight every future fixture can be tomorrow. Select the intended
      // range before waiting for its table; the default Today may correctly be empty.
      await f.getByRole('button', { name: '7 dias' }).click()
      await table.waitFor()
      let txt = await table.innerText()
      // eventos em inglês aparecem em português, com a sigla original; o que não está no dicionário fica como veio
      assert.match(txt, /Inflação ao consumidor, prévia, variação anual \(CPI\)/); assert.match(txt, /Núcleo da inflação ao consumidor de Tóquio \(Core CPI\)/); assert.match(txt, /CPI: inflação ao consumidor/); assert.match(txt, /Xyz Gadget Index/)
      assert.doesNotMatch(txt, /CPI Flash Estimate|Tokyo Core CPI/)
      assert.doesNotMatch(txt, /Vendas no varejo/, 'impacto baixo oculto por padrão')
      assert.match(txt, /2,1%/); assert.match(txt, /4,0 bi/); assert.doesNotMatch(txt, /2\.1%|4\.0B/); assert.match(await table.locator('thead').innerText(), /Previsto[\s\S]*Anterior/)
      assert.ok(await table.locator('.cal-day').count() >= 1)
      // balão do evento: o que é, efeito na economia e ligação com o Brasil; sem categoria mapeada, impacto baixo
      await table.getByRole('button', { name: 'Impacto de Inflação ao consumidor, prévia, variação anual (CPI)' }).click()
      const balao = (titulo) => p.locator('.pop:visible').filter({ hasText: titulo })
      const fechar = async (titulo) => { if (width < 700) await balao(titulo).getByRole('button', { name: 'Fechar' }).click(); else { await p.keyboard.press('Escape'); await p.mouse.move(0, 0); await p.evaluate(() => document.activeElement?.blur()) } await balao(titulo).waitFor({ state: 'hidden' }) }
      let pop = await balao('Inflação ao consumidor, prévia, variação anual (CPI)').innerText()
      assert.match(pop, /Nome na fonte:\s*CPI Flash Estimate y\/y/)
      assert.match(pop, /Na economia:/); assert.match(pop, /Brasil:[\s\S]*Zona do euro/); assert.match(pop, /Impacto:\s*Alto/)
      await fechar('Inflação ao consumidor, prévia, variação anual (CPI)')
      await table.getByRole('button', { name: 'Impacto de Xyz Gadget Index' }).click()
      pop = await balao('Xyz Gadget Index').innerText()
      assert.match(pop, /Impacto baixo/); assert.match(pop, /correlação direta relevante mapeada com o Brasil/); assert.match(pop, /classifica como alto/)
      await fechar('Xyz Gadget Index')
      assert.match(await table.locator('.cal-time').first().innerText(), /^\d{2}:\d{2}$/)
      // impacto baixo entra ao ligar; país restringe
      await sec.getByRole('group', { name: 'Impacto dos eventos' }).getByRole('button', { name: 'Baixo' }).click()
      assert.match(await table.innerText(), /Vendas no varejo/)
      await sec.getByLabel('País do evento').selectOption('EU')
      txt = await table.innerText(); assert.match(txt, /Inflação ao consumidor, prévia/); assert.doesNotMatch(txt, /Tóquio|Vendas no varejo/)
      // o último filtro de impacto não pode ser desligado
      for (const n of ['Alto', 'Médio', 'Baixo']) await sec.getByRole('group', { name: 'Impacto dos eventos' }).getByRole('button', { name: n }).click()
      assert.equal(await sec.getByRole('group', { name: 'Impacto dos eventos' }).locator('[aria-pressed="true"]').count() >= 1, true)
      assert.match(await sec.innerText(), /Horário de Brasília/)
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      assert.deepEqual(errors, [])
    }
    console.log('PASS calendário econômico: filtros, agrupamento por dia e horário de Brasília (390 e 1280)')
  } finally { await b.close() }
})().catch((e) => { console.error(e); process.exit(1) })
