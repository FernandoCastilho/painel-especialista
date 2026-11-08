import test from 'node:test'
import assert from 'node:assert/strict'
import { marketSlot, seenMarketSlot, rememberMarketSlot, marketFx, hourMarketChange, marketDi, marketBrent, marketSummary, marketTone, validMarketPoints } from '../src/marketPopup.js'
const time=s=>Date.parse(s)
test('agenda em São Paulo: 9h a 18h e nenhuma edição fora da janela',()=>{
 assert.equal(marketSlot(time('2026-11-06T11:59:59Z')),null)
 for(let h=9;h<=18;h++)assert.equal(marketSlot(time('2026-11-06T'+String(h+3).padStart(2,'0')+':00:00Z')).hour,h)
 assert.equal(marketSlot(time('2026-11-06T20:59:59Z')).hour,17)
 assert.equal(marketSlot(time('2026-11-06T21:00:59Z')).hour,18)
 assert.equal(marketSlot(time('2026-11-06T21:01:00Z')),null)
 assert.equal(marketSlot(NaN),null)
})
test('sábado, domingo e virada UTC não usam o dia do navegador',()=>{
 for(const d of ['2026-11-07','2026-11-08'])assert.equal(marketSlot(time(d+'T15:00:00Z')),null)
 assert.equal(marketSlot(time('2026-11-07T00:00:00Z')),null)
 assert.equal(marketSlot(time('2026-11-06T13:35:00Z')).key,'2026-11-06T10')
})
test('feriados nacionais, inclusive Consciência Negra, bloqueiam a edição',()=>{
 for(const d of ['2026-01-01','2026-04-21','2026-05-01','2026-09-07','2026-10-12','2026-11-02','2026-11-20','2026-12-25','2027-01-01'])assert.equal(marketSlot(time(d+'T15:00:00Z')),null,d)
})
test('recorte nacional não transforma feriado municipal ou ponto facultativo em nacional',()=>{
 for(const d of ['2026-07-09','2026-02-17','2026-06-04'])assert.ok(marketSlot(time(d+'T15:00:00Z')),d)
})
test('deduplicação por hora sobrevive ao recarregamento e ao armazenamento bloqueado',()=>{
 const slot=marketSlot(time('2026-11-06T15:00:00Z')), memory=new Set(), map=new Map()
 const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)}
 assert.equal(seenMarketSlot(slot,storage,memory),false)
 rememberMarketSlot(slot,storage,memory)
 assert.equal(seenMarketSlot(slot,storage,new Set()),true)
 assert.equal(seenMarketSlot(marketSlot(time('2026-11-06T16:00:00Z')),storage,memory),false)
 const blocked={getItem(){throw Error()},setItem(){throw Error()}}
 rememberMarketSlot(slot,blocked,memory)
 assert.equal(seenMarketSlot(slot,blocked,memory),true)
 assert.equal(seenMarketSlot(null,storage,memory),true)
})
const now=time('2026-11-06T15:00:00Z')
const q={bid:5.1,pct:1,timestamp:now,source:'USD'}
const pts=[{t:now-3600000,bid:5},{t:now,bid:5.1}]
test('última hora calcula só amostras próximas, frescas e do mesmo dia',()=>{
 assert.ok(Math.abs(hourMarketChange(q,pts,now)-2)<1e-9)
 assert.equal(hourMarketChange(q,[{t:now-4000000,bid:5}],now),null)
 assert.equal(hourMarketChange({...q,stale:true},pts,now),null)
 assert.equal(hourMarketChange({...q,fallback:true},pts,now),null)
 assert.equal(hourMarketChange(q,pts,now+11*60000),null)
 assert.equal(hourMarketChange(q,[],now),null)
 const midnight=time('2026-11-06T03:30:00Z')
 assert.equal(hourMarketChange({...q,timestamp:midnight},[{t:midnight-3600000,bid:5}],midnight),null)
})
test('câmbio identifica antigo, retido, diário, inválido e não inventa a variação',()=>{
 assert.match(marketFx('USD',q,pts,now).note,/cotação indicativa/)
 assert.match(marketFx('USD',q,pts,now+11*60000).note,/Dado antigo/)
 assert.match(marketFx('USD',{...q,stale:true},pts,now).note,/Pendente/)
 assert.equal(marketFx('EUR',{...q,fallback:true},pts,now).change,null)
 assert.match(marketFx('CNH',{...q,source:'CNY',fallback:true},pts,now).detail,/CNY/)
 assert.equal(marketFx('USD',{...q,timestamp:now+600000},pts,now).value,'—')
 assert.equal(marketFx('USD',null,pts,now).value,'—')
 assert.equal(marketFx('USD',{...q,bid:NaN},pts,now).value,'—')
})
test('pontos inválidos e futuros são descartados e os reais são ordenados',()=>{
 assert.deepEqual(validMarketPoints([pts[1],{t:now+1,bid:9},{t:now,bid:NaN},pts[0]],now),pts)
})
const curves={br:{compare:[{id:'hoje',date:'2026-11-06'},{id:'d1',date:'2026-11-05'}],curves:{'2026-11-06':[[504,12.35],[1260,12.85]],'2026-11-05':[[503,12.28],[1259,12.75]]}}}
test('DI usa dois prazos da curva diária e mudanças em pontos percentuais',()=>{
 const di=marketDi(curves,now)
 assert.equal(di.rows[0].value,'12,35%')
 assert.ok(Math.abs(di.rows[0].change-.07)<1e-9)
 assert.equal(di.date,'2026-11-06')
 assert.equal(di.points.length,2)
 assert.equal(marketDi(null,now).rows[0].value,'—')
 assert.equal(marketDi(curves,time('2026-11-05T15:00:00Z')).rows[0].value,'—')
})
test('DI não substitui silenciosamente vértices distantes nem compara prazos incompatíveis',()=>{
 const far={br:{...curves.br,curves:{'2026-11-06':[[252,12]],'2026-11-05':[[504,12.2]]}}}
 assert.equal(marketDi(far,now).rows[0].value,'—')
 const incompatible={br:{...curves.br,curves:{...curves.br.curves,'2026-11-05':[[400,12.2]]}}}
 assert.equal(marketDi(incompatible,now).rows[0].change,null)
})
const oil={benchmark:'Brent',kind:'spot',unit:'USD/barril',points:[{date:'2026-11-04',value:80},{date:'2026-11-05',value:78},{date:'2026-11-09',value:200}]}
test('Brent diário usa as observações reais e não um campo de topo ou ponto futuro',()=>{
 const brent=marketBrent({...oil,value:999},now)
 assert.equal(brent.value,'US$ 78,00')
 assert.equal(brent.stamp,'2026-11-05')
 assert.equal(brent.points.length,2)
 assert.ok(Math.abs(brent.change+2.5)<1e-9)
 assert.equal(marketBrent(null,now).value,'—')
 assert.equal(marketBrent({...oil,kind:'futures'},now).value,'—')
})
test('síntese é descritiva, não inventa causa nem última hora quando indisponível',()=>{
 const summary=marketSummary([marketFx('USD',q,pts,now)],marketBrent(oil,now))
 assert.match(summary,/Dólar: \+1,00%/)
 assert.match(summary,/observações diárias/)
 assert.doesNotMatch(summary,/atividade global|última hora/)
 assert.equal(marketTone(.001),'flat')
 assert.equal(marketTone(null),'flat')
})

test('síntese omite câmbio retido, antigo, diário ou de sexta-feira na segunda',()=>{
 const monday=time('2026-11-09T12:00:00Z')
 const friday=time('2026-11-06T20:00:00Z')
 for(const quote of [
  {...q,timestamp:friday,stale:true},
  {...q,timestamp:friday},
  {...q,timestamp:monday-11*60000},
  {...q,timestamp:monday,stale:true},
  {...q,timestamp:monday,fallback:true}
 ]){
  const fx=marketFx('USD',quote,[],monday)
  assert.equal(fx.summaryEligible,false)
  assert.doesNotMatch(marketSummary([fx],marketBrent(null,monday)),/Dólar:|frente ao real no dia/)
 }
 const fresh=marketFx('USD',{...q,timestamp:monday},[],monday)
 assert.equal(fresh.summaryEligible,true)
 assert.match(marketSummary([fresh],marketBrent(null,monday)),/Dólar: \+1,00% frente ao real no dia/)
 assert.match(marketSummary([],marketBrent(oil,monday)),/2026-11-09/)
})
