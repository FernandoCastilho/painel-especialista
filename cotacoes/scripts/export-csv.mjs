// Gera CSV somente quando há dados; falha de coleta nunca substitui CSV válido por cabeçalho.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCsvs } from './csv-lib.mjs'
import { loadPublishedFile, validatePublishedFile } from './weekly-data.mjs'

const read = async (f) => { try { return JSON.parse(await readFile(new URL(`../public/${f}.json`, import.meta.url), 'utf8')) } catch { return null } }
const saveFile = async (name, text) => {
  await mkdir(new URL('../public/csv/', import.meta.url), { recursive: true })
  await writeFile(new URL(`../public/csv/${name}`, import.meta.url), text)
}

export async function exportCsvs({ bndes, moedas, load = loadPublishedFile, save = saveFile, warn = console.warn } = {}) {
  const files = buildCsvs({ bndes, moedas })
  const preserved = []
  // Confere o lote inteiro antes da primeira escrita. Sem dado atual nem anterior válido, aborta.
  for (const [name, text] of Object.entries(files)) {
    try { validatePublishedFile(`csv/${name}`, text) }
    catch {
      const previous = await load(`csv/${name}`)
      validatePublishedFile(`csv/${name}`, previous)
      files[name] = previous
      preserved.push(name)
    }
  }
  for (const [name, text] of Object.entries(files)) await save(name, text)
  for (const name of preserved) warn(`CSV ${name}: coleta sem dados; preservado conteúdo publicado anterior, sem renovar datas.`)
  return { files, preserved }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files } = await exportCsvs({ bndes: await read('bndes'), moedas: await read('moedas') })
  console.log(`CSV: ${Object.keys(files).join(' · ')}`)
}
