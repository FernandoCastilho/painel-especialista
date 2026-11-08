import {readFile, readdir, writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {normalizeMovement} from '../src/movimentoFalimentar.js'

const root = new URL('../', import.meta.url)
const names = (await readdir(new URL('data/movimento-falimentar/', root))).filter(n => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort()
const editions = await Promise.all(names.map(async n => JSON.parse(await readFile(new URL('data/movimento-falimentar/' + n, root), 'utf8'))))
if (editions.some(e => e.schemaVersion !== 1)) throw new Error('Versão de fonte inválida')
const generatedAt = Math.max(...editions.map(e => Date.parse(e.source.consultedAt)))
const data = normalizeMovement({schemaVersion: 1, generatedAt, unit: 'editorial-company-event', editions})
const target = new URL('public/movimento-falimentar.json', root)
await writeFile(target, JSON.stringify(data, null, 2) + '\n')
console.log(`${editions.length} edição(ões), ${editions.reduce((n, e) => n + e.events.length, 0)} menções: ${fileURLToPath(target)}`)
