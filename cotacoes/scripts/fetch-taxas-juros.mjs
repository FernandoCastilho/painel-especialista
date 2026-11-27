// Taxas médias por banco e modalidade (PJ) do Banco Central. Falha preserva a última janela, com aviso.
import { readFile, writeFile } from 'node:fs/promises'
import { loadPrevious } from './prev-lib.mjs'
import { TAXAS_API, TAXAS_SEGMENT, parseTaxas } from '../src/taxasJuros.js'

const output = new URL('../public/taxas-juros.json', import.meta.url)
let local
try { local = JSON.parse(await readFile(output, 'utf8')) } catch { /* primeira coleta */ }
const remote = await loadPrevious('taxas-juros.json')
const previous = [local, remote].filter(f => f?.period?.inicio && f.modalities?.length).sort((a, b) => b.period.inicio.localeCompare(a.period.inicio) || b.generatedAt - a.generatedAt)[0]
const now = Date.now()

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

let result
try {
  const segment = `Segmento eq '${TAXAS_SEGMENT}'`
  const [latest] = await odata({ $filter: segment, $orderby: 'InicioPeriodo desc', $top: '1', $select: 'InicioPeriodo,FimPeriodo' })
  if (!latest) throw new Error('BC sem período disponível')
  const period = { inicio: latest.InicioPeriodo, fim: latest.FimPeriodo }
  if (previous && period.inicio < previous.period.inicio) throw new Error('BC devolveu janela anterior à preservada')
  const rows = await odata({ $filter: `${segment} and InicioPeriodo eq '${period.inicio}'`, $select: 'Modalidade,InstituicaoFinanceira,TaxaJurosAoMes,TaxaJurosAoAno', $top: '5000' })
  const data = parseTaxas(rows, period)
  if (previous && period.inicio === previous.period.inicio && data.modalities.length < previous.modalities.length) throw new Error('Cobertura do BC inferior à preservada')
  result = { generatedAt: now, checkedAt: now, stale: false, segment: TAXAS_SEGMENT, ...data }
} catch (error) {
  if (!previous) throw error
  result = { ...previous, generatedAt: now, checkedAt: now, stale: true, error: error.message }
}
await writeFile(output, JSON.stringify(result) + '\n')
console.log(`taxas-juros: ${result.period.inicio} a ${result.period.fim}, ${result.modalities.length} modalidades, pendente=${result.stale}${result.error ? ` (${result.error})` : ''}`)
