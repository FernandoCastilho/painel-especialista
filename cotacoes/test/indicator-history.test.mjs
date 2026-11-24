import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {normalizeIndicatorHistory,indicatorWindow,filterIndicatorPoints,monthLabel} from '../src/indicatorHistory.js'
const raw=JSON.parse(await readFile(new URL('../public/indicator-history.json',import.meta.url)))
const all=normalizeIndicatorHistory(raw)
test('three official real series preserve units and verified latest values, ISM remains unlicensed',()=>{
 assert.equal(all.length,6)
 for(const [id,count,value] of [['unemployment-br',25,5.2],['payroll-us',32,29000],['caged',14,121305]]) {
  const s=all.find(s=>s.id===id);assert.equal(s.points.length,count);assert.equal(s.points.at(-1).value,value);assert.ok(s.sourceUrl.startsWith('https://'));assert.ok(s.revisionNote)
 }
 assert.equal(all.find(s=>s.id==='unemployment-br').frequency,'rolling-quarter')
 assert.equal(all.find(s=>s.id==='payroll-us').seasonallyAdjusted,true)
 for(const s of all.filter(s=>s.id.startsWith('ism'))){assert.equal(s.points.length,0);assert.equal(s.status,'license-required')}
})
test('monthly ranges are inclusive, support short/long/single/empty and reject invalid order',()=>{
 const p=all.find(s=>s.id==='caged').points
 assert.deepEqual(indicatorWindow(p,6),{start:'2026-04',end:'2026-09'})
 assert.equal(filterIndicatorPoints(p,indicatorWindow(p,6)).points.length,6)
 assert.equal(filterIndicatorPoints(p,indicatorWindow(p,24)).points.length,14)
 assert.equal(filterIndicatorPoints(p,{start:'2026-08',end:'2026-08'}).points.length,1)
 assert.equal(filterIndicatorPoints(p,{start:'2020-01',end:'2020-02'}).points.length,0)
 assert.ok(filterIndicatorPoints(p,{start:'2026-09',end:'2026-08'}).error)
 assert.ok(filterIndicatorPoints(p,{start:'',end:'2026-08'}).error)
 assert.equal(monthLabel('2026-08'),'08/2026')
})
test('invalid/missing/duplicate history is never coerced into zero',()=>{
 const s={id:'caged',unit:'postos',sourceUrl:'https://gov.br',points:[{period:'2026-01',value:-100},{period:'2026-02',value:0}]}
 assert.equal(normalizeIndicatorHistory({series:[s]})[0].points[0].value,-100)
 assert.throws(()=>normalizeIndicatorHistory({series:[{...s,points:[{period:'2026-01',value:null}]}]}))
 assert.throws(()=>normalizeIndicatorHistory({series:[{...s,points:[s.points[0],s.points[0]]}]}))
})

test('ICC Brasil mantém fonte, mês, unidade e variação verificados na mesma série', async () => {
 const { activityNeedsReview, contextItems, contextValue, MARKET_IDS } = await import('../src/marketContext.js')
 const indicators = JSON.parse(await readFile(new URL('../public/market-indicators.json', import.meta.url)))
 const item = contextItems(indicators, 'indicators', MARKET_IDS).find(i => i.id === 'consumer-confidence-br')
 const history = all.find(s => s.id === item.id)
 const [previous, last] = history.points.slice(-2)
 assert.equal(history.seasonallyAdjusted, true)
 assert.equal(item.unit, 'pontos')
 assert.equal(last.value, item.value)
 assert.equal(last.period, item.period)
 assert.equal(last.sourceUrl, item.sourceUrl)
 assert.equal(previous.period, '2026-10')
 assert.equal(contextValue({ ...item, value: last.value - previous.value }), '-1,2')
 assert.equal(activityNeedsReview(item, Date.parse('2026-11-24T11:12:01Z')), false)
 assert.equal(activityNeedsReview(item, Date.parse('2026-12-01T11:12:00Z')), true)
})
