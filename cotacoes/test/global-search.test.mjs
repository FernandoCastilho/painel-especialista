import test from 'node:test'
import assert from 'node:assert/strict'
import { CONCEITOS } from '../src/educacao.js'
import { normalizeSearch, makeSearchDoc, plainContent, searchDocuments, groupSearchResults, highlightParts, searchSnippet, indexSearchData, isSearchShortcut, SEARCH_SOURCES } from '../src/globalSearch.js'
import { buildSearchIndex, extractSearchText } from '../scripts/build-search-index.mjs'
test('global search finds full concept bodies across unloaded routes, accents and case',()=>{
 const docs=CONCEITOS.map(c=>makeSearchDoc({id:c.id,title:c.nome,body:plainContent(c),route:'aprender/'+c.id,kind:'Conceito'}))
 assert.equal(searchDocuments(docs,'FEE ESTRUTURACAO')[0].route,'aprender/fee-de-estruturacao')
 const results=searchDocuments(docs,'INADIMPLENCIA')
 for(const title of ['FIDC','CRI','Custo de funding'])assert.ok(results.some(d=>d.title.includes(title)),title)
 assert.deepEqual(searchDocuments(docs,'inadimplência').map(d=>d.id),results.map(d=>d.id))
 assert.ok(results.every(d=>d.route.startsWith('aprender/')))
 assert.equal(searchDocuments(docs,'x').length,0)
 assert.equal(searchDocuments(docs,'expressão que não existe zxqww').length,0)
})
test('query terms all match and title matches rank before body matches',()=>{
 const docs=[makeSearchDoc({id:'a',title:'FIDC',body:'risco de inadimplência',route:'aprender/fidc'}),makeSearchDoc({id:'b',title:'Risco de inadimplência',body:'FIDC',route:'resumo'})]
 assert.equal(searchDocuments(docs,'risco inadimplencia')[0].id,'b')
 assert.equal(searchDocuments(docs,'risco inflação').length,0)
})
test('a busca por FINIMP põe a calculadora antes dos conceitos que citam o termo', async () => {
 const index = await buildSearchIndex()
 const concept = CONCEITOS.find(c => c.id === 'gross-up')
 const docs = [
   makeSearchDoc({ id: concept.id, title: concept.nome, body: plainContent(concept), route: 'aprender/gross-up', kind: 'Conceito' }),
   ...index.documents.filter(d => d.route === 'calculadora/finimp').map(makeSearchDoc),
 ]
 const groups = groupSearchResults(searchDocuments(docs, 'FINIMP'))
 assert.deepEqual(groups.map(group => group.section), ['Calculadoras', 'Aprender'])
 assert.equal(groups[0].items[0].route, 'calculadora/finimp')
 assert.match(groups[0].items[0].title, /^FINIMP: comparação de propostas/)
 assert.equal(groups[1].items[0].route, 'aprender/gross-up')
})
test('highlight preserves original Unicode and treats markup as plain text',()=>{
 const text='😀 Crédito: INADIMPLÊNCIA <script>local</script>'
 const parts=highlightParts(text,'credito inadimplencia')
 assert.equal(parts.map(p=>p.text).join(''),text)
 assert.deepEqual(parts.filter(p=>p.match).map(p=>p.text),['Crédito','INADIMPLÊNCIA'])
 assert.ok(searchSnippet('a'.repeat(500)+' inadimplência '+ 'z'.repeat(500),'inadimplencia').includes('inadimplência'))
 assert.equal(normalizeSearch('AÇÃo'),'acao')
})
test('published data maps sectors, focus and headlines; ignores URLs and secrets',()=>{
 const {docs}=indexSearchData('temas.json',{generatedAt:1,temas:{cobre:{items:[{title:'Cobre recua com estoques',t:Date.now(),description:'China',link:'https://external.test/private',shareToken:'sensitive'}]}}},'resumo','Temas')
 const item=docs.find(d=>d.title.startsWith('Cobre'))
 assert.equal(item.route,'setores/cobre');assert.ok(item.body.includes('China'));assert.ok(!item.body.includes('external'));assert.ok(!item.body.includes('sensitive'))
 assert.throws(()=>indexSearchData('x',[], 'resumo','x'))
 assert.equal(SEARCH_SOURCES.length,new Set(SEARCH_SOURCES.map(s=>s[0])).size)
})
test('shortcut excludes browser find, composition, modifiers and repeated input',()=>{
 const key={key:'F',ctrlKey:true,shiftKey:true,altKey:false,metaKey:false,repeat:false,isComposing:false}
 assert.ok(isSearchShortcut(key))
 for(const patch of [{shiftKey:false},{ctrlKey:false},{altKey:true},{metaKey:true},{repeat:true},{isComposing:true},{defaultPrevented:true},{key:'g'}])assert.ok(!isSearchShortcut({...key,...patch}))
})
test('static index extracts visible text and literals, never classes, code, URLs or hidden prototype',async()=>{
 const result=extractSearchText(`import X from './private.js'; const label = 'Indicador de crédito'; export default () => <p className="hidden private" title="Explicação completa">Texto visível<Explain id="credito"/><a href="https://private.test">Saiba mais</a></p>`)
 assert.ok(result.text.includes('Texto visível'));assert.ok(result.text.includes('Indicador de crédito'));assert.ok(!result.text.includes('hidden private'));assert.ok(!result.text.includes('private.test'));assert.deepEqual(result.explain,['credito'])
 const index=await buildSearchIndex();assert.ok(index.documents.length>=30);assert.ok(index.documents.some(d=>d.route==='cenarios/inadimplencia'));assert.ok(!index.documents.some(d=>d.route==='apresentar'))
 assert.match(index.documents.find(d=>d.id==='page:CambioFuturo.jsx').body,/Compra indicativa/)
})

test('credit, BNDES and Focus results retain exact portfolio, series and forecast-year context',()=>{
 const c=indexSearchData('inadimplencia.json',{generatedAt:1,series:[{key:'pf-livres',person:'PF',type:'livres',points:[{period:'2026-09',t:Date.UTC(2026,8,1),v:8.09}]}]},'cenarios/inadimplencia','Crédito').docs[0]
 assert.equal(c.context.creditType,'livres');assert.match(c.body,/8,09%/)
 const b=indexSearchData('moedas.json',{generatedAt:1,series:{C01:{points:[['2026-09-01',12]]}}},'bndes','BNDES').docs[0]
 assert.equal(b.route,'bndes/tfc/C01')
 const f=indexSearchData('focus-history.json',{generatedAt:1,series:{Selic:{2027:[{d:'2026-11-01',v:10}]}}},'cenarios/projecoes','Focus').docs[0]
 assert.equal(f.context.year,'2027');assert.ok(searchDocuments([f],'Selic 2027').length)
})

test('Configurações e metadados ficam fora de todas as camadas da busca',async()=>{
 const index=await buildSearchIndex()
 assert.ok(index.documents.every(d=>!d.route.startsWith('config')))
 assert.ok(Object.values(index.glossaryRoutes).every(r=>!r.startsWith('config')))
 assert.ok(SEARCH_SOURCES.every(([,route])=>!route.startsWith('config')))
 const privateDoc=makeSearchDoc({id:'config-probe',title:'Termo exclusivo privado',body:'metadado secreto de fonte',route:'config/base-dados'})
 assert.deepEqual(searchDocuments([privateDoc],'exclusivo'),[])
 assert.deepEqual(indexSearchData('acessos.json',{title:'Termo exclusivo privado'},'config','Acessos').docs,[])
 assert.equal(plainContent({title:'público',sources:[{title:'metadado secreto de fonte'}],route:'config/base-dados'}),'público')
})
