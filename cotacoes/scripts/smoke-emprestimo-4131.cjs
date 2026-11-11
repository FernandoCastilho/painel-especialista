// Conferência de navegador da calculadora Empréstimo externo (4131) (#calculadora/emprestimo-4131).
// Pagamento único de 6 meses (IOF-câmbio de 3,5%), com swap e NDF. Números esperados recalculados aqui, sem o código
// do painel; dias úteis contados com os feriados nacionais listados à mão.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.EMPRESTIMO_4131_QA_OUTPUT || 'workspace-qa/emprestimo-4131'
const normalize = text => text.replace(/\s+/g, ' ').trim()
const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s+/g, ' ')
const pct = (v, d = 2) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`
const usd = v => `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Desembolso 11/11/2026, vencimento 11/05/2027: 181 dias corridos.
// Feriados nacionais em dia de semana no período: 20/11, 25/12, 01/01, Carnaval (08 e 09/02), Sexta-feira Santa (26/03) e 21/04.
const START = '2026-11-11', END = '2027-05-11', DC = 181
const HOLIDAYS = new Set(['2026-11-20', '2026-12-25', '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-26', '2027-04-21'])
let DU = 0
for (let t = Date.parse(`${START}T12:00:00Z`) + 864e5; t <= Date.parse(`${END}T12:00:00Z`); t += 864e5) {
  const d = new Date(t)
  if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !HOLIDAYS.has(d.toISOString().slice(0, 10))) DU++
}
const P = 1e6, RATE = 0.06, SPOT = 5, DI = 0.14, CUPOM = 0.05, IR = 0.15, IOF = 0.035
const JUROS = P * RATE * DC / 360
const IR_USD = JUROS * IR / (1 - IR)
const TOTAL_USD = P + JUROS + IR_USD
const NET_USD = P * (1 - IOF)
const ALL_IN = (TOTAL_USD / NET_USD) ** (365 / DC) - 1
const FORWARD = SPOT * (1 + DI) ** (DU / 252) / (1 + CUPOM * DC / 360)
const TOTAL_NDF = TOTAL_USD * FORWARD
const PRE = (TOTAL_NDF / (NET_USD * SPOT)) ** (252 / DU) - 1
const SPREAD = (1 + PRE) / (1 + DI) - 1
const RUN_SPREAD = (TOTAL_NDF / (P * SPOT)) ** (252 / DU) / (1 + DI) - 1
// Com flat de 1% e fiança de 1% a.a. pagos ao exterior: IR com gross-up sobre as comissões.
const FLAT = P * 0.01, FIANCA = P * 0.01 * DC / 360
const NET_FEES = P - FLAT - P * IOF - FLAT * IR / (1 - IR)
const IR_FEES = (JUROS + FIANCA) * IR / (1 - IR)

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const errors = []
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
      page.on('pageerror', e => errors.push(`${width}: ${e.message}`))
      await page.goto(`${base}/#calculadora/emprestimo-4131`)
      const section = page.locator('main.app section.bw.e4')
      await section.waitFor()
      const fill = (id, value) => section.locator(`#e4-${id}`).fill(value)
      const cell = (label, column) => section.locator('.fm-comparison .cx-matrix tbody tr').filter({ has: page.getByRole('rowheader', { name: label }) }).first().locator('td').nth(column)

      await fill('principal', '1.000.000,00')
      await fill('rate', '6,00')
      await fill('spot', '5,0000')
      await fill('start', START)
      await fill('months', '6')
      await section.locator('#e4-freq').selectOption('0')
      await fill('flat', '0,00')
      await fill('guarantee', '0,00')
      await fill('di', '14,00')
      await fill('cupom', '5,00')

      assert.equal(normalize(await section.locator('.fm-operation .fm-financed b').innerText()), brl(NET_USD * SPOT))
      assert.match(normalize(await section.locator('.fm-iof-premise').innerText()), new RegExp(`IOF-câmbio de 3,50% na entrada: prazo médio de ${DC} dias corridos`))
      const headline = normalize(await section.locator('.fm-headline').innerText())
      assert.ok(headline.includes(`CDI + ${pct(SPREAD)}`), headline)
      assert.ok(headline.includes(`Spread do swap: CDI + ${pct(RUN_SPREAD)}`), headline)
      assert.ok(headline.includes(`${pct(PRE)} a.a.`), headline)
      assert.ok(headline.includes(`Total ${brl(TOTAL_NDF)}`), headline)
      assert.equal(normalize(await cell('Custo em reais ao ano', 0).innerText()), pct(ALL_IN))
      assert.equal(normalize(await cell('Custo em reais ao ano', 2).innerText()), pct(PRE))
      assert.equal(normalize(await cell('Spread do swap', 1).innerText()), `CDI + ${pct(RUN_SPREAD)}`)
      assert.equal(normalize(await cell('Custo total em CDI', 1).innerText()), `CDI + ${pct(SPREAD)}`)
      assert.equal(normalize(await cell('Total a pagar em reais', 0).innerText()), brl(TOTAL_USD * SPOT))
      assert.equal(normalize(await cell('Total a pagar em reais', 2).innerText()), brl(TOTAL_NDF))
      assert.ok(RUN_SPREAD < SPREAD - 0.05, 'com IOF de 3,5% em 6 meses, o spread do swap fica bem abaixo do custo total')

      // Cronograma: uma linha de entrada e um pagamento, em dólar.
      await section.locator('.fm-fluxo-panel > summary').click()
      const flow = section.locator('.fm-tabela tbody tr')
      assert.equal(await flow.count(), 2)
      const paid = (await flow.nth(1).locator('td').allInnerTexts()).map(normalize)
      assert.deepEqual(paid.slice(0, 7), ['11/05/2027', String(DC), usd(JUROS), usd(IR_USD), usd(0), usd(P), usd(TOTAL_USD)])
      assert.equal(paid[8], brl(TOTAL_NDF))

      // Comissões pagas ao exterior: IR com gross-up sobre flat (na entrada) e fiança (no pagamento).
      await fill('flat', '1,00')
      await fill('guarantee', '1,00')
      await section.locator('#e4-fees').selectOption('sim')
      assert.equal(normalize(await section.locator('.fm-operation .fm-financed b').innerText()), brl(NET_FEES * SPOT))
      assert.equal(normalize(await flow.nth(1).locator('td').nth(3).innerText()), usd(IR_FEES))
      await section.locator('#e4-fees').selectOption('nao')
      assert.equal(normalize(await flow.nth(1).locator('td').nth(3).innerText()), usd(IR_USD))
      await page.screenshot({ path: path.join(out, `simulacao-${width}.png`), fullPage: true })

      // Desembolso em data futura: aviso sobre o câmbio. Data inexistente no calendário é recusada.
      await fill('start', '2099-01-05')
      assert.match(normalize(await section.locator('.e4-future').innerText()), /Desembolso em data futura/)
      await fill('start', START)

      // Apresentação e prévia do PDF abrem com os números congelados.
      await section.getByRole('button', { name: 'Apresentar simulação' }).click()
      await page.getByRole('button', { name: 'Iniciar apresentação' }).click()
      await page.locator('.bnp-slide h2').waitFor()
      await page.keyboard.press('Escape')
      await section.getByRole('button', { name: 'Imprimir PDF' }).click()
      assert.match(normalize(await page.locator('.bnprint-document').innerText()), /Simulação de empréstimo externo/)
      await page.getByRole('button', { name: 'Fechar prévia' }).click()

      // Aba de regras.
      await section.getByRole('button', { name: 'Regras e fontes', exact: true }).click()
      assert.ok(await section.locator('.e4-rules > div').count() >= 8)

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      assert.ok(overflow <= 1, `${width}: rolagem horizontal de ${overflow}px`)
      await page.close()
      console.log(`PASS emprestimo-4131 ${width} (du=${DU})`)
    }
    assert.deepEqual(errors, [], 'erros do navegador')
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exit(1) })
