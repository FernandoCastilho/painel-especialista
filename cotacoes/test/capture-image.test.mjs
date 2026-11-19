import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { captureSize, copyCapture } from '../src/captureImage.js'
test('PNG tem resolução para notebook sem exceder memória ou reduzir leitura demais',()=>{
 assert.deepEqual(captureSize(960,600),{width:1920,height:1200,scale:2})
 for(const [w,h] of [[0,400],[1000,20000],[12000,10000]]) assert.throws(()=>captureSize(w,h))
})
test('copia PNG só após a resolução e confirma sucesso somente depois da escrita',async()=>{
 const blob=new Blob(['fixture'],{type:'image/png'}),target={}
 let called=false
 class Item { constructor(types){this.types=types} }
 await copyCapture(target,{Item,render:async t=>{assert.equal(t,target);return blob},clipboard:{write:async items=>{
   assert.equal(await items[0].types['image/png'],blob);called=true
 }}})
 assert.equal(called,true)
})
test('recusa e indisponibilidade de clipboard não simulam sucesso nem envio',async()=>{
 await assert.rejects(copyCapture({}, {clipboard:null,Item:null}),/não permite/)
 class Item { constructor(){} }
 await assert.rejects(copyCapture({}, {Item,render:async()=>new Blob(),clipboard:{write:async()=>{throw new Error('negado')}}}),/negado/)
})
test('telas e detalhes têm câmera, sem tocar cálculo ou compartilhar externamente',async()=>{
 const app=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8')
 assert.match(app,/\['resumo', 'juros', 'cenarios'\]\.includes\(tab\).*screen-capture-bar/)
 const expanded=await readFile(new URL('../src/Expandable.jsx',import.meta.url),'utf8')
 assert.match(expanded,/<CaptureButton label=\{`quadro completo:/)
 const explain=await readFile(new URL('../src/Explain.jsx',import.meta.url),'utf8')
 assert.match(explain,/grafico && <CaptureButton/)
 const engine=await readFile(new URL('../src/captureImage.js',import.meta.url),'utf8')
 assert.doesNotMatch(engine,/fetch\(|navigator\.share|\.click\(\)/)
})
test('rolagem usa viewport SVG e deslocamentos serializáveis, não scrollTop no clone',async()=>{
 const src=await readFile(new URL('../src/captureImage.js',import.meta.url),'utf8')
 assert.match(src,/content.setAttribute\('x', String\(-node.scrollLeft\)\)/)
 assert.match(src,/content.setAttribute\('y', String\(-node.scrollTop\)\)/)
 assert.match(src,/viewport.style.overflow = 'hidden'/)
})

test('câmeras cobrem zoom, Panorama, inadimplência e IPCA; Mercado não compartilha ou baixa',async()=>{
 for(const name of ['ChartFullscreen','MarketPopup','Inadimplencia','IpcaGrupoChart']){
  const src=await readFile(new URL('../src/'+name+'.jsx',import.meta.url),'utf8')
  assert.match(src,/<CaptureButton/)
 }
 const market=await readFile(new URL('../src/Resumo.jsx',import.meta.url),'utf8')
 assert.doesNotMatch(market,/shareQuotesImage|img-share/)
 assert.match(market,/<CaptureButton label="Mercado hoje"/)
 assert.match(market,/<Expandable label="Mercado hoje" capture=\{false\}/)
})
test('captura não acessa iframe; mídia externa vira aviso explícito e imagem local precisa estar carregada',async()=>{
 const src=await readFile(new URL('../src/captureImage.js',import.meta.url),'utf8')
 assert.match(src,/Conteúdo externo não incluído na imagem/)
 assert.doesNotMatch(src,/contentDocument|contentWindow|fetch\(/)
 assert.match(src,/location.origin/)
 assert.match(src,/node.complete/)
 assert.match(src,/node.naturalWidth/)
 assert.match(src,/imageCanvas.getContext\('2d'\).drawImage\(node, 0, 0\)/)
})

test('captura incorpora fontes locais e oculta controles sem remover baseline',async()=>{
 const engine=await readFile(new URL('../src/captureImage.js',import.meta.url),'utf8')
 const fonts=await readFile(new URL('../src/captureFonts.js',import.meta.url),'utf8')
 assert.match(engine,/import\('\.\/captureFonts.js'\)/)
 assert.match(engine,/root.append\(fonts, copy\)/)
 assert.match(engine,/element.style.visibility = 'hidden'/)
 assert.match(fonts,/CSSRule.FONT_FACE_RULE/)
 assert.match(fonts,/resolved.origin !== location.origin/)
 assert.match(fonts,/credentials: 'omit'/)
 assert.match(fonts,/reader.readAsDataURL\(blob\)/)
})

test('fontes: incorpora bytes locais sem credenciais e recusa origem externa',async()=>{
 const { captureFontCss } = await import('../src/captureFonts.js')
 const saved = Object.fromEntries(['document','location','CSSRule','fetch','FileReader'].map(k=>[k,globalThis[k]]))
 try {
  const local='https://preview.test/assets/test.woff2'
  let requests=0
  globalThis.location={origin:'https://preview.test'}
  globalThis.CSSRule={FONT_FACE_RULE:5}
  globalThis.document={baseURI:'https://preview.test/',styleSheets:[{href:'https://preview.test/assets/main.css',cssRules:[{type:5,cssText:`@font-face {font-family:Inter;src:url("${local}")}`}]}]}
  globalThis.fetch=async(url,options)=>{requests++;assert.equal(url,local);assert.equal(options.credentials,'omit');return {ok:true,blob:async()=>new Blob(['font'])}}
  globalThis.FileReader=class {readAsDataURL(){this.result='data:font/woff2;base64,Zm9udA==';this.onload()}}
  assert.match(await captureFontCss(),/data:font\/woff2;base64/)
  await captureFontCss();assert.equal(requests,1)
  globalThis.document.styleSheets[0].cssRules[0].cssText='@font-face {src:url("https://third.test/font.woff2")}'
  await assert.rejects(captureFontCss(),/Fonte externa/)
  assert.equal(requests,1)
 } finally {for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}}
})
