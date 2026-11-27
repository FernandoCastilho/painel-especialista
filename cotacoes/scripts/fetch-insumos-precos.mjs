// Preço diário aproximado de insumos (contratos futuros da COMEX e da ICE Nova York via Yahoo Finance), atrasado e não oficial. Grava public/insumos-precos.json.
// Se o Yahoo não responder, preserva o último arquivo publicado e marca como desatualizado; o painel cai para a média mensal do Banco Mundial.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { loadPrevious } from './prev-lib.mjs'
import { parseYahoo, parseYahooLastBar } from './intraday-lib.mjs'
import { INSUMOS_PRECOS, checkUnit, dailyFile, lastDayRange, toDailyPoints } from './insumos-precos-lib.mjs'

const output = new URL('../public/insumos-precos.json', import.meta.url)
const now = Date.now()
let local = null
try { local = JSON.parse(await readFile(output, 'utf8')) } catch { /* sem arquivo local */ }
const remote = await loadPrevious('insumos-precos.json')
const previous = [local, remote].filter((f) => f?.series).sort((a, b) => (b.generatedAt ?? 0) - (a.generatedAt ?? 0))[0] ?? null

const series = {}, errors = []
for (const def of INSUMOS_PRECOS) {
  try {
    const res = await fetch(def.url, { headers: { 'user-agent': 'Mozilla/5.0 (cotacoes-coleta)' }, signal: AbortSignal.timeout(20000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const points = toDailyPoints(parseYahoo(json), def)
    if (points.length < 5) throw new Error('poucos pontos')
    checkUnit(points, def)
    const lastDay = lastDayRange(parseYahooLastBar(json), points, def)
    series[def.id] = { symbol: def.symbol, unit: def.unit, name: def.name, points, ...(lastDay ? { lastDay } : {}), checkedAt: now, stale: false }
  } catch (e) {
    errors.push(`${def.id}: ${e.message}`)
    if (previous?.series?.[def.id]) series[def.id] = { ...previous.series[def.id], stale: true }
  }
}
await mkdir(new URL('../public/', import.meta.url), { recursive: true })
await writeFile(output, `${JSON.stringify(dailyFile(series, now, errors))}\n`)
if (errors.length) console.warn('Falhas:', errors.join(' | '))
for (const [id, s] of Object.entries(series)) console.log(`${id}: ${s.points.length} dias; último ${new Date(s.points.at(-1)[0]).toISOString().slice(0, 10)} = ${s.points.at(-1)[1]} ${s.unit}; stale=${s.stale}`)
