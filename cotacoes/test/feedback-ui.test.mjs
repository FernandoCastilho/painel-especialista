import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { hookRenderer, deferred } from './helpers/hooks.mjs'
import * as feedback from '../src/feedback.js'
const require=createRequire(import.meta.url)
const nodes=node=>Array.isArray(node)?node.flatMap(nodes):node&&typeof node==='object'?[node,...nodes(node.props?.children)]:[]
async function setup(t,{enabled=true,send=async()=>true}={}){
  const listeners=new Map();let focus=0, messageFocus=0
  const window={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)}
  const deps={react:React,'react-dom':{createPortal:el=>el},'./feedbackConfig.json':{},'./feedback.js':{...feedback,sendFeedback:send},'./FeedbackMascot.css':{},'./MascotDock.jsx':()=>null,'./assets/mascot-owl.webp':'owl.webp','./assets/mascot-owl-wing.webp':'owl-wing.webp'}
  const {code}=await transform(await readFile(new URL('../src/FeedbackMascot.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsx:'automatic'})
  const module={exports:{}}
  runInNewContext(code,{module,exports:module.exports,window,document:{body:{}},require:name=>deps[name]??require(name),AbortController,setTimeout,clearTimeout,TypeError})
  const renderer=hookRenderer(()=>module.exports.default({configuration:{formId:'testabcd',verified:enabled}}));t.after(()=>renderer.close())
  await renderer.settle()
  const find=fn=>nodes(renderer.value).find(fn)
  const byId=id=>find(n=>n.props?.id===id)
  const trigger=()=>find(n=>n.props?.className==='feedback-trigger')
  trigger().ref.current={focus:()=>focus++}
  byId('feedback-message').ref.current={focus:()=>messageFocus++}
  const dialog={open:false,showModal(){this.open=true},close(){this.open=false}}
  byId('feedback-dialog').ref.current=dialog
  const open=async()=>{trigger().props.onClick();await renderer.settle()}
  const change=async(name,value)=>{find(n=>n.props?.name===name).props.onChange({target:{name,value}});await renderer.settle()}
  const submit=()=>find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
  const close=async()=>{find(n=>n.props?.className==='feedback-close').props.onClick();await renderer.settle()}
  return {renderer,find,byId,open,change,submit,close,dialog,listeners,get focus(){return focus},get messageFocus(){return messageFocus}}
}
test('feedback UI: opens only on click, closes via Escape, restores focus and preserves draft',async t=>{
  const s=await setup(t);assert.equal(s.dialog.open,false);await s.open();assert.equal(s.dialog.open,true);assert.equal(s.messageFocus,1)
  await s.change('message','Rascunho');s.byId('feedback-dialog').props.onCancel({preventDefault(){}});await s.renderer.settle();assert.equal(s.dialog.open,false);assert.equal(s.focus,1)
  await s.open();assert.equal(s.byId('feedback-message').props.value,'Rascunho');await s.close();assert.equal(s.listeners.size,0)
})
test('feedback UI: duplicate clicks blocked, closing does not lose pending result',async t=>{
  const pending=deferred();let calls=0;const s=await setup(t,{send:()=>{calls++;return pending.promise}});await s.open();await s.change('message','Teste');await s.change('email','teste@example.test')
  const first=s.submit();const second=s.submit();await s.renderer.settle();assert.equal(calls,1);assert.equal(s.find(n=>n.type==='fieldset').props.disabled,true)
  await s.close();await s.open();assert.equal(s.byId('feedback-message').props.value,'Teste');pending.resolve(true);await Promise.all([first,second]);await s.renderer.settle()
  assert.equal(s.byId('feedback-message').props.value,'');assert.equal(s.find(n=>n.props?.className==='feedback-status').props.children,'Mensagem recebida pelo serviço. Obrigado pela contribuição!')
})
test('feedback UI: network failure preserves input and never reports success',async t=>{
  const s=await setup(t,{send:async()=>{throw new TypeError('network')}});await s.open();await s.change('message','Guarde o texto');await s.change('email','teste@example.test');await s.submit();await s.renderer.settle()
  assert.equal(s.byId('feedback-message').props.value,'Guarde o texto');assert.match(s.find(n=>n.props?.role==='alert').props.children,/não confirmou/);await s.close();await s.open();assert.equal(s.byId('feedback-message').props.value,'Guarde o texto')
})
test('feedback UI: configured-off cannot submit and navigation dismisses without stale focus',async t=>{
  let calls=0;const s=await setup(t,{enabled:false,send:async()=>{calls++}});await s.open();await s.change('message','Teste');await s.change('email','teste@example.test');await s.submit();assert.equal(calls,0);assert.equal(s.find(n=>n.props?.type==='submit').props.disabled,true)
  s.listeners.get('popstate')();await s.renderer.settle();assert.equal(s.dialog.open,false);assert.equal(s.focus,0)
})
test('feedback UI: empty message is blocked before transport',async t=>{
  let calls=0;const s=await setup(t,{send:async()=>{calls++}});await s.open();await s.submit();await s.renderer.settle();assert.equal(calls,0);assert.match(s.find(n=>n.props?.role==='alert').props.children,/Escreva/)
})

test('Fredix se apresenta em balão sem mudar a ação de sugestões', async t => {
  const s = await setup(t)
  assert.equal(s.find(n => n.props?.className === 'mascot-greeting').props.children, 'Prazer, sou Fredix')
  assert.equal(s.find(n => n.props?.className === 'feedback-trigger').props['aria-label'], 'Abrir caixa de sugestões')
  await s.open(); assert.equal(s.dialog.open, true)
})

test('feedback UI: e-mail obrigatório bloqueia vazio e inválido; corrigir permite envio sem nome', async t => {
  const sent = []
  const s = await setup(t, {send: async (_config, values) => {sent.push({...values}); return true}})
  await s.open(); await s.change('message', 'Sugestão')
  assert.equal(s.byId('feedback-email').props.required, true)
  assert.equal(s.byId('feedback-email').props.type, 'email')
  assert.equal(s.byId('feedback-name').props.required, undefined)
  for (const email of ['', '   ', 'invalido']) {
    await s.change('email', email); await s.submit(); await s.renderer.settle()
    assert.equal(sent.length, 0)
    assert.match(s.find(n => n.props?.role === 'alert').props.children, /e-mail/)
    assert.equal(s.byId('feedback-message').props.value, 'Sugestão')
  }
  await s.close(); await s.open()
  assert.equal(s.byId('feedback-email').props.value, 'invalido')
  await s.change('email', 'pessoa@example.test'); await s.submit(); await s.renderer.settle()
  assert.equal(sent.length, 1); assert.equal(sent[0].email, 'pessoa@example.test'); assert.equal(sent[0].name, '')
  assert.equal(s.byId('feedback-email').props.value, '')
  await s.change('message', 'Outra sugestão'); await s.submit(); await s.renderer.settle()
  assert.equal(sent.length, 1)
})

test('feedback UI: avisos de processamento e rascunho removidos, alerta de confidencialidade preservado', async t => {
  const s = await setup(t)
  await s.open()
  assert.equal(s.find(n => n.props?.className === 'feedback-provider'), undefined)
  assert.equal(s.find(n => n.props?.className === 'feedback-session'), undefined)
  assert.equal(s.byId('feedback-privacy').props.children, 'Envie sugestões, dicas ou problemas identificados. Não inclua dados de clientes, senhas ou informações confidenciais.')
  assert.equal(s.byId('feedback-email').props.required, true)
})
