import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { MAX_BUDGET_MS } from '../scripts/moedas-collector.mjs'
test('collector budget leaves final-write time before workflow deadline; fallback remains',async()=>{
 const workflow=await readFile(new URL('../../.github/workflows/pages.yml',import.meta.url),'utf8')
 const limit=Number(workflow.match(/name: Coletar TFC e moedas contratuais do BNDES[\s\S]*?timeout-minutes: (\d+)/)?.[1])
 assert.ok(MAX_BUDGET_MS+60000<=limit*60000)
 const script=await readFile(new URL('../scripts/fetch-moedas.mjs',import.meta.url),'utf8')
 assert.ok(script.indexOf("writeFile(new URL('../public/moedas.json'")>script.indexOf('await collectMoedas('))
 assert.match(script,/withOfficialLcdSnapshot\(fillSeriesFromPrevious\(buildMoedas\(results, errors\), await loadPrevious\('moedas.json'\)\)\)/)
})
