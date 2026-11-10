// Dados gerados pelos coletores do Pages. Os JSON editoriais versionados e o ramo
// externo "data" seguem seus próprios fluxos; não são substituídos por esta cópia.
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CSV_FILES, HEADER } from './csv-lib.mjs'

export const RETAIN_JSON_FILES = [
  'bancos.json',
  'trends.json',
  'macro.json', 'focus-history.json', 'curves.json', 'curves-history.json', 'news.json',
  'feriados.json', 'oil.json', 'commodities.json', 'freight.json', 'policy-rates.json',
  'estr.json', 'euro-curve.json', 'indexadores.json', 'bndes.json', 'moedas.json',
  'reforma-tributaria.json', 'curadoria-noticias.json', 'temas.json', 'sector-news.json', 'insumos-precos.json', 'indices.json',
  'commodities-brl.json', 'fuels.json', 'freight-jp.json', 'ipca.json', 'divida.json',
  'ipca-groups.json', 'calendar.json', 'acessos.json', 'inadimplencia.json', 'recuperacao.json', 'heavy-vehicles.json',
]
export const RETAIN_FILES = [...RETAIN_JSON_FILES, ...CSV_FILES.map(file => 'csv/' + file)]
const aborted = (file, detail) => new Error('Publicação semanal abortada: não foi possível preservar ' + file + ' (' + detail + ')')

export function validatePublishedFile(file, text) {
  if (typeof text !== 'string' || !text.trim()) throw aborted(file, 'arquivo vazio ou ausente')
  if (file.endsWith('.json')) {
    let data
    try { data = JSON.parse(text) } catch { throw aborted(file, 'JSON inválido') }
    if (!data || typeof data !== 'object' || Array.isArray(data) ||
        !Object.keys(data).length || !('generatedAt' in data || 'updatedAt' in data)) {
      throw aborted(file, 'estrutura JSON inesperada')
    }
    return data
  }
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/)
  if (lines[0] !== HEADER.join(',') || lines.length < 2 || /^\s*</.test(lines[1])) {
    throw aborted(file, 'CSV inválido ou sem dados')
  }
  return text
}

export async function loadPublishedFile(file, { repo = process.env.GITHUB_REPOSITORY, fetchImpl = fetch } = {}) {
  const [owner, name] = (repo ?? '').split('/')
  if (!owner || !name) throw aborted(file, 'repositório não configurado')
  const url = new URL('https://' + owner.toLowerCase() + '.github.io/' + name + '/' + file)
  url.searchParams.set('weekly', Date.now())
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(20000), headers: { 'Cache-Control': 'no-cache' } })
    if (!response.ok) throw new Error('HTTP ' + response.status)
    // Response.text() remove o BOM UTF-8 dos CSV. Decodificar o buffer o preserva.
    return Buffer.from(await response.arrayBuffer()).toString('utf8')
  } catch (error) { throw aborted(file, error.message) }
}

const hash = text => createHash('sha256').update(text, 'utf8').digest('hex')
export const createWeeklySnapshot = files => Object.fromEntries(RETAIN_FILES.map(file => {
  validatePublishedFile(file, files[file])
  return [file, hash(files[file])]
}))

// Na coleta semanal, o histórico do Focus é renovado de propósito depois do inventário.
// Só esse arquivo pode ter o registro trocado, e só depois de conferido de novo.
export const WEEKLY_REFRESHED_FILES = ['focus-history.json']
export function acceptRefreshedFile(snapshot, file, text) {
  if (!WEEKLY_REFRESHED_FILES.includes(file)) throw aborted(file, 'arquivo não pode ser renovado na coleta semanal')
  if (!snapshot || !/^[a-f0-9]{64}$/.test(snapshot[file] ?? '')) throw new Error('Publicação semanal abortada: inventário de preservação incompleto')
  const data = validatePublishedFile(file, text)
  if (!data.series || typeof data.series !== 'object' || !Object.keys(data.series).length) throw aborted(file, 'histórico renovado sem séries')
  return { ...snapshot, [file]: hash(text) }
}

export async function verifyWeeklyData(directory, snapshot) {
  if (!snapshot || Object.keys(snapshot).length !== RETAIN_FILES.length ||
      RETAIN_FILES.some(file => !/^[a-f0-9]{64}$/.test(snapshot[file] ?? ''))) {
    throw new Error('Publicação semanal abortada: inventário de preservação incompleto')
  }
  for (const file of RETAIN_FILES) {
    let text
    try { text = await readFile(resolve(directory, file), 'utf8') }
    catch { throw aborted(file, 'ausente do pacote final') }
    if (hash(text) !== snapshot[file]) throw aborted(file, 'conteúdo alterado no pacote final')
  }
  console.log('Preservação semanal conferida: ' + RETAIN_FILES.length + ' arquivos no pacote final')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , directory, snapshotFile] = process.argv
  if (!directory || !snapshotFile) throw new Error('Uso: node scripts/weekly-data.mjs dist caminho-do-snapshot.json')
  await verifyWeeklyData(directory, JSON.parse(await readFile(snapshotFile, 'utf8')))
}
