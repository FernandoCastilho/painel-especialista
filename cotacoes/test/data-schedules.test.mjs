import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {b3CollectionDecision,saoPauloParts,FOCUS_CRON} from '../scripts/data-schedules.mjs'
import {collectFocus,preserveFocus} from '../scripts/focus-collector.mjs'
test('B3 closes listed derivatives on official holidays, not Sao Paulo or US-only holidays',()=>{
 for(const d of ['2026-02-16','2026-02-17','2026-11-02','2026-11-20','2026-12-24','2026-12-31'])assert.equal(b3CollectionDecision(d+'T15:00:00Z').run,false)
 for(const d of ['2026-07-09','2026-07-03','2026-11-26','2026-02-18'])assert.equal(b3CollectionDecision(d+'T15:00:00Z').run,true)
 assert.equal(b3CollectionDecision('2026-10-25T15:00:00Z').run,false)
 assert.equal(b3CollectionDecision('2027-01-04T15:00:00Z').run,false)
})
test('B3 respects Brazil civil date and deduplicates only completed same-hour checks',()=>{
 assert.equal(saoPauloParts('2026-10-27T01:30:00Z').date,'2026-10-26')
 assert.equal(b3CollectionDecision('2026-10-26T15:50:00Z','2026-10-26T15:17:00Z').run,false)
 assert.equal(b3CollectionDecision('2026-10-26T16:17:00Z','2026-10-26T15:17:00Z').run,true)
 assert.equal(b3CollectionDecision('2026-10-26T16:17:00Z').run,true)
})
test('weekly Focus cron at 08:30 Brazil on Monday and Tuesday (Monday holiday); hourly crons and coin workflow not duplicated',async()=>{
 assert.equal(FOCUS_CRON,'30 11 * * 1,2');const p=saoPauloParts('2026-11-02T11:30:00Z');assert.equal(p.weekday,'Mon');assert.equal(p.hour,'08');assert.equal(p.minute,'30');assert.equal(saoPauloParts('2026-11-03T11:30:00Z').weekday,'Tue')
 const y=await readFile(new URL('../../.github/workflows/pages.yml',import.meta.url),'utf8')
 const crons=[...y.matchAll(/- cron: '([^']+)'/g)].map(m=>m[1]);assert.deepEqual(crons,['0 11,18 * * *','17 3-23 * * 1-5','17 0-2 * * 2-6','30 11 * * 1,2']);assert.equal(new Set(crons).size,4)
 assert.match(y,/if: github.event.schedule == '30 11 \* \* 1,2'/)
 const deploy=y.split('\n  deploy:\n')[1];assert.ok(deploy)
 const regular=deploy.split('\n').filter(l=>l.includes("github.event.schedule != '30 11 * * 1,2'"));assert.equal(regular.length,34);assert.ok(regular.every(l=>l.includes("github.event.schedule != '0 11,18 * * *'")))
 assert.match(deploy,/Consumir snapshot institucional confirmado[^\n]*\n\s+if: github.event.schedule != '0 11,18 \* \* \*' && \(github.event.schedule != '30 11 \* \* 1,2'\)\n\s+run: node scripts\/sector-news-live\.mjs --snapshot/)
 const institutional=y.split('\n  institutional-news:\n')[1].split('\n  deploy:')[0]
 assert.match(institutional,/needs\.approve-source\.result == 'success'/)
 for(const cron of ['0 11,18 * * *','30 11 * * 1,2'])assert.ok(institutional.includes(`github.event.schedule != '${cron}'`))
})
test('Focus failure/skip preserves actual publication date, values and quote timestamps',()=>{
 const prev={generatedAt:1,focusCheckedAt:2,focus:{date:'2026-10-23',rows:[{values:{2026:10}}]},stale:{focus:1}}
 const skipped=preserveFocus({generatedAt:3},prev,{skipped:true,checkedAt:3});assert.deepEqual(skipped.focus,prev.focus);assert.equal(skipped.focusCheckedAt,2);assert.equal(skipped.stale.focus,1)
 const failed=preserveFocus({},prev,{checkedAt:4,error:'HTTP503'});assert.deepEqual(failed.focus,prev.focus);assert.equal(failed.focusSchedule.error,'HTTP503');assert.equal(failed.focus.date,'2026-10-23')
})
test('Focus rejects missing rows and non-OK responses rather than replacing verified snapshot',async()=>{
 await assert.rejects(collectFocus({fetchImpl:async()=>({ok:false,status:503})}),/HTTP 503/)
 await assert.rejects(collectFocus({fetchImpl:async()=>({ok:true,json:async()=>({value:[]})})}),/incompleto/)
})
test('Focus complete response is deterministic and uses source dates, not an invented publication date',async()=>{
 const row={Data:'2026-10-23',DataReferencia:'2026',Mediana:10,Minimo:9,Maximo:11,numeroRespondentes:50}
 const fetchImpl=async()=>({ok:true,json:async()=>({value:[row]})})
 const a=await collectFocus({fetchImpl,now:Date.parse('2026-10-26T12:30:00Z')}),b=await collectFocus({fetchImpl,now:Date.parse('2026-10-26T12:31:00Z')})
 assert.deepEqual(a,b);assert.equal(a.rows.length,4);assert.equal(a.date,'2026-10-23');assert.equal(a.release,undefined)
 let count=0
 await assert.rejects(collectFocus({now:Date.parse('2026-10-26T12:30:00Z'),fetchImpl:async()=>({ok:true,json:async()=>({value:[{...row,Data:++count===2?'2026-10-22':row.Data}]})})}),/divergentes/)
 await assert.rejects(collectFocus({now:Date.parse('2026-10-26T12:30:00Z'),fetchImpl:async()=>({ok:true,json:async()=>({value:[{...row,Mediana:NaN}]})})}),/incompleto/)
})
test('hourly triggers cover exactly each Brazil weekday hour once and weekly cannot cancel active deployment',async()=>{
 const y=await readFile(new URL('../../.github/workflows/pages.yml',import.meta.url),'utf8');assert.match(y,/cancel-in-progress: false/)
 const hours=[]
 for(let day=25;day<=31;day++)for(let hour=0;hour<24;hour++){
  const utc=new Date(Date.UTC(2026,9,day,hour,17)),weekday=utc.getUTCDay()
  if((hour>=3&&weekday>=1&&weekday<=5)||(hour<=2&&weekday>=2&&weekday<=6)){const p=saoPauloParts(utc);assert.ok(!['Sat','Sun'].includes(p.weekday));hours.push(p.date+'T'+p.hour)}
 }
 assert.equal(hours.length,120);assert.equal(new Set(hours).size,120)
})
test('Focus watch: tries 2 to 10 every 30 min (09:00–13:00 Brasília) on Monday/Tuesday until the week bulletin is published',async()=>{
 const {expectedFocusDate,focusWatchDecision,FOCUS_TENTATIVAS}=await import('../scripts/focus-collector.mjs')
 assert.equal(FOCUS_TENTATIVAS,10)
 assert.equal(expectedFocusDate('2026-11-03T11:47:00Z'),'2026-10-30')
 assert.equal(expectedFocusDate('2026-11-08T12:00:00Z'),'2026-10-30') // domingo ainda é a mesma semana
 const at=(iso,pub)=>focusWatchDecision(pub,Date.parse(iso))
 assert.deepEqual([at('2026-11-09T12:00:00Z','2026-10-30').run,at('2026-11-09T12:00:00Z','2026-10-30').attempt],[true,2]) // segunda 09:00, boletim de 06/11 ausente
 assert.equal(at('2026-11-09T16:00:00Z','2026-10-30').attempt,10) // 13:00
 assert.equal(at('2026-11-09T16:00:00Z','2026-10-30').run,true)
 assert.equal(at('2026-11-09T16:30:00Z','2026-10-30').run,false) // 13:30: passou da 10ª tentativa
 assert.equal(at('2026-11-09T12:10:00Z','2026-10-30').attempt,2) // cron atrasado 10 min continua na mesma tentativa
 assert.equal(at('2026-11-09T12:00:00Z','2026-11-06').run,false) // já publicado
 assert.equal(at('2026-11-03T12:30:00Z','2026-10-23').run,true) // terça após segunda feriado
 assert.equal(at('2026-11-11T12:00:00Z','2026-10-30').run,false) // quarta: fora
})
