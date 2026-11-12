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
  let interest = 0, iof = principal * 0.0038, bal = principal
  const payments = []
  let pmt = 0
  if (system === 'price') { let disc = 0, acc = 1; for (const p of periods) { acc /= 1 + r(p); disc += acc } pmt = principal / disc }
  periods.forEach((p, k) => {
    const j = bal * r(p), a = system === 'price' ? pmt - j : principal / 12
    interest += j; bal -= a; iof += a * Math.min(days[k], 365) * daily / 100; payments.push(a + j)
  })
  const paid = payments.reduce((s, v) => s + v, 0)
  return { first: payments[0], last: payments.at(-1), interest, iof, total: paid + iof }
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
    // Decisão de 11/11/2026: no Finame, em tela de computador (acima de 1000px), os campos têm 36px; o "?" e as telas menores seguem com 44px.
    const compact = !!element.closest('.cx-finame') && innerWidth > 1000 && !element.closest('.fi-help')
    return { id: element.id || element.getAttribute('aria-label'), width: rect.width, height: rect.height, min: compact ? 36 : 44 }
  }))
  assert.ok(controls.length > 0)
  assert.deepEqual(controls.filter(control => control.height < control.min - .1 || control.width < control.min - .1), [], `${label}: campos e ? com a altura mínima combinada (44px; 36px nos campos do Finame em computador)`)
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

async function assertHelp(page, section, label, directory) {
  const help = section.getByRole('button', { name: /^Ajuda: / }).first()
  assert.ok(await help.count(), `${label}: ajuda disponível`)
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
  assert.equal(await section.locator('.cx-back').first().evaluate(element => { element.focus(); return element === document.activeElement }), false, `${label}: fundo modal recusa foco`)
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
    await section.locator('#cx-start').fill('2026-11-06')
    await section.locator('#cx-firstDue').fill('2026-12-06')
    const table = section.locator('.cx-matrix')
    assert.ok(normalize(await table.locator('tbody tr').nth(0).locator('td').first().innerText()).startsWith(brl(giroOracle('price').first)))
    assert.equal(normalize(await table.locator('tbody tr').nth(4).locator('td').first().innerText()), brl(giroOracle('price').total))
    await section.getByRole('button', { name: 'SAC', exact: true }).click()
    assert.equal(normalize(await table.locator('tbody tr').nth(4).locator('td').nth(1).innerText()), brl(giroOracle('sac').total))
  } else if (route === 'conta-garantida') {
    assert.equal(await section.locator('#cg-status, #cg-rateBase, #cg-conversion').count(), 0)
    assert.equal(await section.getByText('Situação da operação', { exact: true }).count(), 0)
    await section.getByLabel('Taxa do contrato (% a.m.)', { exact: true }).fill('3')
    await page.locator('#cg-start').fill('2026-11-05')
    await page.locator('#cg-duration').fill('10')
    await page.locator('#cg-amount').fill('100000')
    assert.ok(await page.locator('#cg-taxProfile').count(), 'enquadramento do IOF preservado')
    const kpi = section.locator('.cg-kpis > div', { has: page.locator('span', { hasText: /^Custo total$/ }) })
    assert.match(await kpi.locator('b').innerText(), /^R\$\s*1\.462,00$/)
    const interest = section.locator('.cg-kpis > div', { has: page.locator('span', { hasText: /^Juros apurados$/ }) })
    assert.match(await interest.locator('b').innerText(), /^R\$\s*1\.000,00$/, '3% mensal proporcional a 10 dias')
    // CET do art. 6º (Res. CMN 4.881/2020): sem limite, só o pedido; com limite, 30 dias sobre o limite em dias corridos/365.
    assert.equal(await section.getByText('Sem CET: informe o limite contratado', { exact: false }).count(), 1)
    assert.equal(await page.locator('#cg-limit').inputValue(), '', 'limite começa vazio')
    await page.locator('#cg-limit').fill('100000')
    const cetKpi = section.locator('.cg-kpis > div', { has: page.locator('span', { hasText: /^CET \(art\. 6º · 30 dias sobre o limite\)$/ }) })
    const cetAnnual = Math.pow((100000 + 3000 + 100000 * 0.000082 * 30) / (100000 - 380), 365 / 30) - 1 // IOF adicional na liberação
    const pct2 = n => (n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    assert.equal(normalize(await cetKpi.locator('b').innerText()), `${pct2(cetAnnual)}% a.a.`)
    assert.match(await kpi.locator('b').innerText(), /^R\$\s*1\.462,00$/, 'limite não muda o custo do período')
    assert.ok(await section.getByText('texto oficial conferido em 11/11/2026', { exact: false }).count())
  } else if (route === 'analise-desconto') {
    await page.locator('#ad-titleFeeMode').selectOption('total')
    assert.equal(await page.locator('#ad-iofAdditional, #ad-iofPaid, #ad-interest').count(), 0)
    await page.locator('#ad-date').fill('2026-11-05')
    await section.getByLabel('Vencimento contratual', { exact: true }).fill('2026-12-05')
    // The nested MoneyInput adds the currency prefix to the label's text.
    const nominal = section.getByLabel(/^Valor nominal total do grupo/)
    assert.equal(await nominal.count(), 1, 'um grupo de títulos no cenário fixo')
    await nominal.fill('225.600,43')
    assert.equal(await nominal.inputValue(), '225.600,43')
    await page.locator('#ad-operationRate').fill('1,83')
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
    const kpis = section.locator('.desconto-kpis')
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
    const row = section.locator('.desconto-summary-panel tbody tr', { has: page.getByRole('rowheader', { name: 'Custo total do desconto', exact: true }) })
    assert.equal(normalize(await row.locator('td').first().innerText()), brl(monthlyCost))
    assert.equal(normalize(await row.locator('td').nth(1).innerText()), brl(monthlyCost * 12))
    const cetRow = section.locator('.desconto-comparison-panel tbody tr', { has: page.getByRole('rowheader', { name: 'CET do desconto', exact: true }) })
    assert.equal(normalize(await cetRow.locator('td').first().innerText()), pct(cet30(0.0175, 824))) // art. 6º: 30 dias; monthlyNet é do prazo real
    const giroCet = section.locator('.desconto-comparison-panel tbody tr', { has: page.getByRole('rowheader', { name: 'CET do giro', exact: true }) })
    assert.equal(await giroCet.locator('td').count(), 5)
    for (const cell of await giroCet.locator('td').allInnerTexts()) assert.match(normalize(cell), /^\d+,\d{2}% a\.a\.$/)
    assert.doesNotMatch(await section.innerText(), /[Nn]ão é CET/)
  } else if (route === 'finimp') {
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
    // IOF padrão PJ geral (zero só com recursos FINAME, Decreto 6.306/2007, art. 8º, IX): 0,38% × R$ 100 mil = R$ 380,00
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
    assert.equal(await section.locator('.fm-destaques tbody tr').count(), 6, 'números principais à vista, sem abrir a composição: taxas, CET, parcelas e custo total')
    assert.equal(await section.locator('.fm-hero').count(), 0, 'sem comparação não há faixa vazia')
    await section.locator('.fm-details > summary').click()
    await section.locator('.fm-grade').waitFor()
    await section.locator('.fm-fluxo-panel > summary').click()
    assert.equal(await section.locator('.fm-tabela tbody tr:not(.fm-liberacao)').count(), 60)
    assert.match(await section.locator('.fm-tabela tbody tr').last().locator('td').last().innerText(), /^R\$\s*0,00$/)
  }
}

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const report = [], failures = []
  try {
    for (const width of widths) {
      const directory = path.join(out, String(width)); fs.mkdirSync(directory, { recursive: true })
      for (const route of routes) {
        const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
        const errors = []; page.on('pageerror', error => errors.push(error.message))
        try {
          await fixtures(page)
          await page.goto(`${base}/#calculadora/${route}`)
          const section = page.locator('main.app section.cx').first(); await section.waitFor()
          if (route === 'finame-materiais') await section.locator('.fm-destaques').waitFor()
          await settleLayout(page)
          await assertWorkspace(page, section, `${route} ${width}`)
          await page.screenshot({ path: path.join(directory, `${route}-initial.png`), fullPage: true })
          await fillScenario(page, section, route)
          await section.locator('.cx-back').first().focus()
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
    assert.deepEqual(failures, [], 'conformidade das seis calculadoras nas cinco larguras')
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
    await browser.close()
  }
})().catch(error => { console.error(error); process.exit(1) })
