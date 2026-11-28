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
  runInNewContext(code,{module,exports:module.exports,document,window,queueMicrotask,setTimeout,clearTimeout,require:n=>n.endsWith('.css')?{}:n==='./ExpandIcon.jsx'?{default:()=>null}:n==='./ChartFilters.jsx'?{useFiltros:()=>null}:n==='react-dom'?{createPortal:(content,target)=>({content,target})}:require(n)})
  const children={content:'mesma instância'}
  const h=hookRenderer(()=>{const tree=module.exports.default({children});const [inline,dialog,portal]=tree.props.children;inline.ref.current=origin;dialog.ref.current=modal;portal.content.props.children[0].props.children.ref.current=trigger;return tree})
  t.after(()=>h.close());await h.settle()
  const portal=()=>h.value.props.children[2]
  const event=()=>({key:'Escape',preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true}})
  const click=async()=>{portal().content.props.children[0].props.children.props.onClick(event());await h.settle()}
  for(const method of ['button','cancel','teclado','hashchange']){
    await click();assert.equal(shown,true);assert.equal(parent,'modal');assert.equal(document.body.style.overflow,'hidden');assert.equal(portal().target,host);assert.equal(portal().content.props.children[1].props.children,children)
    // Esc já tratado pelo gráfico (por exemplo, limpar a seleção) não conta para sair.
    const tratado={...event(),defaultPrevented:true};portal().content.props.children[1].props.onKeyDown(tratado);await h.settle();assert.equal(tratado.stopped,true);assert.equal(tratado.prevented,undefined);assert.match(portal().content.props.children[2].props.children,/duas vezes/)
    assert.equal(listeners.has('keydown'),false)
    if(method==='button')await click();else if(method==='cancel'){
      // Esc duas vezes: o primeiro só avisa, o segundo sai
      const primeiro=event();h.value.props.children[1].props.onCancel(primeiro);await h.settle()
      assert.equal(primeiro.prevented,true);assert.equal(shown,true);assert.match(portal().content.props.children[2].props.children,/Esc de novo/)
      h.value.props.children[1].props.onCancel(event());await h.settle()
    } else if(method==='teclado'){
      // Esc pelo teclado: impede o fechamento nativo; o primeiro avisa, o segundo sai
      const primeiro=event();portal().content.props.children[1].props.onKeyDown(primeiro);await h.settle()
      assert.equal(primeiro.prevented,true);assert.equal(primeiro.stopped,true);assert.equal(shown,true);assert.match(portal().content.props.children[2].props.children,/Esc de novo/)
      const segundo=event();portal().content.props.children[1].props.onKeyDown(segundo);await h.settle();assert.equal(segundo.prevented,true)
    } else {listeners.get(method)();await h.settle()}
    assert.equal(shown,false);assert.equal(parent,'inline');assert.equal(document.body.style.overflow,'auto')
  }
  assert.equal(focus,4)
  h.close();assert.equal(listeners.size,0)
})

test('ao maximizar, os filtros do escopo (período e escala) sobem para o topo da tela cheia e voltam ao restaurar', async t => {
  const source = await readFile(new URL('../src/ChartFullscreen.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader:'jsx', format:'cjs', jsx:'automatic' })
  const host={nome:'grafico'}, document={createElement:()=>host,body:{style:{overflow:'auto'}}}
  const window={addEventListener(){},removeEventListener(){}}
  let escutas=0;const ordem=[], filtrosHost={nome:'filtros',addEventListener(){escutas++},removeEventListener(){escutas--}}
  const lugar={isConnected:true,appendChild:h=>ordem.push(['pagina',h.nome])}
  const filtros={host:filtrosHost,inline:lugar}
  const origin={appendChild:h=>ordem.push(['inline',h.nome])}
  const modal={appendChild:h=>ordem.push(['modal',h.nome]),showModal(){},close(){}}
  const module={exports:{}}
  runInNewContext(code,{module,exports:module.exports,document,window,queueMicrotask,setTimeout,clearTimeout,require:n=>n.endsWith('.css')?{}:n==='./ExpandIcon.jsx'?{default:()=>null}:n==='./ChartFilters.jsx'?{useFiltros:()=>filtros}:n==='react-dom'?{createPortal:(content,target)=>({content,target})}:require(n)})
  const h=hookRenderer(()=>{const tree=module.exports.default({children:'g'});const [inline,dialog,portal]=tree.props.children;inline.ref.current=origin;dialog.ref.current=modal;portal.content.props.children[0].props.children.ref.current={focus(){}};return tree})
  t.after(()=>h.close());await h.settle()
  const click=async()=>{h.value.props.children[2].content.props.children[0].props.children.props.onClick({stopPropagation(){}});await h.settle()}
  ordem.length=0
  await click()
  assert.deepEqual(ordem,[['modal','filtros'],['modal','grafico']]);assert.equal(escutas,1,'Esc nos filtros também conta para sair')
  ordem.length=0
  await click()
  assert.deepEqual(ordem.slice(0,2),[['inline','grafico'],['pagina','filtros']]);assert.equal(escutas,0)
})
