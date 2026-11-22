// Shared calculator contract. Run against the CI build; screenshots are internal QA.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.CALCULATOR_QA_OUTPUT || 'workspace-qa/calculator-layout'
const { widths, layoutRoutes: routes } = require('./smoke-calculator-matrix.cjs')
const normalize = text => text.replace(/\s+/g, ' ').trim()

// Liberação em 06/11/2026 e primeiro vencimento em 06/12/2026. Regra de 11/11/2026: juros por dias corridos, vencimento no
// próximo dia útil, IOF e TAC na liberação. Recálculo independente do motor.
// Vencimentos dia 6 a partir de 06/12/2026, ajustados à mão: 06/12 dom → 07/12; 06/02/2027 sáb → 08/02 e 09/02 Carnaval → 10/02;
// 06/03 sáb → 08/03; 06/06 dom → 07/06; 06/11/2027 sáb → 08/11. Dias corridos desde 06/11/2026.
const giroOracle = (system, principal = 100000, daily = 0.0082) => {
  const days = [31, 61, 96, 122, 151, 181, 213, 242, 273, 304, 334, 367]
  // Sem carência: o dia a mais do 1º vencimento (06/12 domingo → 07/12) é cobrado na própria 1ª parcela.
  const r = d => Math.pow(1.02, d / 30) - 1
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


async function settleLayout(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(document.getAnimations().filter(animation => {
      const end = animation.effect?.getComputedTiming().endTime
      return Number.isFinite(end) && end <= 1500
    }).map(animation => animation.finished.catch(() => {})))
  })
}

async function fixtures(page) {
  const stamp = Date.now()
  await page.route('**/moedas.json*', route => route.fulfill({ json: {
    schemaVersion: 1, generatedAt: stamp,
    series: Object.fromEntries([['C01', 14.4173], ['C02', 14.5416], ['C03', 14.1743], ['C04', 14.2986], ['143', 2226.348419], ['LD1', 0.5]].map(([code, value]) => [code, { points: [['2026-11-04', value]] }])),
    errors: [], stale: {},
  } }))
  await page.route('**/bndes.json*', route => route.fulfill({ json: {
    schemaVersion: 1, generatedAt: stamp,
    series: Object.fromEntries([36, 60, 84, 120].flatMap(term => [30, 90].map(release => [`TFB_${term}_${release}`, { prazo: term, liberacao: release, points: [['2026-11-04', 16 + term / 100 + release / 1000]] }]))),
    tlp: { code: 777, unit: 'a.a.', points: [['2026-11-01', 7.72]] }, errors: [], stale: {},
  } }))
  await page.route('**/macro.json*', route => route.fulfill({ json: {
    schemaVersion: 1, generatedAt: stamp, cdi: [['2026-11-04', 14.9]], focus: {}, errors: [], stale: {},
  } }))
}

async function assertWorkspace(page, section, label) {
  const geometry = await section.evaluate(element => {
    const main = element.closest('main.app'), box = element.getBoundingClientRect(), frame = main.getBoundingClientRect(), style = getComputedStyle(main)
    const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
    return { viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, main: frame.width, left: frame.x, available: main.clientWidth - padding, section: box.width, max: getComputedStyle(element).maxWidth }
  })
  assert.ok(geometry.document <= geometry.viewport + 1, `${label}: documento sem rolagem horizontal ${JSON.stringify(geometry)}`)
  assert.ok(Math.abs(geometry.main - geometry.viewport) <= 2 && Math.abs(geometry.left) <= 1, `${label}: main ocupa a largura da tela`)
  assert.ok(Math.abs(geometry.section - geometry.available) <= 2, `${label}: calculadora ocupa toda a área útil ${JSON.stringify(geometry)}`)
  assert.ok(geometry.max === 'none' || parseFloat(geometry.max) >= geometry.available, `${label}: sem limite estreito herdado`)

  const controls = await section.locator('input:not([type=checkbox]):not([type=hidden]), select, textarea, .fi-help > button').evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => {
    const rect = element.getBoundingClientRect()
    // Decisões de 11/11/2026 (Finame) e 18/11/2026 (todas as calculadoras): em tela de computador (acima de 1000px), os campos têm 36px;
    // o "?" e as telas menores seguem com 44px.
    const compact = innerWidth > 1000 && !element.closest('.fi-help')
    return { id: element.id || element.getAttribute('aria-label'), width: rect.width, height: rect.height, min: compact ? 36 : 44 }
  }))
  assert.ok(controls.length > 0)
  assert.deepEqual(controls.filter(control => control.height < control.min - .1 || control.width < control.min - .1), [], `${label}: campos e ? com a altura mínima combinada (44px; 36px nos campos em computador)`)
  const currencyOverlaps = await section.locator('.money-wrap').evaluateAll(elements => elements.filter(element => element.getClientRects().length).filter(element => {
    const input = element.querySelector('input'), prefix = element.querySelector('i')
    return input && prefix && prefix.getBoundingClientRect().right + 4 > input.getBoundingClientRect().left + parseFloat(getComputedStyle(input).paddingLeft)
  }).map(element => element.closest('label')?.textContent.trim() || element.querySelector('input')?.id))
  assert.deepEqual(currencyOverlaps, [], `${label}: prefixo monetário não sobrepõe o valor`)
  const checkboxes = await section.locator('input[type=checkbox]').evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => ({ label: element.closest('label')?.textContent.trim(), height: element.closest('label')?.getBoundingClientRect().height || 0 })))
  assert.deepEqual(checkboxes.filter(control => control.height < 43.9), [], `${label}: checkbox possui rótulo com área de toque acessível`)

  const selectedContrast = await section.locator('.seg button[aria-pressed="true"]').evaluateAll(buttons => buttons.map(button => {
    const style = getComputedStyle(button)
    const luminance = color => {
      const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
        const channel = value / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
    }
    const foreground = luminance(style.color), background = luminance(style.backgroundColor)
    return { text: button.textContent.trim(), ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) }
  }))
  assert.deepEqual(selectedContrast.filter(button => button.ratio < 4.5), [], `${label}: texto selecionado legível sobre seu fundo`)

  // Tables may be wider than the viewport only when a local scrolling region contains them.
  const escapedTables = await section.locator('table').evaluateAll(tables => tables.filter(table => {
    const box = table.getBoundingClientRect()
    if (box.width <= document.documentElement.clientWidth) return false
    for (let parent = table.parentElement; parent; parent = parent.parentElement) {
      const overflow = getComputedStyle(parent).overflowX
      if ((overflow === 'auto' || overflow === 'scroll') && parent.scrollWidth > parent.clientWidth) return false
    }
    return true
  }).map(table => table.className))
  assert.deepEqual(escapedTables, [], `${label}: tabelas largas têm rolagem própria`)

  const explanations = await section.locator('p').evaluateAll(paragraphs => paragraphs.filter(element => {
    if (element.closest('dialog, [role=tooltip], .sr-only, [hidden], [role=alert], .cx-error, .cg-notice, .desconto-notice, .lcd-warnings, [role=status]')) return false
    if (element.closest('.fm-premises')) return false // A ressalva tributária continua visível.
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element)
    return rect.width > 2 && rect.height > 2 && style.visibility !== 'hidden' && style.display !== 'none' && element.textContent.replace(/\s+/g, ' ').trim().length > 180
  }).map(element => element.textContent.replace(/\s+/g, ' ').trim()))
  assert.deepEqual(explanations, [], `${label}: explicações extensas ficam nas ajudas`)
}

// Padrão de 18/11/2026: resultado ao lado dos dados a partir de 1200px; abaixo deles nas telas menores.
async function assertResultBeside(page, section, inputs, results) {
  await page.evaluate(() => window.scrollTo(0, 0))
  const box = await section.locator(inputs).boundingBox(), result = await section.locator(results).boundingBox()
  const details = JSON.stringify({ box, result })
  if (page.viewportSize().width >= 1200) assert.ok(result.x >= box.x + box.width && Math.abs(result.y - box.y) <= 2, 'resultado ao lado dos dados ' + details)
  else assert.ok(result.y >= box.y + box.height - 1, 'resultado abaixo dos dados ' + details)
}

async function assertHelp(page, section, label, directory) {
  const help = section.getByRole('button', { name: /^Ajuda: / }).first()
  assert.ok(await help.count(), `${label}: ajuda disponível`)
  // Tira o ponteiro de onde o último clique o deixou e espera a prévia anterior fechar (160 ms): se ele já estiver
  // sobre a ajuda, o hover não dispara a prévia.
  await page.mouse.move(0, 0); await page.waitForTimeout(300)
  await help.hover()
  const tooltip = page.getByRole('tooltip')
  await tooltip.waitFor()
  const title = (await help.getAttribute('aria-label')).replace(/^Ajuda: /, '')
  assert.ok((await tooltip.innerText()).includes(title), `${label}: preview pertence à ajuda acionada`)
  const box = await tooltip.boundingBox(), viewport = page.viewportSize()
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${label}: tooltip cabe na tela`)
  await page.screenshot({ path: path.join(directory, `${label}-tooltip.png`) })
  await page.keyboard.press('Escape'); await tooltip.waitFor({ state: 'hidden' })
  assert.equal(await help.getAttribute('aria-expanded'), 'false')
  await help.click()
  const dialog = page.getByRole('dialog', { name: title, exact: true })
  await dialog.waitFor()
  assert.equal(await dialog.evaluate(element => element.matches(':modal')), true, `${label}: clique abre ajuda modal`)
  assert.equal(await dialog.evaluate(element => element === document.activeElement || element.contains(document.activeElement)), true, `${label}: ajuda recebe o foco`)
  // Native showModal makes the page inert without adding an inert attribute.
  // Prove that even a direct focus request cannot reach the background.
  assert.equal(await section.locator('.calc-back').first().evaluate(element => { element.focus(); return element === document.activeElement }), false, `${label}: fundo modal recusa foco`)
  for (const key of ['Tab', 'Tab', 'Shift+Tab']) {
    await page.keyboard.press(key)
    const focus = await dialog.evaluate(element => ({ inside: element === document.activeElement || element.contains(document.activeElement), body: document.activeElement === document.body, modal: element.matches(':modal') }))
    assert.equal(focus.modal, true, `${label}: ajuda permanece modal`)
    assert.ok(focus.inside || focus.body, `${label}: Tab não alcança um controle do fundo`)
    assert.equal(await section.locator(':focus').count(), 0, `${label}: nenhum controle de fundo está focado`)
    // Chromium exposes body while focus passes through browser chrome.
    // The following Tab must return to this dialog, never to the form.
    if (focus.body) {
      await page.keyboard.press('Tab')
      assert.equal(await dialog.evaluate(element => element === document.activeElement || element.contains(document.activeElement)), true, `${label}: Tab seguinte retorna à ajuda`)
    }
  }
  await page.screenshot({ path: path.join(directory, `${label}-help.png`) })
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
  assert.equal(await help.evaluate(element => element === document.activeElement), true, `${label}: Escape retorna ao ?`)
  assert.equal(await help.getAttribute('aria-expanded'), 'false')
  await page.keyboard.press('Tab')
  await page.mouse.move(0, 0)
}

async function fillScenario(page, section, route) {
  if (route === 'giro') {
    // Linha mestra comum (19/11/2026): o caso de referência é digitado nela (R$ 100.000,00 em 12 meses, sem carência).
    await section.locator('#cx-value').fill('100.000,00'); await section.locator('#cx-term').fill('12'); await section.locator('#cx-grace').fill('0')
    await section.getByLabel('Amortização', { exact: true }).selectOption('price')
    await section.locator('.lm-details > summary').click() // data e 1º vencimento ficam na gaveta "Detalhes do contrato" (21/11/2026)
    await section.locator('#cx-start').fill('2026-11-06')
    await section.locator('#cx-firstDue').fill('2026-12-06')
    const simulate = () => section.getByRole('button', { name: 'Simular', exact: true }).click()
    const amount = async label => normalize(await section.locator('dl > div').filter({ has: page.getByText(label, { exact: true }) }).locator('dd').first().innerText())
    await simulate()
    assert.equal(await amount('Quanto paga por mês'), brl(giroOracle('price').first))
    assert.equal(await amount('Custo total'), brl(giroOracle('price').total - 100000))
    await section.getByLabel('Amortização', { exact: true }).selectOption('sac')
    await simulate()
    assert.equal(await amount('Custo total'), brl(giroOracle('sac').total - 100000))
    const form = await section.locator('.giro-form').boundingBox()
    const result = await section.locator('.giro-result').boundingBox()
    const installments = await section.getByText('Ver parcelas', { exact: true }).boundingBox()
    assert.ok(installments.y >= Math.max(form.y + form.height, result.y + result.height), 'parcelas abaixo do formulário e resultado')
    // Roteiro de 21/11/2026 (substitui o resultado fixo ao lado, de 18/11/2026): a tela conta a operação de cima para baixo,
    // em toda largura. Dados, depois o resultado, na largura do formulário (a linha do tempo saiu nos ajustes de 21/11/2026).
    assert.equal(await section.locator('.rt-timeline').count(), 0, 'sem linha do tempo')
    assert.ok(result.y >= form.y + form.height, 'dados e resultado nesta ordem')
    assert.ok(Math.abs(result.width - form.width) < 2, 'resultado na largura toda')
    // O envelope de e-mail fica no cabeçalho do resultado, dentro do quadro.
    const envelope = await section.getByRole('link', { name: 'Preparar e-mail com o resultado' }).boundingBox()
    assert.ok(envelope.x >= result.x && envelope.x + envelope.width <= result.x + result.width && envelope.y >= result.y && envelope.y + envelope.height <= result.y + 60, 'envelope no cabeçalho do resultado')
    // O envelope precisa aparecer (22/11/2026: saiu branco no fundo claro). Contraste mínimo de 3:1 entre o ícone e o que está
    // debaixo dele na tela (o quadro do resultado é irmão do envelope, não pai).
    const contraste = await section.evaluate(el => {
      const a = el.querySelector('a.giro-email'), r = a.getBoundingClientRect()
      const fundo = document.elementsFromPoint(r.x + r.width / 2, r.y + r.height / 2).filter(n => !a.contains(n))
        .map(n => getComputedStyle(n).backgroundColor).find(c => !/rgba\(.*, 0\)$/.test(c))
      const lum = c => { const [rr, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * rr + 0.7152 * g + 0.0722 * b }
      const [l1, l2] = [lum(getComputedStyle(a).color), lum(fundo)].sort((x, y) => y - x)
      return (l1 + 0.05) / (l2 + 0.05)
    })
    assert.ok(contraste >= 3, `envelope visível: contraste ${contraste.toFixed(2)} (mínimo 3)`)
    if (page.viewportSize().width >= 1200) {
      const [demanda, encargos] = [await section.locator('.giro-form .lm').boundingBox(), await section.locator('.giro-form .giro-card').boundingBox()]
      assert.ok(encargos.x >= demanda.x + demanda.width && Math.abs(encargos.y - demanda.y) < 2, 'demanda e encargos lado a lado no computador largo')
    }
  } else if (route === 'conta-garantida') {
    assert.equal(await section.locator('#cg-status, #cg-rateBase, #cg-conversion').count(), 0)
    assert.equal(await section.getByText('Situação da operação', { exact: true }).count(), 0)
    // Abre sem vermelho; o erro de um campo só aparece depois de a pessoa passar por ele e sair.
    assert.equal(await section.locator('[aria-invalid=true], [role=alert]').count(), 0, 'abre sem campo em erro')
    assert.equal(await section.getByText('Preencha valor, taxa e prazo para ver o resultado.', { exact: true }).count(), 1)
    await page.locator('#cg-rate').focus(); await page.locator('#cg-rate').blur()
    assert.equal(await page.locator('#cg-rate').getAttribute('aria-invalid'), 'true', 'erro aparece ao sair do campo vazio')
    assert.equal(await page.locator('#cg-value').getAttribute('aria-invalid'), 'false', 'campo ainda não visitado segue sem erro')
    assert.equal(await section.getByText('Preencha ou corrija os campos sinalizados', { exact: false }).count(), 1)
    await section.getByLabel('Taxa de juros (% a.m.)', { exact: true }).fill('3') // nome padrão dos encargos no roteiro (21/11/2026)
    await page.locator('#cg-start').fill('2026-11-05')
    await page.locator('#cg-duration').fill('10')
    await page.locator('#cg-value').fill('100000')
    assert.ok(await page.locator('#cg-taxProfile').count(), 'enquadramento do IOF preservado')
    // Roteiro de 21/11/2026 (utilização única): respostas e "Do que é feito o custo", terminando no custo total.
    const shown = label => section.locator('dl > div').filter({ has: page.getByText(label, { exact: true }) }).locator('dd').first()
    const kpi = shown('Custo total')
    assert.match(await kpi.innerText(), /^R\$\s*1\.462,00$/)
    assert.match(await shown('Juros').innerText(), /^R\$\s*1\.000,00$/, '3% mensal proporcional a 10 dias')
    // CET do art. 6º (Res. CMN 4.881/2020): sem limite, só o pedido; com limite, 30 dias sobre o limite em dias corridos/365.
    assert.equal(await section.getByText('Sem CET: informe o limite contratado', { exact: false }).count(), 1)
    assert.equal(await page.locator('#cg-limit').inputValue(), '', 'limite começa vazio')
    await page.locator('#cg-limit').fill('100000')
    // O CET aparece uma vez à vista, na resposta da taxa; as equivalências ficam na gaveta "Como calculamos o CET".
    await section.locator('.cg-more > summary').click()
    const cetKpi = section.locator('.cg-equiv > div', { has: page.locator('span', { hasText: /^CET \(art\. 6º · 30 dias sobre o limite\)$/ }) })
    const cetAnnual = Math.pow((100000 + 3000 + 100000 * 0.000082 * 30) / (100000 - 380), 365 / 30) - 1 // IOF adicional na liberação
    const pct2 = n => (n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    assert.equal(normalize(await cetKpi.locator('b').innerText()), `${pct2(cetAnnual)}% a.a.`)
    assert.equal(normalize(await shown('Qual é a taxa efetiva').innerText()), `${pct2(cetAnnual)}% a.a.`)
    assert.match(await kpi.innerText(), /^R\$\s*1\.462,00$/, 'limite não muda o custo do período')
    // Tela limpa (21/11/2026): a regra do art. 6º fica no "?" de "Como calculamos o CET".
    await section.getByRole('button', { name: 'Ajuda: Como calculamos o CET', exact: true }).click()
    await page.getByRole('dialog').getByText('texto oficial conferido em 11/11/2026', { exact: false }).waitFor()
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' })
    // Resposta principal = custo total; "Quanto paga para cobrir" = valor utilizado + custo total.
    assert.match(normalize(await section.locator('.rt-answer-main dd').first().innerText()), /^R\$\s*1\.462,00$/)
    assert.match(normalize(await shown('Quanto paga para cobrir').innerText()), /^R\$\s*101\.462,00$/)
    // Roteiro de 21/11/2026 (substitui, na utilização única, o resultado ao lado de 18/11/2026): dados e resultado de cima
    // para baixo, na largura toda (a linha do tempo saiu no mesmo dia); demanda e encargos lado a lado só no computador largo.
    await page.evaluate(() => window.scrollTo(0, 0))
    assert.equal(await section.locator('.rt-timeline').count(), 0, 'sem linha do tempo')
    const [inputs, result] = [await section.locator('.cg-inputs').boundingBox(), await section.locator('.rt-result').boundingBox()]
    assert.ok(result.y >= inputs.y + inputs.height, 'dados e resultado nesta ordem')
    assert.ok(Math.abs(result.width - inputs.width) < 2, 'resultado na largura toda')
    const [demanda, encargos] = [await section.locator('.cg-inputs > .lm').boundingBox(), await section.locator('.cg-inputs > .cx-panel').boundingBox()]
    if (page.viewportSize().width >= 1200) assert.ok(encargos.x >= demanda.x + demanda.width && Math.abs(encargos.y - demanda.y) < 2, 'demanda e encargos lado a lado no computador largo')
    else assert.ok(encargos.y >= demanda.y + demanda.height, 'encargos abaixo da demanda')
    // Lançamentos por dia segue como era: resultado ao lado dos dados a partir de 1200px, abaixo antes disso.
    await section.getByRole('button', { name: 'Lançamentos por dia', exact: true }).click()
    assert.equal(await section.locator('.rt-timeline, .rt-result').count(), 0, 'roteiro só na utilização única')
    assert.equal(await section.getByLabel('Taxa do contrato (% a.m.)', { exact: true }).count(), 1)
    await assertResultBeside(page, section, '.cg-inputs', '.cg-result-col')
    await section.getByRole('button', { name: 'Utilização única', exact: true }).click()
  } else if (route === 'analise-desconto') {
    await page.locator('#ad-titleFeeMode').selectOption('total')
    assert.equal(await page.locator('#ad-iofAdditional, #ad-iofPaid, #ad-interest').count(), 0)
    await page.locator('#ad-lm-start').fill('2026-11-05')
    await section.getByLabel('Vencimento contratual', { exact: true }).fill('2026-12-05')
    // The nested MoneyInput adds the currency prefix to the label's text.
    const nominal = section.getByLabel(/^Valor nominal total do grupo/)
    assert.equal(await nominal.count(), 1, 'um grupo de títulos no cenário fixo')
    await nominal.fill('225.600,43')
    assert.equal(await nominal.inputValue(), '225.600,43')
    await page.locator('#ad-operationRate').fill('1,83')
    await section.locator('details.dsc-drawer > summary').click() // o enquadramento fica na gaveta "Enquadramento do IOF" (21/11/2026)
    await page.locator('#ad-taxProfile').selectOption('pj')
    await page.locator('#ad-convention').selectOption('commercial30')
    await page.locator('#ad-titleFeeTotal').fill('564,00')
    await page.locator('#ad-tac').fill('260,00')
    await page.locator('#ad-averageValue').fill('225.600,43')
    await page.locator('#ad-discountRate').fill('1,75')
    await page.locator('#ad-operations').fill('6')
    // Regra de 11/11/2026: 05/12/2026 é sábado, pago em 07/12 (32 dias corridos). Desconto comercial; IOF sobre nominal menos juros.
    const gross = 225600.43, days = 32, interest = gross * 0.0183 * days / 30
    const cost = interest + (gross - interest) * (0.0038 + days * 0.000082) + 564 + 260
    // Roteiro de 21/11/2026: custo, líquido e CET do desconto ficam no bloco "4 Resultado" (antes, nos quadrinhos do formulário).
    const kpis = section.locator('.rt-result')
    assert.ok(normalize(await kpis.innerText()).includes(brl(cost)))
    assert.ok(normalize(await kpis.innerText()).includes(brl(gross - cost)))
    // CET pelo art. 6º da Res. CMN 4.881 (texto oficial): 30 dias sobre o nominal; o prazo real (32 dias) aparece à parte.
    const pct = value => `${(value * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`
    const cet30 = (rate, fees) => { const i = gross * rate; const net = gross - i - (gross - i) * (0.0038 + 30 * 0.000082) - fees; return (gross / net) ** (365 / 30) - 1 }
    assert.ok(normalize(await kpis.innerText()).includes(pct(cet30(0.0183, 824))), 'CET do desconto (art. 6º)')
    assert.ok(normalize(await kpis.innerText()).includes(`prazo real: ${pct((gross / (gross - cost)) ** (365 / days) - 1)}`), 'custo pelo prazo real')
    assert.match(await section.locator('.desconto-paydate').innerText(), /07\/12\/2026/)
    const monthlyInterest = gross * 0.0175 * days / 30
    const monthlyNet = gross - monthlyInterest - (gross - monthlyInterest) * (0.0038 + days * 0.000082) - 564 - 260
    const monthlyCost = 6 * (gross - monthlyNet)
    // Padrão de 18/11/2026: as tabelas completas ficam recolhidas abaixo do resultado; a pessoa abre para conferir.
    assert.equal(await section.locator('details.dsc-tables').evaluate(element => element.open), false, 'tabelas começam recolhidas')
    await section.locator('details.dsc-tables > summary').click()
    const row = section.locator('.desconto-summary-panel tbody tr', { has: page.getByRole('rowheader', { name: 'Custo total do desconto', exact: true }) })
    assert.equal(normalize(await row.locator('td').first().innerText()), brl(monthlyCost))
    assert.equal(normalize(await row.locator('td').nth(1).innerText()), brl(monthlyCost * 12))
    const cetRow = section.locator('.desconto-comparison-panel tbody tr', { has: page.getByRole('rowheader', { name: 'CET do desconto', exact: true }) })
    assert.equal(normalize(await cetRow.locator('td').first().innerText()), pct(cet30(0.0175, 824))) // art. 6º: 30 dias; monthlyNet é do prazo real
    const giroCet = section.locator('.desconto-comparison-panel tbody tr', { has: page.getByRole('rowheader', { name: 'CET do giro', exact: true }) })
    assert.equal(await giroCet.locator('td').count(), 5)
    for (const cell of await giroCet.locator('td').allInnerTexts()) assert.match(normalize(cell), /^\d+,\d{2}% a\.a\.$/)
    assert.doesNotMatch(await section.innerText(), /[Nn]ão é CET/)
    // Padrão de 18/11/2026: a resposta principal repete a economia de 12 meses da tabela, com direção em palavras e símbolo.
    const savingsRow = section.locator('.desconto-comparison-panel tbody tr', { has: page.getByRole('rowheader', { name: 'Economia estimada com giro', exact: true }) })
    const savings12 = normalize(await savingsRow.locator('td').nth(1).innerText())
    const answer = normalize(await section.locator('.dsc-answer-main').innerText())
    assert.ok(answer.includes(savings12), `resposta principal traz a economia de 12 meses (${savings12})`)
    assert.match(answer, savings12.startsWith('-') ? /▼.*O giro custa mais/ : /▲.*O giro custa menos/)
    // Roteiro de 21/11/2026 (substitui o resultado fixo ao lado, de 18/11/2026): a tela conta a operação de cima para baixo.
    // Dados e resultado do desconto (a linha do tempo saiu em 21/11/2026); só depois, a comparação com o giro, com a resposta abaixo das premissas.
    await page.evaluate(() => window.scrollTo(0, 0))
    const box = async selector => section.locator(selector).boundingBox()
    assert.equal(await section.locator('.rt-timeline').count(), 0, 'sem linha do tempo')
    const [form, outcome, compare, premises, answerBox] = [await box('.dsc-form'), await box('.rt-result'), await box('.dsc-compare-head'), await box('.dsc-inputs'), await box('.dsc-result-col')]
    assert.ok(outcome.y >= form.y + form.height, 'dados e resultado nesta ordem')
    assert.ok(Math.abs(outcome.width - form.width) < 2, 'resultado na largura toda')
    assert.ok(compare.y >= outcome.y + outcome.height && premises.y >= compare.y + compare.height && answerBox.y >= premises.y + premises.height, 'comparação com o giro depois do resultado do desconto')
    if (page.viewportSize().width >= 1200) {
      const [demanda, encargos] = [await box('.dsc-form > .lm'), await box('.dsc-form > .cx-panel')]
      assert.ok(encargos.x >= demanda.x + demanda.width && Math.abs(encargos.y - demanda.y) < 2, 'demanda e encargos lado a lado no computador largo')
    }
  } else if (route === 'finimp') {
    // Roteiro (21/11/2026): a tabela dos doze prazos fica recolhida depois do resultado.
    await section.locator('details.fi-table-drawer > summary').click()
    for (const [id, value] of [['fi-principal', '100000'], ['fi-a-rate', '6'], ['fi-a-flat', '1'], ['fi-b-rate', '8'], ['fi-b-flat', '0,5']]) await page.locator(`#${id}`).fill(value)
    const row = section.locator('tbody tr').nth(5)
    assert.match(await row.locator('.fi-cost').first().innerText(), /4\.000,00/)
    await section.getByRole('checkbox', { name: 'Incluir TAC à vista' }).check()
    await page.locator('#fi-a-tac').fill('1000'); await page.locator('#fi-b-tac').fill('1500')
    await page.locator('#fi-tac-fx').fill('5')
    assert.match(await row.locator('.fi-cost').first().innerText(), /4\.200,00/)
    assert.match(await row.locator('td').nth(2).innerText(), /^R\$\s*1\.000,00$/)
  } else if (route === 'bndes-selic-lcd') {
    for (const [id, value] of [['principal', '100000'], ['contract', '2026-11-04'], ['release', '2026-11-05'], ['selic', '14'], ['ld1', '0,5'], ['fixing', '2026-11-04'], ['source', 'Contrato de teste QA'], ['bndes', '1'], ['intermediation', '0'], ['agent', '2'], ['schedule', '2026-12-07; 21; C\n2027-01-05; 20; A\n2027-02-05; 23; A'], ['schedule-source', 'Cronograma sintético QA, vencimentos úteis ajustados']]) await page.locator(`#lcd-${id}`).fill(value)
    for (const checkbox of await section.getByRole('checkbox').all()) await checkbox.check()
    try { await section.locator('.lcd-table').waitFor({ timeout: 5000 }) } catch (error) {
      throw new Error(`Cenário LCD não calculou: ${(await section.locator('[role=status], [role=alert]').allInnerTexts()).map(normalize).join(' | ')}`, { cause: error })
    }
    assert.equal(await section.locator('.lcd-table tbody tr').count(), 3)
    assert.match(await section.locator('.lcd-table tbody tr').last().locator('td').last().innerText(), /^R\$\s*0,00$/)
    // CET pela Res. CMN 4.881 (sem Selic) e custo com a Selic do cenário, ambos visíveis sem abrir ajuda.
    // IOF padrão PJ geral (zero só com enquadramento confirmado, Decreto 6.306/2007, art. 8º): 0,38% × R$ 100 mil = R$ 380,00
    // + 0,0082% ao dia × R$ 50 mil × (61 + 92) dias = R$ 627,30, cobrados na liberação.
    assert.equal(await section.locator('#lcd-iof').inputValue(), 'pj')
    const cet = normalize(await section.locator('.lcd-cet').innerText())
    assert.match(cet, /IOF na liberação[\s?]*R\$\s*1\.007,30 R\$\s*380,00 adicional \+ R\$\s*627,30 diário/i)
    assert.match(cet, /CET · parte fixa \(regra do BC\)[\s?]*8,61% a\.a\. LD1 \+ remunerações, sem Selic · líquido R\$\s*98\.992,70/i)
    assert.match(cet, /Custo com Selic projetada[\s?]*23,72% a\.a\./i)
  } else if (route === 'finame-materiais') {
    await section.locator('.fm-destaques').waitFor()
    assert.equal(await section.locator('#fm-finame-eligible, #fm-sis, #fm-comp, #fm-lib, #fm-fgi-inc').count(), 0)
    const eligibilityWarning = section.locator('.fm-iof-premise')
    assert.equal(await eligibilityWarning.isVisible(), true, 'aviso tributário obrigatório permanece visível')
    assert.match(await eligibilityWarning.innerText(), /FINAME|Finame/)
    assert.equal(await section.locator('.fm-destaques tbody tr:not(.fm-grp)').count(), 10, 'números principais à vista, sem abrir a composição: taxas, CET e valores em reais até o custo total')
    assert.equal(await section.locator('.fm-hero').count(), 0, 'sem comparação não há faixa vazia')
    await section.locator('.fm-details > summary').click()
    await section.locator('.fm-grade').waitFor()
    await section.locator('summary').filter({ hasText: /^Cronograma ilustrativo ·/ }).click()
    assert.equal(await section.locator('.fm-tabela tbody tr:not(.fm-liberacao)').count(), 48) // prazo padrão de 48 meses (18/11/2026)
    assert.match(await section.locator('.fm-tabela tbody tr').last().locator('td').last().innerText(), /^R\$\s*0,00$/)
  }
}

const workspaceRoutes = {
  '': '.cx-tile',
  'comparador-credito': '#credit-shared-value',
  'operacao-di': '#od-value',
  'emprestimo-4131': '#e4-valor',
  'cbs-caixa': '#cbs-revenue',
  'finame-materiais': '#fm-valor',
  'bndes-credito-tfb': '#tfb-heading',
  'bndes-tlp-exigivel': '#tlp-heading',
  'bndes-selic-lcd': '#lcd-heading, #lcd-title',
  'conta-garantida': '#cg-rate',
  'finimp': '#fi-currency',
  'giro': '#cx-value',
  'analise-desconto': '#ad-lm-start',
}

// Prova do catálogo agrupado nos dois temas, usando o mesmo artifact das calculadoras.
async function assertGroupedCatalog(browser, report, failures) {
  const expected = [
    ['Crédito e capital de giro', ['BNDES', 'Necessidade do Cliente', 'Capital de Giro', 'Conta Garantida', 'Análise de desconto']],
    ['Crédito internacional', ['FINIMP', 'Empréstimo externo (4131)', 'Câmbio futuro']],
    ['Taxas e câmbio', ['Operação x DI', 'CDI x Dólar']],
    ['Planejamento e análise', ['Faturamento', 'Dividendos via empréstimo', 'Reforma tributária · caixa']],
  ]
  for (const width of widths) for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width, height: 950 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' })
    const label = `catálogo agrupado ${width}px ${theme}`
    const screenshot = path.join(out, `catalogo-grupos-${width}-${theme}.png`)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await fixtures(page)
      await page.goto(base + '/#calculadora')
      const catalog = page.locator('.calc-catalog')
      await catalog.locator('.calc-catalog-group').first().waitFor()
      await settleLayout(page)
      const state = await catalog.evaluate(element => {
        const rect = element.getBoundingClientRect()
        return {
          theme: document.documentElement.dataset.theme,
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
          left: rect.left, right: rect.right,
          groups: [...element.querySelectorAll('.calc-catalog-group')].map(group => {
            const heading = group.querySelector('h3')
            return {
              title: heading.textContent.trim(),
              labelled: group.getAttribute('aria-labelledby') === heading.id,
              headingBottom: heading.getBoundingClientRect().bottom,
              cards: [...group.querySelectorAll('.cx-tile')].map(button => {
                const r = button.getBoundingClientRect()
                return { title: button.querySelector('b').textContent.trim(), left:r.left, right:r.right, top:r.top, width:r.width, height:r.height,
                  clipped: button.scrollWidth > button.clientWidth + 1 }
              }),
            }
          }),
        }
      })
      assert.equal(state.theme, theme, label + ': tema aplicado')
      assert.deepEqual(state.groups.map(g => [g.title, g.cards.map(c => c.title)]), expected, label + ': itens, ordem e agrupamentos completos')
      assert.ok(state.document <= state.viewport + 1 && state.left >= -1 && state.right <= state.viewport + 1, label + ': catálogo sem corte horizontal')
      for (const group of state.groups) {
        assert.ok(group.labelled, label + ': título acessível')
        for (const card of group.cards) {
          assert.ok(card.left >= state.left - 1 && card.right <= state.right + 1 && !card.clipped, label + ': cartão legível ' + card.title)
          assert.ok(card.width >= 44 && card.height >= 44, label + ': alvo de toque ' + card.title)
          assert.ok(card.top >= group.headingBottom, label + ': título antes dos cartões')
        }
        if (width === 320 || width === 390) {
          assert.equal(new Set(group.cards.map(c => Math.round(c.left))).size, 1, label + ': coluna única no celular')
        }
      }
      assert.equal(await catalog.getByRole('link', { name: 'Taxas BNDES · consultar séries e históricos', exact:true }).getAttribute('href'), '#bndes')
      await catalog.getByRole('button', { name:'BNDES: abrir calculadora', exact:true }).focus()
      assert.equal(await catalog.getByRole('button', { name:'BNDES: abrir calculadora', exact:true }).evaluate(el => el === document.activeElement), true, label + ': foco por teclado')
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path:screenshot, fullPage:true })
      assert.deepEqual(errors, [], label + ': sem erros do navegador')
      report.push({ route:'catalogo-grupos', width, theme, status:'pass', screenshot:path.basename(screenshot) })
    } catch (error) {
      await page.screenshot({ path:screenshot, fullPage:true }).catch(() => {})
      report.push({ route:'catalogo-grupos', width, theme, status:'fail', message:error.message })
      failures.push(label + ': ' + error.message)
    } finally { await page.close() }
  }
}

async function assertComparatorFamily(browser) {
  for (const width of [390, 820, 1440]) for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width, height: 950 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' })
    try {
      await fixtures(page)
      await page.goto(base + '/#resumo')
      if (width < 1000) {
        await page.getByRole('navigation', { name: 'Seções', exact: true }).getByRole('button', { name: 'Calculadoras', exact: true }).click()
      } else {
        const navigationRows = await page.locator('.topbar-tabs > button, .topbar-tabs > .more-tab > button').evaluateAll(buttons =>
          new Set(buttons.map(button => Math.round(button.getBoundingClientRect().top))).size
        )
        assert.equal(navigationRows, 1, 'navegação do desktop mantém as seis abas e Mais na mesma linha a 1440px')
        await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: 'Calculadoras', exact: true }).click()
      }
      await page.locator(workspaceRoutes['']).first().waitFor()
      for (const [route, anchor] of Object.entries(workspaceRoutes)) {
        if (route) await page.goto(base + '/#calculadora/' + route)
        await page.locator(anchor).first().waitFor()
        if (route === 'giro') {
          const giro = page.locator('.giro-screen')
          // Desde 19/11/2026 o Capital de Giro usa a moldura e as cores das outras calculadoras, nos dois temas.
          assert.equal(await giro.evaluate(element => element.classList.contains('bw')), true, 'Capital de Giro na moldura padrão')
          await assertWorkspace(page, giro, `Capital de Giro · ${width}px · ${theme}`)
          if (width === 390 || width === 1440) await page.screenshot({ path: path.join(out, `giro-${width}-${theme}.png`), fullPage: true })
          continue
        }
        const heading = page.locator('main.app-calculators .bw > .bw-heading h2').first()
        await heading.waitFor()
        const style = await heading.evaluate(element => {
          const workspace = element.closest('.bw')
          const css = getComputedStyle(workspace)
          const sample = document.createElement('span')
          sample.hidden = true
          sample.style.backgroundColor = 'var(--bw-soft)'
          workspace.append(sample)
          const surfaceColor = getComputedStyle(sample).backgroundColor
          sample.remove()
          return {
            border:css.borderTopWidth,
            surfaceColor,
            background:css.backgroundColor,
            theme:document.documentElement.dataset.theme,
            width:workspace.getBoundingClientRect().width,
            viewport:document.documentElement.clientWidth,
            document:document.documentElement.scrollWidth,
            headingWidth:element.getBoundingClientRect().width,
          }
        })
        const description = `${route || 'catálogo'} · ${width}px · ${theme}`
        assert.equal(style.theme, theme, description + ': tema aplicado')
        assert.equal(style.border, '1px', description + ': moldura compartilhada')
        assert.notEqual(style.surfaceColor, 'rgba(0, 0, 0, 0)', description + ': cor da superfície definida')
        assert.equal(style.background, style.surfaceColor, description + ': fundo renderizado usa a superfície do Comparador')
        assert.ok(style.document <= style.viewport + 1 && style.headingWidth <= style.width, description + ': conteúdo contido na tela')
        if (route === 'comparador-credito') {
          const overlaps = await page.locator('#credit-shared-value').evaluate(input => {
            const prefix = input.parentElement.querySelector('i')
            return prefix.getBoundingClientRect().right + 4 > input.getBoundingClientRect().left + parseFloat(getComputedStyle(input).paddingLeft)
          })
          assert.equal(overlaps, false, description + ': prefixo monetário separado do valor')
        }
        if ((width === 390 && theme === 'dark') || (width === 1440 && theme === 'light')) {
          await page.screenshot({ path:path.join(out, `família-${route || 'catalogo'}-${width}-${theme}.png`) })
        }
        if (width === 390 && route === 'emprestimo-4131') {
          const geometry = await page.locator('#e4-convertido').evaluate(converted => ({
            principal:converted.closest('.fm-group-fields').querySelector('#e4-valor').getBoundingClientRect().width,
            converted:converted.getBoundingClientRect().width,
          }))
          assert.ok(geometry.converted >= 240 && Math.abs(geometry.converted - geometry.principal) <= 2,
            `${description} ${JSON.stringify(geometry)}: valor convertido usa a linha inteira no celular`)
        }
        if (width === 1440 && route === 'emprestimo-4131') {
          // Roteiro de 21/11/2026: demanda e encargos lado a lado; resultado e atingir meta abaixo, na largura toda (sem linha do tempo).
          const geometry = await page.locator('.e4 .fm-input-panel > .cx-form').evaluate(form => {
            const screen = form.closest('.e4')
            const box = selector => screen.querySelector(selector).getBoundingClientRect()
            const [operation, charges, result, meta] = ['.fm-operation', '.e4-encargos', '#fm-result', '.e4-meta'].map(box)
            return {
              available:form.clientWidth,
              used:charges.right - operation.left,
              topGap:Math.abs(charges.top - operation.top),
              operation:operation.width, charges:charges.width, result:result.width, meta:meta.width,
              inOrder:result.top >= Math.max(operation.bottom, charges.bottom) && meta.top >= result.bottom,
              select:box('#e4-meta-kind').width,
              value:box('#e4-meta').width,
            }
          })
          const details = `${description} ${JSON.stringify(geometry)}`
          assert.ok(geometry.topGap <= 1 && Math.abs(geometry.used - geometry.available) <= 2 && Math.abs(geometry.operation - geometry.charges) <= 2, details + ': demanda e encargos lado a lado, na largura útil')
          for (const block of ['result', 'meta']) {
            assert.ok(Math.abs(geometry[block] - geometry.available) <= 2, details + ': ' + block + ' ocupa a largura útil')
          }
          assert.ok(geometry.inOrder, details + ': resultado e atingir meta abaixo dos dados, nesta ordem')
          assert.ok(geometry.select >= 160 && geometry.value >= 120, details + ': campos da meta têm largura de leitura')
        }
        if (width === 1440 && route === 'finame-materiais') {
          const geometry = await page.locator('.cx-finame .fm-input-panel > .cx-form').evaluate(form => {
            const { paddingLeft, paddingRight } = getComputedStyle(form)
            const operation = form.querySelector('.fm-operation').getBoundingClientRect()
            const costs = form.querySelector('.fm-costs').getBoundingClientRect()
            const results = form.closest('.fm-workspace').querySelector('.fm-results').getBoundingClientRect()
            return {
              available:form.clientWidth - parseFloat(paddingLeft) - parseFloat(paddingRight),
              used:costs.right - operation.left,
              topGap:Math.abs(costs.top - operation.top),
              formBottom:form.getBoundingClientRect().bottom,
              formLeft:form.getBoundingClientRect().left,
              resultWidth:results.width,
              resultsTop:results.top,
              resultsLeft:results.left,
            }
          })
          const details = `${description} ${JSON.stringify(geometry)}`
          assert.ok(Math.abs(geometry.used - geometry.available) <= 2 && geometry.topGap <= 2, details + ': Operação e Custos preenchem a mesma linha')
          assert.ok(geometry.resultsTop >= geometry.formBottom - 1 && Math.abs(geometry.resultsLeft - geometry.formLeft) <= 2 && Math.abs(geometry.resultWidth - geometry.available) <= 2, details + ': cotação abaixo e em largura total')
        }
      }
      console.log(`PASS família visual do Comparador · ${width}px · ${theme}`)
    } finally {
      await page.close()
    }
  }
}

async function assertCambioFuturoCenario(browser) {
  const now = Date.parse('2026-11-20T15:00:00Z')
  const t = iso => Date.parse(iso + 'T19:00:00Z')
  const normalizeMoney = value => value.replace(/\s/g, '')
  for (const width of [320, 1440]) for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width, height: 950 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('dialog', dialog => dialog.accept())
    try {
      await fixtures(page)
      const holidaySpot = theme === 'dark'
      // Exerce as duas condições: CNH offshore aceito e CNY onshore rejeitado.
      const cnhSource = theme === 'dark' ? 'CNH' : 'CNY'
      await page.route('**/quotes.json*', route => route.fulfill({ json: { source: 'AwesomeAPI', generatedAt: now, quotes: {
        USDBRL: { bid: 5.71, ask: 5.72, high: 5.75, low: 5.65, timestamp: Date.parse(holidaySpot ? '2026-11-20T14:55:00Z' : '2026-11-19T21:04:00Z') / 1000, pctChange: 0 },
        EURBRL: { bid: 6.55, ask: 6.56, high: 6.60, low: 6.50, timestamp: Date.parse('2026-11-19T21:04:00Z') / 1000, pctChange: 0 },
      } } }))
      await page.route('**/intraday.json*', route => route.fulfill({ json: { source: 'AwesomeAPI (coleta central a cada 5 min)', generatedAt: now - 60000, resolution: '5 min', series: {
        USD: { points: [[Date.parse('2026-11-19T21:08:00Z'), 5.7051], [Date.parse('2026-11-20T14:55:00Z'), 5.71]] },
      } } }))
      await page.route('**/history.json*', route => route.fulfill({ json: { source: 'AwesomeAPI', generatedAt: now - 60000, series: {
        USD: { source: 'USD', points: [{ t: t('2026-08-25'), bid: 5.60 }, { t: t('2026-11-12'), bid: 5.70 }, { t: t('2026-11-19'), bid: 5.71 }] },
        EUR: { source: 'EUR', points: [{ t: t('2026-08-25'), bid: 6.42 }, { t: t('2026-11-12'), bid: 6.65 }, { t: t('2026-11-19'), bid: 6.55 }] },
        CNH: { source: cnhSource, points: [{ t: t('2026-11-12'), bid: .85 }, { t: t('2026-11-19'), bid: .86 }] },
      } } }))
      await page.clock.setFixedTime(new Date(now))
      if (width === 1440) {
        await page.goto(`${base}/#resumo`)
        const tape = page.getByRole('region', { name: 'Cotações e juros de referência', exact: true })
        for (const code of ['USD', 'EUR']) {
          const flag = tape.locator('.tape-set:not([aria-hidden]) .tape-fx-label').filter({ hasText: code + '/BRL' }).locator('.flag')
          await flag.waitFor({ state: 'visible' })
          assert.equal(await flag.getAttribute('aria-hidden'), 'true')
          assert.equal(await flag.locator('svg').count(), 1)
        }
        assert.equal(await tape.locator('.tape-set:not([aria-hidden]) .tape-fx-label').count(), 2)
      }
      await page.goto(`${base}/#calculadora/cambio-futuro`)
      const section = page.locator('section.cf-cenario')
      await section.getByRole('heading', { name: 'Câmbio futuro', exact: true }).waitFor()
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
      assert.equal(await section.locator('#cf-c-inicio').inputValue(), '2026-11-20')
      assert.equal(await section.locator('#cf-c-p1-cenario').inputValue(), '')
      assert.equal(await section.getByRole('button', { name: 'Copiar resumo', exact: true }).count(), 0, 'sem totais, não oferece texto para cliente')
      assert.equal(await section.locator('#cf-c-moeda').inputValue(), 'USD')
      assert.equal(await section.locator('#cf-c-trava-moeda').inputValue(), 'USD')
      await section.getByText(holidaySpot ? 'Compra indicativa · 19/11/2026 às 18:08' : 'Compra indicativa · 19/11/2026 às 18:04', { exact: true }).waitFor()
      assert.equal(await page.locator('.tape .tape-fx-label').count(), 0, 'bandeiras na faixa só na página inicial')
      assert.equal(await section.locator('#cf-c-p1-trava').inputValue(), '', 'indicativo não preenche cotação')
      assert.equal(await section.locator('#cf-c-p1-cenario').inputValue(), '', 'indicativo não preenche cenário')
      for (const [title, words] of [
        ['Moedas e cotação indicativa', /AwesomeAPI.*trocar/is],
        ['Parcelas e cotações', /vencimento.*Sem o cenário/s],
        ['Resultado da comparação', /Preencha todas as parcelas.*Soma nominal/s],
      ]) {
        const help = section.getByRole('button', { name: 'Ajuda: ' + title, exact: true })
        await help.click()
        const modal = page.getByRole('dialog', { name: title, exact: true })
        assert.match(await modal.innerText(), words)
        if (title === 'Moedas e cotação indicativa') {
          const quoteDetail = holidaySpot ? /Compra indicativa: R\$ 5,7051\/USD/i : /Última faixa à vista.*5,7100.*5,7200\/USD/i
          await modal.getByText(quoteDetail).waitFor()
          assert.doesNotMatch(await section.innerText(), /5,7051|5,7100/, 'valor fica apenas no ?')
        }
        await page.keyboard.press('Escape')
        assert.equal(await modal.count(), 0)
      }
      assert.doesNotMatch(await section.innerText(), /Preencha todas as parcelas|Soma nominal das parcelas|As cotações são de cada vencimento/)
      const previous = section.getByRole('link', { name: 'Simular TIR da parcela em USD', exact: true })
      assert.equal(await previous.isVisible(), true)
      assert.equal(await previous.getAttribute('href'), '#calculadora/cambio-futuro/tir-usd')
      const costs = section.locator('.cf-c-details').first()
      await costs.locator('summary').click()
      assert.match(await costs.innerText(), /descontados os custos iniciais.*Custos de parcela são pagos no vencimento.*não estão na cotação nem no valor líquido/s)
      await costs.locator('summary').click()
      await section.getByRole('button', { name: '3 parcelas', exact: true }).click()
      assert.equal(await section.locator('.cf-c-row').count(), 3)
      for (const [i, date, locked] of [[1, '2027-05-20', '6,55'], [2, '2027-08-20', '6,60'], [3, '2027-11-20', '6,65']]) {
        await section.locator(`#cf-c-p${i}-data`).fill(date)
        await section.locator(`#cf-c-p${i}-valor`).fill('10000')
        await section.locator(`#cf-c-p${i}-trava`).fill(locked)
        assert.equal(await section.locator(`#cf-c-p${i}-valor`).inputValue(), '10.000,00')
      }
      assert.equal(normalizeMoney(await section.locator('#cf-c-total-trava').innerText()), 'R$198.000,00')
      assert.equal(await section.locator('#cf-c-total-cenario').innerText(), '—')
      assert.equal(await section.locator('#cf-c-diferenca').innerText(), '—')
      for (const [i, scenario] of [[1, '6,70'], [2, '6,80'], [3, '6,75']]) await section.locator(`#cf-c-p${i}-cenario`).fill(scenario)
      assert.equal(normalizeMoney(await section.locator('#cf-c-total-cenario').innerText()), 'R$202.500,00')
      assert.equal(normalizeMoney(await section.locator('#cf-c-diferenca').innerText()), 'R$4.500,00')
      assert.match(await section.locator('#cf-c-diferenca').locator('..').innerText(), /Economia neste cenário/)
      const details = section.locator('.cf-c-result-foot details')
      assert.equal(await details.getAttribute('open'), null)
      await details.locator('summary').click()
      assert.equal(await details.locator('section').count(), 3)
      assert.match(await details.locator('section').first().innerText(), /Cotação de equilíbrio.*6,5500/s)
      await details.locator('summary').click()
      const resumo = section.getByRole('region', { name: 'Resumo para o cliente' })
      await resumo.waitFor()
      assert.match(await resumo.innerText(), /Neste cenário, a trava reduziria o total em R\$\s*4\.500,00/)
      assert.match(await resumo.innerText(), /não garante economia/)
      assert.ok(await resumo.evaluate(el => el.previousElementSibling?.contains(el.parentElement.querySelector('.cf-c-result-foot details'))), 'resumo após o detalhe das parcelas')
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin })
      await resumo.getByRole('button', { name: 'Copiar resumo', exact: true }).click()
      await resumo.getByText('Resumo copiado.', { exact: true }).waitFor()
      const copiado = await page.evaluate(() => navigator.clipboard.readText())
      assert.match(copiado, /Total com trava:\s*R\$\s*198\.000,00/)
      assert.match(copiado, /Total sem trava no cenário:\s*R\$\s*202\.500,00/)
      assert.match(copiado, /Economia neste cenário:\s*R\$\s*4\.500,00/)
      assert.match(copiado, /não garante economia/)
      const graph = section.locator('.cf-c-graph')
      await graph.getByRole('img', { name: /USD\/BRL/ }).waitFor()
      assert.match(await graph.getByRole('img', { name: /USD\/BRL/ }).getAttribute('aria-label'), /12\/11/)
      await section.getByRole('button', { name: '90 dias' }).click()
      assert.match(await graph.getByRole('img', { name: /USD\/BRL/ }).getAttribute('aria-label'), /25\/08/)
      await settleLayout(page)
      await assertWorkspace(page, section, `Câmbio futuro, 3 parcelas ${width} ${theme}`)
      await page.screenshot({ path: path.join(out, `cambio-futuro-tres-parcelas-${width}-${theme}.png`), fullPage: true })
      await section.locator('#cf-c-p2-data').fill('2027-08-21')
      assert.equal(await section.locator('#cf-c-p2-trava').inputValue(), '')
      assert.equal(await section.locator('#cf-c-p2-cenario').inputValue(), '')
      assert.equal(await section.locator('#cf-c-p3-cenario').inputValue(), '6,75')
      await section.getByRole('button', { name: '2 parcelas', exact: true }).click()
      await section.getByRole('button', { name: '5 parcelas', exact: true }).click()
      assert.equal(await section.locator('.cf-c-row').count(), 5)
      assert.equal(await section.locator('#cf-c-p3-cenario').inputValue(), '')
      await section.getByRole('button', { name: '1 parcela', exact: true }).click()
      for (const { code, conversion, forward, gross, total } of [
        { code: 'EUR', conversion: '0,9', forward: '7', gross: 'R$63.000,00', total: 'R$63.090,00' },
        { code: 'CNH', conversion: '7,5', forward: '0,8', gross: 'R$60.000,00', total: 'R$60.090,00' },
      ]) {
        await section.locator('#cf-c-trava-moeda').selectOption(code)
        assert.equal(await section.locator('#cf-c-p1-valor').inputValue(), '10.000,00')
        await section.locator('#cf-c-p1-trava').fill(forward)
        await section.locator('#cf-c-p1-cross').fill(conversion)
        await section.locator('#cf-c-p1-cross-status').selectOption('cenario')
        await section.getByText('Ainda há parcela sem trava integral. Abra os detalhes para conferir.', { exact: true }).waitFor()
        assert.equal(await section.locator('#cf-c-total-trava').innerText(), '—')
        const steps = section.locator('.cf-c-row--cross .cf-c-cross-step')
        assert.match(await steps.nth(0).innerText(), new RegExp('Converter USD em ' + code))
        assert.match(await steps.nth(1).innerText(), new RegExp('Converter ' + code + ' em reais'))
        const [parity, forwardField] = await Promise.all([steps.nth(0).boundingBox(), steps.nth(1).boundingBox()])
        if (width <= 480) assert.ok(parity && forwardField && forwardField.y > parity.y + parity.height - 1)
        const details = section.getByText('Ver detalhes por parcela', { exact: true })
        const result = section.getByRole('region', { name: 'Resultado cruzado da parcela 1' })
        assert.equal(await result.isVisible(), false)
        await details.click()
        await result.getByText(`Exposição residual USD/${code}. Não é cobertura integral.`, { exact: true }).waitFor()
        assert.ok(normalizeMoney(await result.innerText()).includes(gross))
        await details.click()
        await section.locator('#cf-c-p1-cross-status').selectOption('contratada')
        assert.equal(await section.locator('#cf-c-total-trava').innerText(), '—')
        await section.getByRole('checkbox', { name: 'Trava em reais contratada para esta parcela' }).check()
        assert.equal(normalizeMoney(await section.locator('#cf-c-total-trava').innerText()), gross)
        await costs.locator('summary').click()
        await section.locator('#cf-c-p1-tarifa-trava').fill('90')
        assert.equal(normalizeMoney(await section.locator('#cf-c-total-trava').innerText()), total)
        await costs.locator('summary').click()
        await settleLayout(page)
        await assertWorkspace(page, section, `Câmbio futuro USD/${code} ${width} ${theme}`)
      }
      const approvedTotal = normalizeMoney(await section.locator('#cf-c-total-trava').innerText())
      await section.getByRole('button', { name: 'Gerar exemplo fictício', exact: true }).click()
      assert.equal(normalizeMoney(await section.locator('#cf-c-diferenca').innerText()), 'R$37.800,00')
      assert.equal(await section.locator('#cf-c-moeda').inputValue(), 'USD')
      assert.equal(await section.locator('#cf-c-trava-moeda').inputValue(), 'CNH')
      for (const i of [1, 2, 3]) assert.equal(await section.locator(`#cf-c-p${i}-valor`).inputValue(), '100.000,00')
      if (width === 1440 && theme === 'light') {
        const firstRow = section.locator('.cf-c-row--cross').first()
        for (const checkWidth of [390, 414, 620, 621, 820, 1120, 1121]) {
          await page.setViewportSize({ width: checkWidth, height: 900 })
          await settleLayout(page)
          await assertWorkspace(page, section, `Trava cruzada, largura ${checkWidth}`)
          assert.equal(await firstRow.getByText('Vencimento da parcela 1', { exact: true }).isVisible(), true)
          assert.equal(await firstRow.getByText('Valor da parcela 1 (USD)', { exact: true }).isVisible(), true)
        }
        await page.setViewportSize({ width, height: 900 })
        await settleLayout(page)
      }
      if (cnhSource === 'CNH') {
        const compare = graph.getByRole('img', { name: 'Comparação USD/BRL e CNH/BRL em base 100', exact: true })
        await compare.waitFor()
        assert.equal(await compare.locator('polyline').count(), 2)
        assert.match(await graph.innerText(), /USD\/BRL · Operação: R\$ 5,7100.*CNH\/BRL · Trava: R\$ 0,8600/s)
      } else {
        await graph.getByText('Histórico CNH/BRL indisponível neste período.', { exact: true }).waitFor()
        await graph.getByRole('img', { name: /USD\/BRL · cotação diária/ }).waitFor()
      }
      await section.getByRole('button', { name: 'Sair do exemplo fictício', exact: true }).click()
      assert.equal(await section.locator('#cf-c-trava-moeda').inputValue(), 'CNH')
      assert.equal(normalizeMoney(await section.locator('#cf-c-total-trava').innerText()), approvedTotal)
      await section.getByRole('button', { name: '5 parcelas', exact: true }).click()
      await section.locator('#cf-c-moeda').selectOption('CNH')
      assert.equal(await section.locator('#cf-c-p1-valor').inputValue(), '')
      if (cnhSource === 'CNY') {
        await graph.getByText('Histórico indisponível neste período.').waitFor()
        assert.equal(await graph.getByRole('img').count(), 0, 'histórico CNY não substitui CNH offshore')
      } else await graph.getByRole('img', { name: /CNH\/BRL · cotação diária/ }).waitFor()
      const example = section.getByRole('button', { name: 'Gerar exemplo fictício', exact: true })
      const help = section.getByRole('button', { name: 'Ajuda: Câmbio futuro', exact: true })
      assert.ok(await example.evaluate(el => el.parentElement === el.closest('.cf-c-heading-actions') &&
        !!el.parentElement.querySelector('.fi-help')), 'atalho fica no mesmo grupo do botão de ajuda')
      assert.equal(await help.isVisible(), true)
      assert.equal(await example.getAttribute('aria-pressed'), 'false')
      await section.locator('#cf-c-p1-valor').fill('123,45')
      await example.click()
      const quit = section.getByRole('button', { name: 'Sair do exemplo fictício', exact: true })
      assert.equal(await quit.getAttribute('aria-pressed'), 'true')
      assert.equal(await section.getByText('Exemplo fictício.', { exact: true }).isVisible(), true)
      assert.equal(normalizeMoney(await section.locator('#cf-c-diferenca').innerText()), 'R$37.800,00')
      assert.equal(await section.locator('.cf-c-row').count(), 3)
      await settleLayout(page)
      await assertWorkspace(page, section, `Exemplo de câmbio futuro ${width} ${theme}`)
      await page.screenshot({ path: path.join(out, `cambio-futuro-exemplo-${width}-${theme}.png`), fullPage: true })
      await quit.click()
      assert.equal(await section.locator('#cf-c-moeda').inputValue(), 'CNH')
      assert.equal(await section.locator('#cf-c-p1-valor').inputValue(), '123,45')
      assert.equal(await section.locator('.cf-c-row').count(), 5)
      assert.equal(await section.getByText('Exemplo fictício.', { exact: true }).count(), 0)
      await previous.click()
      await page.waitForURL('**/#calculadora/cambio-futuro/tir-usd')
      await page.locator('#cf-valor').waitFor()
      assert.deepEqual(errors, [])
      console.log(`PASS Câmbio futuro até cinco parcelas ${width} ${theme}`)
    } finally { await page.close() }
  }
}

async function assertCambioFuturo(browser) {
  // USD 110 mil já com juros: em 360 dias a 10% a.a., o principal é USD 100 mil.
  // EUR: 88 mil × 6,50 = R$ 572 mil; CNH: (550 mil ÷ 0,75) × 0,80.
  // TIR anual = (pagamento em reais ÷ R$ 500 mil)^(365/360) − 1.
  for (const width of [320, 1440]) for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width, height: 950 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await fixtures(page)
      let clock = Date.parse('2026-01-02T02:00:00Z') // 01/01 23h de Brasília, sem pregão.
      const prev = Date.parse('2025-12-31T20:57:00Z')
      const raw = (bid, ask, high, low, timestamp) => ({ bid, ask, high, low, timestamp: timestamp / 1000, pctChange: 0 })
      await page.route('**/quotes.json*', route => route.fulfill({ json: { source: 'AwesomeAPI', generatedAt: clock,
        quotes: { EURBRL: raw(6.51, 6.52, 6.6, 6.4, clock - 120000), USDBRL: raw(5.7, 5.71, 5.75, 5.65, clock - 120000),
          USDCNH: raw(6.7, 6.71, 6.8, 6.6, clock - 120000) },
      } }))
      await page.route('**/history.json*', route => route.fulfill({ json: { source: 'AwesomeAPI', generatedAt: prev + 60000,
        series: { EUR: { source: 'EUR', points: [{ t: prev, bid: 6.48 }] } },
      } }))
      await page.route('**/intraday.json*', route => route.fulfill({ json: { source: 'AwesomeAPI (coleta central a cada 5 min)', generatedAt: prev + 60000,
        series: { CNH: { points: [[prev, .85]] } },
      } }))
      await page.clock.setFixedTime(new Date(clock))
      await page.goto(`${base}/#calculadora/cambio-futuro/tir-usd`)
      const section = page.locator('section.cf-pattern')
      await section.getByRole('heading', { name: 'Câmbio futuro', exact: true }).waitFor()
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
      assert.match(await section.innerText(), /Data-base da simulação: 01\/01\/2026/)
      assert.equal(await section.getByRole('heading', { name: 'Fluxo de caixa por vencimento' }).count(), 0)
      const operacao = section.locator('article[aria-labelledby="cf-operacao"]')
      assert.deepEqual(await operacao.locator('input').evaluateAll(items => items.map(x => x.id)), ['cf-valor', 'cf-vencimento', 'cf-cotacao', 'cf-taxa'])
      const mesa = section.locator('article[aria-labelledby="cf-mesa"]')
      assert.deepEqual(await mesa.locator('fieldset legend').allTextContents(), ['Yuan (CNH)', 'Euro (EUR)'])
      assert.equal(await operacao.locator('label[for="cf-valor"] .flag svg').count(), 1)
      assert.equal(await mesa.locator('legend .flag svg').count(), 2)
      assert.equal(await section.locator('.cf-resultado-moeda h4 .flag svg').count(), 2)
      const eurNote = mesa.locator('#cf-EUR-cotacao-obs')
      const cnhNote = mesa.locator('#cf-CNH-cotacao-obs')
      await eurNote.filter({ hasText: /Referência diária indicativa/ }).waitFor()
      await cnhNote.filter({ hasText: /último ponto indicativo/ }).waitFor()
      assert.match(await eurNote.innerText(), /6,4800.*31\/12\/2025.*AwesomeAPI/i)
      assert.match(await cnhNote.innerText(), /0,8500.*31\/12\/2025 às 17:57.*AwesomeAPI/i)
      assert.match(await mesa.locator('#cf-EUR-futuro-obs').innerText(), /Não é cotação à vista/)
      assert.equal(await mesa.locator('#cf-EUR-cotacao').inputValue(), '', 'referência não preenche o campo')
      assert.equal(await mesa.locator('#cf-CNH-cotacao').inputValue(), '', 'referência não preenche o campo')
      assert.doesNotMatch(await eurNote.innerText(), /Partida /)
      assert.doesNotMatch(await cnhNote.innerText(), /Partida /)
      for (const [id, valor] of Object.entries({ valor: '110.000', vencimento: '2026-12-27', cotacao: '5', taxa: '10',
        'EUR-cotacao': '6,25', 'EUR-futuro': '6,50', 'CNH-cotacao': '0,75', 'CNH-futuro': '0,80' })) {
        await section.locator('#cf-' + id).fill(valor)
      }
      const eur = section.locator('#cf-resultado-EUR').locator('..')
      const cnh = section.locator('#cf-resultado-CNH').locator('..')
      assert.match(await eur.innerText(), /27\/12\/2026[\s\S]*88\.000,00[\s\S]*14,61%/)
      assert.match(await cnh.innerText(), /27\/12\/2026[\s\S]*733\.333,33[\s\S]*17,59%/)
      await settleLayout(page)
      await assertWorkspace(page, section, `Câmbio futuro parcela única ${width} ${theme}`)
      const metrics = await section.locator('.cf-resultado-moeda dd').evaluateAll(items => items.map(el => {
        const range = document.createRange(); range.selectNodeContents(el)
        const box = el.closest('.cf-resultado-moeda').getBoundingClientRect()
        const text = range.getBoundingClientRect()
        return { value: el.textContent, lines: range.getClientRects().length,
          inside: text.left >= box.left && text.right <= box.right }
      }))
      assert.equal(metrics.length, 6)
      assert.deepEqual(metrics.filter(m => m.lines !== 1 || !m.inside), [], 'datas, valores e TIR cabem inteiros no resultado')
      assert.match(await mesa.locator('#cf-EUR-futuro-obs').innerText(), /Taxa para 27\/12\/2026.*Não é cotação à vista/)
      assert.match(await eurNote.innerText(), /Partida abaixo do valor indicativo exibido/)
      assert.match(await cnhNote.innerText(), /Partida abaixo do valor indicativo exibido/)
      assert.doesNotMatch(await eurNote.innerText(), /da faixa|%/)
      await page.screenshot({ path: path.join(out, `cambio-futuro-parcela-${width}-${theme}.png`), fullPage: true })
      await section.locator('#cf-vencimento').fill('2026-12-28')
      assert.equal(await section.locator('#cf-EUR-futuro').inputValue(), '')
      assert.equal(await section.locator('#cf-CNH-futuro').inputValue(), '')
      assert.equal(await section.locator('#cf-EUR-cotacao').inputValue(), '6,25')
      assert.doesNotMatch(await eur.innerText(), /14,61%/)
      await section.locator('#cf-EUR-futuro').fill('6,50')
      assert.match(await eur.locator('.cf-tir dd').innerText(), /%/)
      await page.clock.setFixedTime(new Date('2026-01-02T03:00:00Z'))
      await section.locator('#cf-valor').fill('111.000')
      assert.match(await section.innerText(), /Data-base da simulação: 02\/01\/2026/)
      assert.match(await section.innerText(), /Informe novamente as cotações/)
      for (const id of ['cotacao', 'EUR-cotacao', 'EUR-futuro', 'CNH-cotacao', 'CNH-futuro']) {
        assert.equal(await section.locator('#cf-' + id).inputValue(), '')
      }
      assert.equal(await eur.locator('.cf-tir dd').innerText(), '—')
      clock = Date.parse('2026-01-02T13:00:00Z')
      await page.clock.setFixedTime(new Date(clock))
      await page.reload()
      await eurNote.filter({ hasText: /À vista hoje/ }).waitFor()
      await cnhNote.filter({ hasText: /À vista hoje/ }).waitFor()
      assert.match(await eurNote.innerText(), /compra–venda.*6,5100 a 6,5200\/EUR.*02\/01\/2026 às 09:58.*AwesomeAPI/)
      assert.match(await cnhNote.innerText(), /compra–venda.*\/CNH.*02\/01\/2026 às 09:58.*CNH offshore/)
      for (const [valor, state] of [['6,51', 'dentro'], ['6,59', 'acima'], ['6,4', 'abaixo']]) {
        await mesa.locator('#cf-EUR-cotacao').fill(valor)
        assert.match(await eurNote.innerText(), new RegExp('Partida ' + state + ' da faixa'))
      }
      assert.doesNotMatch(await cnhNote.innerText(), /Partida (dentro|acima|abaixo)/)
      await settleLayout(page)
      await assertWorkspace(page, section, `Referência à vista ${width} ${theme}`)
      await page.screenshot({ path: path.join(out, `cambio-futuro-spot-${width}-${theme}.png`), fullPage: true })
      assert.deepEqual(errors, [])
      console.log(`PASS Câmbio futuro parcela única ${width} ${theme}`)
    } finally { await page.close() }
  }
}

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const report = [], failures = []
  try {
    await assertGroupedCatalog(browser, report, failures)
    for (const width of widths) {
      const directory = path.join(out, String(width)); fs.mkdirSync(directory, { recursive: true })
      for (const route of routes) {
        const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
        const errors = []; page.on('pageerror', error => errors.push(error.message))
        try {
          await fixtures(page)
          await page.goto(`${base}/#calculadora/${route}`)
          const section = page.locator(route === 'giro' ? '.giro-screen' : 'main.app section.cx').first(); await section.waitFor()
          if (route === 'finame-materiais') await section.locator('.fm-destaques').waitFor()
          await settleLayout(page)
          await assertWorkspace(page, section, `${route} ${width}`)
          await page.screenshot({ path: path.join(directory, `${route}-initial.png`), fullPage: true })
          await fillScenario(page, section, route)
          await section.locator('.calc-back').first().focus()
          await page.evaluate(() => window.scrollTo(0, 0))
          await settleLayout(page)
          await assertWorkspace(page, section, `${route} preenchida ${width}`)
          await page.screenshot({ path: path.join(directory, `${route}-filled.png`), fullPage: true })
          await assertHelp(page, section, route, directory)
          if (route === 'conta-garantida') await require('./smoke-alongamento.cjs')(page, section, directory, width, assertWorkspace, settleLayout)
          assert.deepEqual(errors, [], `${route} ${width}: erros do navegador`)
          report.push({ route, width, status: 'pass' })
          console.log(`PASS calculator layout ${route} ${width}`)
        } catch (error) {
          await page.screenshot({ path: path.join(directory, `${route}-failure.png`), fullPage: true }).catch(() => {})
          report.push({ route, width, status: 'fail', message: error.message })
          failures.push(`${route} ${width}: ${error.message}`)
        } finally {
          await page.close()
        }
      }
    }
    await assertComparatorFamily(browser)
    await assertCambioFuturo(browser)
    await assertCambioFuturoCenario(browser)
    assert.deepEqual(failures, [], 'conformidade das seis calculadoras nas cinco larguras')
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
    await browser.close()
  }
})().catch(error => { console.error(error); process.exit(1) })
