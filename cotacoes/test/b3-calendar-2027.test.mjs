import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { B3_CALENDAR_2027_SOURCE, B3_LISTED_2027_CLOSED } from '../src/b3Calendar2027.mjs'
import { calendarYearCovered, holidayMap, isBusinessDay } from '../src/holidays.js'
import { b3CalendarStatus,b3ClosedDay,b3CollectionDecision,fxSessionOpen } from '../scripts/data-schedules.mjs'
const hora=(date,time='12:30')=>Date.parse(date+'T'+time+':00Z')

test('Ofício 057/2026-VNC quadro A: 12 dias sem pregão, fonte e catálogo coerentes',()=>{
 const esperado=['01-01','02-08','02-09','03-26','04-21','05-27','09-07','10-12','11-02','11-15','12-24','12-31']
 assert.deepEqual(Object.keys(B3_LISTED_2027_CLOSED),esperado)
 assert.deepEqual([...holidayMap('B3',2027).keys()],esperado.map(d=>'2027-'+d))
 assert.equal(b3CalendarStatus(2027).source,B3_CALENDAR_2027_SOURCE)
 for(const d of esperado.map(d=>'2027-'+d)){
  assert.equal(b3ClosedDay(hora(d)),true,d)
  assert.equal(b3CollectionDecision(hora(d)).run,false,d)
  assert.equal(fxSessionOpen(hora(d)),false,d+' não abre a janela intensiva')
 }
})
test('2027: virada e exceções paulistas abertas; 2028 não é inferido, e fins de semana são fechados',()=>{
 for(const d of ['2027-01-04','2027-01-25','2027-07-09']){
  assert.equal(b3ClosedDay(hora(d)),false,d)
  assert.equal(b3CollectionDecision(hora(d)).run,true,d)
  assert.equal(fxSessionOpen(hora(d)),true,d)
 }
 assert.equal(b3ClosedDay(hora('2027-11-20')),true)
 assert.equal(calendarYearCovered('B3',2028),false)
 assert.equal(b3ClosedDay(hora('2028-01-04')),null)
 assert.equal(b3CollectionDecision(hora('2028-01-04')).run,false)
 assert.equal(fxSessionOpen(hora('2028-01-04')),true)
})
test('Cinzas: limita PRE/DOL até 13h, não o spot; deduplicação segue por hora',()=>{
 const d='2027-02-10'
 assert.equal(b3ClosedDay(hora(d)),false)
 assert.equal(isBusinessDay(d,'B3'),true)
 assert.match(b3CollectionDecision(hora(d,'15:59')).reason,/13h/)
 assert.equal(b3CollectionDecision(hora(d,'16:00')).run,true)
 assert.equal(b3CollectionDecision(hora(d,'16:17'),hora(d,'16:00')).run,false)
 assert.equal(fxSessionOpen(hora(d,'12:05')),true)
 const curves=readFileSync(new URL('../scripts/fetch-curves.mjs',import.meta.url),'utf8')
 assert.match(curves,/if\(decision\.run\) \{ out\.br=await b3Curve\('PRE'[\s\S]*out\.cc=await b3Curve\('DOL'/)
 assert.match(curves,/else \{out\.br=previous\?\.br[\s\S]*\n\n\/\/ EUA: Treasury[\s\S]*const csv = await get/)
})
test('24/31: sem listados mas Balcão distingue 13h/13h30; calendário civil e contratual inalterados',()=>{
 const view=readFileSync(new URL('../src/Feriados.jsx',import.meta.url),'utf8')
 assert.match(view,/24 e 31\/12[\s\S]*sem pregão listado[\s\S]*Balcão B3 sem contraparte central encerra às 13h[\s\S]*até 13h30/)
 assert.match(view,/Não é fechamento integral nem horário do câmbio à vista/)
 for(const d of ['2027-12-24','2027-12-31']){
  assert.equal(isBusinessDay(d,'CIVBR'),true,d)
  assert.equal(isBusinessDay(d,'BR'),true,d)
  assert.equal(isBusinessDay(d,'B3'),false,d)
 }
 const yml=readFileSync(new URL('../../.github/workflows/quotes.yml',import.meta.url),'utf8')
 assert.match(yml,/\n {10}collect_and_publish[\s\S]*while[^\n]*in_session/)
})
