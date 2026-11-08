import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runParserMaintenance } from '../scripts/sector-news-parser-release.mjs'
import { createSimulationState, digest, STATE_REF } from '../scripts/sector-news-safe/state.mjs'
const state = { ...createSimulationState({ now: Date.parse('2026-11-08T12:00:00Z'), storeId: 'fixture' }), environment: 'production' }
const token = 'a'.repeat(40)
const candidate = { beforeDigest: digest(state), parentToken: token, reviewId: 'fixture-review', reviewedAt: '2026-11-08T12:01:00Z', sources: ['aneel', 'susep'] }
function setup() {
  let writes=0,reads=0
  const service={ store:{read:async()=>{reads++;return {state:structuredClone(state),token,confirmed:true,ref:STATE_REF}}}, applyParserRelease:async()=>{writes++;throw Error('must not write')} }
  return {service,get reads(){return reads},get writes(){return writes}}
}
test('maintenance plan is read-only and leaves candidate unapproved',async()=>{
  const f=setup();const result=await runParserMaintenance({mode:'plan',service:f.service,candidate})
  assert.equal(result.applied,false);assert.equal(result.previousRevision,0);assert.equal(result.proposedRevision,1)
  assert.equal(f.reads,1);assert.equal(f.writes,0)
  await assert.rejects(runParserMaintenance({mode:'apply',service:f.service,candidate}),/not_approved/)
  assert.equal(f.reads,1);assert.equal(f.writes,0)
})
test('maintenance refuses stale candidate, future date and unknown mode without writes',async()=>{
  const f=setup()
  await assert.rejects(runParserMaintenance({mode:'plan',service:f.service,candidate:{...candidate,parentToken:'b'.repeat(40)}}),/stale/)
  await assert.rejects(runParserMaintenance({mode:'plan',service:f.service,candidate,clock:()=>Date.parse('2026-11-08T11:00:00Z')}),/future/)
  await assert.rejects(runParserMaintenance({mode:'automatic',service:f.service,candidate}),/mode/)
  assert.equal(f.writes,0)
})
test('maintenance workflow shares collector concurrency and defaults to read-only planning',async()=>{
  const workflow=await readFile(new URL('../../.github/workflows/institutional-news-release.yml',import.meta.url),'utf8')
  const collector=await readFile(new URL('../../.github/workflows/institutional-news.yml',import.meta.url),'utf8')
  for(const text of [workflow,collector]){assert.match(text,/group: institutional-news-collector/);assert.match(text,/cancel-in-progress: false/)}
  assert.match(workflow,/default: false/);assert.doesNotMatch(workflow,/schedule:/)
  assert.match(workflow,/--plan/);assert.match(workflow,/--apply/)
  const plan=workflow.split('  plan:')[1].split('  apply:')[0]
  assert.doesNotMatch(plan,/contents: write/)
})
