// Conferência de navegador da calculadora Empréstimo externo (4131) (#calculadora/emprestimo-4131).
// Pagamento único de 6 meses (IOF-câmbio de 3,5%), com swap e NDF, e três parcelas mensais no formato da cotação
// (custo efetivo exp/360, economia de IOF e equivalente em giro). Números esperados recalculados aqui, sem o código
// do painel; dias úteis contados com os feriados nacionais listados à mão. Cotações e curva DI do Painel são simuladas.
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
const busDays = (from, to) => {
  let n = 0
  for (let t = Date.parse(`${from}T12:00:00Z`) + 864e5; t <= Date.parse(`${to}T12:00:00Z`); t += 864e5) {
    const d = new Date(t)
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !HOLIDAYS.has(d.toISOString().slice(0, 10))) n++
  }
  return n
}
const DU = busDays(START, END)
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

// Três parcelas mensais iguais, em dia fixo: 11/12/2026, 11/01/2027 e 11/02/2027 (30, 61 e 92 dias corridos).
// Prazo médio de 61 dias: IOF-câmbio de 3,5%. Juros sobre o saldo; IR do tomador com a base reajustada.
const PARCELAS = [['2026-12-11', 30, 30], ['2027-01-11', 61, 31], ['2027-02-11', 92, 31]].map(([date, dc, days], i) => {
  const saldo = P - i * P / 3
  const juros = saldo * RATE * days / 360
  const usdTotal = P / 3 + juros / (1 - IR)
  return { date, dc, saldo, juros, usdTotal, brl: usdTotal * SPOT * (1 + DI) ** (busDays(START, date) / 252) / (1 + CUPOM * dc / 360) }
})
// Taxa que zera o fluxo por dias corridos/365, por bisseção.
const tir = (entrada) => {
  let lo = -0.9, hi = 10
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (PARCELAS.reduce((s, f) => s + f.brl / (1 + mid) ** (f.dc / 365), 0) > entrada) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
const NET_PARCELAS = NET_USD * SPOT
// Pagamento único: taxa interna por dias corridos/365, lida ao mês e ao ano no formato da cotação.
const Y_UNICO = (TOTAL_NDF / (NET_USD * SPOT)) ** (365 / DC) - 1
const IOF_GIRO = P * SPOT * 0.0038 + PARCELAS.reduce((s, f) => s + P / 3 * SPOT * 0.000082 * f.dc, 0)
const CET = tir(NET_PARCELAS), GIRO = tir(NET_PARCELAS + IOF_GIRO)
// Taxas futuras fictícias, como se viessem da cotação da mesa, e o custo com elas (bisseção própria).
const COLADAS = [5.03, 5.07, 5.11]
const CET_MESA = (() => {
  let lo = -0.9, hi = 10
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (PARCELAS.reduce((s, f, k) => s + f.usdTotal * COLADAS[k] / (1 + mid) ** (f.dc / 365), 0) > NET_PARCELAS) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
})()
const mes = y => (1 + y) ** (30 / 365) - 1, ano = y => (1 + y) ** (360 / 365) - 1
// Cotações e curva DI simuladas: dólar 5,3127, euro 6,1844 e DI plano de 14% a.a.
const NOW_S = Math.floor(Date.now() / 1000) - 120
const quote = bid => ({ bid: String(bid), ask: String(bid + 0.001), high: String(bid + 0.02), low: String(bid - 0.02), pctChange: '0.1', varBid: '0.005', timestamp: String(NOW_S) })
const QUOTES = { generatedAt: Date.now() - 60000, quotes: { USDBRL: quote(5.3127), EURBRL: quote(6.1844), JPYBRL: quote(0.035), USDCNH: quote(7.1) } }
const CURVES = { generatedAt: Date.now() - 60000, br: { compare: [{ id: 'hoje', date: '2026-01-02' }], curves: { '2026-01-02': [[21, 14], [252, 14], [2520, 14], [7560, 14]] } }, cc: { compare: [], curves: {} }, us: { compare: [], curves: {} } }

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const errors = []
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] })
      page.on('pageerror', e => errors.push(`${width}: ${e.message}`))
      await page.route('**/quotes.json*', route => route.fulfill({ json: QUOTES }))
      await page.route('**/curves.json*', route => route.fulfill({ json: CURVES }))
      await page.goto(`${base}/#calculadora/emprestimo-4131`)
      const section = page.locator('main.app section.bw.e4')
      await section.waitFor()
      const fill = (id, value) => section.locator(`#e4-${id}`).fill(value)
      const cell = (label, column) => section.locator('.fm-comparison .cx-matrix tbody tr').filter({ has: page.getByRole('rowheader', { name: label }) }).first().locator('td').nth(column)
      const flow = section.locator('.fm-tabela tbody tr')
      // textContent: no celular a tabela esconde quatro colunas, mas os números continuam na página.
      const linha = async (i) => [normalize(await flow.nth(i).locator('th').textContent()), ...(await flow.nth(i).locator('td').allTextContents()).map(normalize)]

      // Tela inicial no formato da cotação: poucos campos, 36 parcelas mensais a cada 30 dias, e o câmbio e o DI do
      // Painel já preenchidos, com a origem ao lado.
      await page.waitForFunction(() => document.querySelector('#e4-spot')?.value === '5,3127')
      assert.match(normalize(await section.locator('#e4-spot-origem').innerText()), /^Painel · \d{2}\/\d{2} \d{2}:\d{2}$/)
      await page.waitForFunction(() => document.querySelector('#e4-di')?.value === '14,00')
      assert.match(normalize(await section.locator('#e4-protecao-origem').innerText()), /DI: do Painel, curva DI da B3 de 02\/01\/2026.*Cupom cambial: valor de exemplo/)
      assert.equal(normalize(await section.locator('label[for="e4-months"]').innerText()), 'Parcelas mensais')
      assert.equal(await section.locator('.fm-operation:not(.e4-opcoes) .cx-field').count(), 6, 'seis campos na operação')
      assert.equal(await section.locator('.e4-mais').evaluate(el => el.open), false, 'Mais opções começa fechado')
      assert.equal(await flow.count(), 37, 'desembolso e 36 parcelas')
      // No celular a tabela mostra o essencial; no notebook, todas as colunas.
      assert.equal(await section.locator('.fm-tabela thead th:visible').count(), width < 641 ? 4 : 8)
      assert.equal(normalize(await section.locator('.fm-operation .fm-financed b').innerText()), usd(1e7 / 5.3127))
      const pills = normalize(await section.locator('.fm-pills').innerText())
      assert.ok(pills.includes('Principal em parcelas iguais') && pills.includes('Datas a cada 30 dias, em dia útil') && !pills.includes('Pagamentos'), pills)

      // Atingir meta: custo efetivo de 1,30% ao mês. A tela calcula a taxa all-in e recalcula o resto.
      const taxaAntes = await section.locator('#e4-rate').inputValue()
      await fill('meta', '1,30')
      await section.getByRole('button', { name: 'Calcular taxa' }).click()
      await page.waitForFunction(antes => document.querySelector('#e4-rate')?.value !== antes, taxaAntes)
      assert.match(await section.locator('#e4-rate').inputValue(), /^\d{1,2},\d{4}$/)
      assert.ok(normalize(await section.locator('.fm-headline').innerText()).includes('1,30% a.m.'), 'a meta aparece como custo efetivo')
      assert.match(normalize(await section.locator('#e4-meta-status').innerText()), /^Taxa all-in de Dólar \+ \d{1,2},\d{4}% a\.a\., calculada para chegar ao custo efetivo de 1,30% ao mês\.$/)
      assert.equal(normalize(await section.locator('#e4-rate-origem').innerText()), 'Calculada pela meta.')
      // Meta abaixo do que a operação alcança com taxa zero: a tela explica e não mexe na taxa.
      const taxaMeta = await section.locator('#e4-rate').inputValue()
      await fill('meta', '0,10')
      await section.getByRole('button', { name: 'Calcular taxa' }).click()
      assert.match(normalize(await section.locator('#e4-meta-status').innerText()), /^Meta abaixo do mínimo/)
      assert.equal(await section.locator('#e4-rate').inputValue(), taxaMeta)
      // Com o campo da taxa vazio, a meta ainda calcula: a taxa é justamente o que se procura.
      await fill('rate', '')
      await fill('meta', '1,30')
      await section.getByRole('button', { name: 'Calcular taxa' }).click()
      assert.equal(await section.locator('#e4-rate').inputValue(), taxaMeta)
      // Meta em CDI pode ser negativa.
      await section.locator('#e4-meta-kind').selectOption('spread')
      await fill('meta', '-1,00')
      await section.getByRole('button', { name: 'Calcular taxa' }).click()
      assert.match(normalize(await section.locator('#e4-meta-status').innerText()), /calculada para chegar ao CDI − 1,00%\.$/)
      assert.ok(normalize(await section.locator('.fm-headline').innerText()).includes('CDI − 1,00%'))
      await section.locator('#e4-meta-kind').selectOption('cetMes')
      await fill('meta', '1,30')
      await section.getByRole('button', { name: 'Calcular taxa' }).click()
      assert.equal(await section.locator('#e4-rate').inputValue(), taxaMeta)

      // Condições da operação na ordem do e-mail de cotação e o resumo copiado em texto.
      const condicoes = normalize(await section.locator('.e4-condicoes dl').innerText())
      assert.ok(condicoes.includes('Produto 4131 com NDF') && condicoes.includes('Valor de principal R$ 10.000.000,00') && condicoes.includes('Prazo 36 meses') && condicoes.includes('Principal Mensal · 36 parcelas') && condicoes.includes('Juros Mensal'), condicoes)
      await section.getByRole('button', { name: 'Copiar resumo' }).click()
      await section.getByRole('button', { name: 'Resumo copiado' }).waitFor()
      const resumo = await page.evaluate(() => navigator.clipboard.readText())
      assert.ok(resumo.startsWith('4131 com NDF · Condições da operação\n'), resumo)
      assert.match(resumo, /Custo efetivo total: taxa de juros prefixada em reais de 1,30% a\.m\. \/ \d+,\d{2}% a\.a\. \(exp\/360\), equivalente a CDI \+ \d+,\d{2}%/)
      assert.match(resumo, /Economia de IOF \(R\$\): [\d.]+,\d{2}/)
      assert.match(resumo, /Taxa equivalente em capital de giro: \d+,\d{2}% a\.m\. \/ \d+,\d{2}% a\.a\. \(exp\/360\)/)

      // O que foge do padrão fica em Mais opções; a comparação com swap e sem proteção, em painel próprio.
      await section.locator('.e4-mais > summary').click()
      await section.locator('.e4-comparar > summary').click()
      assert.equal(await section.locator('#e4-irrf').isDisabled(), true, 'alíquota do IR só vale quando o IR é somado à taxa')

      // Pagamento único de 6 meses, em dia fixo, com o IR somado à taxa: R$ 5 milhões a 5,0000 são US$ 1 milhão.
      await fill('valor', '5.000.000,00')
      await fill('rate', '6,00')
      await fill('spot', '5,0000')
      await fill('start', START)
      await fill('months', '6')
      await section.locator('#e4-freq').selectOption('0')
      await section.locator('#e4-calendar').selectOption('mes')
      await section.locator('#e4-amort').selectOption('bullet')
      await section.locator('#e4-gross').selectOption('sim')
      await fill('di', '14,00')
      await fill('cupom', '5,00')
      assert.match(normalize(await section.locator('#e4-spot-origem').innerText()), /^Digitado\. Usar o do Painel \(5,3127\)$/)
      assert.equal(await section.locator('#e4-grace').isDisabled(), true)
      assert.equal(normalize(await section.locator('label[for="e4-months"]').innerText()), 'Prazo total (meses)')
      assert.match(normalize(await section.locator('.e4-mais > summary').innerText()), /4 itens fora do padrão/)

      assert.equal(normalize(await section.locator('.fm-operation .fm-financed b').innerText()), usd(P))
      assert.match(normalize(await section.locator('.fm-iof-premise').innerText()), new RegExp(`IOF-câmbio de 3,50% na entrada: prazo médio de ${DC} dias corridos`))
      const headline = normalize(await section.locator('.fm-headline').innerText())
      assert.ok(headline.includes(`${pct(mes(Y_UNICO))} a.m.`) && headline.includes(`${pct(ano(Y_UNICO))} a.a. · exp/360`), headline)
      assert.ok(headline.includes(`CDI + ${pct(SPREAD)}`), headline)
      assert.ok(headline.includes(`Total das parcelas ${brl(TOTAL_NDF)}`), headline)
      assert.equal(normalize(await cell('Custo em reais ao ano', 0).innerText()), pct(ALL_IN))
      assert.equal(normalize(await cell('Custo em reais ao ano', 2).innerText()), pct(PRE))
      assert.equal(normalize(await cell('Spread do swap', 1).innerText()), `CDI + ${pct(RUN_SPREAD)}`)
      assert.equal(normalize(await cell('Custo total em CDI', 1).innerText()), `CDI + ${pct(SPREAD)}`)
      assert.equal(normalize(await cell('Total a pagar em reais', 0).innerText()), brl(TOTAL_USD * SPOT))
      assert.equal(normalize(await cell('Total a pagar em reais', 2).innerText()), brl(TOTAL_NDF))
      assert.ok(RUN_SPREAD < SPREAD - 0.05, 'com IOF de 3,5% em 6 meses, o spread do swap fica bem abaixo do custo total')

      // Parcela a parcela: a linha do desembolso (valor líquido recebido) e um pagamento.
      assert.equal(await flow.count(), 2)
      const entrada = await linha(0)
      assert.equal(entrada[4], usd(P * IOF), 'IOF descontado na entrada')
      assert.equal(entrada[7], brl(NET_USD * SPOT), 'valor líquido recebido')
      const paid = await linha(1)
      assert.deepEqual(paid.slice(0, 6), [String(DC), '11/05/2027', usd(P), usd(P), usd(JUROS + IR_USD), usd(TOTAL_USD)])
      assert.equal(paid[7], brl(TOTAL_NDF))

      // Comissões pagas ao exterior: IR com gross-up sobre tarifa (na entrada) e fiança (no pagamento).
      await fill('flat', '1,00')
      await fill('guarantee', '1,00')
      await section.locator('#e4-fees').selectOption('sim')
      assert.equal((await linha(0))[7], brl(NET_FEES * SPOT))
      assert.equal((await linha(1))[4], usd(JUROS + FIANCA + IR_FEES))
      await section.locator('#e4-fees').selectOption('nao')
      assert.equal((await linha(1))[4], usd(JUROS + FIANCA + IR_USD))
      await page.screenshot({ path: path.join(out, `simulacao-${width}.png`), fullPage: true })

      // Principal em três parcelas mensais: saldo, juros sobre o saldo e leitura no formato da cotação.
      await fill('flat', '0,00')
      await fill('guarantee', '0,00')
      await fill('months', '3')
      await section.locator('#e4-freq').selectOption('1')
      await section.locator('#e4-amort').selectOption('parcelas')
      assert.equal(await section.locator('#e4-grace').isDisabled(), false)
      assert.match(normalize(await section.locator('.fm-iof-premise').innerText()), /IOF-câmbio de 3,50% na entrada: prazo médio de 61 dias corridos/)
      assert.equal(await flow.count(), 4)
      for (const [i, f] of PARCELAS.entries()) {
        const row = await linha(i + 1)
        assert.deepEqual(row.slice(0, 6), [String(f.dc), f.date.split('-').reverse().join('/'), usd(P / 3), usd(f.saldo), usd(f.juros / (1 - IR)), usd(f.usdTotal)], `parcela ${i + 1}`)
        assert.equal(row[7], brl(f.brl), `parcela ${i + 1} em reais`)
      }
      const custo = normalize(await section.locator('.fm-headline').innerText())
      assert.ok(custo.includes(`${pct(mes(CET))} a.m.`) && custo.includes(`${pct(ano(CET))} a.a. · exp/360`), custo)
      const cotacao = normalize(await section.locator('.e4-cotacao').innerText())
      assert.ok(cotacao.includes(brl(IOF_GIRO)), cotacao)
      assert.ok(cotacao.includes(`${pct(mes(GIRO))} a.m.`) && cotacao.includes(`${pct(ano(GIRO))} a.a. · exp/360`), cotacao)
      assert.match(cotacao, /Não desconta o IOF-câmbio de 3,50% desta operação/)
      assert.ok(GIRO < CET, 'com o IOF do giro a favor, a taxa equivalente fica abaixo do custo efetivo')
      // Taxas futuras da mesa coladas: cada parcela em reais passa a ser a parcela na moeda vezes a taxa colada.
      await section.locator('#e4-fwdMode').selectOption('mesa')
      await fill('fwd', '5,0300\n5,0700')
      assert.equal(normalize(await section.locator('#e4-fwd-err').innerText()), 'Falta 1 taxa: você colou 2 e a operação tem 3 pagamentos.')
      await fill('fwd', COLADAS.map(v => v.toFixed(4).replace('.', ',')).join('\n'))
      for (const [i, f] of PARCELAS.entries()) assert.equal((await linha(i + 1))[7], brl(f.usdTotal * COLADAS[i]), `parcela ${i + 1} com a taxa da mesa`)
      const comMesa = normalize(await section.locator('.fm-headline').innerText())
      assert.ok(comMesa.includes(`${pct(mes(CET_MESA))} a.m.`) && comMesa.includes(`${pct(ano(CET_MESA))} a.a. · exp/360`), comMesa)
      assert.match(normalize(await section.locator('#e4-fwd-origem').innerText()), /^✓ 3 de 3 taxas · cupom cambial implícito de -?\d+,\d{2}% a -?\d+,\d{2}% a\.a\., com o DI informado$/)
      assert.match(normalize(await section.locator('.fm-hero').innerText()), /Com as taxas futuras da mesa/)
      // Colagem suspeita: ordem invertida avisa, sem bloquear a conta.
      await fill('fwd', [...COLADAS].reverse().map(v => v.toFixed(4).replace('.', ',')).join('\n'))
      assert.match(normalize(await section.locator('.e4-aviso').last().innerText()), /^A 2ª taxa colada é menor que a anterior: confira a ordem e os valores\.$/)
      await section.locator('#e4-fwdMode').selectOption('estimar')
      assert.equal((await linha(1))[7], brl(PARCELAS[0].brl))
      // Carência de um pagamento: a primeira linha só tem juros e o principal vai em duas parcelas.
      await fill('grace', '1')
      assert.equal((await linha(1))[2], usd(0))
      assert.equal((await linha(2))[2], usd(P / 2))
      await fill('grace', '0')
      // Cada 30 dias, em dia útil: 11/12/2026 (sexta); 10/01/2027 é domingo e vai para segunda; 09/02/2027 é Carnaval e vai para quarta.
      await section.locator('#e4-calendar').selectOption('30d')
      assert.deepEqual((await flow.locator('td:first-of-type').allInnerTexts()).map(normalize).slice(1), ['11/12/2026', '11/01/2027', '10/02/2027'])
      await section.locator('#e4-calendar').selectOption('mes')
      await page.screenshot({ path: path.join(out, `parcelas-${width}.png`), fullPage: true })

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
      assert.match(normalize(await page.locator('.bnprint-document').innerText()), /Custo efetivo com NDF \(exp\/360\)/)
      await page.getByRole('button', { name: 'Fechar prévia' }).click()

      // Euro: rótulos trocam e a cotação de partida volta a vir do Painel, agora a do euro.
      await section.locator('#e4-currency').selectOption('EUR')
      assert.equal(normalize(await section.locator('label[for="e4-rate"]').innerText()), 'Taxa all-in (Euro +)')
      assert.equal(await section.locator('#e4-spot').inputValue(), '6,1844')
      assert.equal(normalize(await section.locator('label[for="e4-cupom"]').innerText()), 'Juro do euro')
      assert.match(normalize(await section.locator('.fm-difference').innerText()), /se o euro subir/)
      await section.locator('#e4-currency').selectOption('USD')
      assert.equal(await section.locator('#e4-spot').inputValue(), '5,3127')

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
