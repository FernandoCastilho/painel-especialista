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
test('M&A: datas confirmadas no lançamento têm apoio primário e preservam o recorte histórico',()=>{
  const verified = new Map([
    ['2025-bionexo-tasy','2025-12-30'],
    ['2025-hindiana-neogrid','2025-12-22'],
    ['2025-savencia-quata','2025-12-23'],
    ['2025-vtal-um-telecom','2025-12-29'],
  ])
  for (const [id,date] of verified) {
    const row = catalog.transactions.find(item => item.id === id)
    assert.equal(row.announcementDate,date)
    assert.equal(row.dateBasis,'announcement')
    assert.match(row.supportingSource,/^https:\/\//)
    assert.ok(maNote(row,'2026-11-23').includes(`[Fonte primária do negócio](${row.supportingSource})`))
    assert.equal(row.completionDate,null)
  }
  assert.equal(catalog.transactions.find(row => row.id === '2025-vtal-um-telecom').status,'Em aprovação')
})
