// NTN-B (juro real do Tesouro): baixa a planilha oficial de taxas do Tesouro Direto e grava ntnb.json na branch `data`,
// junto das cotações. Visita a fonte no máximo a cada 3 h (ela muda 1 vez por dia útil). Qualquer falha mantém o último
// dado válido, marcado como pendente: nunca derruba a coleta das cotações.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { NTNB_SOURCE, buildNtnbData, ntnbAccept, ntnbDue, ntnbFailure, parseNtnbCsv } from '../src/ntnb.js'

const dir = process.env.DATA_DIR ?? '/tmp/data'
const file = join(dir, 'ntnb.json')
let previous = null
try { previous = JSON.parse(await readFile(file, 'utf8')) } catch { /* primeira coleta */ }

if (!ntnbDue(previous)) {
  console.log('NTN-B: planilha lida há menos de 3 h; sem nova visita ao Tesouro')
  process.exit(0)
}

let data
try {
  // NTNB_CSV_URL só para o teste automatizado (planilha local simulada); a coleta real usa sempre o endereço oficial.
  const r = await fetch(process.env.NTNB_CSV_URL || NTNB_SOURCE.csv, { headers: { 'user-agent': 'Mozilla/5.0 (cotacoes-coleta)', accept: 'text/csv' }, signal: AbortSignal.timeout(90000) })
  if (!r.ok) throw new Error(`Tesouro respondeu HTTP ${r.status}`)
  data = ntnbAccept(previous, buildNtnbData(parseNtnbCsv(await r.text())))
  const hoje = data.curve.curves[data.ref]
  console.log(`NTN-B: ${data.vencimentos.length} vencimentos em ${data.ref}; ${hoje.map((p) => `${p[2]} ${p[1]}%`).join(', ')}; histórico de ${data.dates.length} dias`)
} catch (error) {
  data = ntnbFailure(previous, error)
  console.warn(`NTN-B: ${data.error}; ${previous?.vencimentos?.length ? 'mantido o último dado válido' : 'sem dado válido anterior'}`)
}
await mkdir(dir, { recursive: true })
await writeFile(file, `${JSON.stringify(data)}\n`)
