// Coleta semanal do Focus: registra no inventário o histórico recém-renovado, para a conferência final
// comparar o pacote com o que a coleta de fato gravou. As demais bases seguem travadas no conteúdo publicado.
import { readFile, writeFile } from 'node:fs/promises'
import { acceptRefreshedFile } from './weekly-data.mjs'

const snapshotFile = process.argv[2]
if (!snapshotFile) throw new Error('Informe o caminho do snapshot da atualização semanal')
const file = 'focus-history.json'
const text = await readFile(new URL('../public/' + file, import.meta.url), 'utf8')
const snapshot = acceptRefreshedFile(JSON.parse(await readFile(snapshotFile, 'utf8')), file, text)
await writeFile(snapshotFile, JSON.stringify(snapshot), 'utf8')
console.log('Histórico do Focus renovado registrado na conferência semanal')
