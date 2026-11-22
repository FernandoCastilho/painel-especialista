import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { hookRenderer } from './helpers/hooks.mjs'
import { classicKeyRows, getClassicKeyState, portraitKeyRows } from '../src/rpnClassicLayout.mjs'
import { rpnKeyFromEvent } from '../src/rpnKeyboard.mjs'
import { captureReportedRpnResult, createRpnHistoryCapture, replayRpnEntry } from '../src/rpnHistory.mjs'
import { CLASSIC_KEYS, createClassicRpnController } from '../src/rpnClassicController.mjs'
import { convertEquivalentRate } from '../src/rpnRateConversion.mjs'

const require = createRequire(import.meta.url)
const source = await readFile(new URL('../src/RpnCalculator.jsx', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []

function resources(create) {
  const module = { exports: {} }
  let sequence = 0
  const deps = { react: { ...React, useId: () => 'rpn-test-' + ++sequence },
    './RpnCalculator.css': {}, './RpnCetPanel.jsx': { __esModule: true, default: function CetPanel() {} }, './rpnClassicController.mjs': { createClassicRpnController: create },
    './rpnClassicLayout.mjs': { classicKeyRows, portraitKeyRows, getClassicKeyState },
    './rpnRateConversion.mjs': { convertEquivalentRate }, './rpnKeyboard.mjs': { rpnKeyFromEvent },
    './rpnHistory.mjs': { captureReportedRpnResult, createRpnHistoryCapture }, './RpnHistoryPanel.jsx': { __esModule: true, default: function HistoryPanel() {} } }
  runInNewContext(code + '\nmodule.testComponents = { RatePanel, KeyGrid, LcdValue }', {
    module, exports: module.exports, require: path => deps[path] ?? require(path),
  })
  return { Calculator: module.exports.default, ...module.testComponents }
}
function setup(t, create, autoClose = true) {
  const { Calculator, KeyGrid, LcdValue, RatePanel } = resources(create)
  const render = hookRenderer(() => Calculator())
  if (autoClose) t.after(() => render.close())
  const all = () => nodes(render.value)
  return { render, panel: () => render.value, find: pred => all().find(pred),
    keys: () => nodes(KeyGrid(all().find(el => el.type === KeyGrid).props)).filter(el => el.type === 'button'),
    display: () => nodes(LcdValue(all().find(el => el.type === LcdValue).props)).filter(el => el.type === 'span').find(el => el.props.className === 'rpn-sr-only')?.props.children
      ?? LcdValue(all().find(el => el.type === LcdValue).props).props.children,
    rates: () => all().find(el => el.type === RatePanel).props }
}
const event = (key, extra = {}) => ({ key, prevented: false, preventDefault() { this.prevented = true }, ...extra })

test('grade física clássica tem 39 teclas nas posições exatas e Enter único em cada modo', () => {
  const expected = [
    'n i pv pmt fv chs 7 8 9 divide',
    'power reciprocal pctTotal pctDiff percent eex 4 5 6 multiply',
    'runStop sst roll swap clx enter 1 2 3 subtract',
    'on f g sto rcl _ 0 decimal sum add',
  ]
  assert.deepEqual(classicKeyRows.map(row => row.map(k => k?.id ?? '_').join(' ')), expected)
  const ids = rows => rows.flat().filter(Boolean).map(k => k.id).sort()
  assert.deepEqual(ids(portraitKeyRows), ids(classicKeyRows))
  assert.equal(new Set(ids(portraitKeyRows)).size, 39)
})

test('teclado físico respeita região, conversor, atalhos do navegador, composição e ativação nativa', () => {
  for (const [key, id] of [['0','0'],[',','decimal'],['.','decimal'],['Enter','enter'],['=','enter'],
    ['+','add'],['-','subtract'],['*','multiply'],['/','divide'],['%','percent'],['^','power'],
    ['Backspace','backspace'],['Delete','clx'],['Escape','cancel'],['f','f'],['F','f'],['g','g'],['G','g'],['c','clx'],['C','clx'],['N','n'],['I','i']]) assert.equal(rpnKeyFromEvent(event(key)),id)
  for (const e of [event('Tab'),event(' '),event('1',{altKey:true}),event('+',{ctrlKey:true}),
    event('-', {metaKey:true}),event('C',{ctrlKey:true}),event('G',{altKey:true}),event('7',{nativeEvent:{isComposing:true}}),
    event('8',{target:{closest:()=>({})}}),event('Enter',{target:{closest:s=>s==='button'?{}:null}})])
    assert.equal(rpnKeyFromEvent(e),null)
})

test('atalhos f, g e c enviam as mesmas teclas que os botões clássicos', () => {
  const mock = (calc, keys) => keys.forEach(key => {
    const id = rpnKeyFromEvent(event(key))
    assert.ok(id && calc.isSupported(id))
    calc.press(id)
  })
  const viaKeys = createClassicRpnController()
  const reference = createClassicRpnController()
  try {
    mock(viaKeys, ['2', 'N', 'C'])
    for (const id of ['2', 'n', 'clx']) reference.press(id)
    assert.equal(viaKeys.snapshot().finance.n, 2, 'C sozinho não limpa registros financeiros')
    assert.deepEqual(viaKeys.snapshot(), reference.snapshot())
    mock(viaKeys, ['F', 'C'])
    for (const id of ['f', 'clx']) reference.press(id)
    assert.equal(viaKeys.snapshot().finance.n, 0, 'F + C aciona CLEAR REG')
    assert.deepEqual(viaKeys.snapshot(), reference.snapshot())
    mock(viaKeys, ['G', '7'])
    for (const id of ['g', '7']) reference.press(id)
    assert.equal(viaKeys.snapshot().indicators.begin, true, 'G + 7 equivale a BEG')
    assert.deepEqual(viaKeys.snapshot(), reference.snapshot())
    mock(viaKeys, ['g', '8', 'g', 'c'])
    for (const id of ['g', '8', 'g', 'clx']) reference.press(id)
    assert.equal(viaKeys.snapshot().indicators.begin, false)
    assert.deepEqual(viaKeys.snapshot(), reference.snapshot())
  } finally { viaKeys.dispose(); reference.dispose() }
})

test('toque e teclado enviam IDs físicos; LCD, estados e indisponibilidade vêm do controlador', async t => {
  const calls = []
  let view = { display:'0,00', indicators:{on:true} }
  const ui = setup(t, () => ({
    snapshot: () => view, isSupported: key => key !== 'sst',
    press: key => { calls.push(key); view = {display:'120,50',shift:'g',indicators:{begin:true,program:true,on:true},message:'Teste local'} },
    setDisplay: value => { calls.push(value); view = {...view,display:'12,6825'} },
  }))
  await ui.render.settle()
  const physical = event('2')
  ui.panel().props.onKeyDown(physical)
  await ui.render.settle()
  assert.ok(physical.prevented)
  assert.equal(ui.display(), '120,50')
  assert.equal(ui.find(n => n.props?.role === 'status').props.children, 'Teste local')
  const key = id => ui.keys().find(k => k.props['data-key'] === id)
  assert.ok(key('g').props['aria-pressed'])
  assert.match(key('sst').props['aria-label'],/indisponível/)
  assert.ok(key('sst').props.disabled)
  assert.equal(key('pv').props['aria-label'],'g · CF₀')
  key('pv').props.onClick()
  await ui.render.settle()
  assert.deepEqual(calls,['2','pv'])
  const trigger = ui.find(n => n.props?.className === 'rpn-rates-trigger')
  trigger.props.onClick()
  await ui.render.settle()
  assert.ok(ui.rates().open)
  ui.rates().onUse(12.6825)
  await ui.render.settle()
  assert.deepEqual(calls,['2','pv',12.6825])
  assert.equal(ui.display(),'12,6825')
  assert.ok(!ui.rates().open)
})

test('conversor abre sem valor, exige base diária e envia somente uma taxa calculada', async t => {
  const { RatePanel } = resources(null)
  const used = []
  let open = true
  const ui = hookRenderer(() => RatePanel({id:'test-rates',open,onUse:value=>used.push(value),onClose:()=>{open=false},canUse:true}))
  t.after(() => ui.close())
  const nodesOf = tag => nodes(ui.value).filter(n=>n.type===tag)
  const set = async (node,value) => { node.props.onChange({target:{value}}); await ui.settle() }
  const use = () => nodesOf('button').find(b=>b.props.className==='rpn-use-rate')
  await ui.settle()
  assert.ok(use().props.disabled)
  await set(nodesOf('input')[0],'1,00')
  assert.match(nodesOf('output')[0].props.children.join(''),/^12,682503.+% a.a.$/)
  await set(nodesOf('select')[1],'day')
  assert.equal(nodesOf('select').length,3)
  assert.ok(use().props.disabled)
  await set(nodesOf('select')[2],'252')
  assert.ok(!use().props.disabled)
  use().props.onClick()
  assert.equal(used.length,1)
  assert.ok(Math.abs(used[0]-convertEquivalentRate({rate:1,from:'month',to:'day',dayBasis:252}).value)<1e-13)
  assert.equal(nodesOf('input')[0].props.value,'1,00')
})

test('falha inesperada limpa visor e desliga as operações sem impedir ajuda ou conversão independente', async t => {
  let calls = 0
  const ui = setup(t,()=>({snapshot:()=>({display:'99'}),isSupported:()=>true,press:()=>{calls++;throw new Error('fixture')}}))
  await ui.render.settle()
  ui.panel().props.onKeyDown(event('1'))
  await ui.render.settle()
  assert.equal(ui.display(),'—')
  assert.match(ui.find(n=>n.props?.role==='status').props.children,/Não foi possível/)
  assert.ok(ui.keys().every(k=>k.props.disabled))
  const extra = event('2')
  ui.panel().props.onKeyDown(extra)
  assert.ok(!extra.prevented)
  assert.equal(calls,1)
})


test('interface e controlador reais compartilham o mapa, preservam fluxo e não gravam a conversão em i', async t => {
  assert.deepEqual(classicKeyRows.flat().filter(Boolean).map(key=>key.id),CLASSIC_KEYS)
  const controller = createClassicRpnController()
  const ui = setup(t,()=>controller)
  const keyboard = async key => { ui.panel().props.onKeyDown(event(key)); await ui.render.settle() }
  const click = async id => {
    const button = ui.keys().find(key=>key.props['data-key']===id)
    assert.ok(button && !button.props.disabled,`tecla disponível: ${id}`)
    button.props.onClick()
    await ui.render.settle()
  }
  await ui.render.settle()
  for (const key of ['2','Enter','3','+']) await keyboard(key)
  assert.match(ui.display(),/^5(?:,0+)?$/)
  for (const id of ['clx','1','0','0','chs','g','pv','clx','8','0','g','pmt','f','fv']) await click(id)
  assert.match(ui.display(),/^[-−]20(?:,0+)?$/)
  const before = controller.snapshot()
  const rate = convertEquivalentRate({rate:1,from:'month',to:'year'}).value
  ui.rates().onUse(rate)
  await ui.render.settle()
  assert.equal(controller.snapshot().x,rate)
  assert.deepEqual(controller.snapshot().finance,before.finance)
  assert.deepEqual(controller.snapshot().stack.slice(1),before.stack.slice(1))
})


test('UI reflete pausa e retomada emitidas, remove assinatura e ignora entrega já enfileirada', async t => {
  let notify
  let routeExited = false, disposed = false
  let view = {display:'1,00',indicators:{on:true}}
  const controller = {
    press: () => (view={display:'2,00',indicators:{on:true,running:true,paused:true}}),
    snapshot: () => view,
    isSupported: () => true,
    subscribe: listener => { notify=listener; return () => { routeExited=true } },
    dispose: () => { disposed=true },
  }
  const ui = setup(t,()=>controller,false)
  await ui.render.settle()
  ui.keys().find(key=>key.props['data-key']==='runStop').props.onClick()
  await ui.render.settle()
  assert.equal(ui.display(),'2,00')
  assert.ok(ui.find(node=>node.props?.children==='PAUSA'))
  notify({display:'3,00',indicators:{on:true}})
  await ui.render.settle()
  assert.equal(ui.display(),'3,00')
  assert.ok(!ui.find(node=>node.props?.children==='PAUSA'))
  const count = ui.render.updates
  ui.render.close()
  assert.ok(routeExited && disposed)
  notify({display:'4,00',indicators:{on:true}})
  assert.equal(ui.render.updates,count)
})

test('programa real com PSE atualiza o React ao retomar; desmontagem cancela a próxima pausa', async t => {
  let seq = 0
  const pending = new Map()
  const controller = createClassicRpnController({
    schedule(callback, ms) {
      assert.equal(ms,1000)
      pending.set(++seq,callback)
      return seq
    },
    cancelScheduled(id) { pending.delete(id) },
  })
  const ui = setup(t,()=>controller,false)
  const tap = async (...ids) => {
    for (const id of ids) {
      const button = ui.keys().find(key=>key.props['data-key']===id)
      assert.ok(button && !button.props.disabled,`tecla disponível no modo atual: ${id}`)
      button.props.onClick()
      await ui.render.settle()
    }
  }
  await ui.render.settle()
  await tap('f','runStop','2','enter','g','runStop','3','add','f','runStop','g','roll','0','0','runStop')
  assert.equal(ui.display(),'2,00')
  assert.ok(ui.find(n=>n.props?.children==='PAUSA'))
  assert.ok(!ui.rates().canUse)
  assert.equal(pending.size,1)
  const [id, resume] = pending.entries().next().value
  pending.delete(id)
  resume()
  await ui.render.settle()
  assert.equal(ui.display(),'5,00')
  assert.ok(!ui.find(n=>n.props?.children==='PAUSA'))
  assert.ok(ui.rates().canUse)
  await tap('g','roll','0','0','runStop')
  assert.equal(pending.size,1)
  ui.render.close()
  assert.equal(pending.size,0)
  assert.equal(controller.snapshot().indicators.paused,false)
})


test('visor exibe o indicador C com descrição acessível somente enquanto ativo', async t => {
  const controller = createClassicRpnController()
  const ui = setup(t,()=>controller)
  const tap = async id => {
    const button = ui.keys().find(key=>key.props['data-key']===id)
    assert.ok(button && !button.props.disabled,`tecla disponível: ${id}`)
    button.props.onClick()
    await ui.render.settle()
  }
  const compoundBadge = () => ui.find(node=>node.props?.title==='Juros compostos na fração de período')
  await ui.render.settle()
  assert.equal(compoundBadge(),undefined)
  await tap('sto')
  await tap('eex')
  const badge = compoundBadge()
  assert.ok(badge)
  assert.equal(badge.props.children[0].props.children,'C')
  assert.equal(badge.props.children[0].props['aria-hidden'],'true')
  assert.equal(badge.props.children[1].props.children,'Juros compostos na fração de período')
  await tap('sto')
  await tap('eex')
  assert.equal(compoundBadge(),undefined)
})

test('teclado de retrato reserva 44 px por coluna, inclusive na largura útil medida a 320 px', async () => {
  const css = await readFile(new URL('../src/RpnCalculator.css',import.meta.url),'utf8')
  assert.match(css,/\.rpn-keypad--portrait \{ grid-template-columns: repeat\(5,minmax\(44px,1fr\)\)/)
  const compact = css.split('@container (max-width: 330px) {')[1]?.match(/\.rpn-keypad--portrait \{ gap: (\d+)px; padding: (\d+)px; \}/)
  assert.ok(compact)
  const [,gap,padding]=compact.map(Number)
  // CI mediu 43,75 px por coluna com gap 5, padding 6 e borda 1 de cada lado.
  const existingBorderBox = 5*43.75 + 4*5 + 2*6 + 2
  assert.ok(5*44 + 4*gap + 2*padding + 2 <= existingBorderBox)
})

test('De e Para têm rótulos nativos próprios sem o texto das opções no rótulo', async t => {
  const { RatePanel } = resources(null)
  const ui = hookRenderer(() => RatePanel({id:'taxas-a11y',open:true,onUse(){},onClose(){},canUse:true}))
  t.after(() => ui.close())
  await ui.settle()
  const elements=nodes(ui.value)
  for(const [name,control,value] of [['De','taxas-a11y-from','month'],['Para','taxas-a11y-to','year']]){
    const label=elements.find(element=>element.type==='label' && element.props.htmlFor===control)
    assert.equal(label?.props.children,name)
    const select=elements.find(element=>element.type==='select' && element.props.id===control)
    assert.equal(select?.props.value,value)
    assert.deepEqual(Array.from(select.props.children, option=>option.props.value),['day','month','year'])
    assert.ok(!nodes(label).includes(select))
  }
})

test('resumo simultâneo da taxa não supõe base diária e o visor recebe somente o destino', async t => {
  const { RatePanel } = resources(null)
  const used = []
  const ui = hookRenderer(() => RatePanel({id:'taxas-resumo', open:true, onUse:value=>used.push(value), onClose(){}, canUse:true}))
  t.after(() => ui.close())
  const find = f => nodes(ui.value).find(f)
  const set = async (control, value) => { find(control).props.onChange({target:{value}}); await ui.settle() }
  const field = id => el => el.type === 'select' && el.props.id === 'taxas-resumo-' + id
  const basis = el => el.type === 'select' && el.props['aria-label'] === 'Base diária'
  const summary = period => {
    const area = find(el => el.props?.['aria-label'] === 'Equivalências por período')
    return nodes(area).find(el => el.type === 'div' && nodes(el).some(ch => ch.type === 'dt' && ch.props.children === period))
      ?.props.children.find(ch => ch.type === 'dd').props.children
  }
  await ui.settle()
  await set(el => el.type === 'input', '2')
  assert.equal(summary('Ao mês'), '2% a.m.')
  assert.match(summary('Ao ano'), /^26,8241794563% a\.a\.$/)
  assert.equal(summary('Ao dia'), 'Escolha a base diária')
  for (const b of ['365', '252']) {
    await set(basis, b)
    const expected = convertEquivalentRate({rate:2,from:'month',to:'day',dayBasis:Number(b)}).value
    const display = Number(summary('Ao dia').split('%')[0].replace(',','.'))
    assert.ok(Math.abs(display - expected) < 1e-12)
  }
  const use = () => find(el => el.props?.className === 'rpn-use-rate')
  use().props.onClick()
  assert.deepEqual(used, [convertEquivalentRate({rate:2,from:'month',to:'year'}).value])
  await set(basis, '')
  await set(field('to'), 'day')
  assert.equal(use().props.disabled, true)
  assert.equal(summary('Ao mês'), '2% a.m.')
  await set(field('from'), 'day')
  assert.equal(summary('Ao ano'), 'Escolha a base diária')
  assert.equal(use().props.disabled, true)
})


test('histórico, atalhos e conversão convivem sem reescrever pilha ou registradores alheios', async t => {
  const controller = createClassicRpnController()
  const ui = setup(t, () => controller)
  const keyboard = async key => { ui.panel().props.onKeyDown(event(key)); await ui.render.settle() }
  await ui.render.settle()
  for (const key of ['2','N','C','F','C','2','Enter','3','+']) await keyboard(key)
  assert.equal(controller.snapshot().finance.n, 0)
  assert.equal(controller.snapshot().x, 5)
  ui.find(node => node.props?.['aria-label'] === 'Histórico de contas').props.onClick()
  await ui.render.settle()
  const history = () => ui.find(node => node.type?.name === 'HistoryPanel').props
  assert.equal(history().entries.length, 1)
  const recorded = history().entries[0]
  assert.equal(recorded.result, 5)
  history().onEdit({ ...replayRpnEntry('add', 2, 9), id: recorded.id })
  await ui.render.settle()
  assert.equal(controller.snapshot().x, 5)
  assert.equal(history().entries[0].result, 11)
  history().onRemove(recorded.id)
  await ui.render.settle()
  history().onClose()
  await ui.render.settle()
  ui.find(node => node.props?.['aria-label'] === 'Histórico de contas').props.onClick()
  await ui.render.settle()
  assert.equal(history().canUndo, true)
  history().onUndo()
  await ui.render.settle()
  const before = controller.snapshot()
  const rate = convertEquivalentRate({ rate: 1, from: 'month', to: 'year' }).value
  ui.rates().onUse(rate)
  await ui.render.settle()
  assert.equal(controller.snapshot().x, rate)
  assert.deepEqual(controller.snapshot().finance, before.finance)
  assert.deepEqual(controller.snapshot().stack.slice(1), before.stack.slice(1))
  assert.equal(history().entries.length, 2)
  assert.equal(history().entries[0].result, rate)
  assert.equal(history().entries[1].result, 11)
})

test('limpeza do histórico mantém a calculadora e permite recuperar contas após novo cálculo', async t => {
  const controller = createClassicRpnController()
  const ui = setup(t, () => controller)
  const keyboard = async key => { ui.panel().props.onKeyDown(event(key)); await ui.render.settle() }
  await ui.render.settle()
  for (const key of ['2', 'Enter', '3', '+']) await keyboard(key)
  ui.find(node => node.props?.['aria-label'] === 'Histórico de contas').props.onClick()
  await ui.render.settle()
  const history = () => ui.find(node => node.type?.name === 'HistoryPanel').props
  const before = controller.snapshot()
  history().onClear()
  await ui.render.settle()
  assert.equal(history().entries.length, 0)
  assert.equal(history().hasCleared, true)
  assert.deepEqual(controller.snapshot(), before)
  for (const key of ['4', '+']) await keyboard(key)
  history().onUndo()
  await ui.render.settle()
  assert.equal(history().entries.map(e => e.result).join(','), '9,5')
  assert.equal(controller.snapshot().x, 9)
})

test('fita atualiza a mesma linha durante digitação e só registra o resultado após a operação', async t => {
  const ui = setup(t, createClassicRpnController)
  await ui.render.settle()
  ui.find(node => node.props?.['aria-label'] === 'Histórico de contas').props.onClick()
  await ui.render.settle()
  const tape = () => ui.find(node => node.type?.name === 'HistoryPanel').props
  const keyboard = async (key, draft, count = 0) => {
    ui.panel().props.onKeyDown(event(key))
    await ui.render.settle()
    assert.equal(tape().draft, draft)
    assert.equal(tape().entries.length, count)
  }
  await keyboard('1', '1')
  await keyboard('2', '12')
  await keyboard(',', '12,')
  await keyboard('5', '12,5')
  await keyboard('Backspace', '12,')
  await keyboard('5', '12,5')
  await keyboard('Enter', null)
  await keyboard('3', '3')
  await keyboard('+', null, 1)
  assert.equal(tape().entries[0].result, 15.5)
  await keyboard('9', '9', 1)
  await keyboard('Delete', null, 1)
})


const cetSource = await readFile(new URL('../src/RpnCetPanel.jsx', import.meta.url), 'utf8')
const cetCode = (await transform(cetSource, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })).code
test('CET atualiza após colagem e recalcula ao digitar encargos', async t => {
  const { calculatePastedCet } = await import('../src/rpnPastedCet.mjs')
  const module = { exports: {} }
  runInNewContext(cetCode, { module, exports: module.exports, require: p =>
    p === './rpnPastedCet.mjs' ? { calculatePastedCet } : p === 'react' ? { ...React, useId: () => 'cet-test' } : require(p) })
  const ui = hookRenderer(() => module.exports.default())
  t.after(() => ui.close())
  ui.render()
  const fill = (name, index, value) => {
    nodes(ui.value).filter(el => el.type === name)[index].props.onChange({ target: { value } })
    ui.render()
  }
  fill('input', 0, '2025-01-01')
  fill('input', 1, '1000')
  fill('textarea', 0, '01/01/2026\t1100')
  assert.match(nodes(ui.value).find(el => el.type === 'strong').props.children.join(''), /10,00\s*% a\.a\./)
  fill('input', 2, '100')
  assert.match(nodes(ui.value).find(el => el.type === 'strong').props.children.join(''), /22,22\s*% a\.a\./)
})
