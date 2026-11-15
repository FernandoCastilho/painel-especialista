// Local/CI build only. No publication, remote writes or live source mutation.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const sha256 = value => createHash('sha256').update(value).digest('hex')
let transcriptText
const studies = require('../src/sectorStudies/studies.json')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.RESEARCHED_SECTORS_QA_OUTPUT || 'workspace-qa/researched-sectors'
const report = { studies: studies.length, results: [], errors: [], audioPlayback: { schemaVersion: 1, humanOrNativeListeningPerformed: false, expected: studies.filter(study => study.audio?.src).length, results: [], scope: 'Browser playback, pause, seek, ending, speed and displayed duration. Not full-length listening or speech/content audit.' } }
// Component-only captures must not be obscured by the app's fixed navigation.
const captureComponent = (locator, filename) => locator.screenshot({ path: path.join(out, filename), style: '.nav-top, .term-head { visibility: hidden !important; }' })

async function verifyAudioPlayback(page, article, audio, study, key) {
  const duration = await audio.evaluate(element => element.duration)
  assert.ok(duration > 1, `gravação deve permitir teste real de reprodução: ${key}`)
  // Hash the exact URL used by the player, not an unchecked copy of manifest metadata.
  const currentSrc = await audio.evaluate(element => element.currentSrc)
  assert.equal(currentSrc, new URL(study.audio.src, page.url()).href, `origem do áudio: ${key}`)
  const mediaResponse = await page.request.get(currentSrc)
  assert.equal(mediaResponse.status(), 200, `bytes completos do áudio servido: ${key}`)
  const servedBytes = await mediaResponse.body()
  const fileSha256 = sha256(servedBytes)
  const textSha256 = sha256(transcriptText(study.transcript))
  assert.equal(fileSha256, study.audio.fileSha256, `hash do áudio servido: ${key}`)
  assert.equal(textSha256, study.audio.textSha256, `hash da transcrição atual: ${key}`)
  assert.equal(servedBytes.length, study.audio.bytes, `tamanho do áudio servido: ${key}`)
  assert.ok(Math.abs(duration - study.audio.durationSeconds) <= 0.1, `duração do áudio atual: ${key}`)
  const play = async () => {
    const error = await audio.evaluate(async element => {
      let timer
      try {
        await Promise.race([element.play(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('play() timed out')), 10000) })])
        return null
      } catch (error) { return error.message } finally { clearTimeout(timer) }
    })
    assert.equal(error, null, `reprodução real: ${key}`)
  }
  await play()
  await page.waitForFunction(() => {
    const audio = document.querySelector('.sector-study audio')
    return audio && !audio.error && !audio.paused && audio.currentTime >= 0.08
  }, null, { timeout: 10000 })
  const playedTo = await audio.evaluate(element => { element.pause(); return element.currentTime })
  await page.waitForTimeout(150)
  assert.equal(await audio.evaluate(element => element.paused), true, key)
  const pausedAt = await audio.evaluate(element => element.currentTime)
  assert.ok(Math.abs(pausedAt - playedTo) < 0.03, `pausa interrompe o relógio: ${key}`)
  const rates = [0.75, 1, 1.25, 1.5, 2]
  const rateChecks = []
  for (const rate of rates) {
    await article.getByLabel('Velocidade').selectOption(String(rate))
    const media = await audio.evaluate(element => ({ rate: element.playbackRate, defaultRate: element.defaultPlaybackRate, preservesPitch: element.preservesPitch, duration: element.duration, error: element.error }))
    assert.deepEqual(media, { rate, defaultRate: rate, preservesPitch: true, duration, error: null }, `${key} velocidade ${rate}`)
    const seconds = Math.round(duration / rate)
    const expectedLabel = `Tempo total nesta velocidade: ${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s.`
    await article.getByText(expectedLabel, { exact: true }).waitFor()
    const before = await audio.evaluate(element => element.currentTime)
    await play()
    await page.waitForFunction(({ before, rate }) => {
      const audio = document.querySelector('.sector-study audio')
      return audio && !audio.error && !audio.paused && audio.playbackRate === rate && audio.preservesPitch && audio.currentTime > before + 0.05
    }, { before, rate }, { timeout: 10000 })
    const after = await audio.evaluate(element => { element.pause(); return element.currentTime })
    rateChecks.push({ rate, observedRate: media.rate, before, after })
  }
  await audio.evaluate(element => { element.currentTime = element.duration - 0.25 })
  await page.waitForFunction(() => {
    const audio = document.querySelector('.sector-study audio')
    return audio && !audio.error && !audio.seeking && audio.currentTime >= audio.duration - 0.5
  }, null, { timeout: 10000 })
  const seekedTo = await audio.evaluate(element => element.currentTime)
  await play()
  await page.waitForFunction(() => {
    const audio = document.querySelector('.sector-study audio')
    return audio && !audio.error && audio.ended && audio.paused
  }, null, { timeout: 10000 })
  const endedAt = await audio.evaluate(element => element.currentTime)
  assert.ok(Math.abs(endedAt - duration) < 0.05, `fim real da gravação: ${key}`)
  report.audioPlayback.results.push({ study: key, studyKey: `${study.group}/${study.topicIndex}`, src: study.audio.src, fileSha256, textSha256, status: 'passed', durationSeconds: duration, playedTo, seekedTo, endedAt, rates, rateChecks, pauseObservation: { before: playedTo, after: pausedAt, waitedMs: 150 }, paused: true, ended: true, preservesPitch: true, durationLabels: true })
  await audio.evaluate(element => { element.currentTime = 0 })
  await article.getByLabel('Velocidade').selectOption('1.25')
}

;(async () => {
  ;({ transcriptText } = await import('../src/sectorStudies/presentation.js'))
  const { PLAYER_FILES } = await import('./sector-audio-release-lib.mjs')
  const repoRoot = path.resolve(__dirname, '../..')
  const manifestPath = path.resolve(__dirname, '../public/audio/sectors/manifest.json')
  report.audioPlayback.sources = {
    canonicalStudiesSha256: sha256(fs.readFileSync(path.resolve(__dirname, '../src/sectorStudies/studies.json'))),
    manifestSha256: fs.existsSync(manifestPath) ? sha256(fs.readFileSync(manifestPath)) : null,
    playerFiles: Object.fromEntries(PLAYER_FILES.map(filename => [filename, sha256(fs.readFileSync(path.join(repoRoot, filename)))])),
  }
  report.audioPlayback.generatedAt = new Date().toISOString()
  const { CATALOGO_SETORIAL } = await import('../src/centralSetorial.js')
  const catalog = CATALOGO_SETORIAL.flatMap(group => group.topics.map((title, topicIndex) => ({ group: group.id, topicIndex, title })))
  assert.equal(catalog.length, 81, 'catálogo completo, incluindo o piloto TIC')
  assert.ok(studies.length <= 80, 'até 80 estudos adicionais; lote parcial aprovado é válido')
  const included = new Set(studies.map(study => `${study.group}/${study.topicIndex}`))
  assert.equal(included.size, studies.length, 'nenhum estudo duplicado')
  const pending = catalog.filter(study => `${study.group}/${study.topicIndex}` !== 'tic/0' && !included.has(`${study.group}/${study.topicIndex}`))
  report.pending = pending.length
  fs.mkdirSync(out, { recursive: true })
  const launchOptions = require('./smoke-launch.cjs')()
  // Permit deterministic media QA only in the existing Chrome CI job.
  if (process.env.GITHUB_ACTIONS === 'true' && process.env.SMOKE_CHANNEL === 'chrome') launchOptions.args = ['--autoplay-policy=no-user-gesture-required']
  const browser = await chromium.launch(launchOptions)
  let activePage
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'no-preference', hasTouch: width <= 600 })
      await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort())
      await context.route('**/recado.json*', route => route.fulfill({ json: { ativo: false } }))
      const page = await context.newPage()
      activePage = page
      page.on('pageerror', error => report.errors.push({ width, url: page.url(), message: error.message }))
      const capturedGroups = new Set()
      for (const study of studies) {
        const key = `${study.group}-${study.topicIndex}`
        const url = `${base}/#setores/topico/${study.group}/${study.topicIndex}`
        try {
          await page.goto(url)
          const article = page.locator('.central-detail .sector-study')
          await article.getByRole('heading', { name: study.title, exact: true }).waitFor()
          assert.equal(await article.locator('.study-canvas-questions > li').count(), study.canvasQuestions.length, key)
          if (study.diagram.cycle) {
            assert.equal(await article.locator('.rich-stage').count(), study.diagram.nodes.length, key)
            assert.equal(await article.locator('.rich-link').count(), study.diagram.edges.length, key)
            assert.equal(await article.locator('.sector-chain-node').count(), 0, key)
          } else {
            assert.equal(await article.locator('.sector-chain-node').count(), study.diagram.nodes.length, key)
            assert.equal(await article.locator('.sector-chain-edges > li').count(), study.diagram.edges.length, key)
          }
          assert.equal(await article.locator('.study-nav, .study-callout').count(), 0, key)
          assert.equal(await article.locator('.study-summary').count(), 1, key)
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `overflow ${width} ${key}`)
          for (const chart of study.charts) {
            const panel = article.locator('section.study-chart').filter({ has: page.locator(`[id="chart-${chart.id}"]`) })
            await panel.getByText('Ver todos os dados e método', { exact: true }).click()
            assert.equal(await panel.locator('thead th').first().innerText(), chart.categoryLabel || 'Ano', key)
            assert.equal(await panel.locator('tbody tr').count(), chart.years.length, key)
            for (let seriesIndex = 0; seriesIndex < chart.series.length; seriesIndex++) {
              if (chart.series.length > 1) await panel.getByRole('combobox').selectOption(String(seriesIndex))
              const values = chart.series[seriesIndex].values
              const signed = chart.series.some(series => series.values.some(value => value < 0))
              assert.deepEqual(await panel.locator('.study-bar-row strong').allTextContents(), values.map(value => value.toLocaleString('pt-BR', { signDisplay: signed ? 'exceptZero' : 'auto' })), key)
              const valueLabels = await panel.locator('.study-bar-row strong').evaluateAll(elements => elements.map(element => {
                const range = document.createRange()
                range.selectNodeContents(element)
                return { lines: range.getClientRects().length, fits: element.scrollWidth <= element.clientWidth + 1 }
              }))
              assert.ok(valueLabels.every(value => value.lines === 1 && value.fits), `números sem quebra ou corte ${width} ${key}`)
              assert.equal(await panel.locator('.research-bar-negative').count(), values.filter(value => value < 0).length, key)
              if (signed) assert.ok((await panel.locator('.research-bar-axis').innerText()).includes('0'), key)
              const geometry = await panel.locator('.research-bar').evaluateAll(elements => elements.map(element => ({ left: parseFloat(element.style.left), width: parseFloat(element.style.width) })))
              geometry.forEach((bar, index) => { assert.ok(bar.left >= -0.01 && bar.left + bar.width <= 100.01, key); if (values[index] < 0) assert.ok(bar.left < 50 && Math.abs(bar.left + bar.width - 50) < .01, key) })
            }
          }
          const audio = article.locator('audio')
          if (study.audio?.src) {
            assert.equal(await audio.count(), 1, key)
            await audio.evaluate(element => element.load())
            await page.waitForFunction(() => { const audio = document.querySelector('.sector-study audio'); return audio && audio.readyState >= 1 && Number.isFinite(audio.duration) && audio.duration > 0 })
            assert.equal(await audio.evaluate(element => element.playbackRate), 1.25, key)
            assert.equal(await audio.evaluate(element => element.preservesPitch), true, key)
            assert.match(await article.innerText(), /Voz sintética/)
            await article.getByLabel('Velocidade').selectOption('1.5')
            assert.equal(await audio.evaluate(element => element.playbackRate), 1.5, key)
            // Exercise every recording once; both widths still verify metadata and controls.
            if (width === 1440) await verifyAudioPlayback(page, article, audio, study, key)
            await article.getByText('Ler transcrição', { exact: true }).click()
          } else {
            assert.equal(await audio.count(), 0, key)
            assert.match(await article.innerText(), /Áudio ainda não disponível para este estudo\./)
            await article.getByText('Ler síntese em texto', { exact: true }).click()
          }
          if (!capturedGroups.has(study.group) || (study.group === 'atacado' && study.topicIndex === 5)) {
            capturedGroups.add(study.group)
            await article.locator('.study-canvas-details').evaluate(el => { el.open = true })
            await captureComponent(article.locator('.study-canvas-details'), `${key}-${width}-canvas.png`)
            await captureComponent(article.locator('.researched-flow'), `${key}-${width}-cadeia.png`)
          }
          if (study.group === 'atacado' && study.topicIndex === 5) await captureComponent(article.locator('section.study-chart').last(), `${key}-${width}-historico.png`)
          if (study.group === 'tic' && study.topicIndex === 6) await captureComponent(article.locator('section.study-chart').last(), `${key}-${width}-mercados.png`)
          if (study.charts.some(chart => chart.series.some(series => series.values.some(value => value < 0))) && !fs.existsSync(path.join(out, `bipolar-${width}.png`))) await captureComponent(article.locator('section.study-chart').last(), `bipolar-${width}.png`)
          report.results.push({ width, study: key, status: 'passed' })
        } catch (error) {
          report.results.push({ width, study: key, status: 'failed', message: error.message })
          await page.screenshot({ path: path.join(out, `${key}-${width}-failure.png`), fullPage: true }).catch(() => {})
          throw error
        }
      }
      for (const [index, study] of pending.entries()) {
        await page.goto(`${base}/#setores/topico/${study.group}/${study.topicIndex}`)
        const detail = page.locator('.central-detail')
        await detail.getByRole('heading', { name: study.title, exact: true }).waitFor()
        assert.equal(await detail.locator('.sector-study').count(), 0, 'recorte excluído não pode expor rascunho')
        assert.match(await detail.innerText(), /Estudo setorial não incluído ainda/)
        assert.equal(await detail.locator('audio').count(), 0)
        if (index === 0) await detail.screenshot({ path: path.join(out, `pending-${width}.png`) })
        report.results.push({ width, study: `${study.group}-${study.topicIndex}`, status: 'pending-honest' })
      }
      await page.goto(`${base}/#setores/topico/tic/0`)
      await page.locator('#tic-study-title').waitFor()
      assert.equal(await page.locator('.tic-flow-stage').count(), 13, 'piloto TIC preservado')
      if (!studies.length) { await context.close(); continue }
      // Tela cheia e laser valem para os dois formatos: cadeia em texto (estudos sem desenhos) e cadeia em desenhos.
      const selected = studies.find(study => study.group === 'atacado' && study.topicIndex === 5) || studies.find(study => !study.diagram.cycle) || studies[0]
      const nodeSel = selected.diagram.cycle ? '.rich-stage' : '.sector-chain-node'
      const nodeAnimation = selected.diagram.cycle ? 'rich-glow' : 'sector-chain-step'
      const alternate = studies.find(study => study.title !== selected.title) || null
      const rich = studies.find(study => study.diagram.cycle)
      if (rich && width > 600) {
        await page.goto(`${base}/#setores/topico/${rich.group}/${rich.topicIndex}`)
        const richDiagram = page.locator('.researched-flow')
        await richDiagram.waitFor()
        const richStage = richDiagram.locator('.rich-stage').first()
        const richPacket = richDiagram.locator('.rich-packet').first()
        assert.equal(await richStage.evaluate(element => getComputedStyle(element).animationName), 'rich-glow')
        assert.equal(await richPacket.evaluate(element => getComputedStyle(element).animationName), 'rich-go')
        assert.equal(await richDiagram.locator('.rich-cycle').count(), 1)
        await richDiagram.focus()
        await page.keyboard.press('p')
        assert.equal(await richPacket.evaluate(element => getComputedStyle(element).animationPlayState), 'paused')
        await page.keyboard.press('p')
        assert.equal(await richPacket.evaluate(element => getComputedStyle(element).animationPlayState), 'running')
        await page.emulateMedia({ reducedMotion: 'reduce' })
        assert.equal(await richPacket.evaluate(element => getComputedStyle(element).animationName), 'none')
        await page.emulateMedia({ reducedMotion: 'no-preference' })
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'cadeia em desenhos sem rolagem horizontal')
      }
      await page.goto(`${base}/#setores/topico/${selected.group}/${selected.topicIndex}`)
      const diagram = page.locator('.researched-flow')
      await diagram.waitFor()
      const stage = diagram.locator(nodeSel).first()
      assert.equal(await stage.evaluate(element => getComputedStyle(element).animationName), nodeAnimation)
      assert.equal(await diagram.getByRole('button', { name: /Pausar|Retomar/ }).count(), 0)
      await diagram.focus()
      await page.keyboard.press('p')
      assert.equal(await stage.evaluate(element => getComputedStyle(element).animationPlayState), 'paused')
      await page.keyboard.press('p')
      assert.equal(await stage.evaluate(element => getComputedStyle(element).animationPlayState), 'running')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      assert.equal(await stage.evaluate(element => getComputedStyle(element).animationName), 'none')
      assert.equal(await diagram.getByRole('button', { name: 'Maximizar diagrama' }).isVisible(), true)
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await diagram.getByRole('button', { name: 'Maximizar diagrama' }).click()
      const modal = page.getByRole('dialog', { name: 'Diagrama em tela cheia' })
      await modal.waitFor()
      // The shared laser portal follows the newly visible host on the next frame.
      await modal.getByRole('button', { name: 'Laser pointer: riscar a tela', exact: true }).waitFor()
      assert.equal(await modal.locator('button:visible').count(), 1)
      const expandedDiagram = modal.locator('.researched-flow')
      const bounds = await expandedDiagram.boundingBox()
      assert.ok(bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= width + 1, JSON.stringify(bounds))
      if (width <= 600) {
        assert.ok(bounds.width >= width - 26, 'diagrama ocupa a largura disponível no celular')
        assert.equal(await expandedDiagram.evaluate(element => getComputedStyle(element).transform), 'none', 'texto não pode ser reduzido por escala')
        assert.ok(await modal.locator(`${nodeSel} strong`).first().evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 16), 'texto legível no celular')
        assert.equal(await modal.evaluate(element => element.scrollWidth <= element.clientWidth + 1), true, 'sem rolagem horizontal')
        assert.equal(await modal.evaluate(element => element.scrollHeight > element.clientHeight), true, 'diagrama completo usa rolagem vertical')
        await modal.evaluate(element => { element.scrollTop = element.scrollHeight })
        const last = await expandedDiagram.locator('figcaption').boundingBox()
        assert.ok(last.y >= 0 && last.y + last.height <= 1001, 'fim do diagrama acessível por rolagem')
        const laserBounds = await modal.getByRole('button', { name: 'Laser pointer: riscar a tela' }).boundingBox()
        assert.ok(laserBounds.y >= 0 && laserBounds.y + laserBounds.height <= 1001, 'laser permanece acessível ao rolar')
        await modal.screenshot({ path: path.join(out, `fullscreen-${width}-bottom.png`) })
        await page.setViewportSize({ width: 1440, height: 1000 })
        await page.waitForFunction(() => {
          const figure = document.querySelector('.researched-flow-fullscreen > .researched-flow')
          const box = figure.getBoundingClientRect()
          return getComputedStyle(figure).transform !== 'none' && figure.parentElement.scrollTop === 0 && box.x >= -1 && box.y >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1
        })
        assert.equal(await modal.locator('button:visible').count(), 1, 'redimensionamento preserva botão único')
        await page.setViewportSize({ width, height: 1000 })
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.researched-flow-fullscreen > .researched-flow')).transform === 'none')
        await modal.evaluate(element => { element.scrollTop = 0 })
      } else {
        assert.ok(bounds.y + bounds.height <= 1001, 'desktop preserva auto-fit')
      }
      await require('./helpers/verify-diagram-laser.cjs')(page, modal, width)
      await page.keyboard.press('p')
      assert.equal(await modal.locator(nodeSel).first().evaluate(element => getComputedStyle(element).animationPlayState), 'paused')
      await modal.screenshot({ path: path.join(out, `fullscreen-${width}.png`) })
      await page.keyboard.press('Escape')
      await modal.waitFor({ state: 'hidden' })
      await page.waitForFunction(() => !history.state?.sectorDiagramFullscreen)
      assert.equal(await page.locator('#root').evaluate(element => element.inert), false)
      assert.equal(await diagram.getByRole('button', { name: 'Maximizar diagrama' }).evaluate(element => element === document.activeElement), true, 'devolve foco ao botão de maximizar')
      await diagram.getByRole('button', { name: 'Maximizar diagrama' }).click()
      await modal.waitFor()
      await page.emulateMedia({ reducedMotion: 'reduce' })
      assert.equal(await modal.locator(nodeSel).first().evaluate(element => getComputedStyle(element).animationName), 'none')
      await page.goBack()
      await modal.waitFor({ state: 'hidden' })
      const destination = alternate || { group: 'tic', topicIndex: 0, title: 'Integração de TI e infraestrutura digital' }
      const search = page.getByLabel('Buscar setor ou subsetor')
      await search.fill(destination.title)
      await page.locator('.central-catalog').getByRole('button', { name: destination.title, exact: true }).first().click()
      await page.waitForURL(`**/#setores/topico/${destination.group}/${destination.topicIndex}`)
      await page.locator('.sector-study').getByRole('heading', { name: destination.title, exact: true }).waitFor()
      await page.goBack()
      await page.waitForURL(`**/#setores/topico/${selected.group}/${selected.topicIndex}`)
      await page.waitForFunction(title => document.querySelector('.central-search input')?.value === title, destination.title)
      await page.getByRole('button', { name: 'Limpar busca', exact: true }).click()
      await page.locator('.sector-study').getByRole('heading', { name: selected.title, exact: true }).waitFor()
      await page.goForward()
      await page.locator('.sector-study').getByRole('heading', { name: destination.title, exact: true }).waitFor()
      await page.reload()
      await page.locator('.sector-study').getByRole('heading', { name: destination.title, exact: true }).waitFor()
      await context.close()
    }
    assert.deepEqual(report.errors, [], 'erros JavaScript no navegador')
    assert.equal(report.audioPlayback.results.length, report.audioPlayback.expected, 'todas as gravações incluídas passam por reprodução, pausa, busca, fim e velocidades')
    console.log(`PASS: ${studies.length} estudos e ${pending.length} placeholders em desktop/mobile; piloto TIC preservado; dados, áudio, apresentação e navegação`)
    console.log(`Browser audio playback: ${report.audioPlayback.results.length}/${report.audioPlayback.expected}; full-length decoding and speech fidelity are separate audits.`)
  } catch (error) {
    report.failure = error.message
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(out, 'interaction-failure.png'), fullPage: true }).catch(() => {})
    throw error
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
    await browser.close()
  }
})().catch(error => { console.error(error); process.exit(1) })
