import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, cp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const root=await mkdtemp(join(tmpdir(),'maintenance-isolation-'))
await cp(new URL('../src/',import.meta.url),join(root,'src'),{recursive:true})
await cp(new URL('../scripts/',import.meta.url),join(root,'scripts'),{recursive:true})
await writeFile(join(root,'package.json'),'{"type":"module"}')
test.after(()=>rm(root,{recursive:true,force:true}))
const load=path=>import(pathToFileURL(join(root,path)))
const {createSimulationState,digest,STATE_REF}=await load('scripts/sector-news-safe/state.mjs')
const state={...createSimulationState({now:Date.parse('2026-11-08T12:00:00Z'),storeId:'isolated'}),environment:'production'}
const token='a'.repeat(40)
const candidate={beforeDigest:digest(state),parentToken:token,reviewId:'isolated-review',reviewedAt:'2026-11-08T12:01:00Z',sources:['aneel','susep']}
// Grant exists exclusively in this temporary module tree, never the checkout.
const releasePath=join(root,'scripts/sector-news-safe/parser-release.mjs')
const original=await readFile(releasePath,'utf8')
await writeFile(releasePath,original.replace('Object.freeze([])',`Object.freeze([${JSON.stringify(candidate)}])`))
// Load wrapper through a distinct copied module graph so it sees the isolated grant.
const second=join(root,'apply');await cp(join(root,'scripts'),join(second,'scripts'),{recursive:true});await cp(join(root,'src'),join(second,'src'),{recursive:true});await writeFile(join(second,'package.json'),'{"type":"module"}')
const {runParserMaintenance}=await import(pathToFileURL(join(second,'scripts/sector-news-parser-release.mjs')))
const {planParserRelease}=await import(pathToFileURL(join(second,'scripts/sector-news-safe/parser-release.mjs')))
function serviceFor(failure) {
  let reads=0,writes=0,saved=false
  const next=planParserRelease(state,token,candidate)
  return {get writes(){return writes},get reads(){return reads},service:{store:{read:async()=>{
    reads++
    if(saved&&failure==='uncertain')throw Error('simulated_final_read_uncertain')
    return {state:saved?next:structuredClone(state),token:saved?(failure==='mismatch'?'c':'b').repeat(40):token,confirmed:true,ref:STATE_REF}
  }},applyParserRelease:async()=>{writes++;saved=true;return {state:next,token:'b'.repeat(40),confirmed:true,ref:STATE_REF}}}}
}
test('isolated approved apply succeeds only after final matching reread',async()=>{
  const f=serviceFor();const result=await runParserMaintenance({mode:'apply',service:f.service,candidate})
  assert.equal(result.applied,true);assert.equal(result.stateToken,'b'.repeat(40));assert.equal(f.writes,1);assert.equal(f.reads,2)
})
for(const failure of ['mismatch','uncertain'])test(`isolated apply ${failure} fails closed without retry`,async()=>{
  const f=serviceFor(failure)
  await assert.rejects(runParserMaintenance({mode:'apply',service:f.service,candidate}),/final_read/)
  assert.equal(f.writes,1);assert.equal(f.reads,2)
})
test('maintenance blocks direct production collector before any request, journal read/write or publication',async()=>{
  await writeFile(join(root,'scripts/sector-news-safe/maintenance-config.json'),'{"schemaVersion":1,"enabled":true}')
  const {runSectorNewsProduction}=await load('scripts/sector-news-safe/runner.mjs')
  const never=()=>{throw Error('must not access')}
  const result=await runSectorNewsProduction({store:{read:never,compareAndSwap:never},transport:{request:never},publisher:{publish:never}})
  assert.deepEqual(result,{status:'maintenance',networkEnabled:false,collectionAttempted:false})
})
test('maintenance notice does not renew article, source or publication dates',async()=>{
  const {normalizeSectorNews}=await load('src/sectorNews.js')
  const data=JSON.parse(await readFile(new URL('../public/sector-news.json',import.meta.url)))
  const before=structuredClone(data)
  data.collectionPolicy={...data.collectionPolicy,maintenanceActive:true}
  const result=normalizeSectorNews(data)
  assert.equal(result.collection.automaticCollectionEnabled,false);assert.equal(result.collection.mode,'maintenance')
  assert.deepEqual(data.sourceStates,before.sourceStates);assert.deepEqual(data.topics,before.topics);assert.deepEqual(data.delivery,before.delivery)
})
