import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fetchBankText } from './bancos-transport.mjs'
import { BANKS } from '../src/bancos.js'
import { bankDataUrl, comparisonPeriods, normalizeBankQuarter } from './bancos-lib.mjs'
const output = new URL('../public/bancos.json', import.meta.url)
const releaseFile = new URL('../public/' + 'bancos-ri.json', import.meta.url)
const previous = await readFile(output, 'utf8').then(JSON.parse).catch(() => null)
const releases = await readFile(releaseFile, 'utf8').then(JSON.parse)
const cache = new Map(), errors = []
async function report(period, id) {
  const key = `${period}-${id}`
  if (cache.has(key)) return cache.get(key)
  const task = (async () => {
    let data
    if (process.env.BANKS_CACHE_DIR) data = await readFile(`${process.env.BANKS_CACHE_DIR}/${key}.json`, 'utf8').then(JSON.parse).catch(() => null)
    if (!data) {
      const url = bankDataUrl(period, id)
      const text = process.env.BANKS_CURL === '1' ? execFileSync('curl', ['-fsSL', '--max-time', '45', url], { encoding: 'utf8', maxBuffer: 30e6 }) : await fetchBankText(url)
      data = JSON.parse(text)
      if (process.env.BANKS_CACHE_DIR) { await mkdir(process.env.BANKS_CACHE_DIR, { recursive: true }); await writeFile(`${process.env.BANKS_CACHE_DIR}/${key}.json`, text) }
    }
    if (!Array.isArray(data.value)) throw new Error(`Resposta inválida: ${key}`)
    const rows = [...data.value]
    // OData pode paginar. Nunca apresentar um lote parcial como base completa.
    let next = data['@odata.nextLink']
    while (next) {
      const url = new URL(next, bankDataUrl(period, id))
      if (url.origin !== 'https://olinda.bcb.gov.br') throw new Error('Paginação fora da origem oficial')
      data = JSON.parse(await fetchBankText(url))
      if (!Array.isArray(data.value)) throw new Error(`Paginação inválida: ${key}`)
      rows.push(...data.value); next = data['@odata.nextLink']
    }
    return rows
  })()
  cache.set(key, task)
  return task
}
const now = new Date(), q = Math.floor(now.getUTCMonth() / 3)
let candidate = now.getUTCFullYear() * 100 + q * 3
if (!q) candidate = (now.getUTCFullYear() - 1) * 100 + 12
let latest
for (let i = 0; i < 5; i++) {
  try { const rows = await report(candidate, '1'); if (BANKS.some(b => rows.some(r => r.CodInst === b.code && r.Conta === '140220' && Number.isFinite(r.Saldo)))) { latest = candidate; break } }
  catch (e) { errors.push(`${candidate}: ${e.message}`) }
  candidate = candidate % 100 === 3 ? (Math.floor(candidate / 100) - 1) * 100 + 12 : candidate - 3
}
if (!latest) {
  if (!previous) throw new Error('IF.data indisponível e sem base anterior para preservar')
  previous.stale = true; previous.lastAttemptAt = Date.now(); previous.errors = errors
  await writeFile(output, JSON.stringify(previous, null, 2) + '\n')
  process.exit(0)
}
const periods = comparisonPeriods(latest), allReports = {}
for (const period of periods) {
  allReports[period] = {}
  // Sequential requests avoid bursts of six large historical reports at the source.
  for (const id of ['1', '2', '11', '13', '14', '16']) {
    try { allReports[period][id] = await report(period, id) }
    catch (error) { errors.push(`${period} · relatório ${id}: ${error.message}`) }
  }
}
const points = periods.flatMap(period => normalizeBankQuarter(period, allReports[period], allReports[period % 100 === 6 || period % 100 === 12 ? period - 3 : 0]))
const banks = BANKS.map(b => {
  const old = previous?.banks?.find(x => x.id === b.id)
  const fresh = points.filter(p => p.id === b.id)
  // Retém métricas individuais em falha parcial, sem renovar a data da observação.
  const observations = fresh.map(p => {
    const retained = old?.observations?.find(x => x.period === p.period)
    const roe = releases.supplements?.[b.id]?.find(x => x.period === p.period)?.roe
    const extra = Number.isFinite(roe?.value) && roe.source && roe.basis ? { roe } : {}
    return { ...p, ...(extra.roe ? { sourceLabel: 'Banco Central + RI', scope: p.scope + ' · ROE do banco (critério próprio)' } : {}), metrics: { ...(retained?.metrics || {}), ...p.metrics, ...extra } }
  })
  for (const p of old?.observations || []) if (!observations.some(x => x.period === p.period)) observations.push(p)
  return { ...b, observations, releases: releases.banks[b.id] || [] }
})
await writeFile(output, JSON.stringify({ generatedAt: Date.now(), lastAttemptAt: Date.now(), latestBcPeriod: latest, riReviewedAt: releases.reviewedAt, stale: errors.length > 0, errors, banks }, null, 2) + '\n')
console.log(`Bancos: ${banks.length} instituições; BC ${latest}; ${errors.length} falhas; RI revisado em ${releases.reviewedAt}`)
