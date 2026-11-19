import test from 'node:test'
import assert from 'node:assert/strict'
import {captureUsesViewport} from '../src/captureImage.js'
test('contêiner rolável preserva recorte no topo e rolado',()=>{
 const target={scrollTop:0,scrollLeft:0,scrollHeight:1604,clientHeight:950,scrollWidth:390,clientWidth:390}
 for(const overflowY of ['auto','scroll','hidden','clip'])assert.equal(captureUsesViewport(target,{overflowY,overflowX:'visible'}),true)
 assert.equal(captureUsesViewport({...target,scrollTop:40},{overflowY:'auto',overflowX:'visible'}),true)
 assert.equal(captureUsesViewport({...target,scrollHeight:950,scrollWidth:900},{overflowY:'visible',overflowX:'auto'}),true)
})
test('conteúdo sem recorte conserva comportamento anterior',()=>{
 const target={scrollTop:0,scrollLeft:0,scrollHeight:1604,clientHeight:950,scrollWidth:390,clientWidth:390}
 assert.equal(captureUsesViewport(target,{overflowY:'visible',overflowX:'visible'}),false)
 assert.equal(captureUsesViewport({...target,scrollHeight:950},{overflowY:'auto',overflowX:'auto'}),false)
})
