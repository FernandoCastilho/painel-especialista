import { readFile, writeFile, rename } from 'node:fs/promises'
import { resolve } from 'node:path'
import { validateRecoveryHistory } from '../src/recoveryHistory.js'

const [inputPath, additionalEditionsPath, generatedAt] = process.argv.slice(2)
if (!inputPath || !additionalEditionsPath || !generatedAt) {
  throw new Error('Uso: node scripts/export-recovery-public.mjs <normalizado.json> <datas-adicionais.json> <gerado-em-ISO>')
}

const input = JSON.parse(await readFile(resolve(inputPath), 'utf8'))
const additionalEditions = JSON.parse(await readFile(resolve(additionalEditionsPath), 'utf8'))
if (!Array.isArray(additionalEditions) || new Set(additionalEditions).size !== additionalEditions.length) {
  throw new Error('Informe datas adicionais sem repetições')
}
const target = new URL('../public/recuperacao-historico.json', import.meta.url)
let previous = null
try { previous = validateRecoveryHistory(JSON.parse(await readFile(target, 'utf8'))) }
catch (error) { if (error.code !== 'ENOENT') throw error }
if (previous && Date.parse(generatedAt) < Date.parse(previous.generatedAt)) throw new Error('A nova versão é anterior ao histórico salvo')
const editions = [...new Set([...previous?.editions ?? [], ...input.sources.flatMap(source => source.publicationDates), ...additionalEditions])].sort()
const normalizeSector = label => {
  const clean = label?.replace(/\s+/g, ' ').trim()
  return !clean || /^n[aã]o (identificad[oa]|informad[oa])$/i.test(clean) ? null : clean
}
const publishedName = entry => {
  if (!entry.cnpj || !entry.companyName || entry.companyName.length > 240) return null
  const name = entry.companyName.trim()
  if (/\b(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11,})\b/.test(name)) return null
  // Só denominação empresarial com tipo societário expresso na linha; ME/EPP sozinho não prova tipo.
  return /(?:\bLtda\.?|\bLimitada|\bS\s*\/\s*A\.?|\bS\.A\.?|\bEireli)(?:\s*[-–]?\s+(?:ME|EPP|em recuperaç[aã]o judicial))?$/iu.test(name)
    ? name : null
}

const labels = new Map()
const records = input.events.filter(entry => entry.eventType === 'pedido').map(entry => {
  const normalized = normalizeSector(entry.sectorSource)
  const key = normalized?.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')
  if (key && !labels.has(key)) labels.set(key, normalized)
  return {
    id: entry.id,
    date: entry.publicationDate,
    uf: entry.historicalUfStatus === 'explicit-address' ? entry.historicalUf : null,
    sector: labels.get(key) ?? null,
    name: publishedName(entry),
  }
}).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

const inputIds = new Set(records.map(row => row.id))
if (inputIds.size !== records.length) throw new Error('Entrada contém menções repetidas')
const preserved = new Map((previous?.records ?? []).map(row => [row.id, row]))
for (const row of records) {
  const saved = preserved.get(row.id)
  if (saved && JSON.stringify(saved) !== JSON.stringify(row)) throw new Error('Uma menção anterior mudou e requer conferência')
  preserved.set(row.id, row)
}
const merged = [...preserved.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
const output = validateRecoveryHistory({ schemaVersion: 1, generatedAt, editions, records: merged })
const temporary = new URL('../public/.recuperacao-historico.tmp', import.meta.url)
await writeFile(temporary, JSON.stringify(output) + '\n', 'utf8')
await rename(temporary, target)
console.log(`${merged.length} menções; ${editions.length} edições; ${merged.filter(record => record.name === null).length} nomes não exibidos.`)
