// Captura e verifica o pacote de dados sob o lock de publicação de Pages.
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RETAIN_FILES, validatePublishedFile } from './weekly-data.mjs'

const CBS = 'ibge-cbs-snapshot.json'
const MARKER = 'painel-release.json'
const SHA = /^[0-9a-f]{40}$/
export const RELEASE_FILES = [...RETAIN_FILES, 'fx-noticias.json', 'knowledge-news.json']
const hash = text => createHash('sha256').update(text).digest('hex')
const transient = new Set([408, 429, 500, 502, 503, 504])

export async function downloadPublished(file, { repo = process.env.GITHUB_REPOSITORY, fetchImpl = fetch, wait = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  const [owner, name] = (repo ?? '').split('/')
  if (!owner || !name) throw new Error('Repositório Pages não configurado.')
  const url = new URL(`https://${owner.toLowerCase()}.github.io/${name}/${file}`)
  for (let i = 0; i < 3; i++) {
    try { return await download(url, fetchImpl) }
    catch (e) {
      if (i === 2 || !isTransient(e)) throw Object.assign(new Error(file + ': ' + e.message), { status: e.status })
      await wait(250 * (i + 1))
    }
  }
}

const isTransient = e => e.status ? transient.has(e.status) : ['TypeError', 'TimeoutError', 'AbortError'].includes(e.name)

async function download(url, fetchImpl) {
  url.searchParams.set('release-check', randomUUID())
  const r = await fetchImpl(url, { signal: AbortSignal.timeout(10000), cache: 'no-store', redirect: 'error' })
  if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status })
  return Buffer.from(await r.arrayBuffer()).toString('utf8')
}

const runNumber = /^[1-9][0-9]*$/

function validateMarker(marker, requireRun = false) {
  if (!SHA.test(marker?.sha ?? '') || !SHA.test(marker?.cbsBlob ?? '') || !/^[0-9a-f]{64}$/.test(marker?.cbsHash ?? '') ||
      ((requireRun || marker.runId != null || marker.runAttempt != null) &&
        (!runNumber.test(marker.runId ?? '') || !runNumber.test(marker.runAttempt ?? '')))) {
    throw new Error('Marcador Pages inválido.')
  }
}

export async function verifyPublishedMarker({ pageUrl, expected, sha, runId, runAttempt, fetchImpl = fetch, wait = ms => new Promise(r => setTimeout(r, ms)) }) {
  validateMarker(expected, true)
  if (expected.sha !== sha || expected.runId !== runId || expected.runAttempt !== runAttempt) throw new Error('Marcador local não corresponde à execução.')
  const root = new URL(pageUrl)
  if (root.protocol !== 'https:' || root.username || root.password || root.search || root.hash) throw new Error('Endereço público Pages inválido.')
  if (!root.pathname.endsWith('/')) root.pathname += '/'
  const markerUrl = new URL(MARKER, root)
  for (let i = 0; i < 8; i++) {
    try {
      const served = JSON.parse(await download(markerUrl, fetchImpl))
      validateMarker(served)
      if (['sha', 'runId', 'runAttempt', 'cbsBlob', 'cbsHash'].every(key => served[key] === expected[key])) return
      throw Object.assign(new Error('Marcador servido não corresponde ao SHA e à execução publicados.'), { propagation: true })
    } catch (e) {
      // 404 ou versão anterior podem ocorrer enquanto o Pages propaga o novo artefato.
      if (i === 7 || !(e.propagation || e.status === 404 || isTransient(e))) throw e
      await wait(10000)
    }
  }
}

export async function snapshotRelease(load = downloadPublished, save = savePublic) {
  const files = {}
  // Lotes limitados; não se grava nada se uma única base falhar.
  for (let i = 0; i < RELEASE_FILES.length; i += 6) {
    await Promise.all(RELEASE_FILES.slice(i, i + 6).map(async file => {
      const text = await load(file)
      validatePublishedFile(file, text)
      files[file] = text
    }))
  }
  for (const [file, text] of Object.entries(files)) await save(file, text)
  return Object.fromEntries(RELEASE_FILES.map(file => [file, hash(files[file])]))
}

export async function verifyRelease(directory, snapshot) {
  if (Object.keys(snapshot ?? {}).length !== RELEASE_FILES.length || RELEASE_FILES.some(file => !/^[0-9a-f]{64}$/.test(snapshot[file] ?? ''))) {
    throw new Error('Inventário de preservação de Pages incompleto.')
  }
  for (const file of RELEASE_FILES) {
    if (hash(await readFile(resolve(directory, file), 'utf8')) !== snapshot[file]) throw new Error(file + ': conteúdo mudou no build.')
  }
}

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))
const cbsSrc = fileURLToPath(new URL('../src/ibgeCbsSnapshot.json', import.meta.url))
async function savePublic(file, text) {
  const target = resolve(publicDir, file)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, text, 'utf8')
}

function validarCbs(text) {
  const data = JSON.parse(text)
  if (data.schemaVersion !== 1 || !Array.isArray(data.datasets) || data.datasets.length !== 3 ||
      !['comercio', 'industria', 'servicos'].every(kind => data.datasets.some(d => d.kind === kind && Number.isInteger(d.year) && d.groups?.length >= 5))) {
    throw new Error('Snapshot de referências IBGE CBS inválido.')
  }
}

export async function prepareCbs({ sha, blob, scheduled, load = downloadPublished, read = () => readFile(cbsSrc, 'utf8'), write = text => writeFile(cbsSrc, text, 'utf8') }) {
  if (!SHA.test(sha ?? '') || !SHA.test(blob ?? '')) throw new Error('SHA de código ou de CBS inválido.')
  let marker
  try { marker = JSON.parse(await load(MARKER)) }
  catch (e) { if (scheduled || e.status !== 404) throw e }
  if (marker !== undefined) validateMarker(marker)
  if (scheduled && marker?.sha !== sha) throw new Error('A coleta não pode republicar um SHA diferente do Pages ativo.')
  if (marker?.cbsBlob === blob) {
    const previous = await load(CBS)
    validarCbs(previous)
    if (hash(previous) !== marker.cbsHash) throw new Error('Snapshot publicado do IBGE CBS não corresponde ao marcador.')
    await write(previous)
  } else validarCbs(await read())
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , mode, file, dir] = process.argv
  const { GITHUB_SHA: sha, CBS_BLOB: blob, GITHUB_RUN_ID: runId, GITHUB_RUN_ATTEMPT: runAttempt } = process.env
  if (mode === 'capturar') await writeFile(file, JSON.stringify(await snapshotRelease()), 'utf8')
  else if (mode === 'conferir') await verifyRelease(dir, JSON.parse(await readFile(file, 'utf8')))
  else if (mode === 'preparar-cbs') await prepareCbs({ sha, blob, scheduled: process.env.GITHUB_EVENT_NAME === 'schedule' })
  else if (mode === 'empacotar-cbs') {
    const text = await readFile(cbsSrc, 'utf8')
    validarCbs(text)
    await writeFile(resolve(file, CBS), text, 'utf8')
    const marker = { sha, runId, runAttempt, cbsBlob: blob, cbsHash: hash(text) }
    validateMarker(marker, true)
    await writeFile(resolve(file, MARKER), JSON.stringify(marker) + '\n', 'utf8')
  } else if (mode === 'conferir-publicado') {
    const expected = JSON.parse(await readFile(resolve(file, MARKER), 'utf8'))
    await verifyPublishedMarker({ expected, sha, runId, runAttempt, pageUrl: process.env.SMOKE_PUBLISHED_URL })
    console.log('Marcador Pages confirmado para o SHA e a tentativa atuais.')
  } else throw new Error('Modo de preservação de Pages inválido.')
}
