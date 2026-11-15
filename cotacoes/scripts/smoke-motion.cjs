// Movimento: barras em cascata, gaveta em cortina e troca de tela suave; com "reduzir movimento", nada anima.
const { chromium } = require('playwright'), assert = require('node:assert/strict')
const dates = ['2026-10-26', '2026-10-23', '2026-10-19', '2026-09-25', '2026-07-27', '2026-04-27', '2025-10-24']
const labels = ['Último dia', '1 dia', '1 semana', '1 mês', '3 meses', '6 meses', '1 ano']
const compare = dates.map((date, i) => ({ id: 'c' + i, label: labels[i], days: i, date }))
const mk = (base, slope) => Object.fromEntries(dates.map((d, i) => [d, [63, 126, 252, 504, 1260].map((du) => [du, +(base - i * 0.05 + (du / 252) * slope).toFixed(4)])]))
const set = (base, slope) => ({ compare, curves: mk(base, slope), checkedAt: Date.now(), sourceDate: dates[0], warnings: [] })
const usCurves = Object.fromEntries(dates.map((d) => [d, [[0.25, 4.08, '3 Mo'], [0.5, 4.07, '6 Mo'], [1, 4.04, '1 Yr'], [2, 3.96, '2 Yr'], [5, 4.03, '5 Yr']]]))
const curves = { generatedAt: Date.now(), br: set(14.3, -0.2), cc: set(5.2, -0.1), us: { compare, curves: usCurves }, errors: [], stale: {} }
const out = process.env.SMOKE_OUT || '/tmp'
;(async () => {
  const b = await chromium.launch(require('./smoke-launch.cjs')()), base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5216'
  // animações em curso num elemento (nome, duração e atraso), lidas do próprio navegador
  const anims = (loc) => loc.evaluate((el) => el.getAnimations().map((a) => ({ name: a.animationName || 'js', dur: a.effect.getTiming().duration, delay: a.effect.getTiming().delay, iter: a.effect.getTiming().iterations })))
  try {
    for (const width of [390, 1280]) {
      for (const reducedMotion of ['no-preference', 'reduce']) {
        const ctx = await b.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', reducedMotion })
        const p = await ctx.newPage(), errors = [], calm = reducedMotion === 'reduce'
        p.on('pageerror', (e) => errors.push(e.message))
        await p.route('**/curves.json*', (r) => r.fulfill({ json: curves }))
        await p.goto(base + '/#juros')
        // 1) barras da variação do cupom: crescem do zero em cascata curta, cada uma < 1 s, sem loop
        await p.locator('.curve-table', { hasText: 'Brasil · Cupom cambial' }).getByRole('button', { name: /1 ano: abrir gráfico da curva/ }).click() // a leitura do cupom fica na tela da curva
        const s = p.locator('.cupom-leitura'); await s.waitFor(); await s.scrollIntoViewIfNeeded()
        await s.getByRole('button', { name: 'Variação por vértice' }).click()
        const bars = s.locator('.cl-bar-track i'); await bars.first().waitFor()
        const n = await bars.count(); assert.ok(n >= 3)
        const all = []; for (let i = 0; i < n; i++) all.push((await anims(bars.nth(i))).find((a) => a.name === 'bar-grow-x'))
        if (calm) assert.ok(all.every((a) => !a), 'reduzir movimento: barras sem animação')
        else {
          assert.ok(all.every((a) => a && a.iter === 1 && a.dur + a.delay < 1000), `cascata abaixo de 1 s: ${JSON.stringify(all)}`)
          assert.ok(all.every((a, i) => i === 0 || a.delay > all[i - 1].delay), 'uma depois da outra')
        }
        // valores já no final, sem contagem
        assert.match(await s.locator('.cl-bar-val').first().innerText(), /bps$/)
        // balão do "?": surge curto (< 0,2 s); com reduzir movimento, aparece direto
        await p.getByRole('button', { name: /^O que é: Curvas de comparação/ }).click()
        const tip = p.locator('[role=tooltip]').filter({ hasText: 'Curvas de comparação' }).first(); await tip.waitFor()
        const ta = (await anims(tip)).find((a) => a.name === 'pop-in')
        if (calm) assert.ok(!ta, 'reduzir movimento: balão sem animação')
        else assert.ok(ta && ta.dur <= 200 && ta.iter === 1, `balão < 0,2 s: ${JSON.stringify(ta)}`)
        await p.keyboard.press('Escape'); if (width < 700) await p.locator('.pop-close:visible').first().click().catch(() => {})
        await p.getByRole('button', { name: 'Fechar detalhes' }).click(); await p.locator('dialog.is-modal').waitFor({ state: 'detached' })
        if (width < 700) {
          // celular: balão da tabela de juros fica na frente das colunas fixas das linhas de baixo (nada o cobre)
          const ajudas = p.locator('.executive-rates__name .help > button'); await ajudas.first().waitFor()
          await ajudas.nth(2).scrollIntoViewIfNeeded(); await ajudas.nth(2).click()
          const pop = p.locator('.pop').first(); await pop.waitFor(); await p.waitForTimeout(250)
          const bb = await pop.boundingBox()
          const tapado = await p.evaluate(({ x, y, w, h }) => {
            const el = document.querySelector('.pop'), pts = [[.25, .3], [.5, .5], [.2, .7], [.75, .6], [.5, .85]]
            return pts.filter(([a, b]) => !el.contains(document.elementFromPoint(x + w * a, y + h * b))).length
          }, { x: bb.x, y: bb.y, w: bb.width, h: bb.height })
          assert.equal(tapado, 0, 'nada cobre o balão no celular')
          await p.screenshot({ path: `${out}/motion-390-balao-juros.png` })
          await pop.getByRole('button', { name: 'Fechar' }).click(); await pop.waitFor({ state: 'hidden' })
        }
        await p.waitForTimeout(1000)
        // 2) detalhe do indicador: gaveta em cortina (lateral no computador, tela toda no celular)
        await p.goto(base + '/#cenarios/commodities')
        const tr0 = Date.now()
        await p.getByRole('button', { name: 'Petróleo Brent: abrir gráfico e histórico' }).click()
        const d = p.getByRole('dialog', { name: /histórico de Petróleo Brent/i }); await d.waitFor()
        const da = (await anims(d)).find((a) => a.name === 'curtain-in')
        if (calm) assert.ok(!da, 'reduzir movimento: gaveta sem cortina')
        else { assert.ok(da && da.dur < 1000 && da.iter === 1, 'cortina < 1 s'); await p.waitForTimeout(150); await p.screenshot({ path: `${out}/motion-${width}-cortina.png` }) }
        await p.waitForTimeout(600)
        const box = await d.boundingBox(), dw = width >= 900 ? Math.min(860, width) : width
        assert.ok(Math.abs(box.width - dw) <= 1 && Math.abs(box.x + box.width - width) <= 1, `gaveta à direita (${JSON.stringify(box)})`)
        if (!calm) await p.screenshot({ path: `${out}/motion-${width}-gaveta.png` })
        const trigger = p.getByRole('button', { name: 'Petróleo Brent: abrir gráfico e histórico' })
        await p.keyboard.press('Escape'); await d.waitFor({ state: 'hidden', timeout: 1000 })
        assert.equal(await trigger.evaluate((e) => e === document.activeElement), true, 'foco volta ao indicador')
        assert.ok(Date.now() - tr0 < 5000)
        // 3) troca de tela: esmaecimento curto (< 0,5 s), nunca em loop
        await p.getByRole('button', { name: 'Inflação', exact: true }).click()
        const fa = (await anims(p.locator('main.app'))).find((a) => a.name === 'js')
        if (calm) assert.ok(!fa, 'reduzir movimento: troca sem esmaecimento')
        else assert.ok(fa && fa.dur < 500 && fa.iter === 1, `troca < 0,5 s: ${JSON.stringify(fa)}`)
        await p.waitForTimeout(400)
        assert.equal((await anims(p.locator('main.app'))).length, 0, 'nada fica animando depois da troca')
        assert.deepEqual(errors, [])
        await ctx.close()
      }
      console.log(width, 'PASS movimento: cascata, gaveta, troca de tela e reduzir movimento')
    }
  } finally { await b.close() }
})().catch((e) => { console.error(e); process.exit(1) })
