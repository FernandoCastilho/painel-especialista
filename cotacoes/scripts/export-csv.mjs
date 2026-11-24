// Gera CSV somente quando há dados; falha de coleta nunca substitui CSV válido por cabeçalho.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCsvs, HEADER } from './csv-lib.mjs'
import { loadPublishedFile, validatePublishedFile } from './weekly-data.mjs'
import { isMoedaDate, moedaDateInBrasilia, onlyEffectiveMoedas } from './moedas-lib.mjs'

const read = async (f) => { try { return JSON.parse(await readFile(new URL(`../public/${f}.json`, import.meta.url), 'utf8')) } catch { return null } }
const saveFile = async (name, text) => {
  await mkdir(new URL('../public/csv/', import.meta.url), { recursive: true })
  await writeFile(new URL(`../public/csv/${name}`, import.meta.url), text)
}

const checkedRows = (file, text, cutoff) => {
  validatePublishedFile(file, text)
  const [header, ...lines] = text.trim().split(/\r?\n/)
  const points = new Set(), effectiveLines = []
  for (const line of lines) {
    // Código é a primeira coluna; data, valor e unidade partem do fim porque o nome pode ter vírgulas.
    const columns = line.split(',')
    const id = columns[0], date = columns.at(-3), rawValue = columns.at(-2)
    if (columns.length < 5 || !id || !isMoedaDate(date) || !rawValue?.trim() || !Number.isFinite(Number(rawValue))) {
      throw new Error(`CSV ${file}: observação inválida`)
    }
    if (date > cutoff) continue
    effectiveLines.push(line)
    const key = `${id},${date}`
    if (points.has(key)) throw new Error(`CSV ${file}: observação repetida ${key}`)
    points.add(key)
  }
  const effectiveText = effectiveLines.length === lines.length ? text : toEffectiveCsv(header, effectiveLines)
  return { points, effectiveText }
}
const toEffectiveCsv = (header, lines) => `\uFEFF${[header, ...lines].join('\r\n')}\r\n`
const PROTECTED_CSVS = new Set(['tfc.csv', 'moedas.csv'])

export async function exportCsvs({ bndes, moedas, load = loadPublishedFile, save = saveFile, warn = console.warn, now = Date.now() } = {}) {
  const cutoff = moedaDateInBrasilia(now)
  const files = buildCsvs({ bndes, moedas: onlyEffectiveMoedas(moedas, now) })
  const preserved = []
  // Antes da primeira escrita, verifica se o CSV segue cobrindo todas as datas já publicadas em cada série de moedas.
  const previousCurrencies = new Map(await Promise.all([...PROTECTED_CSVS].map(async name => [
    name, await load(`csv/${name}`, { allowMissing: true }),
  ])))
  for (const [name, text] of Object.entries(files)) {
    const file = `csv/${name}`
    try { validatePublishedFile(file, text) }
    catch {
      const previous = previousCurrencies.has(name) ? previousCurrencies.get(name) : await load(file)
      validatePublishedFile(file, previous)
      files[name] = previous
      preserved.push(name)
    }
    if (!PROTECTED_CSVS.has(name)) continue
    const { points: current, effectiveText } = checkedRows(file, files[name], cutoff)
    validatePublishedFile(file, effectiveText)
    files[name] = effectiveText
    const previous = previousCurrencies.get(name)
    if (previous === null) continue
    // Um cabeçalho sem observações de versões antigas não tem dados para preservar.
    if (previous.replace(/^\uFEFF/, '').trim() === HEADER.join(',')) continue
    const lost = [...checkedRows(file, previous, cutoff).points].find(key => !current.has(key))
    if (lost) throw new Error(`CSV ${name}: observação publicada ausente no novo arquivo (${lost})`)
  }
  for (const [name, text] of Object.entries(files)) await save(name, text)
  for (const name of preserved) warn(`CSV ${name}: coleta sem dados; preservadas as observações vigentes já publicadas, sem renovar datas.`)
  return { files, preserved }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files } = await exportCsvs({ bndes: await read('bndes'), moedas: await read('moedas') })
  console.log(`CSV: ${Object.keys(files).join(' · ')}`)
}
