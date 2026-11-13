// Run against the local CI build. No remote writes or publication.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.FOLDERS_QA_OUTPUT || 'workspace-qa/folders'
const report = { schemaVersion: 1, passed: false, results: [], errors: [] }
;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  let activePage, activeScenario
  try {
    for (const width of [320, 390, 768, 1440]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 960 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' })
      await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort())
      await context.route('**/recado.json*', route => route.fulfill({ json: { ativo: false } }))
      const page = await context.newPage()
      activePage = page
      activeScenario = `${width}-${theme}`
      page.on('pageerror', error => report.errors.push(error.message))
      const overflow = async () => {
        const size = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
        assert.ok(size.scroll <= size.viewport + 1, `${width}/${theme}: sem rolagem horizontal: ${JSON.stringify(size)}`)
      }
      await page.goto(`${base}/#setores/central`)
      const folders = page.locator('.central-folder')
      await folders.first().waitFor()
      await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme)
      assert.equal(await folders.count(), 15)
      await folders.last().scrollIntoViewIfNeeded()
      await folders.first().scrollIntoViewIfNeeded()
      await page.waitForFunction(() => [...document.querySelectorAll('.central-folder img')].every(image => image.complete && image.naturalWidth === 1536 && image.naturalHeight === 1024))
      if (width < 1000) {
        const more = page.getByRole('button', { name: 'Mais', exact: true })
        const menu = page.getByRole('menu', { name: 'Mais', exact: true })
        const focused = async name => {
          await page.waitForFunction(expected => document.activeElement?.matches('[role="menuitem"]') && document.activeElement.textContent.trim() === expected, name)
          assert.equal(await menu.getByRole('menuitem', { name, exact: true }).evaluate(element => element === document.activeElement), true)
        }
        await more.focus(); await page.keyboard.press('ArrowDown')
        await focused('BNDES')
        await page.keyboard.press('ArrowUp'); await focused('Aprender')
        await page.keyboard.press('Home'); await focused('BNDES')
        await page.keyboard.press('End'); await focused('Aprender')
        await page.keyboard.press('Escape')
        assert.equal(await menu.count(), 0)
        assert.equal(await more.evaluate(element => element === document.activeElement), true)
        await page.keyboard.press('ArrowUp'); await focused('Aprender')
        await page.keyboard.press('Tab')
        assert.equal(await menu.count(), 0)
        assert.equal(await page.evaluate(() => document.activeElement === document.body), false, 'Tab must not lose focus to body')
        await more.click(); await focused('BNDES')
        await page.keyboard.press('ArrowDown'); await focused('Setores')
        await page.keyboard.press('Enter')
        assert.equal(await menu.count(), 0)
        await folders.first().waitFor()
      }
      await overflow()
      const clipped = await folders.evaluateAll(elements => elements.filter(element => element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1).map(element => element.textContent))
      assert.deepEqual(clipped, [], 'nomes completos cabem nas pastas')
      await page.screenshot({ path: path.join(out, `${width}-${theme}-pastas.png`), fullPage: true })
      const firstFolder = page.getByRole('button', { name: 'Explorar Base florestal e madeira, 6 subsetores' })
      await firstFolder.focus()
      await page.keyboard.press('Enter')
      await page.waitForURL('**/#setores/pasta/base-florestal')
      assert.equal(await page.locator('.central-topics .central-topic').count(), 6)
      await page.locator('.central-subsector').last().scrollIntoViewIfNeeded()
      await page.locator('.central-subsector').first().scrollIntoViewIfNeeded()
      await page.waitForFunction(() => [...document.querySelectorAll('.central-subsector img')].every(image => image.complete && image.naturalWidth === 1536 && image.naturalHeight === 1024))
      await page.screenshot({ path: path.join(out, `${width}-${theme}-subsetores.png`), fullPage: true })
      await page.getByRole('button', { name: 'Compensados', exact: true }).click()
      await page.waitForURL('**/#setores/topico/base-florestal/3')
      await page.locator('.central-detail').getByRole('heading', { name: 'Compensados', exact: true }).waitFor()
      assert.equal(await folders.count(), 0, 'grade não disputa espaço com estudo')
      assert.equal(await page.locator('.central-catalog').count(), 0)
      await overflow()
      await page.screenshot({ path: path.join(out, `${width}-${theme}-estudo.png`) })
      // Re-select the already open study with the keyboard. No duplicate history
      // entry should be created, and the removed result must not take focus away.
      const historyBeforeRepeat = await page.evaluate(() => history.length)
      for (let repeat = 0; repeat < 2; repeat++) {
        await page.getByLabel('Buscar setor ou subsetor').fill('compensados')
        const currentResult = page.locator('#central-topic-base-florestal-3')
        assert.equal(await currentResult.getAttribute('aria-current'), 'page')
        await currentResult.focus()
        await page.keyboard.press('Enter')
        await page.locator('.central-detail').getByRole('heading', { name: 'Compensados', exact: true }).waitFor()
        await page.waitForFunction(() => document.activeElement?.classList.contains('central-surface'))
        assert.equal(await page.getByLabel('Buscar setor ou subsetor').inputValue(), '')
        assert.equal(await page.evaluate(() => history.length), historyBeforeRepeat)
        const visible = await page.locator('.central-detail').evaluate(element => { const r = element.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight })
        assert.equal(visible, true, 'seleção repetida traz o estudo ao campo visual')
      }
      await page.getByLabel('Trocar subsetor', { exact: true }).selectOption('topico/base-florestal/4')
      await page.waitForURL('**/#setores/topico/base-florestal/4')
      await page.goBack()
      await page.locator('.central-detail').getByRole('heading', { name: 'Compensados', exact: true }).waitFor()
      await page.goForward()
      await page.locator('.central-detail').getByRole('heading', { name: 'MDF e MDP', exact: true }).waitFor()
      await page.reload()
      await page.locator('.central-detail').getByRole('heading', { name: 'MDF e MDP', exact: true }).waitFor()
      assert.match(page.url(), /#setores\/topico\/base-florestal\/4$/)
      await page.getByLabel('Buscar setor ou subsetor').fill('ciberseguranca')
      await page.getByRole('button', { name: 'Cibersegurança', exact: true }).click()
      await page.waitForURL('**/#setores/topico/tic/1')
      await page.goBack()
      await page.waitForFunction(() => document.querySelector('.central-search input')?.value === 'ciberseguranca')
      await page.waitForFunction(() => document.activeElement?.id === 'central-topic-tic-1')
      assert.equal(await page.getByRole('button', { name: 'Cibersegurança', exact: true }).evaluate(element => element === document.activeElement), true, 'voltar restaura foco no resultado')
      await page.reload()
      await page.waitForFunction(() => document.querySelector('.central-search input')?.value === 'ciberseguranca')
      await page.goForward()
      await page.locator('.central-detail').getByRole('heading', { name: 'Cibersegurança', exact: true }).waitFor()
      await page.getByLabel('Trocar subsetor', { exact: true }).selectOption('topico/base-florestal/4')
      await page.locator('.central-detail').getByRole('heading', { name: 'MDF e MDP', exact: true }).waitFor()
      assert.equal(await page.getByLabel('Buscar setor ou subsetor').inputValue(), '', 'nova seleção não restaura busca antiga')
      await page.getByLabel('Buscar setor ou subsetor').fill('nãoexistezzz')
      await page.getByText('Nenhum tópico encontrado. Tente outro termo.').waitFor()
      await page.locator('.central-empty').getByRole('button', { name: 'Limpar busca', exact: true }).focus()
      await page.keyboard.press('Enter')
      await page.waitForFunction(() => document.activeElement === document.querySelector('.central-search input'))
      await page.locator('.central-detail').getByRole('heading', { name: 'MDF e MDP', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Todos os setores', exact: true }).click()
      await folders.first().waitFor()
      await page.getByLabel('Buscar setor ou subsetor').fill('compensados')
      await page.getByRole('button', { name: 'Compensados', exact: true }).click()
      await page.getByRole('button', { name: 'Todos os setores', exact: true }).click()
      assert.equal(await page.getByLabel('Buscar setor ou subsetor').inputValue(), 'compensados')
      await page.goBack()
      await page.locator('.central-detail').getByRole('heading', { name: 'Compensados', exact: true }).waitFor()
      await page.goForward()
      await page.waitForFunction(() => document.querySelector('.central-search input')?.value === 'compensados')
      await page.reload()
      await page.waitForFunction(() => document.querySelector('.central-search input')?.value === 'compensados')
      assert.equal(await page.getByRole('button', { name: 'Compensados', exact: true }).count(), 1)
      await page.getByRole('button', { name: 'Limpar busca', exact: true }).focus()
      await page.keyboard.press('Enter')
      await page.waitForFunction(() => document.activeElement === document.querySelector('.central-search input'))
      await folders.first().waitFor()
      const motion = await folders.first().evaluate(element => ({ duration: getComputedStyle(element).transitionDuration, transform: getComputedStyle(element).transform }))
      assert.equal(motion.duration, '0s', 'reduced-motion desliga transição')
      await page.getByRole('button', { name: 'Cobre', exact: true }).click()
      await page.waitForURL('**/#setores/cobre')
      await page.locator('.central-detail-content .desk-panel').waitFor()
      await overflow()
      await page.goto(`${base}/#setores/pasta/inexistente`)
      await page.getByText('Este setor ou subsetor não foi encontrado. Escolha um setor ou use a busca.').waitFor()
      assert.equal(await folders.count(), 15)
      if (width === 1440 && theme === 'dark') {
        const ids = await folders.evaluateAll(elements => elements.map(element => element.id))
        let topicImages = 0
        for (const id of ids) {
          await page.locator(`#${id}`).click()
          const topics = page.locator('.central-subsector')
          topicImages += await topics.count()
          await topics.last().scrollIntoViewIfNeeded()
          await topics.first().scrollIntoViewIfNeeded()
          await page.waitForFunction(() => [...document.querySelectorAll('.central-subsector img')].every(image => image.complete && image.naturalWidth === 1536 && image.naturalHeight === 1024))
          await overflow()
          await page.screenshot({ path: path.join(out, `${id}-subsetores.png`), fullPage: true })
          await page.getByRole('button', { name: 'Todos os setores', exact: true }).click()
        }
        assert.equal(topicImages, 81, 'todos os subsetores recebem imagem local')
      }
      if (width === 320 || width === 390 || width === 1440) {
        for (const group of ['turismo', 'varejo', 'saude', 'pet']) {
          await page.goto(`${base}/#setores/pasta/${group}`)
          const highlight = page.locator('.central-highlight')
          const cards = page.locator('.central-subsectors')
          await highlight.waitFor()
          assert.equal(await highlight.getByText('O que acompanhar', { exact: true }).count(), 1)
          const bounds = await highlight.boundingBox(), cardBounds = await cards.boundingBox()
          assert.ok(bounds && cardBounds && bounds.y + bounds.height <= cardBounds.y, `${group}: resumo vem antes dos cards`)
          await overflow()
          await page.screenshot({ path: path.join(out, `${width}-${theme}-${group}-executivo.png`), fullPage: true })
        }
        await page.goto(`${base}/#setores/central`)
        await folders.first().waitFor()
      }
      if (width === 390) {
        await page.locator('#central-folder-tic').click()
        await page.locator('.central-subsector').last().scrollIntoViewIfNeeded()
        await page.locator('.central-subsector').first().scrollIntoViewIfNeeded()
        await page.waitForFunction(() => [...document.querySelectorAll('.central-subsector img')].every(image => image.complete && image.naturalWidth === 1536))
        await page.keyboard.press('Tab')
        await page.locator('.central-subsector').first().focus()
        assert.equal(await page.locator('.central-subsector').first().evaluate(element => element.matches(':focus-visible') && getComputedStyle(element).outlineStyle !== 'none' && parseFloat(getComputedStyle(element).outlineWidth) >= 2), true, 'subsetor tem foco de teclado visível')
        await overflow()
        await page.screenshot({ path: path.join(out, `${width}-${theme}-tic.png`), fullPage: true })
      }
      report.results.push({ width, theme, status: 'pass', folders: 15, images: true, navigation: true, search: true, history: true, reload: true, focus: true, repeatSelection: true, clearFocus: true, overflow: false, reducedMotion: true, inputs: true, invalidRoute: true, moreKeyboard: width < 1000 ? true : 'not-applicable' })
      await context.close()
    }
    assert.deepEqual(report.errors, [])
    report.passed = true
    console.log(`PASS: ${report.results.length} cenários de pastas em desktop/mobile e claro/escuro`)
  } catch (error) {
    report.failure = error.message
    if (activePage) report.failureContext = await activePage.evaluate(() => ({
      url: location.href,
      query: document.querySelector('.central-search input')?.value,
      historyState: history.state,
      expectedFocusId: history.state?.centralSetorial?.focusId,
      expectedFocusExists: Boolean(document.getElementById(history.state?.centralSetorial?.focusId || '')),
      activeElement: { id: document.activeElement?.id, tag: document.activeElement?.tagName, className: document.activeElement?.className },
      visibleResults: [...document.querySelectorAll('.central-topic')].map(element => ({ id: element.id, visible: element.getClientRects().length > 0 })),
    })).catch(() => null)
    if (activePage) await activePage.screenshot({ path: path.join(out, `${activeScenario}-failure.png`), fullPage: true }).catch(() => {})
    throw error
  }
  finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
