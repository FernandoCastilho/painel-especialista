import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {isCaptureMascotDecoration, captureBackgroundImage} from '../src/captureImage.js'
test('exceção estrita só para face do mascote em UI marcada',()=>{
 const element=(face,marked)=>({matches:s=>{assert.equal(s,'.mascot-mini-face');return face},closest:s=>{assert.equal(s,'[data-capture-ignore="mascot"]');return marked?{}:null}})
 assert.equal(isCaptureMascotDecoration(element(true,true)),true)
 assert.equal(isCaptureMascotDecoration(element(true,false)),false)
 assert.equal(isCaptureMascotDecoration(element(false,true)),false)
})
test('portal do mascote fica marcado e imagem decorativa removida só do clone',()=>{
 const dock=readFileSync(new URL('../src/MascotDock.jsx',import.meta.url),'utf8')
 const engine=readFileSync(new URL('../src/captureImage.js',import.meta.url),'utf8')
 assert.match(dock,/className="mascot-mini" data-capture-ignore="mascot"/)
 assert.match(dock,/createPortal\(miniEl, slot\)/)
 assert.match(engine,/copy\.style\.backgroundImage = captureBackgroundImage\(node, css\.backgroundImage\)/)
 assert.match(engine,/throw new Error\('Esta área contém fundo com imagem/)
 assert.match(engine,/location\.origin/)
 assert.match(engine,/element\.style\.visibility = 'hidden'/)
})

test('renderizador rejeita outros fundos locais ou externos; não muta elemento original',()=>{
 const node={matches:()=>false,closest:()=>null,style:{backgroundImage:'original'}}
 for(const url of ['url("https://externo.invalid/a.png")','url("/assets/local.png")'])assert.throws(()=>captureBackgroundImage(node,url),/fundo com imagem/)
 assert.equal(captureBackgroundImage(node,'linear-gradient(red,blue)'),'linear-gradient(red,blue)')
 const mascot={matches:()=>true,closest:()=>({}),style:{backgroundImage:'original'}}
 assert.equal(captureBackgroundImage(mascot,'url("/assets/mascot-owl.webp")'),'none')
 assert.equal(mascot.style.backgroundImage,'original');assert.equal(node.style.backgroundImage,'original')
})
