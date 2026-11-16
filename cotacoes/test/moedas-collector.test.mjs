import test from 'node:test'
import assert from 'node:assert/strict'
import { collectMoedas, collectionBudget } from '../scripts/moedas-collector.mjs'
import { buildMoedas, fillSeriesFromPrevious } from '../scripts/moedas-lib.mjs'
const ids=['604','143','024','236','TR1','TR2','TD1','TD2','TD3']
const body='13/11/2026; 5,123456\n16/11/2026; 5,234567'
function harness(mode) {
 let clock=0, active=0, maxActive=0;const calls=[]
 return {calls,get clock(){return clock},get maxActive(){return maxActive},options:{now:()=>clock,timeoutSignal:ms=>({ms}),sleep:async ms=>{clock+=ms},fetchFn:async(url,{signal})=>{
 active++;maxActive=Math.max(active,maxActive);const id=url.match(/um(.*)\.txt$/)[1];calls.push({id,timeout:signal.ms})
 try {if(mode==='all-timeout'||(mode==='tfc-timeout'&&id.startsWith('C'))){clock+=signal.ms;throw Error('timeout')}
 clock+=Math.min(1,signal.ms);return {ok:mode!=='http-fail',status:503,text:async()=>body}
 }finally{active--}
 }}}
}
test('unavailable TFC cannot starve nine currencies; sequential and globally bounded',async()=>{
 const h=harness('tfc-timeout'),r=await collectMoedas(h.options)
 for(const id of ids)assert.equal(r.results[id],body)
 assert.equal(h.maxActive,1);assert.ok(h.clock<=360000);assert.ok(h.calls.every(c=>c.timeout<=40000));assert.ok(!h.calls.some(c=>c.id==='LD1'))
})
test('all timeouts still attempt every eligible series within total deadline',async()=>{
 const h=harness('all-timeout'),r=await collectMoedas(h.options)
 assert.equal(new Set(h.calls.map(c=>c.id)).size,33);assert.ok(h.clock<=360000);assert.equal(Object.values(r.results).filter(v=>v!==null).length,0)
})
test('HTTP failures preserve maximum three attempts per series and deadline',async()=>{
 const h=harness('http-fail');await collectMoedas(h.options)
 for(const c of h.calls)assert.ok(h.calls.filter(x=>x.id===c.id).length<=3)
 assert.ok(h.clock<=360000);assert.ok(h.calls.length<=99)
})
test('healthy sources retain parser and all official future dates',async()=>{
 const h=harness('ok'),r=await collectMoedas(h.options),out=buildMoedas(r.results,r.errors,100)
 assert.equal(h.calls.length,33);assert.deepEqual(out.series['604'].points,[['2026-11-13',5.123456],['2026-11-16',5.234567]])
})
test('failure preserves previous data, freshness and validated LD1 without fetching it',async()=>{
 const h=harness('all-timeout'),r=await collectMoedas(h.options)
 const previous={generatedAt:50,stale:{'604':25},series:{'604':{points:[['2026-11-13',5]]},C01:{points:[['2026-11-13',12]]},LD1:{points:[['2026-10-01',-0.11]],sourceValidated:true,source:'https://www.bndes.gov.br/Moedas/umLD1.txt'}}}
 const out=fillSeriesFromPrevious(buildMoedas(r.results,r.errors,100),previous)
 assert.deepEqual(out.series,previous.series);assert.equal(out.stale['604'],25);assert.equal(out.stale.C01,50);assert.equal(out.stale.LD1,50)
})
test('configuration cannot expand six-minute cap',()=>{
 for(const v of [undefined,NaN,-1,0,'bad',Infinity])assert.equal(collectionBudget(v),360000)
 assert.equal(collectionBudget(600000),360000);assert.equal(collectionBudget(60000),60000)
})
test('body failures retry safely and HTML never becomes invented points',async()=>{
 const h=harness('ok');let n=0;h.options.fetchFn=async()=>({ok:true,text:async()=>{if(n++===0)throw Error('body interrupted');return '<html>error</html>'}})
 const r=await collectMoedas(h.options);assert.equal(n,34)
 const previous={generatedAt:40,series:{'604':{points:[['2026-11-13',5.1]]}}}
 const out=fillSeriesFromPrevious(buildMoedas(r.results,r.errors,100),previous)
 assert.deepEqual(out.series,previous.series);assert.equal(out.stale['604'],40)
})
test('sources and headers unchanged; tests never access real network',async()=>{
 const h=harness('ok'),original=h.options.fetchFn
 h.options.fetchFn=async(url,options)=>{assert.match(url,/^https:\/\/www\.bndes\.gov\.br\/Moedas\/um(?:C\d\d|604|143|024|236|TR[12]|TD[123])\.txt$/);assert.equal(options.headers.referer,'https://www.bndes.gov.br/');return original(url,options)}
 await collectMoedas(h.options)
})
