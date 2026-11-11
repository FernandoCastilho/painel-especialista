import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { feedbackEndpoint, validateFeedback, sendFeedback, EMPTY_FEEDBACK } from '../src/feedback.js'
const config = { formId: 'testabcd', verified: true }
const values = { ...EMPTY_FEEDBACK, message: ' Uma sugestão de teste. ' }

test('feedback: configuration is off until a valid form is verified', async () => {
  for (const c of [null, {}, { formId: 'testabcd' }, { ...config, verified: false }, { ...config, formId: 'https://evil.test' }, { ...config, formId: 'test/abc' }]) assert.equal(feedbackEndpoint(c), null)
  assert.equal(feedbackEndpoint(config), 'https://formspree.io/f/testabcd')
  const production = JSON.parse(await readFile(new URL('../src/feedbackConfig.json', import.meta.url), 'utf8'))
  assert.equal(production.verified, true)
  assert.equal(feedbackEndpoint(production), 'https://formspree.io/f/xaeegypp')
  assert.equal(production.verifiedAt, '2026-11-08T23:38:29Z')
  const evidence = await readFile(new URL('../../docs/feedback-form.md', import.meta.url), 'utf8')
  assert.match(evidence, /2026-11-08T23:38:29Z/)
  assert.match(evidence, /recebimento confirmado/)
})
test('feedback: message required, optional contact, lengths and supported categories', () => {
  assert.equal(validateFeedback(values), '')
  for (const change of [{message:'  '},{message:'x'.repeat(4001)},{type:'Outra'},{name:'x'.repeat(101)},{email:'nao-e-email'},{email:'a'.repeat(250)+'@b.com'}]) assert.ok(validateFeedback({...values,...change}))
  assert.equal(validateFeedback({...values,message:'x'.repeat(4000),name:'x'.repeat(100),email:'anon@example.test'}),'')
})
test('feedback: only user-entered fields are transmitted, never URL, cookies or history', async () => {
  let request
  const sent = {...values, name:' Ana ', email:'ana@example.test'}
  assert.equal(await sendFeedback(config,sent,{fetcher:async (url,options)=>{request={url,...options}; return {ok:true,json:async()=>({ok:true})}}}),true)
  assert.equal(request.url,feedbackEndpoint(config));assert.equal(request.credentials,'omit');assert.equal(request.referrerPolicy,'no-referrer');assert.equal(request.redirect,'error')
  assert.deepEqual(JSON.parse(request.body),{assunto:'[Painel do Especialista] Sugestão',tipo:'Sugestão',message:'Uma sugestão de teste.',name:'Ana',email:'ana@example.test',_gotcha:''})
  assert.equal(sent.message,values.message)
})
test('feedback: no success from an HTTP-only acceptance, error, quota or invalid JSON', async () => {
  for(const response of [{ok:true,json:async()=>({})},{ok:false,json:async()=>({ok:true})},{ok:false,status:429,json:async()=>({})},{ok:true,json:async()=>{throw Error('bad')}}]) await assert.rejects(sendFeedback(config,values,{fetcher:async()=>response}))
})
test('feedback: disabled form, invalid input and honeypot never call the service', async () => {
  let calls=0;const fetcher=async()=>{calls++;throw Error('network')}
  await assert.rejects(sendFeedback({},values,{fetcher}))
  await assert.rejects(sendFeedback(config,{...values,message:''},{fetcher}))
  await assert.rejects(sendFeedback(config,{...values,website:'spam'},{fetcher}))
  assert.equal(calls,0)
})
test('feedback: optional fields omitted and abort is forwarded', async () => {
  const signal=new AbortController().signal
  await sendFeedback(config,values,{signal,fetcher:async (_url,options)=>{assert.equal(options.signal,signal);assert.equal('email' in JSON.parse(options.body),false);assert.equal('name' in JSON.parse(options.body),false);return {ok:true,json:async()=>({ok:true})}}})
})

test('feedback: mobile mascot floats above content and does not reserve page space', async () => {
  const css = await readFile(new URL('../src/FeedbackMascot.css', import.meta.url), 'utf8')
  assert.doesNotMatch(css, /@media\(max-width:999px\)\{\.mascot-tray\{height:250px/)
  assert.match(css, /\.mascot-dock\{[^}]*position:fixed/)
  assert.match(css, /env\(safe-area-inset-right\)/)
})
