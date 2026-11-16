import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { recoverNine, validateNineSnapshot, runRecovery } from '../scripts/recover-nine-moedas.mjs'
import { pointsOf } from '../src/moedas.js'
const IDS=['604','143','024','236','TR1','TR2','TD1','TD2','TD3']

const snapshot = await readFile(new URL('../data/recovery/moedas-nine-2026-11-16.json', import.meta.url), 'utf8')
const base = () => ({ generatedAt: 1794760000000, series: { LD1: { points: [['2026-10-01', -0.11]], sourceValidated: true }, C01: {points: [['2026-11-13', 14.3795]]} }, stale: {LD1: 1793890320000}, errors: ['original'] })
const mutatedSnapshot = mutate => {
  const value = JSON.parse(snapshot); mutate(value)
  const text = JSON.stringify(value)
  return [text, {expectedHash: createHash('sha256').update(text).digest('hex')}]
}

test('official snapshot validates all nine official series and 7182 points', () => {
  const checked = validateNineSnapshot(snapshot)
  assert.equal(Object.keys(checked.series).length, 9)
  assert.equal(Object.values(checked.series).reduce((n,s) => n+s.points.length,0),7182)
})
test('missing nine currencies restored, other currencies and original timestamps untouched', () => {
  const current = base(), before = structuredClone(current)
  const {data,recovered} = recoverNine(current,snapshot)
  assert.equal(recovered.length,9)
  assert.deepEqual(current,before)
  assert.deepEqual(data.series.LD1,before.series.LD1)
  assert.deepEqual(data.series.C01,before.series.C01)
  assert.equal(data.generatedAt,before.generatedAt)
  assert.equal(data.stale.LD1,before.stale.LD1)
  assert.deepEqual(data.errors,before.errors)
  for(const id of recovered) assert.equal(data.stale[id],Date.parse(JSON.parse(snapshot).capturedAt))
})
test('partial current data wins even if older; only missing series restored', () => {
  const current=base(); current.series['604']={points:[['2026-11-10',12.34]],custom:true};current.stale['604']=123
  const {data,recovered}=recoverNine(current,snapshot)
  assert.equal(recovered.length,8)
  assert.deepEqual(data.series['604'],current.series['604'])
  assert.equal(data.stale['604'],123)
})
test('complete nine currencies base is unchanged and recovery is idempotent', () => {
  const {data}=recoverNine(base(),snapshot)
  const second=recoverNine(data,snapshot)
  assert.deepEqual(second.data,data)
  assert.deepEqual(second.recovered,[])
})
test('invalid existing series blocks instead of replacing it', () => {
  const current=base();current.series['604']={points:[['2026-02-31',10]]}
  assert.throws(()=>recoverNine(current,snapshot),/série atual 604 inválida/)
})
test('corrupted snapshot blocks', () => assert.throws(()=>recoverNine(base(),snapshot+'x'),/hash/))
test('wrong provenance or raw content hash blocks', () => {
  for(const mutate of [s=>s.series['604'].source='https://example.com',s=>s.series['604'].raw+='x']) {
    const [text,options]=mutatedSnapshot(mutate)
    assert.throws(()=>recoverNine(base(),text,options),/proveniência ou integridade/)
  }
})
test('unapproved series blocks', () => {
  const [text,options]=mutatedSnapshot(s=>{s.series.LD1=s.series['604'];delete s.series['604']})
  assert.throws(()=>recoverNine(base(),text,options),/lista de séries/)

})
test('missing local base loads published base before recovery',async()=>{
  let saved
  const result=await runRecovery({readCurrent:async()=>{throw Object.assign(new Error('missing'),{code:'ENOENT'})},load:async file=>{assert.equal(file,'moedas.json');return JSON.stringify(base())},readSnapshot:async()=>snapshot,save:async text=>{saved=JSON.parse(text)}})
  assert.equal(result.recovered.length,IDS.length)
  assert.deepEqual(saved.series.LD1,base().series.LD1)
})
test('unavailable base or invalid snapshot never writes',async()=>{
  let writes=0
  await assert.rejects(runRecovery({readCurrent:async()=>{throw Object.assign(new Error('missing'),{code:'ENOENT'})},load:async()=>{throw new Error('HTTP 503')},readSnapshot:async()=>snapshot,save:async()=>writes++}),/HTTP 503/)
  await assert.rejects(runRecovery({readCurrent:async()=>JSON.stringify(base()),readSnapshot:async()=>snapshot+'x',save:async()=>writes++}),/hash/)
  assert.equal(writes,0)
})
test('original consumer retains future observations and applies validity by Sao Paulo day',()=>{
 const {data}=recoverNine(base(),snapshot)
 const at=d=>Date.parse(d+'T12:00:00-03:00')
 assert.equal(data.series['143'].points.at(-1)[0],'2026-11-17')
 assert.equal(data.series['604'].points.at(-1)[0],'2026-11-16')
 assert.equal(pointsOf(data,'143',at('2026-11-15')).at(-1)[0],'2026-11-13')
 assert.equal(pointsOf(data,'143',at('2026-11-16')).at(-1)[0],'2026-11-16')
 assert.equal(pointsOf(data,'143',at('2026-11-17')).at(-1)[0],'2026-11-17')
})
test('workflow orders recovery after TFC before CSV and fails closed',async()=>{
 const text=await readFile(new URL('../../.github/workflows/pages.yml',import.meta.url),'utf8')
 assert.ok(text.indexOf('run: node scripts/recover-tfc.mjs')<text.indexOf('run: node scripts/recover-nine-moedas.mjs'))
 assert.ok(text.indexOf('run: node scripts/recover-nine-moedas.mjs')<text.indexOf('run: node scripts/export-csv.mjs'))
 const step=text.split('- name: Recuperar nove moedas')[1].split('- name:')[0]
 assert.doesNotMatch(step,/continue-on-error:/)
 assert.ok(step.includes("github.event.schedule != '0 11,18 * * *'"))
 assert.ok(step.includes("github.event.schedule != '30 11 * * 1,2'"))
})
test('newer current observations and original freshness win over snapshot',()=>{
 const current=base();current.series['604']={points:[['2026-11-20',6.25]],capturedAt:'2026-11-20T16:00:00Z'};current.stale['604']=1795190400000
 const {data}=recoverNine(current,snapshot)
 assert.deepEqual(data.series['604'],current.series['604'])
 assert.equal(data.stale['604'],current.stale['604'])
})
