// NTN-B na aba Juros: os dois gráficos na página (histórico de um vencimento e curva) e o detalhe com escolha do
// vencimento, curva e tabela de hoje, 1 mês e 1 ano. Notebook e celular. Dados fictícios de teste (planilha no
// formato do Tesouro, montada pelo mesmo código da coleta).
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.NTNB_QA_OUTPUT || 'ntnb-qa'

const HEAD = 'Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha'
const NTNB = 'Tesouro IPCA+ com Juros Semestrais'
const VENCS = ['2030-08-15', '2035-05-15', '2045-05-15', '2060-08-15']
const HOJE = [7.05, 7.19, 7.01, 6.99]
const dmy = (iso) => iso.split('-').reverse().join('/')

// Dois anos de dias úteis terminando ontem; a taxa oscila em torno de 7% e fecha nos valores de HOJE.
function planilha() {
  const datas = []
  for (let t = Date.now() - 864e5; datas.length < 520; t -= 864e5) if (![0, 6].includes(new Date(t).getUTCDay())) datas.unshift(new Date(t).toISOString().slice(0, 10))
  const rows = [HEAD]
  datas.forEach((d, i) => VENCS.forEach((v, k) => {
    const taxa = i === datas.length - 1 ? HOJE[k] : HOJE[k] + 0.6 * Math.sin((datas.length - i) / 60) + 0.05 * Math.sin(i * 1.7 + k)
    const s = taxa.toFixed(2).replace('.', ',')
    rows.push(`${NTNB};${dmy(v)};${dmy(d)};${s};${s};4000,00;3990,00;3990,00`)
  }))
  return rows.join('\r\n')
}

;(async () => {
  const { buildNtnbData, parseNtnbCsv } = await import('../src/ntnb.js')
  const ntnb = buildNtnbData(parseNtnbCsv(planilha()))
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  try {
    for (const [width, height] of [[1280, 800], [1366, 768], [390, 844]]) {
      const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce' })
      let arquivo = ntnb
      await ctx.route('**/ntnb.json*', (r) => (arquivo ? r.fulfill({ json: arquivo }) : r.fulfill({ status: 404, body: '' })))
      await ctx.route('**/recado.json*', (r) => r.fulfill({ json: { ativo: false } }))
      const p = await ctx.newPage(), errors = []
      p.on('pageerror', (e) => errors.push(e.message))
      await p.goto(base + '/#juros')
      const aviso = p.locator('dialog.aviso-inicial[open]:not(.recado)')
      if (await aviso.isVisible({ timeout: 3000 }).catch(() => false)) await aviso.getByRole('button', { name: 'Entendi' }).click()

      // Página: histórico da NTN-B 2035 e curva, dentro do Brasil, com atalho no topo.
      const hist = p.locator('#juros-ntnb'), curva = p.locator('#juros-ntnb-curva')
      await hist.locator('.plot svg').first().waitFor()
      assert.equal(await p.locator('section[aria-labelledby="juros-brasil"] #juros-ntnb').count(), 1, 'NTN-B na seção Brasil')
      assert.match(await hist.innerText(), /Brasil · NTN-B 2035[\s\S]*juro real \(acima do IPCA\)/)
      await curva.locator('.plot svg').first().waitFor()
      assert.match(await curva.innerText(), /Brasil · Curva da NTN-B/)
      assert.equal(await p.locator('main table').count(), 0, 'nenhuma tabela na página')
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'sem rolagem lateral')
      await p.locator('.juros-nav').getByRole('button', { name: 'NTN-B', exact: true }).click()
      await p.waitForTimeout(300)
      await hist.screenshot({ path: `${out}/${width}-historico.png` })
      await curva.scrollIntoViewIfNeeded()
      await curva.screenshot({ path: `${out}/${width}-curva.png` })

      // Detalhe: troca o vencimento, curva e tabela com hoje, 1 mês e 1 ano.
      await p.getByRole('button', { name: 'Ampliar gráfico: NTN-B (juro real)', exact: true }).click()
      const dlg = p.getByRole('dialog', { name: 'detalhes: NTN-B (juro real)' })
      await dlg.locator('.plot svg').first().waitFor()
      const vencs = dlg.getByRole('group', { name: 'Vencimento da NTN-B' })
      assert.deepEqual(await vencs.getByRole('button').allInnerTexts(), ['2030', '2035', '2045', '2060'])
      assert.equal(await vencs.getByRole('button', { name: '2035' }).getAttribute('aria-pressed'), 'true')
      await vencs.getByRole('button', { name: '2060' }).click()
      await dlg.getByRole('heading', { name: 'Brasil · NTN-B 2060' }).waitFor()
      const tab = dlg.locator('.curve-table')
      assert.equal(await tab.locator('tbody tr').count(), 4)
      const cab = (await tab.locator('thead th').allInnerTexts()).map((t) => t.trim())
      assert.equal(cab.length, 5); ['Vencimento', 'Hoje', '1 mês', '1 ano', 'Variação'].forEach((c, i) => assert.ok(cab[i].startsWith(c), `coluna ${c}: ${cab[i]}`))
      assert.match(await tab.locator('tbody tr', { hasText: 'NTN-B 2035' }).innerText(), /7,19% a\.a\.[\s\S]*p\.p\./)
      assert.match(await tab.locator('tbody tr', { hasText: 'NTN-B 2060' }).innerText(), /6,99% a\.a\./)
      assert.equal(await tab.locator('tbody button:not([disabled])').count(), 0, 'linhas da tabela do detalhe não são clicáveis')
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'sem rolagem lateral no detalhe')
      await dlg.locator('.expandable-body').screenshot({ path: `${out}/${width}-detalhe.png` })
      await tab.scrollIntoViewIfNeeded()
      await p.screenshot({ path: `${out}/${width}-detalhe-tabela.png` })
      await dlg.getByRole('button', { name: 'Fechar detalhes' }).click()
      await dlg.waitFor({ state: 'hidden' })

      // Arquivo velho: aviso de atualização pendente. Sem arquivo: aviso de indisponível, sem quebrar a página.
      arquivo = { ...ntnb, stale: true }
      await p.reload()
      await hist.getByRole('status').filter({ hasText: 'Atualização da NTN-B pendente' }).waitFor()
      arquivo = null
      await p.reload()
      await hist.getByText('NTN-B indisponível no momento.').waitFor()
      assert.deepEqual(errors, [])
      console.log(`${width}px: NTN-B na aba Juros, detalhe com vencimentos, curva e tabela; aviso de atraso e de indisponível`)
      await ctx.close()
    }
  } finally { await browser.close() }
})().catch((e) => { console.error(e); process.exit(1) })
