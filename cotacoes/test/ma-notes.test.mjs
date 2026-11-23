import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { maNote, readMaNote, buildMaCatalog } from '../scripts/build-ma-content.mjs'
const catalog=JSON.parse(readFileSync(new URL('../src/ma/transactions.json',import.meta.url),'utf8'))
test('M&A: nota preserva todos os campos, fontes, histórico e data_criacao',()=>{
  const row=catalog.transactions[0]
  const note=maNote(row,'2026-11-23')
  assert.deepEqual(readMaNote(note),row)
  assert.match(note,/data_criacao: 2026-11-23/)
  assert.match(note,/## Histórico/)
  assert.match(note,/\[\[30\. Recursos\/LLM Wiki\/concepts\/ma-panorama/)
  assert.throws(()=>readMaNote(note.replace('```ma-registro','```texto')))
})
test('M&A: catálogo compilado equivale às notas e não sobrescreve fontes brutas',async()=>{
  const result=await buildMaCatalog({write:false})
  assert.deepEqual(result,catalog)
})
