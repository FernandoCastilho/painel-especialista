// Juros bancários: taxas médias por banco e modalidade, de empresas e de pessoas (Banco Central).
// Cada público é coletado à parte. Falha em um deles preserva a última janela daquele público, com aviso.
import { readFile, writeFile } from 'node:fs/promises'
import { loadPrevious } from './prev-lib.mjs'
import { TAXAS_API, TAXAS_SEGMENTS, parseTaxas } from '../src/taxasJuros.js'

const output = new URL('../public/taxas-juros.json', import.meta.url)
let local
try { local = JSON.parse(await readFile(output, 'utf8')) } catch { /* primeira coleta */ }
const remote = await loadPrevious('taxas-juros.json')
const now = Date.now()

// Último dado válido de cada público, entre a cópia local e a publicada (a janela mais recente vence).
const previousOf = id => [local, remote].map(f => Array.isArray(f?.segments) ? f.segments.find(s => s.id === id) : null)
  .filter(s => s?.period?.inicio && s.modalities?.length).sort((a, b) => b.period.inicio.localeCompare(a.period.inicio))[0]

async function odata(params) {
  const url = `${TAXAS_API}?$format=json&${Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`
  let error
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(25000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      if (!Array.isArray(body?.value)) throw new Error('Resposta do BC sem lista')
      return body.value
    } catch (e) { error = e }
  }
  throw error
}

async function collect({ id, bc, label }) {
  const previous = previousOf(id)
  try {
    const segment = `Segmento eq '${bc}'`
    const [latest] = await odata({ $filter: segment, $orderby: 'InicioPeriodo desc', $top: '1', $select: 'InicioPeriodo,FimPeriodo' })
    if (!latest) throw new Error('BC sem período disponível')
    const period = { inicio: latest.InicioPeriodo, fim: latest.FimPeriodo }
    if (previous && period.inicio < previous.period.inicio) throw new Error('BC devolveu janela anterior à preservada')
    const rows = await odata({ $filter: `${segment} and InicioPeriodo eq '${period.inicio}'`, $select: 'Modalidade,InstituicaoFinanceira,TaxaJurosAoMes,TaxaJurosAoAno', $top: '5000' })
    const data = parseTaxas(rows, period)
    if (previous && period.inicio === previous.period.inicio && data.modalities.length < previous.modalities.length) throw new Error('Cobertura do BC inferior à preservada')
    return { id, label, stale: false, ...data }
  } catch (error) {
    if (!previous) throw error
    return { ...previous, id, label, stale: true, error: error.message }
  }
}

const segments = []
for (const segment of TAXAS_SEGMENTS) segments.push(await collect(segment))
const result = { generatedAt: now, checkedAt: now, stale: segments.some(s => s.stale), segments }
await writeFile(output, JSON.stringify(result) + '\n')
for (const s of segments) console.log(`taxas-juros ${s.id}: ${s.period.inicio} a ${s.period.fim}, ${s.modalities.length} modalidades, pendente=${s.stale}${s.error ? ` (${s.error})` : ''}`)
