import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { transform } from 'esbuild'

// Teste de eventos/estado em memória, sem DOM real, navegador, servidor ou rede.
// Os refs ficam sem nós: este teste não mede layout, foco real ou acessibilidade visual.
const source = await readFile(new URL('../src/Help.jsx', import.meta.url), 'utf8')
const compiled = await transform(source, { loader: 'jsx', format: 'cjs', jsxFactory: '__element' })

function eventTarget() {
  const listeners = new Map()
  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type).add(listener)
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener) },
    dispatchEvent(event) { for (const listener of [...(listeners.get(event.type) ?? [])]) listener(event) },
    count(type) { return listeners.get(type)?.size ?? 0 },
  }
}

function mountHelp(props = {}, mobile = false) {
  const slots = [], pending = []
  let cursor = 0, changed = false, tree
  const document = eventTarget(), window = { ...eventTarget(), matchMedia: () => ({ matches: mobile }) }
  const timers = new Map()
  let timerId = 0
  const hooks = {
    useState(initial) {
      const index = cursor++
      slots[index] ??= { value: initial }
      return [slots[index].value, value => {
        const next = typeof value === 'function' ? value(slots[index].value) : value
        if (!Object.is(next, slots[index].value)) { slots[index].value = next; changed = true }
      }]
    },
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index] },
    useId() { return hooks.useRef('test-help').current },
    useEffect(effect, dependencies) {
      const index = cursor++, previous = slots[index]
      if (!previous || dependencies.some((value, at) => !Object.is(value, previous.dependencies[at]))) {
        pending.push(() => {
          previous?.cleanup?.()
          slots[index] = { dependencies, cleanup: effect() }
        })
      }
    },
    useLayoutEffect(effect, dependencies) { hooks.useEffect(effect, dependencies) },
  }
  const module = { exports: {} }
  vm.runInNewContext(compiled.code, {
    module, exports: module.exports,
    require: name => {
      if (name === 'react') return hooks
      if (name === 'react-dom') return { createPortal: node => node }
      throw new Error(`Importação inesperada: ${name}`)
    },
    __element: (type, attributes, ...children) => ({ type, props: { ...attributes, children } }),
    window, document,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail } },
    setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id },
    clearTimeout: id => timers.delete(id),
  })
  const render = () => {
    let rounds = 0
    do {
      if (++rounds > 20) throw new Error('Renderização não estabilizou')
      cursor = 0; changed = false
      tree = module.exports.default({ label: 'Ajuda de teste', children: 'Conteúdo', ...props })
      while (pending.length) pending.shift()()
    } while (changed)
  }
  const find = predicate => {
    const visit = node => {
      if (!node || typeof node !== 'object') return null
      if (Array.isArray(node)) return node.map(visit).find(Boolean)
      return predicate(node) ? node : visit(node.props?.children)
    }
    return visit(tree)
  }
  render()
  return {
    expanded: () => find(node => node.type === 'button' && node.props['aria-label'])?.props['aria-expanded'],
    button: () => find(node => node.type === 'button' && node.props['aria-label']),
    tooltip: () => find(node => node.props?.role === 'tooltip'),
    wrapper: () => find(node => node.props?.className === 'help'),
    closeButton: () => find(node => node.props?.className === 'pop-close'),
    backdrop: () => find(node => node.props?.className === 'pop-backdrop'),
    act(callback) { callback(); render() },
    key(key) { document.dispatchEvent({ type: 'keydown', key, preventDefault() {}, stopPropagation() {} }); render() },
    openOther() { window.dispatchEvent({ type: 'help-open', detail: 'other-help' }); render() },
    listenerCount: type => document.count(type),
    pendingTimers: () => timers.size,
    unmount() { for (const slot of slots) slot?.cleanup?.() },
  }
}

test('Help: Escape fecha abertura por foco, sem exigir clique', () => {
  const help = mountHelp()
  assert.equal(help.expanded(), false)
  assert.equal(help.listenerCount('keydown'), 0)
  help.act(() => help.button().props.onFocus())
  assert.equal(help.expanded(), true)
  assert.equal(help.listenerCount('keydown'), 1)
  help.key('Tab')
  assert.equal(help.expanded(), true)
  help.key('Escape')
  assert.equal(help.expanded(), false)
  assert.equal(help.listenerCount('keydown'), 0)
  help.unmount()
})

test('Help: Escape fecha hover e limpa também o hover de ajuda fixada', () => {
  for (const pin of [false, true]) {
    const help = mountHelp()
    help.act(() => help.wrapper().props.onPointerEnter({ pointerType: 'mouse' }))
    if (pin) help.act(() => help.button().props.onClick())
    assert.equal(help.expanded(), true)
    help.key('Escape')
    assert.equal(help.expanded(), false)
    assert.equal(help.listenerCount('pointerdown'), 0)
    assert.equal(help.listenerCount('keydown'), 0)
    help.unmount()
  }
})

test('Help: Escape fecha foco dentro do conteúdo e cancela timer de saída', () => {
  const help = mountHelp({ wide: true })
  help.act(() => help.button().props.onFocus())
  help.act(() => help.tooltip().props.onFocus())
  help.act(() => help.button().props.onBlur())
  assert.equal(help.expanded(), true)
  help.act(() => help.wrapper().props.onPointerLeave())
  assert.equal(help.pendingTimers(), 1)
  help.key('Escape')
  assert.equal(help.expanded(), false)
  assert.equal(help.pendingTimers(), 0)
  help.unmount()
})

test('Help: Escape repetido é inofensivo e novo foco pode reabrir a ajuda', () => {
  const help = mountHelp()
  for (let round = 0; round < 3; round++) {
    help.act(() => help.button().props.onFocus())
    assert.equal(help.expanded(), true)
    help.key('Escape')
    help.key('Escape')
    assert.equal(help.expanded(), false)
  }
  help.act(() => help.button().props.onFocus())
  help.unmount()
  assert.equal(help.listenerCount('keydown'), 0)
})

test('Help: fechamento por teclado vale para wide, fixed e folha móvel', () => {
  for (const [props, mobile] of [[{ wide: true }, false], [{ fixed: true }, false], [{ wide: true }, true]]) {
    const help = mountHelp(props, mobile)
    help.act(() => help.wrapper().props.onPointerEnter({ pointerType: 'touch' }))
    assert.equal(help.expanded(), false, 'toque não simula hover de mouse')
    help.act(() => help.button().props.onClick())
    assert.equal(help.expanded(), true)
    help.key('Escape')
    assert.equal(help.expanded(), false)
    help.unmount()
  }
})

test('Help: abrir outra ajuda continua fechando a anterior e limpando listener', () => {
  const help = mountHelp()
  help.act(() => help.button().props.onFocus())
  help.act(() => help.button().props.onClick())
  assert.equal(help.expanded(), true)
  help.openOther()
  assert.equal(help.expanded(), false)
  assert.equal(help.listenerCount('keydown'), 0)
  assert.equal(help.listenerCount('pointerdown'), 0)
  help.unmount()
})

test('Help: folha móvel não abre com hover incidental durante rolagem', () => {
 const help = mountHelp({ wide: true }, true)
 help.act(() => help.wrapper().props.onPointerEnter({ pointerType: 'mouse' }))
 assert.equal(help.expanded(), false)
 help.act(() => help.button().props.onFocus())
 assert.equal(help.expanded(), true, 'teclado continua disponível')
 help.key('Escape')
 help.act(() => help.button().props.onClick())
 assert.equal(help.expanded(), true, 'clique continua disponível')
 help.unmount()
})

for (const control of ['closeButton', 'backdrop']) {
  test(`Help: ${control} fecha folha móvel e limpa foco, hover e timer`, () => {
    const help = mountHelp({ wide: true }, true)
    help.act(() => help.button().props.onFocus())
    help.act(() => help.button().props.onClick())
    help.act(() => help.tooltip().props.onFocus())
    help.act(() => help.wrapper().props.onPointerLeave())
    assert.equal(help.expanded(), true)
    assert.equal(help.pendingTimers(), 1)
    assert.ok(help[control](), 'controle de fechamento presente')
    help.act(() => help[control]().props.onClick())
    assert.equal(help.expanded(), false)
    assert.equal(help.tooltip(), undefined)
    assert.equal(help.backdrop(), undefined)
    assert.equal(help.pendingTimers(), 0)
    assert.equal(help.listenerCount('keydown'), 0)
    assert.equal(help.listenerCount('pointerdown'), 0)
    help.act(() => help.wrapper().props.onPointerEnter({ pointerType: 'mouse' }))
    assert.equal(help.expanded(), false, 'hover incidental não reabre')
    help.act(() => help.button().props.onClick())
    assert.equal(help.expanded(), true, 'clique explícito pode reabrir')
    help.unmount()
  })
}
