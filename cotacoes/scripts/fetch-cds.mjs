/* global document, window -- usados só dentro da página aberta no navegador */
// CDS de 5 anos do Brasil (World Government Bonds, fonte gratuita e não oficial). Rodado junto da coleta das cotações,
// mas visita o site no máximo a cada ~2 h. A página só mostra o número depois de carregar, então abre num Chrome sem janela
// (navegador comum, sem disfarce) e lê o texto montado. Qualquer falha mantém o último dado válido: nunca derruba a coleta.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { CDS_SOURCE, buildCdsData, cdsDue, cdsFailure, chartHistory, parseCdsText } from '../src/cds.js'

const dir = process.env.DATA_DIR ?? '/tmp/data'
const file = join(dir, 'cds.json')
let previous = null
try { previous = JSON.parse(await readFile(file, 'utf8')) } catch { /* primeira coleta */ }

if (!cdsDue(previous)) {
  console.log('CDS: coletado há menos de 2 h; sem nova visita ao site')
  process.exit(0)
}

async function readPage() {
  if (!process.env.PLAYWRIGHT_DIR) throw new Error('navegador da coleta não preparado')
  const { chromium } = createRequire(join(process.env.PLAYWRIGHT_DIR, 'noop.js'))('playwright')
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true })
  try {
    const page = await browser.newPage()
    // CDS_URL só para o teste automatizado (página local simulada); a coleta real usa sempre o endereço da fonte.
    const res = await page.goto(process.env.CDS_URL || CDS_SOURCE.url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    // Bloqueio ou erro do site: para aqui, sem tentar contornar.
    if (!res || res.status() >= 400) throw new Error(`site respondeu HTTP ${res?.status() ?? 'sem resposta'}`)
    await page.waitForFunction(() => /value stands at \d/.test(document.body.innerText.replace(/\s+/g, ' ')), null, { timeout: 45000 })
    const text = await page.evaluate(() => document.body.innerText)
    // Histórico de 12 meses: a mesma página traz um gráfico diário que só monta quando aparece na tela.
    // Lê os pontos que a própria página já carregou; se não aparecer, segue só com o número do dia.
    let chart = []
    try {
      await page.getByRole('heading', { name: /Interactive Chart/i }).scrollIntoViewIfNeeded({ timeout: 10000 })
      await page.waitForFunction(() => window.Highcharts?.charts?.some((c) => c?.series?.some((s) => s.name === 'CDS' && s.options?.data?.length)), null, { timeout: 30000 })
      chart = await page.evaluate(() => {
        const s = window.Highcharts.charts.flatMap((c) => c?.series ?? []).find((x) => x.name === 'CDS' && !x.options?.isInternal)
        return (s?.options?.data ?? []).map((p) => (Array.isArray(p) ? [Number(p[0]), Number(p[1])] : null)).filter(Boolean)
      })
    } catch (error) {
      console.warn(`CDS: gráfico da página não lido (${error.message.split('\n')[0]}); segue só com o número do dia`)
    }
    return { text, chart }
  } finally {
    await browser.close()
  }
}

let data
try {
  const page = await readPage()
  const reading = parseCdsText(page.text)
  const chart = chartHistory(page.chart, reading)
  if (page.chart.length && !chart.length) console.warn('CDS: gráfico da página não passou na conferência; histórico não usado')
  data = buildCdsData(previous, reading, Date.now(), chart)
  console.log(`CDS: ${data.value} pb (página de ${new Date(data.observedAt).toISOString()})${data.reference ? `; dia anterior ${data.reference.value} pb` : '; sem dia anterior para a variação'}; histórico de ${data.history.length} dias`)
} catch (error) {
  data = cdsFailure(previous, error)
  console.warn(`CDS: ${data.error}; ${previous?.value ? 'mantido o último dado válido' : 'sem dado válido anterior'}`)
}
await mkdir(dir, { recursive: true })
await writeFile(file, `${JSON.stringify(data, null, 2)}\n`)
