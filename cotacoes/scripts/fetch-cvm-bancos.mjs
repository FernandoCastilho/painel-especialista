import { readFile, writeFile, mkdtemp, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CVM_BANKS } from '../src/bancosCvm.js'
import { cvmZipUrl, cvmEntry, readCvmRows, buildBankCvm, mergeBankCvm } from './cvm-lib.mjs'

const output = new URL('../public/bancos-cvm.json', import.meta.url)
const previous = await readFile(output, 'utf8').then(JSON.parse).catch(() => null)
const cache = process.env.CVM_CACHE_DIR || await mkdtemp(join(tmpdir(), 'cvm-'))
const errors = []
const now = new Date(), thisYear = now.getUTCFullYear()
// Primeira coleta: três anos fechados mais o corrente. Depois, só o ano passado e o corrente
// (arquivos antigos não mudam, a não ser por reapresentação, que o ano passado ainda cobre).
const firstYear = previous?.banks?.length && process.env.CVM_FULL !== '1' ? thisYear - 1 : thisYear - 3
const years = Array.from({ length: thisYear - firstYear + 1 }, (_, i) => firstYear + i)

async function download(kind, year) {
  const file = join(cache, `${kind}_${year}.zip`)
  if (await access(file).then(() => true, () => false)) return file
  const url = cvmZipUrl(kind, year)
  const response = await fetch(url, { signal: AbortSignal.timeout(180000), redirect: 'error' })
  if (response.status === 404) return null // ITR do ano corrente só existe depois do primeiro trimestre divulgado
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.subarray(0, 2).toString() !== 'PK') throw new Error('Resposta não é um arquivo ZIP')
  await writeFile(file, buffer)
  return file
}
function readEntry(zip, entry) {
  const text = execFileSync('unzip', ['-p', zip, entry], { maxBuffer: 1024 * 1024 * 1024 }).toString('latin1')
  return text
}

const rows = { dfp: {}, itr: {} }
for (const kind of ['dfp', 'itr']) {
  // A DFP de um ano só é publicada no ano seguinte; pedir a do ano corrente seria falha certa.
  for (const year of kind === 'dfp' ? years.filter(y => y < thisYear) : years) {
    try {
      const zip = await download(kind, year)
      if (!zip) continue
      rows[kind][year] = ['BPA', 'BPP', 'DRE'].flatMap(statement => readCvmRows(readEntry(zip, cvmEntry(kind, statement, year)), CVM_BANKS.map(b => b.cvmCode)))
    } catch (error) { errors.push(`${kind.toUpperCase()} ${year}: ${error.message}`) }
  }
}
const got = Object.values(rows).reduce((n, byYear) => n + Object.keys(byYear).length, 0)
if (!got) {
  if (!previous) throw new Error('CVM indisponível e sem base anterior para preservar')
  await writeFile(output, JSON.stringify({ ...previous, stale: true, lastAttemptAt: Date.now(), errors }, null, 2) + '\n')
  console.log(`Bancos CVM: coleta falhou, base anterior preservada (${errors.join('; ')})`)
  process.exit(0)
}
const banks = CVM_BANKS.map(bank => mergeBankCvm(previous?.banks?.find(b => b.id === bank.id), buildBankCvm(bank, rows)))
const empty = banks.filter(b => !b.annual.length && !b.quarterly.length)
if (empty.length === banks.length) throw new Error('Nenhum indicador reconhecido: o plano de contas da CVM pode ter mudado')
for (const b of empty) errors.push(`${b.name}: nenhum indicador reconhecido`)
await writeFile(output, JSON.stringify({ generatedAt: Date.now(), lastAttemptAt: Date.now(), stale: errors.length > 0, errors, source: 'CVM · dados abertos · DFP e ITR consolidados', banks }, null, 2) + '\n')
console.log(`Bancos CVM: ${banks.length} bancos; anos ${years.join(', ')}; ${errors.length} falhas`)
