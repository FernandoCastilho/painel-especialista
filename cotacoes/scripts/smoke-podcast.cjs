// Regression of the actual built UI with deterministic RSS and decoded WAV audio.
// No real producer requests; this is browser/media-engine proof, NOT live-feed availability.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const base = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768').replace(/\/$/, '')
const out = process.env.PODCAST_QA_OUTPUT || 'workspace-qa/podcast'
const wav = Buffer.alloc(44 + 8000 * 2 * 90)
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40)
const artHost = 'https://d3t3ozftmdmh3i.cloudfront.net'
const artPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPI3P8fAAO8AihqTpd6AAAAAElFTkSuQmCC', 'base64')
const report = { fixture: 'RSS + 90-second silent WAV, actual HTMLAudioElement; no media API mocks', cases: [] }
;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  let page
  try {
    for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' })
      await context.route('https://anchor.fm/**', route => {
        const id = new URL(route.request().url()).pathname.split('/')[2]
        const program = { f84d76fc: 'morning', e0ddef4c: 'views', f9f69e70: 'daily-fin' }[id]
        if (!program) return route.abort()
        const art = suffix => '<itunes:image href="' + artHost + '/fixture/' + program + '-' + suffix + '.png"/>'

        return route.fulfill({ contentType: 'application/rss+xml', headers: { 'access-control-allow-origin': '*' }, body: '<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>' + art('cover') + '<item>' + art('episode') + '<title>Teste ' + program + '</title><pubDate>Tue, 17 Nov 2026 12:00:00 GMT</pubDate><enclosure url="https://podcast-fixture.invalid/' + program + '.wav" type="audio/wav"/></item></channel></rss>' })
      })
      await context.route(artHost + '/**', route => {
        const path = new URL(route.request().url()).pathname
        if (path.endsWith('/morning-episode.png') || path.endsWith('/daily-fin-cover.png') || path.endsWith('/daily-fin-episode.png') || path.includes('/41836892/')) return route.fulfill({ status: 404, body: '' })
        return route.fulfill({ contentType: 'image/png', body: artPixel })
      })
      await context.route('https://podcast-fixture.invalid/**', route => {
        // Media seeking requires byte ranges, like the producer's audio server.
        const range = route.request().headers().range
        const headers = { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes' }
        if (!range) return route.fulfill({ status: 200, contentType: 'audio/wav', body: wav, headers })
        const match = /^bytes=(\d+)-(\d*)$/.exec(range)
        const start = match ? Number(match[1]) : wav.length
        const end = match && match[2] ? Math.min(Number(match[2]), wav.length - 1) : wav.length - 1
        if (start > end || start >= wav.length) return route.fulfill({ status: 416, headers: { ...headers, 'content-range': 'bytes */' + wav.length }, body: '' })
        return route.fulfill({ status: 206, contentType: 'audio/wav', body: wav.subarray(start, end + 1), headers: { ...headers, 'content-range': 'bytes ' + start + '-' + end + '/' + wav.length } })
      })
      page = await context.newPage()
      await page.goto(base + '/#podcast', { waitUntil: 'domcontentloaded' })
      await page.locator('.podcast-program').nth(1).waitFor()
      const notice = page.getByRole('dialog', { name: 'Aviso', exact: true })
      if (await notice.isVisible()) await notice.getByRole('button', { name: 'Entendi', exact: true }).click()
      await page.locator('audio').waitFor({ state: 'attached' })
      await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme)
      assert.equal(await page.locator('.podcast-program').count(), 3)
      assert.equal(await page.locator('audio').evaluate(a => a.paused), true, 'no autoplay')
      const geometry = await page.evaluate(() => {
        const a = document.querySelector('.podcast-listening').getBoundingClientRect(), b = document.querySelector('.podcast-programs').getBoundingClientRect()
        return { player: { x:a.x,y:a.y,right:a.right,bottom:a.bottom }, programs:{x:b.x,y:b.y}, viewport:innerWidth, scroll:document.documentElement.scrollWidth }
      })
      assert.ok(geometry.scroll <= width + 1, 'no horizontal clipping')
      if (width < 800) assert.ok(geometry.programs.y >= geometry.player.bottom - 1, 'programs below player')
      else assert.ok(geometry.programs.x >= geometry.player.right - 1, 'programs alongside player')
      const link = page.locator('.podcast-external a').first()
      const linkColor = await link.evaluate(a => getComputedStyle(a).color)
      assert.equal(linkColor, 'rgb(105, 191, 255)', 'navy card link remains readable')
      await link.hover()
      assert.equal(await link.evaluate(a => getComputedStyle(a).color), linkColor, 'hover contrast preserved')
      const played = []
      for (let i = 0; i < 3; i++) {
        await page.locator('.podcast-program').nth(i).click()
        assert.equal(await page.locator('audio').count(), 1)
        if (i < 2) {
          const expected = i === 0 ? 'morning-cover.png' : 'views-episode.png'
          await page.waitForFunction(name => {
            const img = document.querySelector('.podcast-art img')
            return img?.src.endsWith(name) && img.complete && img.naturalWidth > 0
          }, expected)
        } else {
          await page.locator('.podcast-art svg').waitFor()
          assert.equal(await page.getByRole('link', { name: /Abrir no Podcast Addict/ }).getAttribute('href'), 'https://podcastaddict.com/podcast/daily-fin-podcast/5848272')
        }
        assert.equal(await page.locator('audio').evaluate(a => a.paused), true, 'changing program does not autoplay')
        const panel = await page.locator('.podcast-listening').boundingBox()
        const cover = await page.locator('.podcast-art').boundingBox()
        assert.ok(cover.width < panel.width && cover.width === cover.height, 'cover stays square within the player')
        await page.getByRole('button', { name:'Reproduzir episódio', exact:true }).click()
        await page.waitForFunction(() => { const a=document.querySelector('audio'); return a && !a.paused && a.currentTime > .2 && a.readyState >= 2 })
        played.push(await page.locator('audio').evaluate(a => ({src:a.currentSrc,time:a.currentTime,duration:a.duration})))
        await page.getByRole('button', { name:'Pausar episódio', exact:true }).click()
        assert.equal(await page.locator('audio').evaluate(a => a.paused), true)
        await page.waitForFunction(() => { const a=document.querySelector('audio'); return a.seekable.length && a.seekable.end(a.seekable.length - 1) >= 60 })
        await page.getByRole('button', { name:'Avançar 30 segundos', exact:true }).click()
        await page.waitForFunction(() => { const a=document.querySelector('audio'); return !a.seeking && a.currentTime >= 30 })
        assert.ok(await page.locator('audio').evaluate(a => a.currentTime >= 30))
        await page.getByRole('button', { name:'Voltar 15 segundos', exact:true }).click()
        await page.waitForFunction(() => { const a=document.querySelector('audio'); return !a.seeking && a.currentTime >= 15 && a.currentTime < 17 })
        assert.ok(await page.locator('audio').evaluate(a => a.currentTime >= 15 && a.currentTime < 17))
        await page.getByLabel('Velocidade de reprodução').selectOption('1.5')
        assert.equal(await page.locator('audio').evaluate(a => a.playbackRate), 1.5)
        await page.getByLabel('Volume', {exact:true}).press('End')
        await page.getByLabel('Volume', {exact:true}).press('ArrowLeft')
        assert.equal(await page.locator('audio').evaluate(a => a.volume), .95)
        await page.getByLabel('Posição do episódio', {exact:true}).press('Home')
        await page.getByLabel('Posição do episódio', {exact:true}).press('ArrowRight')
        await page.waitForFunction(() => { const a=document.querySelector('audio'); return !a.seeking && Math.abs(a.currentTime - 1) < .1 })
        assert.ok(await page.locator('audio').evaluate(a => Math.abs(a.currentTime - 1) < .1))
      }
      await page.screenshot({path:path.join(out, width + '-' + theme + '.png'), fullPage:true})
      report.cases.push({width,theme,geometry,linkColor,played})
      await context.close()
    }
    // Delivery check for this integration only. Later deploys keep the deterministic fixture smoke.
    if (process.env.PODCAST_REAL_DAILY_FIN === '1' ||
        (process.env.GITHUB_EVENT_NAME === 'pull_request' && process.env.GITHUB_HEAD_REF === 'nexo/daily-fin-capas-podcast')) {
      const live = await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'})
      page = await live.newPage()
      await page.goto(base + '/#podcast', {waitUntil:'domcontentloaded'})
      await page.getByRole('button',{name:/Daily Fin Podcast/}).waitFor({timeout:15000})
      const notice = page.getByRole('dialog',{name:'Aviso',exact:true})
      if (await notice.isVisible()) await notice.getByRole('button',{name:'Entendi',exact:true}).click()
      await page.getByRole('button',{name:/Daily Fin Podcast/}).click()
      await page.waitForFunction(() => {
        const audio=document.querySelector('audio')
        if (!audio?.src) return false
        const u=new URL(audio.src)
        return u.protocol==='https:' && !u.hostname.endsWith('.invalid')
      },null,{timeout:35000})
      await page.getByRole('button',{name:'Reproduzir episódio',exact:true}).click()
      await page.waitForFunction(() => {
        const a=document.querySelector('audio')
        return a && !a.paused && a.currentTime>=1 && a.readyState>=2 && !a.error
      },null,{timeout:45000})
      report.realDailyFin = await page.locator('audio').evaluate(a=>({origin:new URL(a.currentSrc).hostname,time:a.currentTime,duration:a.duration,readyState:a.readyState}))
      await page.getByRole('button',{name:'Pausar episódio',exact:true}).click()
      assert.equal(await page.locator('audio').evaluate(a=>a.paused),true)
      console.log('PASS Daily Fin: episódio verdadeiro reproduzido sem interceptar áudio',JSON.stringify(report.realDailyFin))
      await live.close()
    }
    report.passed = true
  } catch (error) {
    report.error = error.stack
    if (page && !page.isClosed()) report.mediaAtFailure = await page.locator('audio').evaluate(a => ({ currentTime:a.currentTime, duration:a.duration, paused:a.paused, seeking:a.seeking, readyState:a.readyState, networkState:a.networkState, seekable:Array.from({length:a.seekable.length},(_,i)=>[a.seekable.start(i),a.seekable.end(i)]), error:a.error?.code ?? null })).catch(()=>null)
    if (page && !page.isClosed()) await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{})
    throw error
  } finally {
    fs.writeFileSync(path.join(out,'report.json'), JSON.stringify(report,null,2))
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
