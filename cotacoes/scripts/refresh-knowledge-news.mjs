import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildKnowledgeGraph } from '../src/knowledgeGraph.js'
import { loadPrevious } from './prev-lib.mjs'

const FILES = {
  sectorNews: 'sector-news.json',
  news: 'news.json',
  temas: 'temas.json',
  curadoria: 'curadoria-noticias.json',
}
const SNAPSHOT = 'knowledge-news.json'
const validArchive = data => data?.schemaVersion === 1 && data.windowDays === 7 && Array.isArray(data.items)
const timestamp = value => {
  const stamp = typeof value === 'number' ? value : Date.parse(value)
  return Number.isFinite(stamp) ? stamp : null
}
const sourceStale = data => Boolean(
  (data?.stale && (typeof data.stale !== 'object' || Object.keys(data.stale).length)) ||
  data?.error || data?.errors?.length,
)

async function readJson(file) {
  try {
    const data = JSON.parse(await readFile(file, 'utf8'))
    return data && typeof data === 'object' && !Array.isArray(data)
      ? { status: 'available', data }
      : { status: 'invalid', data: null }
  } catch (error) {
    return { status: error.code === 'ENOENT' ? 'missing' : 'invalid', data: null }
  }
}

// This packages already collected headlines. It neither crawls sources nor changes
// their publication dates, last successful collection, or five-day display rules.
export async function refreshKnowledgeNews({
  directory = fileURLToPath(new URL('../public/', import.meta.url)),
  now = Date.now(),
  load = loadPrevious,
  repo = process.env.GITHUB_REPOSITORY,
} = {}) {
  if (!Number.isFinite(now) || now <= 0) throw new Error('Instante de montagem inválido')
  const inputStates = await Promise.all(Object.entries(FILES).map(async ([key, file]) => [key, file, await readJson(resolve(directory, file))]))
  const local = await readJson(resolve(directory, SNAPSHOT))
  let published = null
  try { published = await load(SNAPSHOT, repo) } catch { /* recorded explicitly below */ }
  const publishedStatus = published == null ? 'unavailable' : validArchive(published) ? 'available' : 'invalid'
  const localStatus = local.status === 'available' && !validArchive(local.data) ? 'invalid' : local.status
  const archives = [localStatus === 'available' ? local.data : null, publishedStatus === 'available' ? published : null].filter(Boolean)
  const originalUpdate = value => {
    const stamp = timestamp(value)
    return stamp !== null && stamp > 0 && stamp <= now ? stamp : null
  }
  const archiveUpdates = archives.map(archive => originalUpdate(archive.sourceUpdatedAt)).filter(value => value !== null)
  const archiveSourceUpdatedAt = archiveUpdates.length ? Math.max(...archiveUpdates) : null
  const inputs = Object.fromEntries(inputStates.map(([key, , state]) => [key, state.data]))
  const graph = buildKnowledgeGraph({
    ...inputs,
    archive: { schemaVersion: 1, windowDays: 7, sourceUpdatedAt: archiveSourceUpdatedAt, items: archives.flatMap(archive => archive.items) },
    now,
  })
  const notes = new Set(graph.meta?.coverageNotes || [])
  if (publishedStatus !== 'available') notes.add('Histórico publicado do mapa indisponível nesta montagem; o histórico local válido foi preservado. Na primeira publicação, a janela começa nas bases já disponíveis, sem recuperação retroativa.')
  for (const [, file, state] of inputStates) {
    if (state.status !== 'available') notes.add(`Base ${file} ${state.status === 'missing' ? 'ausente' : 'inválida'}; matérias anteriores continuam sujeitas ao limite de sete dias.`)
  }
  const sourceStates = Object.fromEntries(inputStates.map(([, file, state]) => [file, {
    status: state.status,
    // This is the source file's own timestamp, never the packaging time.
    generatedAt: timestamp(state.data?.generatedAt),
    stale: sourceStale(state.data),
  }]))
  const partial = publishedStatus !== 'available' || inputStates.some(([, , state]) => state.status !== 'available') || Object.values(sourceStates).some(state => state.stale)
  const snapshot = {
    schemaVersion: 1,
    windowDays: 7,
    generatedAt: now,
    generatedAtMeaning: 'Montagem do arquivo; não é data de publicação nem prova de consulta às fontes.',
    sourceUpdatedAt: originalUpdate(graph.meta?.lastUpdatedAt) ?? archiveSourceUpdatedAt,
    status: partial ? 'partial' : 'ok',
    stale: partial,
    archiveStatus: { local: localStatus, published: publishedStatus },
    sourceStates,
    coverageNotes: [...notes],
    items: graph.archiveItems,
  }
  if (!Array.isArray(snapshot.items)) throw new Error('Retenção do mapa sem arquivo de matérias validado')
  const output = resolve(directory, SNAPSHOT)
  await mkdir(dirname(output), { recursive: true })
  const temporary = `${output}.${process.pid}.tmp`
  await writeFile(temporary, JSON.stringify(snapshot) + '\n')
  await rename(temporary, output)
  return snapshot
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  refreshKnowledgeNews().then(snapshot => console.log(JSON.stringify({
    file: SNAPSHOT, items: snapshot.items.length, status: snapshot.status,
    archiveStatus: snapshot.archiveStatus, coverageNotes: snapshot.coverageNotes,
  }))).catch(error => { console.error(error.message); process.exitCode = 1 })
}
