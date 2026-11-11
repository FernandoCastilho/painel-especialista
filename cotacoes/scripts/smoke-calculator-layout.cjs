// Shared calculator contract. Run against the CI build; screenshots are internal QA.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.CALCULATOR_QA_OUTPUT || 'workspace-qa/calculator-layout'
const { widths, layoutRoutes: routes } = require('./smoke-calculator-matrix.cjs')
const normalize = text => text.replace(/\s+/g, ' ').trim()

// Fixed release 06/11/2026 and first due 06/12/2026. Civil-calendar offsets,
// with iterative outstanding-principal accounting independent of emprestimo.js.
const giroOracle = (system, principal = 100000, daily = 0.0082) => {
  const days = [30, 61, 92, 120, 151, 181, 212, 242, 273, 304, 334, 365]
  const payment = principal * 0.02 / (1 - 1.02 ** -12)
  let balance = principal, interest = 0, iof = principal * 0.0038
  for (const day of days) {
    const charge = balance * 0.02
    const amortization = system === 'sac' ? principal / 12 : payment - charge
    interest += charge; iof += amortization * Math.min(day, 365) * daily / 100
    balance -= amortization
  }
  return { iof, total: principal + interest + iof }
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
    return { id: element.id || element.getAttribute('aria-label'), width: rect.width, height: rect.height }
  }))
  assert.ok(controls.length > 0)
  assert.deepEqual(controls.filter(control => control.height < 43.9 || control.width < 43.9), [], `${label}: campos e ? com pelo menos 44px`)
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
    assert.match(normalize(await table.locator('tbody tr').nth(0).locator('td').first().innerText()), /^R\$\s*9\.455,96/)
    assert.equal(normalize(await table.locator('tbody tr').nth(3).locator('td').first().innerText()), brl(giroOracle('price').total))
    await section.getByRole('button', { name: 'SAC', exact: true }).click()
    assert.equal(normalize(await table.locator('tbody tr').nth(3).locator('td').nth(1).innerText()), brl(giroOracle('sac').total))
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
    // Independent 30-calendar-day commercial discount: IOF on nominal minus interest.
    const gross = 225600.43, interest = gross * 0.0183
    const cost = interest + (gross - interest) * (0.0038 + 30 * 0.000082) + 564 + 260
    const kpis = section.locator('.desconto-kpis')
    assert.ok(normalize(await kpis.innerText()).includes(brl(cost)))
    assert.ok(normalize(await kpis.innerText()).includes(brl(gross - cost)))
    const monthlyInterest = gross * 0.0175
    const monthlyCost = 6 * (monthlyInterest + (gross - monthlyInterest) * (0.0038 + 30 * 0.000082) + 564 + 260)
    const row = section.locator('.desconto-summary-panel tbody tr', { has: page.getByRole('rowheader', { name: 'Custo total do desconto', exact: true }) })
    assert.equal(normalize(await row.locator('td').first().innerText()), brl(monthlyCost))
    assert.equal(normalize(await row.locator('td').nth(1).innerText()), brl(monthlyCost * 12))
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
  } else if (route === 'finame-materiais') {
    await section.locator('.fm-destaques').waitFor()
    assert.equal(await section.locator('#fm-finame-eligible, #fm-sis, #fm-comp, #fm-lib, #fm-fgi-inc').count(), 0)
    const eligibilityWarning = section.locator('.fm-iof-premise')
    assert.equal(await eligibilityWarning.isVisible(), true, 'aviso tributário obrigatório permanece visível')
    assert.match(await eligibilityWarning.innerText(), /FINAME|Finame/)
    assert.equal(await section.locator('.fm-destaques tbody tr').count(), 3, 'números principais à vista, sem abrir a composição')
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
