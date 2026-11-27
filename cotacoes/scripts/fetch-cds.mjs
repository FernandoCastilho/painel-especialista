/* global document -- usado só dentro da página aberta no navegador */
// CDS de 5 anos do Brasil (World Government Bonds, fonte gratuita e não oficial). Rodado junto da coleta das cotações,
// mas visita o site no máximo a cada ~2 h. A página só mostra o número depois de carregar, então abre num Chrome sem janela
// (navegador comum, sem disfarce) e lê o texto montado. Qualquer falha mantém o último dado válido: nunca derruba a coleta.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { CDS_SOURCE, buildCdsData, cdsDue, cdsFailure, parseCdsText } from '../src/cds.js'

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
    return await page.evaluate(() => document.body.innerText)
  } finally {
    await browser.close()
  }
}

let data
try {
  data = buildCdsData(previous, parseCdsText(await readPage()))
  console.log(`CDS: ${data.value} pb (página de ${new Date(data.observedAt).toISOString()})${data.reference ? `; dia anterior ${data.reference.value} pb` : '; sem dia anterior para a variação'}`)
} catch (error) {
  data = cdsFailure(previous, error)
  console.warn(`CDS: ${data.error}; ${previous?.value ? 'mantido o último dado válido' : 'sem dado válido anterior'}`)
}
await mkdir(dir, { recursive: true })
await writeFile(file, `${JSON.stringify(data, null, 2)}\n`)
