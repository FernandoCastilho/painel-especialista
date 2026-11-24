// Requires Node 20+ and Python 3 (standard library only). No API keys or paid services.
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { collectPulpApi } from './pulp-lib.mjs'
import { loadPrevious } from './prev-lib.mjs'
import { COMMODITIES, EIA_DAILY, PINK_PAGE_URL, discoverPinkSheetUrl, buildEiaDaily, parsePinkRows, commodityFallback } from './commodities-lib.mjs'

const output = new URL('../public/commodities.json', import.meta.url)
const now = new Date()
let local = null
try { local = JSON.parse(await readFile(output, 'utf8')) } catch { /* ignora */ }
let remotePromise
const previous = async id => {
  remotePromise ??= loadPrevious('commodities.json')
  const remote = await remotePromise
  return [local, remote].flatMap(data => Array.isArray(data?.commodities) ? data.commodities.filter(c => c.id === id) : [])
}
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`Fonte: HTTP ${response.status}`)
  return response
}
async function collectDaily(id) {
  try { return buildEiaDaily(id, await (await get(COMMODITIES.find(c => c.id === id).sourceUrl)).text(), now) }
  catch (error) { console.warn(`${id}: ${error.message}`); return commodityFallback(id, await previous(id), error) }
}
const monthly = COMMODITIES.filter(c => !(c.id in EIA_DAILY) && c.id !== 'pulp-br')
async function collectMonthly() {
  try {
    // Resolve the current workbook from the official landing page, not a frozen monthly URL.
    const url = discoverPinkSheetUrl(await (await get(PINK_PAGE_URL)).text())
    const buffer = Buffer.from(await (await get(url)).arrayBuffer())
    if (buffer.length > 10_000_000) throw new Error('Banco Mundial: arquivo excessivamente grande')
    const parsed = spawnSync('python3', [fileURLToPath(new URL('./read-pink-sheet.py', import.meta.url))], { input: buffer, encoding: 'utf8', maxBuffer: 10_000_000, timeout: 30000 })
    if (parsed.error || parsed.status !== 0) throw new Error(`Banco Mundial: falha ao ler XLSX (${parsed.error?.message ?? parsed.stderr.trim()})`)
    const pink = parsePinkRows(JSON.parse(parsed.stdout), url, now)
    // Série opcional que sumiu da planilha: preserva o último valor válido, marcado como desatualizado.
    const missing = monthly.filter(c => !pink.some(p => p.id === c.id))
    return [...pink, ...await Promise.all(missing.map(async c => commodityFallback(c.id, await previous(c.id), new Error('Banco Mundial: série ausente na planilha'))))]
  } catch (error) {
    console.warn(`Médias mensais: ${error.message}`)
    return Promise.all(monthly.map(async c => commodityFallback(c.id, await previous(c.id), error)))
  }
}
async function collectPulp() {
  try {
    return await collectPulpApi(async (url, body) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000), ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })
      if (!response.ok) throw new Error(`Comex Stat: HTTP ${response.status}`)
      return response.json()
    }, now)
  }
  catch (error) { console.warn(`Celulose: ${error.message}`); return commodityFallback('pulp-br', await previous('pulp-br'), error) }
}
const commodities = (await Promise.all([...Object.keys(EIA_DAILY).map(collectDaily), collectMonthly(), collectPulp()])).flat()
const data = { schemaVersion: 1, generatedAt: now.toISOString(), commodities }
await mkdir(new URL('../public/', import.meta.url), { recursive: true })
const temporary = new URL('../public/commodities.json.tmp', import.meta.url)
await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`)
await rename(temporary, output)
for (const c of commodities) console.log(`${c.label}: ${c.value ?? 'indisponível'} ${c.unit}; ${c.nature}; ${c.period ?? 'sem referência'}; stale=${c.stale}`)
