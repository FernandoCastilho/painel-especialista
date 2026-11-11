// Histórico do Focus (52 semanas) para o gráfico abaixo da tabela de Cenário econômico. Roda na coleta semanal do Focus
// (segunda/terça 08:30, FOCUS_WEEKLY=true) e nas publicações manuais; nas coletas de hora em hora só preserva o arquivo publicado.
import { writeFile, readFile } from 'node:fs/promises'
import { readPrevious } from './prev-lib.mjs'
import { INDICADORES, arquivoHistorico, mesclar, semanal, ultimaData } from './focus-history-lib.mjs'

const OLINDA = 'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais'
const output = new URL('../public/focus-history.json', import.meta.url)
const now = Date.now()
const scheduled = process.env.GITHUB_EVENT_NAME === 'schedule'
const weekly = process.env.FOCUS_WEEKLY === 'true'
let local = null
try { local = JSON.parse(await readFile(output, 'utf8')) } catch { /* sem arquivo local */ }
const remote = await readPrevious('focus-history.json')
// Publicado ilegível e sem cópia local (a coleta semanal baixa uma antes): para aqui, em vez de gravar um histórico vazio
// ou menor por cima das 52 semanas que estão no ar. A rodada falha e a próxima tenta de novo.
if (remote.status === 'unreadable' && !local && process.env.PREV_IGNORAR_ILEGIVEL !== 'true') {
  console.error(`Focus histórico: não foi possível ler o arquivo publicado (${remote.error}). Coleta interrompida para preservar o histórico que está no ar.`)
  process.exit(1)
}
const previous = remote.data ?? local

if (scheduled && !weekly) {
  // coleta de hora em hora: o Focus não muda; mantém o que está publicado
  await writeFile(output, JSON.stringify(previous ?? arquivoHistorico({}, now, { error: 'ainda sem coleta semanal' })))
  console.log('Focus histórico: preservado (coleta horária)')
  process.exit(0)
}

const ultima = ultimaData(previous?.series)
// Primeira coleta: 53 semanas; depois, só a partir de duas semanas antes da última data (revisões recentes entram).
const since = new Date(ultima ? Date.parse(`${ultima}T12:00:00Z`) - 14 * 864e5 : now - 53 * 7 * 864e5).toISOString().slice(0, 10)
const rows = []
const errors = []
for (const indicador of Object.keys(INDICADORES)) {
  try {
    const filter = encodeURIComponent(`Indicador eq '${indicador}' and Data ge '${since}' and baseCalculo eq 0`)
    const res = await fetch(`${OLINDA}?$top=5000&$filter=${filter}&$orderby=Data%20asc&$format=json`, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (!Array.isArray(data?.value)) throw new Error('resposta sem linhas')
    rows.push(...data.value)
  } catch (e) { errors.push(`${indicador}: ${e.message}`) }
}
if (errors.length === Object.keys(INDICADORES).length) {
  await writeFile(output, JSON.stringify(previous ? { ...previous, stale: true, error: errors.join(' · ') } : arquivoHistorico({}, now, { stale: true, error: errors.join(' · ') })))
  console.warn('Focus histórico: fonte indisponível; preservado o publicado. ' + errors.join(' · '))
  process.exit(0)
}
const series = mesclar(previous, semanal(rows, arquivoHistorico({}, now).anos), now)
await writeFile(output, JSON.stringify(arquivoHistorico(series, now, { stale: false, error: errors.length ? errors.join(' · ') : null })))
for (const [label, porAno] of Object.entries(series)) console.log(`${label}: ${Object.entries(porAno).map(([ano, p]) => `${ano} ${p.length} semanas (até ${p.at(-1).d})`).join('; ')}`)
if (errors.length) console.warn('Parcial: ' + errors.join(' · '))
