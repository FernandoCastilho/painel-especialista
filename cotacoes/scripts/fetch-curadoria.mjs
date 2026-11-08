import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { loadPrevious } from './prev-lib.mjs'
import { collectCuradoria } from './curadoria-lib.mjs'
const output = new URL('../public/curadoria-noticias.json', import.meta.url)
let local = null
try { local = JSON.parse(await readFile(output, 'utf8')) } catch { /* primeira coleta */ }
const remote = await loadPrevious('curadoria-noticias.json')
const data = await collectCuradoria({ previous: [local, remote] })
await mkdir(new URL('../public/', import.meta.url), { recursive: true })
const temp = new URL('../public/curadoria-noticias.json.tmp', import.meta.url)
await writeFile(temp, JSON.stringify(data) + '\n')
await rename(temp, output)
for (const topic of Object.values(data.topics)) console.log(`${topic.label}: ${topic.items.length} matérias / 168 horas; estado=${topic.status}; buscas=${topic.queriesSucceeded}/${topic.queriesTotal}`)
