// Coleta as séries TFC e as moedas contratuais do BNDES (arquivos /Moedas/um<código>.txt) e grava public/moedas.json. Rodado a cada hora pelo GitHub Actions.
import { mkdir, writeFile } from 'node:fs/promises'
import { withOfficialLcdSnapshot } from '../src/lcdOfficialSnapshot.js'
import { loadPrevious } from './prev-lib.mjs'
import { MOEDAS_CATALOG, SOURCE_STATUS, buildMoedas, fillSeriesFromPrevious, moedaUrl } from './moedas-lib.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const errors = []
// Prazo total da coleta: a etapa do GitHub Actions é interrompida em 8 min e, interrompida, não grava nada (o site perdia o arquivo).
// Passado o prazo, as séries que faltam ficam com o último dado válido publicado e o arquivo é gravado assim mesmo.
const PRAZO_MS = Number(process.env.MOEDAS_PRAZO_MS) || 6 * 60e3
const inicio = Date.now()
const restante = () => PRAZO_MS - (Date.now() - inicio)

async function getText(url, label, tries = 3) {
  let last
  for (let i = 1; i <= tries; i++) {
    if (restante() < 5000) { last = new Error('prazo da coleta esgotado'); break }
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (cotacoes-moedas)', referer: 'https://www.bndes.gov.br/', accept: 'text/plain,*/*' }, signal: AbortSignal.timeout(Math.min(40000, restante())) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (e) {
      last = e
      if (i < tries) await sleep(Math.min(2000 * i, Math.max(0, restante())))
    }
  }
  errors.push(`${label}: ${last.message}`)
  return null
}

const results = {}
for (const { id, name } of MOEDAS_CATALOG) {
  const url = moedaUrl(id)
  if (!url || SOURCE_STATUS[id]?.automaticCollectionEnabled === false) { results[id] = null; errors.push(SOURCE_STATUS[id].reason); continue }
  results[id] = await getText(url, `${id} (${name})`)
}
const out = withOfficialLcdSnapshot(fillSeriesFromPrevious(buildMoedas(results, errors), await loadPrevious('moedas.json')))
await mkdir(new URL('../public/', import.meta.url), { recursive: true })
await writeFile(new URL('../public/moedas.json', import.meta.url), `${JSON.stringify(out)}\n`)
const last = (id) => { const s = out.series[id]; return s ? `${id} ${s.points.at(-1)[1]}${out.stale[id] ? ' (anterior)' : ''}` : `${id} indisponível` }
console.log(`Moedas BNDES: ${MOEDAS_CATALOG.map((s) => last(s.id)).join(' · ')}`)
if (errors.length) console.warn(errors.join('\n'))
