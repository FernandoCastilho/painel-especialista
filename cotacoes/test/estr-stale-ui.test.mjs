import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as estrModel from '../src/estr.js'
import * as trendModel from '../src/rateTrend.js'
const require=createRequire(import.meta.url)
const stub=()=>null
async function load(file,deps={}) {
 const {code}=await transform(await readFile(new URL('../src/'+file,import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsx:'automatic'})
 const module={exports:{}}
 runInNewContext(code,{module,exports:module.exports,require:n=>deps[n] ?? (n==='react' || n==='react/jsx-runtime' ? require(n) : stub),Date})
 return module.exports
}
const points=[{date:'2026-11-12',value:2.4},{date:'2026-11-13',value:2.5}]
const data=stale=>({series:{id:'estr',checkedAt:'2026-11-14T12:00:00Z',points,stale}})
const range={start:new Date('2026-11-01'),end:new Date('2026-11-14')}
for(const [name,state,seriesStale,warn] of [['fresh',{status:'ok'},false,false],['fetch stale',{status:'ok',stale:true},false,true],['source stale',{status:'ok'},true,true],['fetch error',{status:'error'},false,true]]) {
 test(`€STR ${name}: card and trend keep stale status`,async()=>{
  const f={...state,data:data(seriesStale)}
  const series=estrModel.normalizeEstr(f.data)
  const modal=await load('RateModal.jsx',{'./useDataFile.js':{useDataFile:()=>f},'./estr.js':estrModel,'./Macro.jsx':{EstrChart:stub},'./Curves.jsx':{CURVAS:{}}})
  const el=modal.Estr({range})
  assert.equal(el.props.stale,!!(state.stale || state.status==='error'))
  const macro=await load('Macro.jsx',{'./HistoryChart.jsx':{useWidth:()=>[null,640],Plot:stub},'./estr.js':estrModel,'./paises.js':{bandeiraDe:()=>''},'./Avisos.jsx':{Aviso:stub}})
  const html=renderToStaticMarkup(React.createElement(macro.EstrChart,{...el.props,series}))
  assert.equal(html.includes('Atualização do €STR pendente'),warn)
  const trend=await load('RateTrend.jsx',{'./useDataFile.js':{useDataFile:()=>f},'./estr.js':estrModel,'./rateTrend.js':trendModel})
  const out=renderToStaticMarkup(React.createElement(trend.default,{kind:'estr',macro:{},range}))
  assert.equal(out.includes('Leitura limitada às observações disponíveis'),warn)
  assert.match(out,/2,50%/)
 })
}
