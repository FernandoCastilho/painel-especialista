// Recuperação pontual, auditável e fail-closed. Não consulta nem modifica LD1.
import { createHash } from 'node:crypto'
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMoeda, moedaUrl } from './moedas-lib.mjs'
import { loadPublishedFile, validatePublishedFile } from './weekly-data.mjs'

export const SNAPSHOT_SHA256 = 'd63ac787adf0ad472a92568461a5266b0fbadfb0e5a39b9c25e5dc6ad6a30e5d'
const IDS = ['604', '143', '024', '236', 'TR1', 'TR2', 'TD1', 'TD2', 'TD3']
const hash = text => createHash('sha256').update(text, 'utf8').digest('hex')
const fail = detail => { throw new Error(`Recuperação de nove moedas bloqueada: ${detail}`) }
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const validPoints = points => Array.isArray(points) && points.every((p, i) => {
  if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p[0]) || !Number.isFinite(p[1])) return false
  const date = new Date(p[0] + 'T12:00:00Z')
  return Number.isFinite(+date) && date.toISOString().slice(0,10) === p[0] && (!i || p[0] > points[i-1][0])
})

export function validateNineSnapshot(text, { expectedHash = SNAPSHOT_SHA256 } = {}) {
  if (hash(text) !== expectedHash) fail('hash do snapshot diverge')
  let snapshot
  try { snapshot = JSON.parse(text) } catch { fail('JSON do snapshot inválido') }
  if (snapshot.schemaVersion !== 1 || !object(snapshot.series) ||
      !Number.isFinite(Date.parse(snapshot.capturedAt)) || !/Z$/.test(snapshot.capturedAt)) fail('metadados inválidos')
  const ids = IDS
  if (Object.keys(snapshot.series).length !== ids.length || Object.keys(snapshot.series).some(id => !ids.includes(id))) fail('lista de séries divergente')
  const series = {}
  for (const id of ids) {
    const entry = snapshot.series[id]
    if (!object(entry) || entry.source !== moedaUrl(id) || typeof entry.raw !== 'string' || hash(entry.raw) !== entry.sha256) fail(`proveniência ou integridade de ${id} inválida`)
    const points = parseMoeda(entry.raw).map(([date, value]) => [date, Math.round(value * 1e6) / 1e6])
    // Preserva datas futuras oficiais; pointsOf aplica vigência sem alteração.
    if (!points.length || !validPoints(points)) fail(`dados de ${id} inválidos`)
    series[id] = { points, source: entry.source, sourceValidated: true, recoveredFrom: 'moedas-nine-2026-11-16', capturedAt: snapshot.capturedAt }
  }
  return { capturedAt: snapshot.capturedAt, series }
}

export function recoverNine(current, snapshotText, options) {
  const snapshot = validateNineSnapshot(snapshotText, options)
  if (!object(current) || !object(current.series) || !Number.isFinite(current.generatedAt) ||
      (current.stale !== undefined && !object(current.stale))) fail('base de moedas atual inválida')
  const out = structuredClone(current)
  const recovered = []
  for (const id of IDS) {
    const existing = current.series[id]
    if (existing !== undefined && (!object(existing) || !validPoints(existing.points))) fail(`série atual ${id} inválida; não será substituída`)
    if (existing?.points.length) continue
    out.series[id] = snapshot.series[id]
    out.stale = { ...(out.stale ?? {}), [id]: Date.parse(snapshot.capturedAt) }
    recovered.push(id)
  }
  return { data: out, recovered }
}

export async function runRecovery({ readCurrent, readSnapshot, save, load = loadPublishedFile } = {}) {
  let currentText
  try { currentText = await readCurrent() }
  catch (error) {
    // Coletor interrompido pode não ter gravado arquivo: preservar a base publicada,
    // não reconstruir as outras moedas a partir de um snapshot somente das nove moedas.
    if (error.code !== 'ENOENT') throw error
    currentText = await load('moedas.json')
  }
  const current = validatePublishedFile('moedas.json', currentText)
  const result = recoverNine(current, await readSnapshot())
  // Mesmo sem recuperação pode ser necessário materializar a base publicada ausente.
  await save(result.recovered.length ? JSON.stringify(result.data) + '\n' : currentText)
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = new URL('../public/moedas.json', import.meta.url)
  const temporary = new URL('../public/moedas.json.recovery-tmp', import.meta.url)
  const result = await runRecovery({
    readCurrent: () => readFile(output, 'utf8'),
    readSnapshot: () => readFile(new URL('../data/recovery/moedas-nine-2026-11-16.json', import.meta.url), 'utf8'),
    save: async text => {
      await mkdir(new URL('../public/', import.meta.url), { recursive: true })
      await writeFile(temporary, text, 'utf8')
      await rename(temporary, output)
    },
  })
  console.log(result.recovered.length ? `Nove moedas: ${result.recovered.length} séries recuperadas do snapshot oficial, sinalizadas como anteriores.` : 'Nove moedas: nenhuma série substituída.')
}
