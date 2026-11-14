// CI browser regression with explicitly fictitious headlines; no external requests.
const { chromium } = require('playwright')
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const base = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768').replace(/\/$/, '')
const out = process.env.KNOWLEDGE_QA_OUTPUT || 'workspace-qa/knowledge-map'
const now = Date.parse('2026-11-07T12:00:00Z')
const source = 'Fonte fictícia — ensaio CI'
const title = 'Inflação e dólar: matéria fictícia do ensaio CI'
const row = (suffix, days) => ({ title: `${title} ${suffix}`, source, link: `https://example.org/fixture-ci/${suffix}`, t: now - days * 86400000 })
const fixtures = {
  'news.json': { generatedAt: now, news: { ALL: [row('recente', 1), row('seis-dias', 6), row('expirada', 7 + 1 / 86400000), row('futura', -1)] } },
  'sector-news.json': { schemaVersion: 1, generatedAt: now, topics: {}, sourceStates: {} },
  'curadoria-noticias.json': { schemaVersion: 1, windowDays: 7, generatedAt: now, topics: {} },
  'knowledge-news.json': { schemaVersion: 1, windowDays: 7, generatedAt: now, sourceUpdatedAt: now, items: [] },
  'temas.json': { generatedAt: now, temas: {} },
  'recado.json': { ativo: false },
}
const report = { schemaVersion: 1, passed: false, scope: 'UI com dados fictícios; não comprova coleta ou fontes externas.', results: [], errors: [], captureDiagnostics: [] }
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
const cameraReady = page => page.waitForFunction(() => document.querySelector('.km-stage')?.dataset.cameraFitting !== 'true')
const scaleOf = transform => Number(transform.match(/scale\(([^)]+)\)/)[1])
const localFits = stage => stage.evaluate(element => {
  const r = element.getBoundingClientRect(), selected = element.querySelector('.km-node.is-selected')?.getBoundingClientRect()
  const nodes = [...element.querySelectorAll('.km-node')].map(node => node.getBoundingClientRect())
  const labels = [...element.querySelectorAll('.km-label')].map(label => label.getBoundingClientRect())
  return {
    allInside: nodes.every(n => n.left >= r.left + 4 && n.right <= r.right - 4 && n.top >= r.top + 4 && n.bottom <= r.bottom - 4),
    labelsInside: labels.every(n => n.left >= r.left + 2 && n.right <= r.right - 2 && n.top >= r.top + 2 && n.bottom <= r.bottom - 2),
    selectedVisible: !!selected && selected.left >= r.left && selected.right <= r.right && selected.top >= r.top && selected.bottom <= r.bottom,
    stage: { width: r.width, height: r.height }, nodes: nodes.length,
  }
})

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  let activePage, activeScenario
  try {
    for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
      const scenario = `${width}-${theme}`
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, colorScheme: theme, reducedMotion: 'no-preference', serviceWorkers: 'block' })
      const page = await context.newPage()
      activePage = page; activeScenario = scenario
      page.setDefaultTimeout(10000)
      await page.clock.setFixedTime(now)
      page.on('pageerror', error => report.errors.push(`${scenario}: ${error.message}`))
      // Context routing also blocks the popup's first request; page routing
      // alone does not intercept that initial navigation.
      await context.route('**/*', route => {
        const url = new URL(route.request().url())
        if (url.origin !== new URL(base).origin) return route.abort()
        const name = url.pathname.split('/').at(-1)
        if (Object.hasOwn(fixtures, name)) return route.fulfill({ json: fixtures[name] })
        if (name.endsWith('.json')) return route.fulfill({ json: { generatedAt: now } })
        return route.continue()
      })
      await page.goto(`${base}/#aprender/mapa`)
      const notice = page.getByRole('dialog', { name: 'Aviso', exact: true })
      if (await notice.isVisible()) await notice.getByRole('button', { name: 'Entendi', exact: true }).click()
      const map = page.locator('.knowledge-map'), stage = map.locator('.km-stage')
      await map.getByRole('heading', { name: 'Mapa do conhecimento', exact: true }).waitFor()
      await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme)
      // no celular o mapa completo abre na Lista; o restante do roteiro confere o Grafo
      assert.equal(await map.getByRole('button', { name: 'Lista', exact: true }).getAttribute('aria-pressed'), String(width < 700), 'Lista é a visão inicial só abaixo de 700 px')
      if (width < 700) await map.getByRole('button', { name: 'Grafo', exact: true }).click()
      await page.waitForFunction(() => document.querySelectorAll('.km-node.km-news').length === 2)
      const total = await map.locator('.km-node').count()
      assert.ok(total > 130, 'matriz reúne setores, conceitos e notícias')
      assert.doesNotMatch(await map.locator('.km-svg').textContent(), /expirada|futura/)
      const motionNode = map.locator('[data-node-id="concept:inflacao"]')
      const motionBefore = await motionNode.getAttribute('transform')
      await page.waitForFunction(before => document.querySelector('[data-node-id="concept:inflacao"]')?.getAttribute('transform') !== before, motionBefore)
      await map.getByRole('button', { name: 'Pausar movimento', exact: true }).click()
      await frames(page)
      const camera = map.locator('.km-svg > g').first()
      await cameraReady(page)
      const initialScale = scaleOf(await camera.getAttribute('transform'))
      await map.getByRole('button', { name: 'Aproximar mapa', exact: true }).click()
      const zoomed = await camera.getAttribute('transform')
      assert.equal(scaleOf(zoomed), Math.min(4, initialScale * 1.25), 'zoom parte do enquadramento calculado')
      await map.getByRole('button', { name: 'Retomar movimento', exact: true }).click()
      await frames(page)
      await map.getByRole('button', { name: 'Pausar movimento', exact: true }).click()
      await frames(page)
      assert.equal(await camera.getAttribute('transform'), zoomed, 'pause/retomada preservam zoom e posição da câmera')
      await stage.scrollIntoViewIfNeeded()
      const blank = await stage.evaluate(element => {
        const r = element.getBoundingClientRect()
        for (const [dx, dy] of [[8, 8], [8, r.height / 2], [r.width / 2, 8], [r.width - 8, 8]]) {
          const x = r.left + dx, y = r.top + dy, hit = document.elementFromPoint(x, y)
          if (element.contains(hit) && !hit.closest('[data-node-id],button,.km-zoom')) return { x, y }
        }
        return null
      })
      assert.ok(blank, 'há fundo livre para mover a câmera')
      await page.mouse.move(blank.x, blank.y); await page.mouse.down()
      await page.mouse.move(blank.x + 36, blank.y + 24, { steps: 6 }); await page.mouse.up()
      const panned = await camera.getAttribute('transform')
      assert.notEqual(panned, zoomed, 'arrastar o fundo move a câmera')
      assert.equal(scaleOf(panned), scaleOf(zoomed))
      const draggableId = await stage.evaluate(element => {
        const r = element.getBoundingClientRect()
        return [...element.querySelectorAll('[data-node-id]')].find(node => {
          const n = node.getBoundingClientRect(), x = (n.left + n.right) / 2, y = (n.top + n.bottom) / 2
          const hit = document.elementFromPoint(x, y)?.closest('[data-node-id]')
          return x > r.left + 60 && x < r.right - 90 && y > r.top + 60 && y < r.bottom - 80 && hit === node
        })?.getAttribute('data-node-id')
      })
      assert.ok(draggableId, 'há nó no campo visual para arrastar')
      const draggable = map.locator(`[data-node-id="${draggableId}"]`)
      const nodeBefore = await draggable.getAttribute('transform'), box = await draggable.locator('.km-hit').boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 28, box.y + box.height / 2 + 18, { steps: 6 }); await page.mouse.up()
      assert.notEqual(await draggable.getAttribute('transform'), nodeBefore, 'arrastar nó muda sua posição')
      assert.equal(await camera.getAttribute('transform'), panned, 'arrastar nó preserva a câmera')
      assert.equal(await map.locator('.km-node.is-selected').count(), 0, 'arrastar não seleciona')
      await map.getByRole('button', { name: 'Voltar à matriz', exact: true }).click()
      await map.getByRole('button', { name: 'Pausar movimento', exact: true }).click()
      await frames(page)
      await cameraReady(page)
      await motionNode.focus(); await page.keyboard.press('Shift+F10')
      let actions = page.getByRole('menu', { name: 'Ações do ponto', exact: true })
      await actions.waitFor()
      assert.equal(await actions.getByRole('menuitem', { name: 'Ir para a página ↗', exact: true }).count(), 1)
      assert.equal(await actions.getByRole('menuitem', { name: 'Ver conexões', exact: true }).count(), 1)
      await page.keyboard.press('Escape')
      await actions.waitFor({ state: 'hidden' })
      assert.equal(await motionNode.evaluate(node => node === document.activeElement), true, 'Escape devolve o foco ao ponto')
      await page.keyboard.press('Enter')
      await map.locator('.km-focus-label').getByText('Conexões diretas', { exact: true }).waitFor()
      assert.equal(await map.locator('.km-node.is-selected').getAttribute('data-node-id'), 'concept:inflacao')
      const focusedCount = await map.locator('.km-node').count()
      assert.ok(focusedCount > 1 && focusedCount < total)
      const star = await stage.evaluate(element => {
        const selected = element.querySelector('.km-node.is-selected')
        const match = selected.getAttribute('transform').match(/translate\(([-\d.e+]+)[ ,]+([-\d.e+]+)\)/)
        const x = Number(match[1]), y = Number(match[2])
        const lines = [...element.querySelectorAll('.km-edge')]
        const near = (a, b) => Math.abs(a - b) < .01
        return { nodes: element.querySelectorAll('.km-node').length, lines: lines.length, direct: lines.every(line => (near(Number(line.getAttribute('x1')), x) && near(Number(line.getAttribute('y1')), y)) || (near(Number(line.getAttribute('x2')), x) && near(Number(line.getAttribute('y2')), y))) }
      })
      assert.equal(star.direct, true, 'nenhuma linha entre vizinhos no foco local')
      assert.equal(star.lines, star.nodes - 1, 'estrela contém somente conexões do selecionado')
      await cameraReady(page)
      const fitted = await localFits(stage)
      assert.equal(fitted.allInside, true, 'seleção enquadra todos os pontos locais sem exigir ajuste manual')
      assert.equal(fitted.selectedVisible, true)
      assert.equal(fitted.labelsInside, true, 'rótulos locais cabem na área visível')
      const selectedBeforeFullscreen = await map.locator('.km-node.is-selected').getAttribute('data-node-id')
      await map.getByRole('button', { name: 'Tela cheia', exact: true }).click()
      await map.getByRole('button', { name: 'Sair da tela cheia', exact: true }).waitFor()
      await cameraReady(page)
      const fullscreen = await map.evaluate(element => {
        const r = element.getBoundingClientRect()
        return { native: document.fullscreenElement === element, expanded: element.classList.contains('is-fullscreen'), modal: element.getAttribute('aria-modal'), x: r.x, y: r.y, width: r.width, height: r.height, viewportWidth: innerWidth, viewportHeight: innerHeight }
      })
      assert.equal(fullscreen.expanded, true)
      assert.equal(fullscreen.modal, 'true')
      assert.ok(Math.abs(fullscreen.x) <= 1 && Math.abs(fullscreen.y) <= 1, 'tela cheia começa no canto do viewport')
      assert.ok(Math.abs(fullscreen.width - fullscreen.viewportWidth) <= 2 && Math.abs(fullscreen.height - fullscreen.viewportHeight) <= 2, 'tela cheia ocupa a área disponível')
      assert.equal((await localFits(stage)).allInside, true, 'fullscreen refaz o enquadramento da seleção')
      assert.equal((await localFits(stage)).labelsInside, true, 'fullscreen mantém os rótulos locais no campo visual')
      assert.ok((await localFits(stage)).stage.height >= 180, 'canvas continua utilizável no celular')
      if (width === 390) {
        const drawer = map.locator('.km-detail-toggle')
        await drawer.waitFor()
        assert.equal(await drawer.getAttribute('aria-expanded'), 'false')
        assert.equal(await map.locator('#km-detail-content').isVisible(), false, 'detalhes começam recolhidos no fullscreen do celular')
        const closedHeight = (await localFits(stage)).stage.height
        await drawer.click()
        assert.equal(await drawer.getAttribute('aria-expanded'), 'true')
        await map.locator('.km-detail h3').waitFor()
        await cameraReady(page)
        assert.equal((await localFits(stage)).allInside, true, 'abrir detalhes reenquadra o grafo no espaço restante')
        assert.ok((await localFits(stage)).stage.height < closedHeight, 'o painel de detalhes usa somente sua área necessária')
        await drawer.click()
        assert.equal(await drawer.getAttribute('aria-expanded'), 'false')
        await cameraReady(page)
        assert.equal((await localFits(stage)).allInside, true)
      }
      await motionNode.click({ button: 'right' })
      actions = page.getByRole('menu', { name: 'Ações do ponto', exact: true })
      await actions.waitFor()
      assert.equal(await actions.evaluate(menu => !!menu.closest('.knowledge-map.is-fullscreen')), true, 'menu continua dentro da superfície fullscreen')
      await actions.getByRole('menuitem', { name: 'Ver conexões', exact: true }).click()
      await actions.waitFor({ state: 'hidden' })
      await cameraReady(page)
      assert.equal(await map.locator('.km-node.is-selected').getAttribute('data-node-id'), selectedBeforeFullscreen)
      await page.screenshot({ path: path.join(out, `${scenario}-fullscreen.png`) })
      await page.keyboard.press('Escape')
      await map.getByRole('button', { name: 'Tela cheia', exact: true }).waitFor()
      await cameraReady(page)
      assert.equal(await map.locator('.km-node.is-selected').getAttribute('data-node-id'), selectedBeforeFullscreen, 'sair da tela cheia preserva o foco local')
      assert.equal(await map.locator('.km-node').count(), focusedCount)
      await map.getByRole('button', { name: 'Tela cheia', exact: true }).click()
      await map.getByRole('button', { name: 'Sair da tela cheia', exact: true }).click()
      await map.getByRole('button', { name: 'Tela cheia', exact: true }).waitFor()
      await cameraReady(page)
      assert.equal((await localFits(stage)).allInside, true, 'saída explícita reenquadra sem perder a seleção')
      await page.screenshot({ path: path.join(out, `${scenario}-focused.png`), fullPage: true })
      await map.getByRole('button', { name: 'Voltar à matriz', exact: true }).click()
      assert.equal(await map.locator('.km-node').count(), total, 'retorno restaura a matriz completa')
      assert.equal(await map.locator('.km-node.is-selected').count(), 0)
      await map.getByRole('searchbox', { name: 'Buscar no mapa', exact: true }).fill('naoexistezzfixture')
      await map.getByText('Nenhum ponto encontrado', { exact: true }).waitFor()
      assert.equal(await map.locator('.km-node').count(), 0)
      await map.getByRole('searchbox', { name: 'Buscar no mapa', exact: true }).fill('')
      await map.getByRole('button', { name: 'Notícias · 7 dias', exact: true }).click()
      assert.equal(await map.locator('.km-node.km-news').count(), 0)
      await map.getByRole('button', { name: 'Notícias · 7 dias', exact: true }).click()
      assert.equal(await map.locator('.km-node.km-news').count(), 2)
      await page.screenshot({ path: path.join(out, `${scenario}-matrix.png`), fullPage: true })
      await map.getByRole('button', { name: 'Lista', exact: true }).click()
      const article = map.locator('.km-list-item.km-news').filter({ hasText: `${title} recente` })
      assert.match(await article.innerText(), /Fonte fictícia — ensaio CI · 06\/11\/2026/)
      assert.equal(await map.locator('.km-list-item.km-news').count(), 2)
      const expectedHref = 'https://example.org/fixture-ci/recente'
      const popupPromise = context.waitForEvent('page')
      const requestPromise = context.waitForEvent('request', request => request.url() === expectedHref)
      await article.click()
      const [popup, attemptedRequest] = await Promise.all([popupPromise, requestPromise])
      assert.equal(attemptedRequest.url(), expectedHref, 'clique na notícia abre a matéria original')
      await popup.close()
      assert.equal(await map.locator('.km-list-item.is-selected').count(), 0, 'abrir notícia não troca a seleção da matriz')
      assert.equal(await map.locator('.km-publication').count(), 0, 'clique abre a matéria, sem selecionar o resumo')
      await article.click({ button: 'right' })
      actions = page.getByRole('menu', { name: 'Ações do ponto', exact: true })
      await actions.waitFor()
      const menuSourceLink = actions.getByRole('menuitem', { name: 'Ir para a página ↗', exact: true })
      assert.equal(await menuSourceLink.getAttribute('href'), expectedHref)
      assert.equal(await menuSourceLink.getAttribute('rel'), 'noopener noreferrer')
      await actions.getByRole('menuitem', { name: 'Ver conexões', exact: true }).click()
      assert.match(await map.locator('.km-publication').innerText(), /Fonte fictícia — ensaio CI[\s\S]*06\/11\/2026/)
      const sourceLink = map.getByRole('link', { name: 'Ler na fonte ↗', exact: true })
      assert.equal(await sourceLink.getAttribute('href'), expectedHref)
      assert.equal(await sourceLink.getAttribute('rel'), 'noopener noreferrer')
      await sourceLink.click({ trial: true })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false, 'sem transbordamento horizontal')
      await page.screenshot({ path: path.join(out, `${scenario}-news.png`), fullPage: true })
      // Functional actions are checked above. Screenshot persistence is not a
      // product requirement; record any dismissing events instead of guessing
      // their cause or altering the application's scroll/resize behaviour.
      await article.click({ button: 'right' })
      actions = page.getByRole('menu', { name: 'Ações do ponto', exact: true })
      await actions.waitFor()
      assert.equal(await actions.isVisible(), true, 'menu visível antes da captura de viewport')
      const beforeCapture = await page.evaluate(() => {
        const events = []
        const state = () => {
          const menu = document.querySelector('.km-context-menu'), rect = menu?.getBoundingClientRect()
          return { menuVisible: !!rect && rect.width > 0 && rect.height > 0, menu: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null, scrollX, scrollY, innerWidth, innerHeight, clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight }
        }
        const record = event => {
          if (events.length < 40) events.push({ type: event.type, target: event.target === window ? 'window' : event.target === document ? 'document' : `${event.target?.tagName || 'unknown'}${event.target?.id ? '#' + event.target.id : ''}`, time: performance.now(), ...state() })
        }
        for (const type of ['scroll', 'resize', 'pointerdown', 'wheel']) window.addEventListener(type, record, true)
        window.__knowledgeMenuCapture = { state, events, stop: () => { for (const type of ['scroll', 'resize', 'pointerdown', 'wheel']) window.removeEventListener(type, record, true) } }
        return state()
      })
      await page.screenshot({ path: path.join(out, `${scenario}-context-menu.png`), caret: 'initial' })
      await frames(page)
      const afterCapture = await page.evaluate(() => {
        const probe = window.__knowledgeMenuCapture, result = { state: probe.state(), events: probe.events }
        probe.stop(); delete window.__knowledgeMenuCapture
        return result
      })
      const captureDiagnostic = { scenario, method: 'Playwright viewport screenshot, caret initial', before: beforeCapture, after: afterCapture.state, events: afterCapture.events }
      report.captureDiagnostics.push(captureDiagnostic)
      fs.writeFileSync(path.join(out, `${scenario}-menu-capture.json`), JSON.stringify(captureDiagnostic, null, 2))
      if (await actions.isVisible()) await page.keyboard.press('Escape')
      await actions.waitFor({ state: 'hidden' })
      await map.getByRole('button', { name: 'Voltar à matriz', exact: true }).click()
      await map.getByRole('button', { name: 'Grafo', exact: true }).click()
      await map.getByRole('button', { name: 'Pausar movimento', exact: true }).click()
      await motionNode.focus(); await page.keyboard.press('Shift+F10')
      actions = page.getByRole('menu', { name: 'Ações do ponto', exact: true })
      await actions.getByRole('menuitem', { name: 'Ir para a página ↗', exact: true }).click()
      await page.waitForURL(/#aprender\/inflacao$/)
      await page.locator('.learn-card.is-focus').waitFor()
      report.results.push({ width, theme, status: 'pass', motion: true, pauseZoom: true, pan: true, drag: true, localStar: true, autoFit: true, fullscreen: true, nativeFullscreen: fullscreen.native, fullscreenMenu: true, fullscreenExit: true, mobileDetailDrawer: width === 390, matrix: true, emptySearch: true, filters: true, publication: true, contextMenu: true, keyboardMenu: true, menuFocusReturn: true, newsPopup: true, internalDestination: true, externalRequestsBlocked: true, overflow: false })
      await context.close()
    }
    assert.equal(report.results.length, 4)
    assert.deepEqual(report.errors, [])
    report.passed = true
    console.log('PASS mapa: 4 cenários, movimento, zoom, pan/drag, conexões diretas, enquadramento automático, tela cheia/saída/menu, matriz, busca, notícias, popup bloqueado, menu de contexto, teclado e responsividade')
  } catch (error) {
    report.failure = `${activeScenario}: ${error.message}`
    if (activePage) await activePage.screenshot({ path: path.join(out, `${activeScenario}-failure.png`), fullPage: true }).catch(() => {})
    throw error
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
