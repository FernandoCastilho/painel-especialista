import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { hookRenderer, deferred } from './helpers/hooks.mjs'
import * as access from '../src/acessoEmail.js'
const require=createRequire(import.meta.url)
const nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[]
async function setup(t,{today=true,required=true}={}){
 const requests=[],visits=[],clears=[];const child=React.createElement('div',null,'PAINEL PRIVADO')
 const deps={react:React,'./AcessoPorEmail.css':{},'./acessoEmail.js':{...access,exigirAcesso:()=>required,lerAcesso:()=>({email:'teste@example.com',token:'fixture'}),validarAcesso:()=>{const d=deferred();requests.push(d);return d.promise},registrarVisita:async a=>{visits.push(a);return {ok:true}},limparAcesso:()=>clears.push(true)}}
 const code=(await transform(await readFile(new URL('../src/AcessoPorEmail.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsx:'automatic'})).code
 const module={exports:{}}
 runInNewContext(code,{module,exports:module.exports,require:n=>deps[n]??require(n),localStorage:{getItem:()=>today?new Date().toISOString().slice(0,10):null,setItem(){}},setTimeout,clearTimeout})
 const render=hookRenderer(()=>module.exports.default({children:child}));t.after(()=>render.close());await render.settle()
 return{render,requests,visits,clears,child}
}
test('sessão salva não exibe conteúdo antes da validação, mesmo com visita de hoje',async t=>{
 const h=await setup(t);assert.notEqual(h.render.value,h.child);assert.equal(h.requests.length,1)
 h.requests[0].resolve({ok:false,revogado:true,erro:'E-mail bloqueado'});await h.render.settle()
 assert.notEqual(h.render.value,h.child);assert.equal(h.clears.length,1);assert.equal(h.visits.length,0)
})
test('rede indisponível mantém conteúdo fechado e permite tentar novamente sem apagar sessão',async t=>{
 const h=await setup(t);h.requests[0].resolve({ok:false,rede:true,erro:'Sem rede'});await h.render.settle()
 assert.notEqual(h.render.value,h.child);assert.equal(h.clears.length,0)
 nodes(h.render.value).find(n=>n.type==='button').props.onClick();await h.render.settle()
 assert.equal(h.requests.length,2);h.requests[1].resolve({ok:true});await h.render.settle()
 assert.equal(h.render.value,h.child);assert.equal(h.visits.length,0,'visita diária preservada')
})
test('validação permitida registra visita diária somente quando ainda não registrada',async t=>{
 const h=await setup(t,{today:false});h.requests[0].resolve({ok:true});await h.render.settle()
 assert.equal(h.render.value,h.child);assert.equal(h.visits.length,1)
})
test('prévia e fluxo sem exigência continuam livres e não consultam servidor',async t=>{
 const h=await setup(t,{required:false});assert.equal(h.render.value,h.child);assert.equal(h.requests.length,0)
})

test('erro interno mantém sessão lembrada, conteúdo fechado e nova tentativa disponível',async t=>{
 const h=await setup(t);h.requests[0].resolve({ok:false,erro:'Erro no servidor. Tente de novo em instantes.'});await h.render.settle()
 assert.notEqual(h.render.value,h.child);assert.equal(h.clears.length,0)
 nodes(h.render.value).find(n=>n.type==='button').props.onClick();await h.render.settle()
 assert.equal(h.requests.length,2);h.requests[1].resolve({ok:true});await h.render.settle()
 assert.equal(h.render.value,h.child)
})
