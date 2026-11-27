// Preço diário aproximado de insumos (contratos futuros da COMEX e da ICE Nova York via Yahoo Finance), atrasado e não oficial. Grava public/insumos-precos.json.
// Se o Yahoo não responder, preserva o último arquivo publicado e marca como desatualizado; o painel cai para a média mensal do Banco Mundial.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { loadPrevious } from './prev-lib.mjs'
import { parseYahoo, parseYahooLastBar } from './intraday-lib.mjs'
import { INSUMOS_PRECOS, checkUnit, contractUrl, dailyFile, lastDayRange, nextContracts, sameContractDay, toDailyPoints } from './insumos-precos-lib.mjs'

const output = new URL('../public/insumos-precos.json', import.meta.url)
const now = Date.now()
let local = null
try { local = JSON.parse(await readFile(output, 'utf8')) } catch { /* sem arquivo local */ }
const remote = await loadPrevious('insumos-precos.json')
const previous = [local, remote].filter((f) => f?.series).sort((a, b) => (b.generatedAt ?? 0) - (a.generatedAt ?? 0))[0] ?? null

async function getJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (cotacoes-coleta)' }, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
// Vencimentos explícitos que responderam; um que falha só fica de fora.
async function fetchContracts(root) {
  const got = await Promise.all(nextContracts(root, now).map((code) => getJson(contractUrl(code)).then((json) => ({ code, json }), () => null)))
  return got.filter(Boolean)
}

const series = {}, errors = []
for (const def of INSUMOS_PRECOS) {
  try {
    const json = await getJson(def.url)
    const points = toDailyPoints(parseYahoo(json), def)
    if (points.length < 5) throw new Error('poucos pontos')
    checkUnit(points, def)
    let lastDay = lastDayRange(parseYahooLastBar(json), points, def)
    if (def.contracts) {
      // Máxima, mínima e fechamento anterior vêm do vencimento que confere com o KC=F; se os vencimentos responderam
      // e nenhum confere, a faixa fica de fora, para não mostrar números de dois contratos misturados.
      const contracts = await fetchContracts(def.contracts)
      const same = sameContractDay(contracts, points, def)
      if (same || contracts.length) lastDay = same
      console.log(`${def.id}: vencimentos ${contracts.map((c) => c.code).join(', ') || 'nenhum respondeu'}; confere ${same?.contract ?? 'nenhum'}${same?.roll ? ' (troca de contrato)' : ''}`)
    }
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
