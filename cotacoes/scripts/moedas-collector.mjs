// Sequential collection: reserve a fair share for every eligible series.
// Same endpoints, <=3 attempts/series, <=40s/request, <=6min overall, no LD1.
import { MOEDAS_CATALOG, SOURCE_STATUS, moedaUrl } from './moedas-lib.mjs'
export const MAX_BUDGET_MS = 6 * 60e3
export function collectionBudget(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_BUDGET_MS) : MAX_BUDGET_MS
}
export async function collectMoedas({ budgetMs = MAX_BUDGET_MS, fetchFn = fetch, now = Date.now,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), timeoutSignal = ms => AbortSignal.timeout(ms) } = {}) {
  const deadline = now() + collectionBudget(budgetMs)
  const results = {}, errors = []
  const eligible = MOEDAS_CATALOG.filter(({ id }) => moedaUrl(id) && SOURCE_STATUS[id]?.automaticCollectionEnabled !== false)
  let remainingSeries = eligible.length
  for (const { id, name } of MOEDAS_CATALOG) {
    const url = moedaUrl(id)
    if (!url || SOURCE_STATUS[id]?.automaticCollectionEnabled === false) {
      results[id] = null; errors.push(SOURCE_STATUS[id]?.reason ?? `${id}: endpoint indisponível`); continue
    }
    // Unused time rolls forward; a failed early TFC cannot consume later series' shares.
    const seriesDeadline = now() + Math.max(0, Math.floor((deadline - now()) / remainingSeries--))
    const remaining = () => Math.min(deadline, seriesDeadline) - now()
    let last = new Error('prazo da coleta esgotado')
    results[id] = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (remaining() < 1) break
      try {
        const response = await fetchFn(url, { headers: { 'user-agent': 'Mozilla/5.0 (cotacoes-moedas)', referer: 'https://www.bndes.gov.br/', accept: 'text/plain,*/*' }, signal: timeoutSignal(Math.max(1, Math.floor(Math.min(40000, remaining())))) })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        results[id] = await response.text()
        break
      } catch (error) {
        last = error
        if (attempt < 3 && remaining() > 0) await sleep(Math.min(2000 * attempt, Math.max(0, remaining())))
      }
    }
    if (results[id] === null) errors.push(`${id} (${name}): ${last.message}`)
  }
  return { results, errors }
}
