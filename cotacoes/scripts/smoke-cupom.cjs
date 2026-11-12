// Aba Juros: tabelas das curvas e do CDI futuro; a linha abre o gráfico em tela própria.
// Leitura do cupom cambial (na tela da curva do cupom): resumo, variação por vértice e cupom no tempo (curvas sintéticas).
const { chromium } = require('playwright'), assert = require('node:assert/strict')
const dates = ['2026-10-26', '2026-10-23', '2026-10-19', '2026-09-25', '2026-07-27', '2026-04-27', '2025-10-24']
const labels = ['Último dia', '1 dia', '1 semana', '1 mês', '3 meses', '6 meses', '1 ano']
const compare = dates.map((date, i) => ({ id: i ? 'c' + i : 'hoje', label: labels[i], days: i, date })) // a coleta marca a data mais recente como 'hoje'
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
      // a página traz só tabelas: referência, CDI futuro e uma por curva (DI x pré, cupom, Treasuries); nenhum gráfico solto
      await p.locator('.curve-table').first().waitFor()
      assert.equal(await p.locator('main .plot svg[role=img]').count(), 0, 'sem gráfico na página')
      assert.equal(await p.locator('.juros-period').count(), 0)
      const tabela = (t) => p.locator('.curve-table', { hasText: t })
      for (const t of ['Brasil · DI x pré', 'Brasil · Cupom cambial', 'EUA · Treasuries']) assert.ok(await tabela(t).locator('tbody tr').count() >= 4, `${t}: prazos na tabela`)
      // números da curva na tabela: 1 ano do DI na última data = 14,3 − 0,2 (curva sintética), e uma coluna por data de comparação
      assert.match(await tabela('Brasil · DI x pré').locator('tbody tr', { hasText: '1 ano' }).innerText(), /14,10%[\s\S]*14,05%/)
      assert.equal(await tabela('Brasil · DI x pré').locator('thead th').count(), 1 + dates.length)
      assert.match(await tabela('EUA · Treasuries').locator('tbody tr').first().innerText(), /3 meses[\s\S]*4,08%/)
      // CDI futuro: números por horizonte na página; a linha abre o gráfico com a escolha de datas
      const cdif = p.locator('.cdif-table'); assert.match(await cdif.locator('tbody tr', { hasText: '1 ano' }).innerText(), /14,10%/)
      await cdif.getByRole('button', { name: 'CDI futuro, 1 ano: abrir gráfico' }).click()
      const dlgCdif = p.getByRole('dialog', { name: 'detalhes: CDI futuro' }); await dlgCdif.locator('.plot svg').first().waitFor()
      assert.match(await dlgCdif.innerText(), /CDI a termo de/)
      await dlgCdif.getByRole('button', { name: 'Fechar detalhes' }).click(); await dlgCdif.waitFor({ state: 'hidden' })
      // Treasuries: a linha abre a curva em tela própria, com a explicação da seleção de períodos
      await tabela('EUA · Treasuries').locator('tbody tr').first().click()
      const dlgUs = p.getByRole('dialog', { name: 'detalhes: EUA · Treasuries' }); await dlgUs.locator('.plot svg[role=img]').waitFor()
      assert.equal(await dlgUs.locator('.curve-legend-title').count(), 1, 'explicação dos períodos na curva')
      await dlgUs.getByRole('button', { name: 'O que é: Curvas de comparação: Treasuries' }).click()
      const tip = p.locator('[role=tooltip]').filter({ hasText: 'Curvas de comparação: Treasuries' }).first(); await tip.waitFor()
      const tt = await tip.innerText(); assert.match(tt, /Último dia[\s\S]*1 semana[\s\S]*1 ano/); assert.match(tt, /fim de semana ou feriado/); assert.match(tt, /Inversão/)
      await p.keyboard.press('Escape'); if (width < 700) await p.locator('.pop-close:visible').first().click().catch(() => {})
      await dlgUs.getByRole('button', { name: 'Fechar detalhes' }).click(); await dlgUs.waitFor({ state: 'hidden' })
      // cupom cambial: a tela da curva traz o gráfico e, logo abaixo, a leitura de cenário
      await tabela('Brasil · Cupom cambial').getByRole('button', { name: /1 ano: abrir gráfico da curva/ }).click()
      const dlg = p.getByRole('dialog', { name: 'detalhes: Brasil · Cupom cambial' })
      const s = dlg.locator('.cupom-leitura'); await s.waitFor(); await s.scrollIntoViewIfNeeded()
      const txt = await s.innerText()
      const lb = await s.boundingBox(), cc = await dlg.locator('article.chart.curve').boundingBox()
      assert.ok(lb.y > cc.y, 'leitura abaixo da curva do cupom')
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
    console.log('PASS juros: tabelas das curvas e do CDI futuro abrem o gráfico em tela própria; cupom cambial com resumo, variação por vértice e cupom no tempo (390 e 1280)')
  } finally { await b.close() }
})().catch((e) => { console.error(e); process.exit(1) })
