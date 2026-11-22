// Calculadoras: navegação, simulação de Capital de Giro e BNDES.
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')

// Liberação fixa em 06/11/2026 e primeiro vencimento em 06/12/2026. Regra de 11/11/2026: juros por dias corridos ((1,02)^(dias/30)),
// vencimento no próximo dia útil, IOF e TAC na liberação. Recálculo independente do motor (datas ajustadas à mão).
// Vencimentos dia 6 a partir de 06/12/2026, ajustados à mão: 06/12 dom → 07/12; 06/02/2027 sáb → 08/02 e 09/02 Carnaval → 10/02;
// 06/03 sáb → 08/03; 06/06 dom → 07/06; 06/11/2027 sáb → 08/11. Dias corridos desde 06/11/2026.
const giroOracle = (system, principal = 100000, daily = 0.0082, monthly = 0.02) => {
  const days = [31, 61, 96, 122, 151, 181, 213, 242, 273, 304, 334, 367]
  // Sem carência: o dia a mais do 1º vencimento (06/12 domingo → 07/12) é cobrado na própria 1ª parcela.
  const r = d => Math.pow(1 + monthly, d / 30) - 1
  const periods = days.map((d, k) => d - (k ? days[k - 1] : 0))
  const cents = value => Math.round(Number((value * 100).toPrecision(14))) / 100
  let interest = 0, iof = principal * 0.0038, bal = principal
  const payments = []
  let pmt = 0, theoretical = principal
  if (system === 'price') {
    let disc = 0, acc = 1
    for (const p of periods) { acc /= 1 + r(p); disc += acc }
    pmt = principal / disc
  }
  periods.forEach((p, k) => {
    const j = cents(bal * r(p))
    theoretical = system === 'price' ? theoretical * (1 + r(p)) - pmt : principal * (1 - (k + 1) / periods.length)
    const a = k === periods.length - 1 ? bal : cents(cents(principal - theoretical) - (principal - bal))
    interest += j
    bal = cents(bal - a)
    iof += a * Math.min(days[k], 365) * daily / 100
    payments.push(cents(a + j))
  })
  const paid = cents(payments.reduce((s, v) => s + v, 0))
  return { first: payments[0], last: payments.at(-1), interest, iof: cents(iof), total: paid + cents(iof) }
}

const brl = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s+/g, ' ')
const normalize = text => text.replace(/\s+/g, ' ').trim()

;(async () => {
  const b = await chromium.launch(require('./smoke-launch.cjs')()), base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5216'
  const out = process.env.CALCULATOR_QA_OUTPUT ? path.join(process.env.CALCULATOR_QA_OUTPUT, 'functional') : process.env.SMOKE_OUT || 'workspace-qa/calculadoras'
  fs.mkdirSync(out, { recursive: true })
  try {
    for (const width of [390, 1280]) {
      const p = await b.newPage({ viewport: { width, height: 1000 }, serviceWorkers: 'block' }), errors = []
      p.on('pageerror', (e) => errors.push(e.message))
      await p.goto(base + '/#calculadora')
      const tile = p.getByRole('button', { name: 'Capital de Giro: abrir calculadora' })
      await tile.waitFor()
      assert.equal(await tile.locator('svg').count(), 1, 'ícone do Capital de Giro')
      assert.ok((await tile.boundingBox()).height >= 44)
      await tile.click()
      await p.waitForURL('**/#calculadora/giro')
      const sec = p.locator('.giro-screen'); await sec.waitFor()
      const value = sec.getByLabel('Valor solicitado', { exact: true })
      const amount = async label => normalize(await sec.locator('dl > div').filter({ has: p.getByText(label, { exact: true }) }).locator('dd').first().innerText())
      const resultado = async () => normalize(await sec.locator('.giro-result').innerText())
      const simulate = () => sec.getByRole('button', { name: 'Simular', exact: true }).click()
      const iof = async () => normalize(await sec.getByLabel('Valor do IOF', { exact: true }).innerText())
      const expectedPrice = giroOracle('price'), expectedSac = giroOracle('sac')
      // Roteiro de 21/11/2026, com os ajustes do mesmo dia: 1 Demanda, 2 Encargos, 3 Resultado (a linha do tempo saiu). A demanda
      // continua sendo a linha mestra comum; periodicidade e juros na carência logo depois da amortização; data, praça,
      // 1º vencimento e garantia ficam na gaveta.
      assert.deepEqual((await sec.locator('.lm h3, legend, .giro-outcome h3').allInnerTexts()).map(normalize),
        ['1 Demanda do cliente', '2 Encargos', '3 Resultado · custo final para o cliente'])
      assert.equal(await sec.locator('.rt-timeline').count(), 0, 'sem linha do tempo')
      assert.deepEqual(await sec.locator('.lm > .lm-grid .lm-label label').allInnerTexts(), ['Valor solicitado', 'Prazo total', 'Carência', 'Amortização', 'Periodicidade'])
      assert.equal(await sec.getByRole('checkbox', { name: 'Pagar juros na carência' }).isVisible(), true)
      // Tela limpa: nenhuma nota de explicação à vista (vão para os "?").
      assert.equal(await sec.locator('.lm-foot:visible, .giro-hint, .giro-rounding').count(), 0)
      assert.equal(await sec.locator('#cx-start').isVisible(), false, 'detalhes do contrato começam fechados')
      // Padrão próprio do Capital de Giro: 36 meses (22/11/2026), e o gráfico de juros termina no prazo digitado.
      assert.equal(await sec.locator('#cx-term').inputValue(), '36')
      assert.equal(normalize(await sec.locator('.rm h4').first().innerText()), 'Curva DI x pré (B3) · de 12 a 36 meses')
      assert.equal(await sec.locator('section.fp path.fp-juros').count(), 36, 'fluxo de pagamentos da simulação inicial: 36 parcelas mensais')
      // Prazo vazio é erro do prazo, não de data: quem avisa é o campo do prazo, e a gaveta dos detalhes continua fechada.
      await sec.locator('#cx-term').fill('')
      assert.match(await sec.locator('#cx-term-err').innerText(), /prazo em meses/)
      assert.equal(await sec.locator('#cx-start').isVisible(), false, 'prazo vazio não abre os detalhes do contrato')
      assert.equal(await sec.locator('.lm-details > summary .lm-error').count(), 0)
      await sec.locator('#cx-term').fill('24')
      await sec.locator('.lm-details > summary').click()
      assert.deepEqual(await sec.locator('.lm-details .lm-label label').allInnerTexts(), ['Data da liberação', 'Praça do contrato', 'Primeiro vencimento (opcional)', 'Garantia'])
      assert.deepEqual((await sec.locator('.giro-cost-label').allInnerTexts()).map(text => normalize(text.replace('?', ''))),
        ['Taxa de juros prefixada', 'IOF calculado', 'Fee', 'TAC', 'Outros', 'Perfil tributário'])
      // Perfil tributário compacto nos encargos, sem a gaveta "Enquadramento do IOF"; a explicação e a base legal ficam no "?" do IOF.
      assert.equal(await sec.getByText('Enquadramento do IOF', { exact: true }).count(), 0)
      assert.equal(await sec.locator('#cx-profile').inputValue(), 'pj')
      assert.deepEqual(await sec.locator('#cx-profile option').allInnerTexts(), ['Pessoa jurídica geral', 'Simples/MEI: operação elegível até R$ 30 mil'])
      await sec.getByRole('button', { name: 'Ajuda: IOF: como é calculado', exact: true }).click()
      const iofHelp = p.getByRole('dialog', { name: 'IOF: como é calculado', exact: true }); await iofHelp.waitFor()
      assert.match(await iofHelp.innerText(), /0,38%[\s\S]*365 dias[\s\S]*Simples Nacional/)
      assert.equal(await iofHelp.getByRole('link', { name: 'Base legal do IOF automático' }).count(), 1)
      await p.keyboard.press('Escape'); await iofHelp.waitFor({ state: 'hidden' })
      assert.equal(await sec.getByLabel('Unidade do Fee').inputValue(), 'brl')
      assert.equal(await sec.evaluate(el => el.classList.contains('bw')), true, 'mesma moldura das outras calculadoras')
      await value.fill('100.000,00'); await sec.locator('#cx-term').fill('12'); await sec.locator('#cx-grace').fill('0')
      await sec.locator('#cx-start').fill('2026-11-06')
      // 1º vencimento antes da liberação: erro de data, marcado também no título da gaveta.
      await sec.locator('#cx-firstDue').fill('2026-11-01')
      assert.match(await sec.locator('#cx-firstDue-err').innerText(), /primeiro vencimento posterior/)
      assert.match(await sec.locator('.lm-details > summary .lm-error').innerText(), /há um campo a conferir aqui/)
      await sec.locator('#cx-firstDue').fill('2026-12-06')
      assert.equal(await sec.locator('.lm-details > summary .lm-error').count(), 0)
      await simulate()
      assert.equal(await amount('Quanto paga por mês'), brl(expectedPrice.first))
      assert.equal(await iof(), brl(expectedPrice.iof))
      assert.equal(await amount('Custo total'), brl(expectedPrice.total - 100000))
      assert.equal(await amount('Quanto paga no total'), brl(expectedPrice.total))
      assert.equal(await amount('Quanto entra no caixa'), brl(100000 - expectedPrice.iof))
      // As partes do custo trazem o percentual sobre o custo total no rótulo (21/11/2026), com uma casa: "IOF · 9,3%".
      assert.equal(await amount(/^IOF · \d+,\d%$/), brl(expectedPrice.iof), 'composição do custo repete o IOF dos encargos')
      const shares = (await sec.locator('.rt-parts dt').allInnerTexts()).map(normalize).slice(0, 3)
      const custo = expectedPrice.total - 100000
      assert.deepEqual(shares, [`Juros · ${(expectedPrice.interest / custo * 100).toFixed(1).replace('.', ',')}%`,
        `IOF · ${(expectedPrice.iof / custo * 100).toFixed(1).replace('.', ',')}%`, 'Fee, TAC e outros · 0,0%'])
      // Envelope de e-mail no cabeçalho do resultado: rascunho no Outlook com resumo, taxas e parcelas. Endereço curto
      // (22/11/2026: com o cronograma inteiro o login da Microsoft recusava, AADSTS90015): o rascunho leva o resumo das
      // 12 parcelas e o clique copia o cronograma completo para colar.
      const envelope = sec.getByRole('link', { name: 'Preparar e-mail com o resultado' })
      const href = await envelope.getAttribute('href')
      assert.ok(href.length <= 2000, `endereço do rascunho com ${href.length} caracteres`)
      const mail = decodeURIComponent(href)
      assert.match(mail, /^https:\/\/outlook\.office\.com\/mail\/deeplink\/compose\?subject=Capital de Giro/)
      assert.match(mail, /RESUMO[\s\S]*TAXAS E ENCARGOS[\s\S]*PARCELAS[\s\S]*12 parcelas, de [\s\S]*cole aqui \(Ctrl\+V\)/)
      await p.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
      const [aba] = await Promise.all([p.context().waitForEvent('page'), envelope.click()])
      await aba.close()
      const copiado = await p.evaluate(() => navigator.clipboard.readText()).catch(() => null)
      if (copiado !== null) assert.equal(copiado.split('\r\n').filter(line => /^\d+ \|/.test(line)).length, 12, 'cronograma completo copiado')
      assert.ok(mail.replace(/\u00a0/g, ' ').includes(`Total pago: ${brl(expectedPrice.total)}`))
      assert.match(await amount('Quanto custa'), /^\d+,\d{2}% a\.a\.$/)
      // Fluxo de pagamentos depois da referência de mercado: 12 barras mensais, uma por parcela; e o gráfico de juros até 12 meses.
      assert.equal(normalize(await sec.locator('.rm h4').first().innerText()), 'Curva DI x pré (B3) · até 12 meses')
      const fluxo = sec.locator('section.fp')
      assert.equal(await fluxo.evaluate(el => el.previousElementSibling?.matches('.rm:not(.fp)')), true, 'logo depois da referência de mercado')
      assert.equal(await fluxo.locator('path.fp-juros').count(), 12)
      const footer = sec.getByText('Ver parcelas', { exact: true })
      assert.ok((await footer.boundingBox()).y > (await sec.locator('.giro-result').boundingBox()).y)
      await footer.click()
      assert.equal(await sec.getByRole('region', { name: 'Cronograma de pagamentos' }).locator('tbody tr').count(), 12)
      await sec.getByText('Comparar amortizações', { exact: true }).click()
      assert.ok((await sec.getByRole('row', { name: /^SAC/ }).innerText()).replace(/\s+/g, ' ').includes(brl(expectedSac.total)))
      await footer.click()
      await sec.getByLabel('Amortização', { exact: true }).selectOption('sac'); await simulate()
      assert.equal(await amount('Quanto paga por mês'), brl(expectedSac.first))
      assert.ok((await resultado()).includes(`A última é de ${brl(expectedSac.last)}`), 'última parcela do SAC')
      assert.equal(await iof(), brl(expectedSac.iof))
      await sec.getByLabel('Valor de Fee').fill('1.200,00')
      await sec.getByLabel('Forma de pagamento de Fee').selectOption('financed')
      await sec.getByLabel('Valor de Outros').fill('300,00')
      assert.equal(await amount('Saldo financiado'), '—', 'edição invalida resultado anterior')
      await simulate()
      assert.equal(await amount('Saldo financiado'), brl(101200))
      const financedFeeIof = giroOracle('sac', 101200).iof
      assert.equal(await iof(), brl(financedFeeIof))
      await sec.getByLabel('Forma de pagamento de IOF').selectOption('financed')
      await simulate()
      // Recálculo independente do IOF com amortização em centavos sobre o saldo bruto.
      assert.equal(await amount('Saldo financiado'), brl(103266.94))
      assert.equal(await iof(), brl(2066.94))
      await sec.getByLabel('Forma de pagamento de IOF').selectOption('upfront')
      await sec.getByLabel('Valor de Fee').fill('0,00')
      await sec.getByLabel('Valor de Outros').fill('0,00')
      // Bullet: vencimento único no fim do prazo (1º vencimento em branco segue a linha mestra: 06/11/2026 + 12 meses).
      await sec.locator('#cx-firstDue').fill('')
      await sec.getByLabel('Amortização', { exact: true }).selectOption('bullet'); await simulate()
      assert.equal(await amount('Quanto paga no vencimento'), brl(127411.54))
      await sec.getByLabel('Forma de pagamento de IOF').selectOption('financed'); await simulate()
      assert.equal(await amount('Saldo financiado'), brl(103490.74))
      assert.equal(await iof(), brl(3490.74))
      assert.equal(await amount('Quanto paga no vencimento'), brl(127411.54085294812 * 103490.74 / 100000))
      await sec.getByLabel('Forma de pagamento de IOF').selectOption('upfront')
      assert.equal(await sec.getByLabel('Carência', { exact: true }).isDisabled(), true)
      // Bullet com juros periódicos (decisão de Fernando, 22/11/2026): a periodicidade vale para os juros. Padrão: pagamento único,
      // idêntico ao de antes. Trimestral: três pagamentos só de juros e, no fim, principal com os juros do último trimestre.
      const periodicidade = sec.getByLabel('Periodicidade', { exact: true })
      assert.equal(await periodicidade.isDisabled(), false, 'no Bullet a periodicidade vale para os juros')
      assert.equal(await periodicidade.inputValue(), '0', 'Bullet abre em pagamento único')
      await periodicidade.selectOption('3'); await simulate()
      const finalTrimestral = Number((await amount('Quanto paga no vencimento')).replace(/[^\d,]/g, '').replace(',', '.'))
      assert.ok(finalTrimestral > 100000 && finalTrimestral < 127411.54, 'com juros trimestrais, o vencimento paga principal e só os juros do último trimestre')
      assert.match(await resultado(), /3 pagamentos só de juros/)
      await periodicidade.selectOption('0'); await simulate()
      assert.equal(await amount('Quanto paga no vencimento'), brl(127411.54), 'de volta ao pagamento único, igual ao de antes')
      assert.equal(await sec.getByRole('checkbox', { name: 'Pagar juros na carência' }).isDisabled(), true)
      await sec.getByLabel('Amortização', { exact: true }).selectOption('price')
      await sec.locator('#cx-profile').selectOption('simples')
      assert.match(await sec.locator('#cx-profile-err').innerText(), /Confirme/)
      const eligible = sec.getByRole('checkbox', { name: /Confirmo o enquadramento/ })
      await eligible.check(); await simulate()
      assert.equal(await iof(), brl(expectedPrice.iof), 'acima de R$ 30 mil mantém diária geral')
      await value.fill('30.000,00'); await simulate()
      assert.equal(await iof(), brl(giroOracle('price', 30000, 0.00274).iof), 'limite inclusivo usa diária reduzida')
      await eligible.uncheck()
      assert.equal(await iof(), '—')
      await sec.locator('#cx-profile').selectOption('pj')
      await value.fill('100.000,00')
      await sec.getByLabel('Período da taxa').selectOption('aa')
      await sec.getByLabel('Taxa de juros prefixada', { exact: true }).fill('12,6825'); await simulate()
      const expectedAnnualPrice = giroOracle('price', 100000, 0.0082, (1 + 12.6825 / 100) ** (1 / 12) - 1)
      assert.equal(await amount('Quanto paga por mês'), brl(expectedAnnualPrice.first))
      await sec.getByLabel('Prazo total', { exact: true }).fill('0')
      assert.match(await sec.locator('#cx-term-err').innerText(), /prazo em meses/)
      assert.equal(await amount('Quanto paga por mês'), '—')
      await sec.getByLabel('Prazo total', { exact: true }).fill('12')
      await value.fill('1,000.00')
      assert.match(await sec.locator('#cx-value-err').innerText(), /formato brasileiro/)
      assert.equal(await value.getAttribute('aria-invalid'), 'true')
      await value.fill('100.000,00'); await simulate()
      assert.equal(await sec.locator('[role="alert"]').count(), 0)
      assert.equal(await amount('Quanto paga por mês'), brl(expectedAnnualPrice.first))
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      // Ajustes de 21/11/2026. Fee em %: 1,5% de R$ 100.000,00 = R$ 1.500,00, igual ao Fee de R$ 1.500,00.
      await sec.getByLabel('Unidade do Fee').selectOption('pct')
      await sec.getByLabel('Valor de Fee').fill('1,5'); await simulate()
      const feePct = await amount('Quanto entra no caixa')
      await sec.getByLabel('Unidade do Fee').selectOption('brl')
      await sec.getByLabel('Valor de Fee').fill('1.500,00'); await simulate()
      assert.equal(await amount('Quanto entra no caixa'), feePct)
      await sec.getByLabel('Valor de Fee').fill('0,00')
      // Periodicidade: prazo menos carência precisa ser múltiplo; trimestral em 12 meses = 4 parcelas.
      await sec.getByLabel('Periodicidade', { exact: true }).selectOption('3')
      await sec.getByLabel('Prazo total', { exact: true }).fill('13')
      assert.match(await sec.locator('#cx-period-err').innerText(), /múltiplo de 3 meses[\s\S]*12 ou 15 meses/)
      await sec.getByLabel('Prazo total', { exact: true }).fill('12')
      await sec.locator('#cx-firstDue').fill(''); await simulate()
      assert.ok((await sec.locator('dl > div').filter({ has: p.getByText('Quanto paga por trimestre', { exact: true }) }).innerText()).includes('1ª de 4 parcelas trimestrais'))
      // Juros na carência: 3 meses de carência, trimestral em 12 meses = 1 pagamento só de juros e 3 parcelas.
      await sec.getByLabel('Carência', { exact: true }).fill('3')
      await sec.getByRole('checkbox', { name: 'Pagar juros na carência' }).check(); await simulate()
      await footer.click()
      const cronograma = sec.getByRole('region', { name: 'Cronograma de pagamentos' })
      assert.equal(await cronograma.locator('tbody tr').count(), 4)
      assert.match(normalize(await cronograma.locator('tbody tr').first().innerText()), /^1 só juros \d\d\/02\/2027 R\$ 0,00 /)
      // Flex: a parcela 3 paga R$ 50.000,00; a seguinte é recalculada e "Desfazer ajustes" volta ao fluxo padrão.
      const antesFlex = normalize(await cronograma.locator('tbody tr').nth(3).innerText())
      await cronograma.getByRole('button', { name: 'Ajustar parcela 3' }).click()
      await cronograma.getByLabel('Pagamento da parcela 3').fill('50.000,00')
      await cronograma.getByRole('button', { name: 'Aplicar' }).click()
      assert.match(normalize(await cronograma.locator('tbody tr').nth(2).innerText()), /^3 ajustada .* R\$ 50\.000,00 /)
      assert.notEqual(normalize(await cronograma.locator('tbody tr').nth(3).innerText()), antesFlex)
      assert.match(await sec.locator('.giro-result').innerText(), /1 parcela ajustada/)
      await cronograma.getByRole('button', { name: 'Ajustar parcela 2' }).click()
      await cronograma.getByLabel('Pagamento da parcela 2').fill('1,00')
      await cronograma.getByRole('button', { name: 'Aplicar' }).click()
      assert.match(await cronograma.locator('.giro-flex-edit [role=alert]').innerText(), /não cobre os juros do período/)
      await cronograma.getByRole('button', { name: 'Cancelar' }).click()
      await sec.getByRole('button', { name: 'Desfazer ajustes' }).click()
      assert.equal(normalize(await cronograma.locator('tbody tr').nth(3).innerText()), antesFlex)
      await footer.click()
      await sec.getByRole('checkbox', { name: 'Pagar juros na carência' }).uncheck()
      await sec.getByLabel('Carência', { exact: true }).fill('0')
      await sec.getByLabel('Periodicidade', { exact: true }).selectOption('1'); await simulate()
      assert.equal(await amount('Quanto paga por mês'), brl(expectedAnnualPrice.first))
      await sec.getByRole('button', { name: 'Voltar para a lista de calculadoras' }).click(); await p.waitForURL('**/#calculadora')
      const help = async (title, content, scope = p) => {
        await scope.getByRole('button', { name: `Ajuda: ${title}`, exact: true }).click()
        const dialog = p.getByRole('dialog', { name: title, exact: true }); await dialog.waitFor()
        if (content) assert.match(await dialog.innerText(), content)
        await p.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
      }
      // BNDES Finame Materiais: tile, condições com as regras (prazo 84, carência 12 com TFB), TFB do painel, resultado e cronograma
      await p.route('**/moedas.json*', (r) => r.fulfill({ json: { schemaVersion: 1, generatedAt: Date.now(), series: { C01: { points: [['2026-11-03', 14.4025], ['2026-11-04', 14.4173]] }, C02: { points: [['2026-11-04', 14.5416]] }, C03: { points: [['2026-11-04', 14.1743]] }, C04: { points: [['2026-11-04', 14.2986]] } }, errors: [], stale: {} } }))
      await p.route('**/bndes.json*', (r) => r.fulfill({ json: { schemaVersion: 1, generatedAt: Date.now(), series: Object.fromEntries([36, 60, 84, 120].flatMap((pz) => [30, 90].map((lib) => [`TFB_${pz}_${lib}`, { prazo: pz, liberacao: lib, points: [['2026-11-03', 15 + pz / 100], ['2026-11-04', 16 + pz / 100 + lib / 1000]] }]))), tlp: { code: 777, unit: 'a.a.', points: [['2026-10-01', 7.6], ['2026-11-01', 7.72]] }, errors: [], stale: {} } }))
      await p.goto(base + '/#calculadora')
      const tf = p.getByRole('button', { name: 'BNDES: abrir calculadora' }); await tf.waitFor(); await tf.click()
      await p.waitForURL('**/#calculadora/finame-materiais')
      const fm = p.locator('section.cx[aria-labelledby="calc-h"]'); await fm.waitFor()
      assert.match(await fm.locator('.cx-title').innerText(), /BNDES Finame Materiais/)
      // padrão: TFC da série MPME (porte padrão MPME nas demais regiões), faixa até 60 meses
      await fm.locator('.fm-custo-valor', { hasText: 'TFC_MPME_60.90 (C03)' }).waitFor()
      assert.match(await fm.locator('.fm-custo-valor').innerText(), /14,1743% a\.a\. em 04\/11\/2026.*TFC_MPME_60\.90 \(C03\).*faixa até 60 meses/)
      await fm.locator('.fm-destaques').waitFor() // Resultado imediato com premissas fixas.
      if (!(await fm.locator('.fm-grade').isVisible())) await fm.locator('.fm-details > summary').click()
      await fm.locator('.fm-grade').waitFor()
      // Os quadros completos ficam em "Composição do resultado"; os principais se repetem, idênticos, no topo do resultado.
      const composicao = fm.locator('.fm-details'), destaques = fm.locator('.fm-destaques')
      const kpiBox = (nome, area = composicao) => area.locator('.fm-kpi', { has: p.locator('span.fm-rotulo', { hasText: new RegExp(`^${nome}\\s*\\??$`) }) })
      const kpi = async (nome) => (await kpiBox(nome).locator('b').innerText())
      assert.equal(await fm.locator('.fm-hero').count(), 0, 'sem comparação não há faixa "Cotação comparativa" vazia')
      for (const [label, detail] of [['Primeira parcela após carência', 'Parcelas'], ['Custo total estimado', 'Pagamento final']]) {
        const row = destaques.getByRole('row').filter({ has: p.getByRole('rowheader', { name: new RegExp('^' + label) }) })
        assert.ok((await row.locator('td').innerText()).includes(await kpi(detail)), `tabela e composição: ${label}`)
      }
      assert.equal(await destaques.locator('tbody tr:not(.fm-grp)').count(), 10) // taxas e CET; valores em reais (financiado, parcelas, juros, TAC, IOF) e custo total
      const lastPayment = await destaques.getByRole('row').filter({ has: p.getByRole('rowheader', { name: 'Última parcela', exact: true }) }).locator('td').innerText()
      assert.ok((await kpiBox('Parcelas').innerText()).includes(lastPayment), 'última parcela idêntica à composição')
      await help('Custo total estimado', /Valor financiado \+ juros totais \+ IOF \+ TAC \+ ECG/, destaques)
      await help('Taxa final', /14,17% TFC \+ 1,25% BNDES \+ 3,00% spread da instituição/, composicao)
      assert.match(await kpiBox('Spread da instituição').innerText(), /3,00% a\.a\.\s+\+3,4\d p\.p\./)
      // explicações no "?" ao lado do rótulo: abrem e fecham
      await help('Custo financeiro', /Taxa Fixa Composta/)
      assert.equal(await fm.locator('.fm-rotulo .fi-help').count() >= 18, true, 'um "?" por rótulo e por KPI')
      await help('Spread da instituição', /juros com a taxa completa menos/)
      await fm.locator('#fm-porte').selectOption({ label: 'Grande empresa' })
      assert.match(await fm.locator('.fm-custo-valor').innerText(), /14,4173%.*TFC_60\.90 \(C01\).*faixa até 60 meses/)
      await fm.getByLabel('Prazo total (meses)', { exact: true }).fill('72')
      assert.match(await fm.locator('.fm-custo-valor').innerText(), /14,5416%.*TFC_120\.90 \(C02\).*faixa 61 a 120 meses/)
      await fm.getByLabel('Prazo total (meses)', { exact: true }).fill('60')
      await fm.locator('#fm-porte').selectOption({ label: 'MPME nas demais regiões' })
      // TFB da faixa de prazo e liberação
      await fm.locator('#fm-custo').selectOption('tfb')
      await fm.locator('.fm-custo-valor', { hasText: 'TFB_60_90' }).waitFor()
      assert.match(await fm.locator('.fm-custo-valor').innerText(), /16,6900% a\.a\./) // 16 + 0,60 + 0,090
      if (!(await fm.locator('.fm-grade').isVisible())) await fm.locator('.fm-details > summary').click()
      await fm.locator('.fm-grade').waitFor()
      assert.match(await kpi('Taxa final'), /^\d{2},\d{2}% a\.a\.$/)
      // Padrão de 18/11/2026: R$ 1.000.000,00 e 3 meses de carência; o prazo foi posto em 60 acima, então são 57 parcelas.
      assert.equal(await kpi('Valor financiado'), 'R$\u00a01.000.000,00')
      assert.match(await kpiBox('Parcelas').innerText(), /57x mensais/)
      // IOF zero como premissa FINAME, com ressalva tributária.
      const iofKpi = kpiBox('IOF')
      assert.match(await iofKpi.innerText(), /R\$\s*0,00\s+Alíquota zero/)
      await help('IOF', /art\. 8º, IX/)
      assert.equal(await fm.locator('#fm-sis, #fm-comp, #fm-lib, #fm-fgi-inc, #fm-finame-eligible').count(), 0, 'premissas fixas sem controles redundantes')
      assert.equal(await fm.getByLabel('Diária (% ao dia)', { exact: true }).count(), 0, 'não permite inventar alíquota')
      await help('Regras do produto e fontes', /Base legal e onde cada regra foi conferida/)
      // TFB limita carência a 12; TLP calcula no Finame (exigível, 19/11/2026) e mantém o atalho para a projeção própria.
      await fm.getByLabel('Carência (meses)', { exact: true }).fill('18')
      await fm.getByText(/Carência de 0 a 12 meses com TFB/).waitFor()
      const retainedTlpValue = await fm.locator('#fm-valor').inputValue()
      await fm.locator('#fm-custo').selectOption('tlp')
      assert.equal(await fm.locator('#fm-ipca').count(), 0, 'sem o campo antigo de IPCA único')
      await fm.getByRole('link', { name: 'Abrir projeção TLP exigível' }).waitFor()
      assert.ok(p.url().endsWith('#calculadora/finame-materiais'), 'escolher TLP não navega automaticamente')
      assert.equal(await fm.locator('#fm-valor').inputValue(), retainedTlpValue)
      await fm.locator('#fm-custo').selectOption('tfb')
      await fm.getByLabel('Carência (meses)', { exact: true }).fill('12')
      await fm.getByLabel('Prazo total (meses)', { exact: true }).fill('90')
      await fm.getByText(/Prazo de 1 a 84 meses/).waitFor()
      await fm.getByLabel('Prazo total (meses)', { exact: true }).fill('60')
      // Fluxo TFB: liberação + 60 linhas, das quais 12 são carência.
      if (!(await fm.locator('.fm-fluxo').isVisible())) await fm.locator('summary').filter({ hasText: /^Cronograma ilustrativo ·/ }).click()
      await fm.locator('.fm-fluxo').waitFor()
      assert.equal(await fm.locator('.fm-tabela tbody tr:not(.fm-liberacao)').count(), 60)
      assert.equal(await fm.locator('.fm-tabela tbody tr.fm-carencia').count(), 12)
      assert.deepEqual(await fm.locator('.fm-tabela thead th').allInnerTexts(), ['Nº', 'Vencimento', 'Saldo inicial', 'Juros pagos', 'Amortização', 'Parcela', 'Total pago', 'Saldo final'])
      assert.match(await fm.locator('.fm-tabela tbody tr.fm-liberacao td').first().innerText(), /^\d{2}\/\d{2}\/\d{4}$/, 'data da liberação')
      assert.match(await fm.locator('.fm-tabela tbody tr.fm-liberacao td').last().innerText(), /^R\$\s*1\.000\.000,00$/, 'saldo após a liberação (valor padrão de 18/11/2026)')
      assert.match(await fm.locator('.fm-tabela tbody tr.fm-liberacao td').nth(5).innerText(), /^R\$\s*2\.600,00$/, 'só a TAC pré-preenchida na liberação (sem IOF nem FGI)')
      assert.match(await fm.locator('.fm-tabela tbody tr').last().locator('td').last().innerText(), /^R\$\s*0,00$/, 'saldo zera')
      const totalPago = await fm.locator('.fm-tabela tfoot td').nth(5).innerText()
      if (!(await fm.locator('.fm-grade').isVisible())) await fm.locator('.fm-details > summary').click()
      assert.equal(totalPago, await kpi('Pagamento final'), 'total do fluxo = pagamento final')
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Finame sem rolagem lateral a ${width}px`)
      await p.screenshot({ path: `${out}/finame-${width}.png`, fullPage: width > 700 })
      assert.deepEqual(await fm.locator('#fm-custo option').evaluateAll(options => options.map(option => option.value)), ['tfc', 'tfb', 'tlp', 'lcd', 'tfbd'])
      await fm.locator('#fm-custo').selectOption('tfbd')
      // Desde 19/11/2026 a TFBD calcula no Finame (taxa TD do painel + dólar do Focus), com o aviso de que não está disponível no Itaú.
      await fm.locator('#fm-rate-tfbd').waitFor()
      await fm.locator('.fm-projecao').waitFor()
      assert.equal(await fm.locator('.fm-result-tfc, .fm-result-tfb').count(), 0, 'TFBD não mantém resultado de outra moeda')
      await p.screenshot({ path: `${out}/finame-tfbd-${width}.png`, fullPage: true })
      const retainedValue = await fm.locator('#fm-valor').inputValue()
      await fm.locator('#fm-custo').selectOption('lcd')
      assert.ok(p.url().endsWith('#calculadora/finame-materiais'), 'escolher LCD não navega nem apaga o preenchimento')
      assert.equal(await fm.locator('#fm-valor').inputValue(), retainedValue)
      assert.equal(await fm.locator('.fm-result-tfbd').count(), 0, 'LCD não mantém resultado da TFBD')
      await fm.getByRole('link', { name: 'Abrir projeção Selic + LCD' }).click()
      await p.waitForURL('**/#calculadora/bndes-selic-lcd')
      await p.locator('section.cx-lcd').waitFor()
      assert.deepEqual(errors, [])
    }
    console.log('PASS calculadoras: capital de giro e BNDES Finame Materiais (TFC, TFB, TLP, IOF, spread, fluxo) em 390 e 1280')
  } finally { await b.close() }
})().catch((e) => { console.error(e); process.exit(1) })
