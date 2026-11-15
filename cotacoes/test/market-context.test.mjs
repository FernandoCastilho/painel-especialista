import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { MARKET_IDS, contextItems, contextValue, contextDate, brentContext } from '../src/marketContext.js'
test('market context preserves missing versus zero and negative employment', () => {
 const base={id:'caged',label:'Caged',unit:'postos',nature:'saldo',sourceUrl:'https://gov.br'}
 assert.equal(contextValue({...base,value:0}),'0'); assert.equal(contextValue({...base,value:null}),'—'); assert.equal(contextValue({...base,value:-100}),'-100')
 assert.throws(()=>contextItems({indicators:[{...base,value:NaN}]},'indicators',['caged']))
 assert.throws(()=>contextItems({indicators:[{...base,value:100}]},'indicators',['other']))
 assert.throws(()=>contextItems({},'indicators',MARKET_IDS))
})
test('market context distinguishes monthly periods and oil contracts', () => {
 assert.equal(contextDate('2026-09'),'09/2026'); assert.equal(contextDate('2026-10-20'),'20/10/2026'); assert.equal(contextDate(null),'não informada')
 assert.equal(brentContext({benchmark:'Brent',kind:'futures',unit:'USD/barril',value:100}),null)
 const item=brentContext({benchmark:'Brent',kind:'spot',unit:'USD/barril',value:null,stale:true}); assert.equal(item.value,null); assert.equal(item.stale,true)
})
test('verified indicators have provenance and no invented release date', async () => {
 const data=JSON.parse(await readFile(new URL('../public/market-indicators.json',import.meta.url))); const items=contextItems(data,'indicators',MARKET_IDS)
 assert.equal(items.length,5);for(const item of items){assert.ok(item.period);assert.ok(item.checkedAt);assert.ok(item.sourceUrl.startsWith('https://'))}
 assert.equal(items[0].releaseDate,null); assert.equal(items.find(i=>i.id==='caged').value,121305)
})

test('partial commodity coverage is signaled even when both files loaded', async () => {
 const source=await readFile(new URL('../src/MarketContext.jsx',import.meta.url),'utf8')
 assert.ok(source.includes('commodities.data.length < COMMODITY_IDS.length'))
})

test('unidade em dólar aparece sempre como US$ e US¢; o resto fica como veio', async () => {
  const { unidadeEmDolar } = await import('../src/marketContext.js')
  const casos = [['USD/barril', 'US$/barril'], ['USD/onça troy', 'US$/onça troy'], ['USD/MMBtu', 'US$/MMBtu'], ['US$/barril', 'US$/barril'], ['US¢/libra-peso', 'US¢/libra-peso'], ['USc/lb', 'US¢/lb'], ['R$/litro', 'R$/litro'], ['índice', 'índice'], ['USDA', 'USDA']]
  for (const [original, esperado] of casos) assert.equal(unidadeEmDolar(original), esperado, original)
  assert.equal(unidadeEmDolar(undefined), undefined)
})
