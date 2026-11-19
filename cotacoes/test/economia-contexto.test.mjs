import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { renderToStaticMarkup } from 'react-dom/server'
import * as data from '../src/economiaContexto.js'

test('três referências verificadas e únicas, perguntas originais, datas explícitas', () => {
  const items=data.economiaReadings()
  assert.equal(items.length,3)
  assert.deepEqual(items.map(i=>i.id),['juros-credito','custos-competitividade','tributos-caixa'])
  assert.equal(new Set(items.map(i=>i.url)).size,3)
  for(const item of items){assert.equal(new URL(item.url).hostname,'braziljournal.com');assert.match(item.question,/\?$/)}
  assert.equal(items[2].publishedAt,'2026-07-27')
  assert.match(items[2].note,/Não use como cronograma vigente/)
  assert.match(items[0].kind,/opiniões/)
  assert.equal(data.economiaDate('2026-11-19'),'19/11/2026')
})
test('seleção limita três links e rejeita URLs inválidos, duplicados e credenciais', () => {
 const first=data.ECONOMIA_READINGS[0]
 assert.equal(data.economiaReadings([...data.ECONOMIA_READINGS,{...first,id:'extra',url:first.url+'/extra'}]).length,3)
 assert.equal(data.economiaReadings([first,{...first,url:first.url+'/?utm_source=test'}]).length,1)
 for(const url of ['javascript:alert(1)','https://evil.invalid/article','https://u:p@braziljournal.com/article','http://braziljournal.com/article'])
  assert.equal(data.economiaReadings([{...first,url}]).length,0)
})
test('renderização mantém fontes, datas, ressalvas e posição depois de Manchetes',async()=>{
 const source=await readFile(new URL('../src/EconomiaContexto.jsx',import.meta.url),'utf8')
 const code=(await transform(source,{loader:'jsx',format:'cjs',jsx:'automatic'})).code
 const require=createRequire(import.meta.url),module={exports:{}}
 runInNewContext(code,{module,exports:module.exports,require:n=>n==='./economiaContexto.js'?data:n.endsWith('.css')?{}:require(n)})
 const html=renderToStaticMarkup(module.exports.default())
 assert.match(html,/Economia em contexto/)
 assert.equal((html.match(/<li>/g)||[]).length,3)
 assert.equal((html.match(/target="_blank" rel="noopener noreferrer"/g)||[]).length,3)
 assert.match(html,/Não é um feed em tempo real/)
 assert.match(html,/27\/07\/2026/)
 assert.doesNotMatch(html,/<img|<iframe|<audio/)
 const app=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8')
 assert.match(app,/<News colors=\{COLORS\} \/>\s*<EconomiaContexto \/>/)
 assert.equal((app.match(/<EconomiaContexto \/>/g)||[]).length,1)
})
