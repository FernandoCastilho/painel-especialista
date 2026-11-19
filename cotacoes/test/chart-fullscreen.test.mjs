import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { hookRenderer } from './helpers/hooks.mjs'
const require = createRequire(import.meta.url)
test('dialog modal preserva host e restaura por botão, cancel e rota', async t => {
  const source = await readFile(new URL('../src/ChartFullscreen.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader:'jsx', format:'cjs', jsx:'automatic' })
  const host={}, listeners=new Map(), document={createElement:()=>host,body:{style:{overflow:'auto'}}}
  const window={addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k)}
  let shown=false,focus=0,parent
  const origin={appendChild:h=>{assert.equal(h,host);parent='inline'}}
  const modal={appendChild:h=>{assert.equal(h,host);parent='modal'},showModal:()=>{shown=true},close:()=>{shown=false}}
  const trigger={focus:()=>focus++},module={exports:{}}
  runInNewContext(code,{module,exports:module.exports,document,window,queueMicrotask,require:n=>n.endsWith('.css')?{}:['./ExpandIcon.jsx','./CaptureButton.jsx'].includes(n)?{default:()=>null}:n==='react-dom'?{createPortal:(content,target)=>({content,target})}:require(n)})
  const children={content:'mesma instância'}
  const h=hookRenderer(()=>{const tree=module.exports.default({children});const [inline,dialog,portal]=tree.props.children;inline.ref.current=origin;dialog.ref.current=modal;portal.content.props.children[0].props.children.find(n=>n.type==='button').ref.current=trigger;return tree})
  t.after(()=>h.close());await h.settle()
  const portal=()=>h.value.props.children[2]
  const event=()=>({key:'Escape',preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true}})
  const click=async()=>{portal().content.props.children[0].props.children.find(n=>n.type==='button').props.onClick(event());await h.settle()}
  for(const method of ['button','cancel','hashchange']){
    await click();assert.equal(shown,true);assert.equal(parent,'modal');assert.equal(document.body.style.overflow,'hidden');assert.equal(portal().target,host);assert.equal(portal().content.props.children[1].props.children,children)
    // Bubble handler must not prevent the native cancel default or preempt chart Escape.
    const escape=event();portal().content.props.children[1].props.onKeyDown(escape);assert.equal(escape.stopped,true);assert.equal(escape.prevented,undefined)
    assert.equal(listeners.has('keydown'),false)
    if(method==='button')await click();else {if(method==='cancel')h.value.props.children[1].props.onCancel(event());else listeners.get(method)();await h.settle()}
    assert.equal(shown,false);assert.equal(parent,'inline');assert.equal(document.body.style.overflow,'auto')
  }
  assert.equal(focus,3)
  h.close();assert.equal(listeners.size,0)
})
