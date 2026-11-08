import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The reviewed source remains the only editorial authority. Runtime files are
// exact per-study copies, emitted during dev/build instead of bundled together.
export async function buildSectorContent(root = new URL('../', import.meta.url)) {
  const studies = JSON.parse(await readFile(new URL('src/sectorStudies/studies.json', root), 'utf8'))
  if (!Array.isArray(studies)) throw new Error('Catálogo de estudos inválido')
  const keys = studies.map(study => {
    if (!/^[a-z0-9-]+$/.test(study.group) || !Number.isSafeInteger(study.topicIndex) || study.topicIndex < 0) throw new Error('Identidade de estudo inválida')
    return `${study.group}-${study.topicIndex}`
  })
  if (new Set(keys).size !== keys.length) throw new Error('Identidade de estudo duplicada')
  const directory = new URL('public/sector-studies/', root)
  await rm(directory, { recursive: true, force: true })
  await mkdir(directory, { recursive: true })
  await Promise.all(studies.map((study, index) => writeFile(new URL(`${keys[index]}.json`, directory), JSON.stringify(study) + '\n')))
  await writeFile(new URL('src/sectorStudies/catalog.generated.json', root), JSON.stringify(keys) + '\n')
  return { count: studies.length }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildSectorContent()
  console.log(`Estudos: ${result.count} recortes separados, preservando o conteúdo original`)
}
