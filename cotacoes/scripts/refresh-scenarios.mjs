import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { collectFocus, keepPublication, preserveFocus } from './focus-collector.mjs'
import { RETAIN_FILES, loadPublishedFile, validatePublishedFile, createWeeklySnapshot } from './weekly-data.mjs'
export { RETAIN_FILES } from './weekly-data.mjs'

const saveFile = async (file, text) => {
  const output = new URL('../public/' + file, import.meta.url)
  await mkdir(dirname(fileURLToPath(output)), { recursive: true })
  await writeFile(output, text, 'utf8')
}

export async function refreshScenarios({ load = loadPublishedFile, collect = collectFocus, save = saveFile, now = Date.now() } = {}) {
  const retained = {}
  // Todos os downloads e formatos são conferidos antes de escrever em public/.
  for (const file of RETAIN_FILES) {
    const text = await load(file)
    validatePublishedFile(file, text)
    retained[file] = text
  }
  const previous = JSON.parse(retained['macro.json'])
  let macro
  try {
    macro = {
      ...previous,
      focus: keepPublication(await collect({ now }), previous.focus),
      focusCheckedAt: now,
      focusSchedule: { cadence: 'segunda 08:30 America/Sao_Paulo (repete terça 08:30)', skipped: false, error: null },
      stale: { ...previous.stale },
    }
    delete macro.stale.focus
  } catch (error) {
    macro = preserveFocus({ ...previous }, previous, { checkedAt: now, error: error.message })
    console.warn('Focus: último dado preservado; ' + error.message)
  }
  retained['macro.json'] = JSON.stringify(macro)
  for (const file of RETAIN_FILES) await save(file, retained[file])
  return retained
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const snapshotFile = process.argv[2]
  if (!snapshotFile) throw new Error('Informe o caminho do snapshot da atualização semanal')
  const retained = await refreshScenarios()
  await writeFile(snapshotFile, JSON.stringify(createWeeklySnapshot(retained)), 'utf8')
}
