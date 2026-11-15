import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { recoverTfc, validateTfcSnapshot, runRecovery } from '../scripts/recover-tfc.mjs'
import { TFC_SERIES } from '../scripts/moedas-lib.mjs'

const snapshot = await readFile(new URL('../data/recovery/tfc-2026-11-15.json', import.meta.url), 'utf8')
const base = () => ({ generatedAt: 1794760000000, series: { LD1: { points: [['2026-10-01', -0.11]], sourceValidated: true }, '604': {points: [['2026-11-16', 5.6518]]} }, stale: {LD1: 1793890320000}, errors: ['original'] })
const mutatedSnapshot = mutate => {
  const value = JSON.parse(snapshot); mutate(value)
  const text = JSON.stringify(value)
  return [text, {expectedHash: createHash('sha256').update(text).digest('hex')}]
}

test('official snapshot validates all 24 TFC series and 4970 points', () => {
  const checked = validateTfcSnapshot(snapshot)
  assert.equal(Object.keys(checked.series).length, 24)
  assert.equal(Object.values(checked.series).reduce((n,s) => n+s.points.length,0),4970)
})
test('missing TFC restored, other currencies and original timestamps untouched', () => {
  const current = base(), before = structuredClone(current)
  const {data,recovered} = recoverTfc(current,snapshot)
  assert.equal(recovered.length,24)
  assert.deepEqual(current,before)
  assert.deepEqual(data.series.LD1,before.series.LD1)
  assert.deepEqual(data.series['604'],before.series['604'])
  assert.equal(data.generatedAt,before.generatedAt)
  assert.equal(data.stale.LD1,before.stale.LD1)
  assert.deepEqual(data.errors,before.errors)
  for(const id of recovered) assert.equal(data.stale[id],Date.parse(JSON.parse(snapshot).capturedAt))
})
test('partial current data wins even if older; only missing series restored', () => {
  const current=base(); current.series.C01={points:[['2026-11-10',12.34]],custom:true};current.stale.C01=123
  const {data,recovered}=recoverTfc(current,snapshot)
  assert.equal(recovered.length,23)
  assert.deepEqual(data.series.C01,current.series.C01)
  assert.equal(data.stale.C01,123)
})
test('complete TFC base is unchanged and recovery is idempotent', () => {
  const {data}=recoverTfc(base(),snapshot)
  const second=recoverTfc(data,snapshot)
  assert.deepEqual(second.data,data)
  assert.deepEqual(second.recovered,[])
})
test('invalid existing series blocks instead of replacing it', () => {
  const current=base();current.series.C01={points:[['2026-02-31',10]]}
  assert.throws(()=>recoverTfc(current,snapshot),/série atual C01 inválida/)
})
test('corrupted snapshot blocks', () => assert.throws(()=>recoverTfc(base(),snapshot+'x'),/hash/))
test('wrong provenance or raw content hash blocks', () => {
  for(const mutate of [s=>s.series.C01.source='https://example.com',s=>s.series.C01.raw+='x']) {
    const [text,options]=mutatedSnapshot(mutate)
    assert.throws(()=>recoverTfc(base(),text,options),/proveniência ou integridade/)
  }
})
test('unapproved series or future snapshot point blocks', () => {
  const [text,options]=mutatedSnapshot(s=>{s.series.LD1=s.series.C01;delete s.series.C01})
  assert.throws(()=>recoverTfc(base(),text,options),/lista de séries/)
  const [future,opts]=mutatedSnapshot(s=>{s.capturedAt='2025-01-01T00:00:00Z'})
  assert.throws(()=>recoverTfc(base(),future,opts),/dados de C01 inválidos/)
})
test('missing local base loads published base before recovery',async()=>{
  let saved
  const result=await runRecovery({readCurrent:async()=>{throw Object.assign(new Error('missing'),{code:'ENOENT'})},load:async file=>{assert.equal(file,'moedas.json');return JSON.stringify(base())},readSnapshot:async()=>snapshot,save:async text=>{saved=JSON.parse(text)}})
  assert.equal(result.recovered.length,TFC_SERIES.length)
  assert.deepEqual(saved.series.LD1,base().series.LD1)
})
test('unavailable base or invalid snapshot never writes',async()=>{
  let writes=0
  await assert.rejects(runRecovery({readCurrent:async()=>{throw Object.assign(new Error('missing'),{code:'ENOENT'})},load:async()=>{throw new Error('HTTP 503')},readSnapshot:async()=>snapshot,save:async()=>writes++}),/HTTP 503/)
  await assert.rejects(runRecovery({readCurrent:async()=>JSON.stringify(base()),readSnapshot:async()=>snapshot+'x',save:async()=>writes++}),/hash/)
  assert.equal(writes,0)
})
test('workflow gates recovery after collection and before CSV export with same schedule scope',async()=>{
  const text=await readFile(new URL('../../.github/workflows/pages.yml',import.meta.url),'utf8')
  assert.ok(text.indexOf('run: node scripts/fetch-moedas.mjs')<text.indexOf('run: node scripts/recover-tfc.mjs'))
  assert.ok(text.indexOf('run: node scripts/recover-tfc.mjs')<text.indexOf('run: node scripts/export-csv.mjs'))
  const step=text.split('- name: Recuperar somente séries TFC')[1].split('- name:')[0]
  assert.doesNotMatch(step,/continue-on-error:\s*true/)
  assert.match(step,/github.event.schedule != '0 11,18 \* \* \*'/)
  assert.match(step,/github.event.schedule != '30 11 \* \* 1,2'/)
})
