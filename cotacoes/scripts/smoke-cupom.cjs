// Leitura do cupom cambial na aba Juros: resumo, variação por vértice e cupom no tempo (curvas sintéticas).
const { chromium } = require('playwright'), assert = require('node:assert/strict')
const dates = ['2026-10-26', '2026-10-23', '2026-10-19', '2026-09-25', '2026-07-27', '2026-04-27', '2025-10-24']
const labels = ['Último dia', '1 dia', '1 semana', '1 mês', '3 meses', '6 meses', '1 ano']
const compare = dates.map((date, i) => ({ id: 'c' + i, label: labels[i], days: i, date }))
const mk = (base, slope) => Object.fromEntries(dates.map((d, i) => [d, [63, 126, 252, 504, 1260].map((du) => [du, +(base - i * 0.05 + (du / 252) * slope).toFixed(4)])]))
const set = (base, slope) => ({ compare, curves: mk(base, slope), checkedAt: Date.now(), sourceDate: dates[0], warnings: [] })
const usCurves = Object.fromEntries(dates.map((d) => [d, [[0.25, 4.08, '3 Mo'], [0.5, 4.07, '6 Mo'], [1, 4.04, '1 Yr'], [2, 3.96, '2 Yr'], [5, 4.03, '5 Yr']]]))
const curves = { generatedAt: Date.now(), br: set(14.3, -0.2), cc: set(5.2, -0.1), us: { compare, curves: usCurves }, errors: [], stale: {} }
;(async () => {
  const b = await chromium.launch(require('./smoke-launch.cjs')()), base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5216'
  try {
    for (const width of [390, 1280]) {
      const p = await b.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' }), errors = []
      p.on('pageerror', (e) => errors.push(e.message))
      await p.route('**/curves.json*', (r) => r.fulfill({ json: curves }))
      await p.goto(base + '/#juros')
      const s = p.locator('.cupom-leitura'); await s.waitFor(); await s.scrollIntoViewIfNeeded()
      const txt = await s.innerText()
      // leitura logo abaixo da curva do cupom (antes das Treasuries e da curva do euro), na largura toda
      const box = async (t) => (await p.locator('section.macro article.chart', { hasText: t }).first().boundingBox())
      const lb = await s.boundingBox(), cc = await box('Brasil · Cupom cambial'), us = await box('EUA · Treasuries')
      assert.ok(lb.y > cc.y && lb.y < us.y, 'leitura entre a curva do cupom e a dos EUA')
      if (width >= 700) assert.ok(lb.width > cc.width * 1.5, 'leitura ocupa a linha inteira')
      // Cada região tem um período rotulado; nenhuma mistura os históricos.
      for (const [region, label] of [['brasil', /Período do histórico do CDI/], ['exterior', /Período dos históricos de SOFR e €STR/]]) {
        const group = p.locator(`section[aria-labelledby="juros-${region}"]`)
        assert.match(await group.locator('.juros-period-label').innerText(), label)
        const h = await group.getByRole('heading', { name: 'Histórico das taxas de juros' }).boundingBox()
        const per = await group.locator('.juros-period').boundingBox()
        assert.ok(per.y > h.y, 'período abaixo do título da região')
      }
      // explicação da seleção de períodos em cada curva (DI x pré, cupom cambial, Treasuries)
      const titulos = p.locator('.curve-legend-title'); await titulos.first().waitFor()
      assert.equal(await titulos.count(), 3, 'uma explicação por curva')
      await p.getByRole('button', { name: 'O que é: Curvas de comparação: Treasuries' }).click()
      const tip = p.locator('[role=tooltip]').filter({ hasText: 'Curvas de comparação: Treasuries' }).first(); await tip.waitFor()
      const tt = await tip.innerText(); assert.match(tt, /Último dia[\s\S]*1 semana[\s\S]*1 ano/); assert.match(tt, /fim de semana ou feriado/); assert.match(tt, /Inversão/)
      await p.keyboard.press('Escape'); if (width < 700) await p.locator('.pop-close:visible').first().click().catch(() => {})
      assert.match(txt, /Cupom cambial de 1 ano em \d,\d{2}% a\.a\. \(26\/10\)/)
      assert.match(txt, /desvalorização do real de cerca de \d+,\d{2}% a\.a\./)
      assert.match(txt, /p\.p\. (acima|abaixo) do Treasury de 1 ano/)
      assert.doesNotMatch(txt, /[−+]0 bps|NaN|undefined/)
      const t = s.locator('.cl-table'); assert.equal(await t.locator('tbody tr').count(), 4)
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await s.getByRole('button', { name: 'Variação por vértice' }).click()
      assert.ok(await s.locator('.cl-bar').count() >= 3)
      await s.getByLabel('Data de comparação do cupom').selectOption({ index: 2 })
      assert.match(await s.innerText(), /Movimento:/)
      await s.getByRole('button', { name: 'Cupom no tempo' }).click()
      await s.getByRole('button', { name: '2 anos' }).click()
      await s.locator('svg').first().waitFor()
      assert.match(await s.innerText(), /não é série diária/)
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      assert.deepEqual(errors, [])
    }
    console.log('PASS cupom cambial: resumo, variação por vértice e cupom no tempo (390 e 1280)')
  } finally { await b.close() }
})().catch((e) => { console.error(e); process.exit(1) })
