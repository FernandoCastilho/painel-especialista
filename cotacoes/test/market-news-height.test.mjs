import test from 'node:test'
import assert from 'node:assert/strict'
import { marketNewsHeight, observeMarketNewsHeight } from '../src/marketNewsHeight.js'
test('Mercado usa espaço da janela, sem mínimo que ultrapasse janela baixa',()=>{
 assert.equal(marketNewsHeight({width:1440,height:900,top:300}),576)
 assert.equal(marketNewsHeight({width:1440,height:768,top:600}),null)
 assert.equal(marketNewsHeight({width:390,height:844,top:100}),null)
 assert.equal(marketNewsHeight({width:1440,height:900,top:50,bottom:700}),626)
})
test('observa ancestrais, maximização e rolagem interna; limpa listeners',()=>{
 let resize,mutate;const observed=[],listeners=new Map(),removed=[],properties=new Map()
 const dialog={parentElement:null,getBoundingClientRect:()=>({bottom:800})}
 const element={parentElement:dialog,closest:()=>dialog,getBoundingClientRect:()=>({top:100}),style:{setProperty:(k,v)=>properties.set(k,v),removeProperty:k=>properties.delete(k)}}
 const win={innerWidth:1440,innerHeight:900,ResizeObserver:class{constructor(cb){resize=cb}observe(n){observed.push(n)}disconnect(){removed.push('resize')}},MutationObserver:class{constructor(cb){mutate=cb}observe(){}disconnect(){removed.push('mutation')}},requestAnimationFrame:cb=>{cb();return undefined},cancelAnimationFrame(){},addEventListener:(k,fn,capture)=>listeners.set(k,{fn,capture}),removeEventListener:k=>listeners.delete(k)}
 const stop=observeMarketNewsHeight(element,win)
 assert.deepEqual(observed,[element,dialog]);assert.equal(properties.get('--market-news-height'),'676px')
 assert.equal(listeners.get('scroll').capture,true)
 dialog.getBoundingClientRect=()=>({bottom:900});mutate();assert.equal(properties.get('--market-news-height'),'776px')
 element.getBoundingClientRect=()=>({top:800});listeners.get('scroll').fn();assert.equal(properties.has('--market-news-height'),false)
 element.getBoundingClientRect=()=>({top:200});resize();assert.equal(properties.get('--market-news-height'),'676px')
 stop();assert.equal(listeners.size,0);assert.deepEqual(removed,['resize','mutation']);assert.equal(properties.size,0)
})
