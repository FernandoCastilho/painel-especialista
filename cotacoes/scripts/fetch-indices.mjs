// Fechamento diário do Ibovespa (Yahoo Finance, atrasado e não oficial). Grava public/indices.json.
// Se o Yahoo não responder, preserva o último arquivo publicado e marca como desatualizado.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { loadPrevious } from './prev-lib.mjs'
import { parseYahoo, parseYahooLastBar } from './intraday-lib.mjs'
import { INDICES, indexDayRange, indicesFile, toIndexPoints } from './indices-lib.mjs'

const output = new URL('../public/indices.json', import.meta.url)
const now = Date.now()
let local = null
try { local = JSON.parse(await readFile(output, 'utf8')) } catch { /* sem arquivo local */ }
const remote = await loadPrevious('indices.json')
const previous = [local, remote].filter((f) => f?.series).sort((a, b) => (b.generatedAt ?? 0) - (a.generatedAt ?? 0))[0] ?? null

const series = {}, errors = []
for (const def of INDICES) {
  try {
    const res = await fetch(def.url, { headers: { 'user-agent': 'Mozilla/5.0 (cotacoes-coleta)' }, signal: AbortSignal.timeout(20000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const points = toIndexPoints(parseYahoo(json))
    if (points.length < 5) throw new Error('poucos pontos')
    const lastDay = indexDayRange(parseYahooLastBar(json), points)
    series[def.id] = { symbol: def.symbol, unit: def.unit, name: def.name, points, ...(lastDay ? { lastDay } : {}), checkedAt: now, stale: false }
  } catch (e) {
    errors.push(`${def.id}: ${e.message}`)
    if (previous?.series?.[def.id]) series[def.id] = { ...previous.series[def.id], stale: true }
  }
}
await mkdir(new URL('../public/', import.meta.url), { recursive: true })
await writeFile(output, `${JSON.stringify(indicesFile(series, now, errors))}\n`)
if (errors.length) console.warn('Falhas:', errors.join(' | '))
for (const [id, s] of Object.entries(series)) console.log(`${id}: ${s.points.length} dias; último ${new Date(s.points.at(-1)[0]).toISOString().slice(0, 10)} = ${s.points.at(-1)[1]} ${s.unit}; stale=${s.stale}`)
