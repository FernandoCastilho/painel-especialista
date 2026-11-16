// Coleta as séries TFC e as moedas contratuais do BNDES (arquivos /Moedas/um<código>.txt) e grava public/moedas.json. Rodado a cada hora pelo GitHub Actions.
import { mkdir, writeFile } from 'node:fs/promises'
import { withOfficialLcdSnapshot } from '../src/lcdOfficialSnapshot.js'
import { loadPrevious } from './prev-lib.mjs'
import { MOEDAS_CATALOG, buildMoedas, fillSeriesFromPrevious } from './moedas-lib.mjs'

import { collectMoedas, collectionBudget } from './moedas-collector.mjs'

const { results, errors } = await collectMoedas({ budgetMs: collectionBudget(process.env.MOEDAS_PRAZO_MS) })
const out = withOfficialLcdSnapshot(fillSeriesFromPrevious(buildMoedas(results, errors), await loadPrevious('moedas.json')))
await mkdir(new URL('../public/', import.meta.url), { recursive: true })
await writeFile(new URL('../public/moedas.json', import.meta.url), `${JSON.stringify(out)}\n`)
const last = (id) => { const s = out.series[id]; return s ? `${id} ${s.points.at(-1)[1]}${out.stale[id] ? ' (anterior)' : ''}` : `${id} indisponível` }
console.log(`Moedas BNDES: ${MOEDAS_CATALOG.map((s) => last(s.id)).join(' · ')}`)
if (errors.length) console.warn(errors.join('\n'))
