// Câmbio futuro (pedido de 27/11/2026): "?" ao lado do título com a explicação e o vídeo do YouTube embutido.
// Confere que a ajuda abre, cabe na tela e traz o vídeo; registra se o YouTube carregou o player (depende da rede do CI).
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.CF_AJUDA_QA_OUTPUT || 'cf-ajuda-qa'

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(require('./smoke-launch.cjs')())
  const report = []
  try {
    for (const [width, height] of [[1366, 768], [390, 844]]) {
      const page = await (await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce' })).newPage()
      await page.goto(`${base}/#calculadora/cambio-futuro`)
      await page.locator('#cf-f-title').waitFor()
      const help = page.getByRole('button', { name: 'Ajuda: O que é câmbio futuro' })
      assert.equal(await help.count(), 1, `${width}px: "?" ao lado do título`)
      await help.click()
      const dialog = page.getByRole('dialog', { name: 'O que é câmbio futuro' })
      await dialog.waitFor()
      const frame = dialog.locator('iframe')
      assert.match(await frame.getAttribute('src'), /^https:\/\/www\.youtube-nocookie\.com\/embed\/xJr3uf1CXSo$/)
      const box = await dialog.boundingBox(), video = await frame.boundingBox()
      assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `${width}px: ajuda dentro da tela ${JSON.stringify(box)}`)
      assert.ok(Math.abs(video.width / video.height - 16 / 9) < 0.05, `${width}px: vídeo em 16:9 ${JSON.stringify(video)}`)
      await frame.scrollIntoViewIfNeeded()
      // O player é de outro site: só registra o que aparece, sem reprovar por falta de rede.
      let player = 'não carregou'
      try {
        const yt = await (await frame.elementHandle()).contentFrame()
        await yt.waitForLoadState('domcontentloaded', { timeout: 15000 })
        await page.waitForTimeout(3000)
        const t = (await yt.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ').trim()
        player = /indispon|unavailable|não está disponível|desativad|disabled/i.test(t) ? `bloqueado: ${t.slice(0, 160)}` : `ok: ${t.slice(0, 120)}`
      } catch (error) { player = `não carregou: ${error.message.split('\n')[0]}` }
      report.push({ width, player })
      console.log(`${width}px player: ${player}`)
      await page.screenshot({ path: path.join(out, `ajuda-${width}.png`) })
      await page.close()
    }
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
    await browser.close()
  }
})().catch(error => { console.error(error); process.exit(1) })
