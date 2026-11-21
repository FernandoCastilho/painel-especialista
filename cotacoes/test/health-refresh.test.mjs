import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { loadDataFile } from '../src/useDataFile.js'
import { browserClock, hookRenderer, json } from './helpers/hooks.mjs'
let version=0
async function client(base) {
 const require=createRequire(import.meta.url)
 let src=await readFile(new URL('../src/useQuotes.js',import.meta.url),'utf8')
 src=src.replace("from 'react'", "from '"+pathToFileURL(require.resolve('react'))+"'")
 .replace("from './visiblePolling.js'", "from '"+new URL('../src/visiblePolling.js',import.meta.url)+"'")
 .replace("from './quoteSafety.js'", "from '"+new URL('../src/quoteSafety.js',import.meta.url)+"'")
 .replace("from '../scripts/data-schedules.mjs'", "from '"+new URL('../scripts/data-schedules.mjs',import.meta.url)+"'")
 .replace('import.meta.env?.VITE_DATA_BASE',base?JSON.stringify(base):'undefined')
 return import('data:text/javascript;base64,'+Buffer.from(src+'\n// health '+(++version)).toString('base64'))
}
const batch=at=>Object.fromEntries(Object.entries({USDBRL:5.4,EURBRL:6.1,JPYBRL:.035,USDCNH:6.65}).map(([k,b])=>[k,{bid:String(b),ask:String(b*1.001),high:String(b*1.02),low:String(b*.98),pctChange:'0',timestamp:String(at/1000)}]))
test('health refresh: arquivo distingue tentativa, sucesso, cache, falha e recuperação',async t=>{
 const clock=browserClock(t), generatedAt=clock.now-3600000
 let fail=false,calls=0
 globalThis.fetch=async()=>{calls++;if(fail)throw Error('offline');return json({generatedAt})}
 const first=await loadDataFile('health-attempt.json',clock.now,true)
 assert.equal(first.checkedAt,clock.now);assert.equal(first.lastSuccessAt,clock.now)
 await clock.advance(1000)
 const cached=await loadDataFile('health-attempt.json',clock.now)
 assert.equal(calls,1);assert.equal(cached.checkedAt,first.checkedAt)
 fail=true
 const failed=await loadDataFile('health-attempt.json',clock.now,true)
 assert.equal(failed.checkedAt,clock.now);assert.equal(failed.lastSuccessAt,first.lastSuccessAt);assert.equal(failed.data.generatedAt,generatedAt);assert.equal(failed.stale,true)
 await clock.advance(1000);fail=false
 const recovered=await loadDataFile('health-attempt.json',clock.now,true)
 assert.equal(recovered.lastSuccessAt,clock.now);assert.equal(recovered.stale,undefined);assert.equal(recovered.data.generatedAt,generatedAt)
})
test('health refresh: cache direto e rejeição total não renovam a leitura válida',async t=>{
 const clock=browserClock(t),q=await client();let mode='ok',calls=0
 globalThis.fetch=async()=>{calls++;const rows=batch(clock.now);if(mode==='bad')for(const raw of Object.values(rows))Object.assign(raw,{bid:'54',ask:'54.01',high:'55',low:'53'});return json(rows)}
 const r=hookRenderer(()=>q.useQuotes());clock.cleanup(()=>r.close());await r.settle()
 const initial=r.value.lastSuccessAt,stamp=r.value.quotes.USD.timestamp
 assert.equal(initial,clock.now);assert.equal(r.value.checkedAt,clock.now)
 await clock.advance(1000);await r.value.reload();await r.settle()
 assert.equal(calls,1);assert.equal(r.value.checkedAt,initial);assert.equal(r.value.lastSuccessAt,initial)
 mode='bad';await clock.advance(1000);await r.value.refresh();await r.settle()
 assert.equal(r.value.checkedAt,clock.now);assert.equal(r.value.lastSuccessAt,initial);assert.equal(r.value.quotes.USD.timestamp,stamp);assert.equal(r.value.quotes.USD.stale,true)
 mode='ok';await clock.advance(61000);await r.value.refresh();await r.settle()
 assert.equal(r.value.lastSuccessAt,clock.now);assert.equal(r.value.quotes.USD.stale,false)
})
test('health refresh: falha central com cache conserva sucesso; reserva em cache não cria nova consulta',async t=>{
 const clock=browserClock(t),q=await client('https://central.example');let centralOk=true
 globalThis.fetch=async url=>String(url).startsWith('https://central.example')?(centralOk?json({generatedAt:clock.now,quotes:batch(clock.now)}):{ok:false,status:503}):json(batch(clock.now))
 const direct=await q.fetchQuotes(undefined,{direct:true});assert.equal(direct.successfulAt,clock.now)
 await clock.advance(1000);centralOk=false
 const cached=await q.fetchQuotes();assert.equal(cached.checkedAt,clock.now);assert.equal(cached.successfulAt,null);assert.equal(cached.collectedAt,direct.collectedAt)
 const reserve=await client();globalThis.fetch=async url=>String(url).includes('awesomeapi')?{ok:false,status:503}:json({date:new Date(clock.now-86400000).toISOString().slice(0,10),rates:{BRL:{USD:5.4,EUR:6.1,JPY:.035,CNY:.8}[new URL(url).searchParams.get('base')]}})
 const freshReserve=await reserve.fetchQuotes(undefined,{direct:true});assert.equal(freshReserve.successfulAt,clock.now)
 await clock.advance(1000);const oldReserve=await reserve.fetchQuotes();assert.equal(oldReserve.checkedAt,null);assert.equal(oldReserve.successfulAt,null);assert.equal(oldReserve.results.USD.quote.fallback,true)
})
