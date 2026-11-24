// Coleta as séries TFC e as moedas contratuais do BNDES e grava public/moedas.json.
import { mkdir, writeFile, rename } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { withOfficialLcdSnapshot } from '../src/lcdOfficialSnapshot.js'
import { readPrevious } from './prev-lib.mjs'
import { MOEDAS_CATALOG, SOURCE_STATUS, buildMoedas, fillSeriesFromPrevious, moedaUrl, parseMoeda, onlyEffectiveMoedas } from './moedas-lib.mjs'

const PRAZO_MS = Number(process.env.MOEDAS_PRAZO_MS) || 6 * 60e3
const REQUEST_MS = 10000
const PARALLEL = 3
const ATTEMPTS = 3
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const headers = { 'user-agent': 'Mozilla/5.0 (cotacoes-moedas)', referer: 'https://www.bndes.gov.br/', accept: 'text/plain,*/*' }

export async function fetchMoedas({ fetchImpl = fetch, now = Date.now, wait = sleep, deadlineMs = PRAZO_MS } = {}) {
  const deadline = now() + deadlineMs
  // As moedas contratuais com uso direto nas calculadoras começam primeiro.
  // Cada série tem uma chance antes que uma fonte lenta receba nova tentativa.
  const catalog = [...MOEDAS_CATALOG.filter(s => s.group === 'moedas'), ...MOEDAS_CATALOG.filter(s => s.group === 'tfc')]
  const errors = new Map()
  let pending = catalog.filter(({ id }) => {
    if (moedaUrl(id) && SOURCE_STATUS[id]?.automaticCollectionEnabled !== false) return true
    errors.set(id, SOURCE_STATUS[id]?.reason ?? 'fonte indisponível')
    return false
  })
  const results = {}

  async function fetchSeries({ id, name }) {
    try {
      const remaining = deadline - now()
      if (remaining < 1) throw new Error('prazo da coleta esgotado')
      const response = await fetchImpl(moedaUrl(id), { headers, signal: AbortSignal.timeout(Math.min(REQUEST_MS, remaining)) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = await response.text()
      if (!parseMoeda(body).length) throw new Error('resposta sem observações válidas')
      results[id] = body
      errors.delete(id)
    } catch (error) {
      errors.set(id, `${id} (${name}): ${error.message}`)
    }
  }

  for (let attempt = 1; attempt <= ATTEMPTS && pending.length && now() < deadline; attempt++) {
    for (let i = 0; i < pending.length; i += PARALLEL) {
      await Promise.all(pending.slice(i, i + PARALLEL).map(fetchSeries))
    }
    pending = pending.filter(({ id }) => !results[id])
    if (pending.length && attempt < ATTEMPTS && now() < deadline) await wait(Math.min(2000 * attempt, deadline - now()))
  }
  for (const { id, name } of pending) {
    if (!errors.has(id)) errors.set(id, `${id} (${name}): prazo da coleta esgotado`)
  }
  return buildMoedas(results, [...errors.values()], now())
}

export async function collectMoedas({ collect = fetchMoedas, previous = readPrevious } = {}) {
  const [fresh, before] = await Promise.all([collect(), previous('moedas.json')])
  if (before.status === 'unreadable' || (before.status === 'ok' &&
      (!before.data?.series || typeof before.data.series !== 'object' || Array.isArray(before.data.series)))) {
    throw new Error('Base anterior de moedas ilegível: coleta interrompida para preservar as séries publicadas.')
  }
  const now = fresh.generatedAt
  return withOfficialLcdSnapshot(fillSeriesFromPrevious(
    onlyEffectiveMoedas(fresh, now),
    onlyEffectiveMoedas(before.data, now),
  ))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const data = await collectMoedas()
  const output = new URL('../public/moedas.json', import.meta.url)
  const temporary = new URL('../public/moedas.json.collect-tmp', import.meta.url)
  await mkdir(new URL('../public/', import.meta.url), { recursive: true })
  await writeFile(temporary, `${JSON.stringify(data)}\n`)
  await rename(temporary, output)
  const last = id => data.series[id] ? `${id} ${data.series[id].points.at(-1)[1]}${data.stale[id] ? ' (anterior)' : ''}` : `${id} indisponível`
  console.log(`Moedas BNDES: ${MOEDAS_CATALOG.map(({ id }) => last(id)).join(' · ')}`)
  if (data.errors.length) console.warn(data.errors.join('\n'))
}
