import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { CALCULATOR_GROUPS } from '../src/calculatorGroups.js'
test('catálogo agrupa os 15 destinos uma vez, com BNDES primeiro e sem expor árvore', async () => {
  const source = await readFile(new URL('../src/Calculadora.jsx', import.meta.url), 'utf8')
  const original = [...source.slice(source.indexOf('const CALCS'),source.indexOf('// Aba Calculadoras')).matchAll(/id: '([^']+)'/g)].map(m=>m[1])
  const grouped = CALCULATOR_GROUPS.flatMap(g=>g.calculators)
  assert.equal(grouped.length,15)
  assert.equal(new Set(grouped).size,15)
  assert.deepEqual([...grouped].sort(),original.sort())
  assert.equal(grouped[0],'finame-materiais')
  assert.ok(!grouped.includes('arvore-credito'))
  assert.deepEqual(CALCULATOR_GROUPS.map(g=>g.title),['Crédito e capital de giro','Crédito internacional','Taxas e câmbio','Planejamento e análise','Investimentos'])
})
test('grupos têm títulos acessíveis e todos os botões preservam destino ao clicar', async () => {
  const source = await readFile(new URL('../src/Calculadora.jsx', import.meta.url), 'utf8')
  const code = (await transform(source,{loader:'jsx',format:'cjs',jsx:'automatic'})).code
  const require = createRequire(import.meta.url)
  const stub = () => null
  const module = {exports:{}}
  runInNewContext(code,{module,exports:module.exports,require:n=>{
    if(n==='./calculatorGroups.js') return {CALCULATOR_GROUPS}
    if(n.startsWith('.')) return new Proxy({__esModule:true,default:stub},{get:(o,k)=>o[k]??stub})
    return require(n)
  }})
  const clicks=[]
  // Busca e destaque (revisão de 25/11/2026): a lista sem estado é testada direto; "Mais usadas" + 5 grupos.
  const { CatalogoLista, MAIS_USADAS } = module.exports
  const expand = n => Array.isArray(n) ? n.flatMap(expand) : n && typeof n === 'object' ? (typeof n.type === 'function' && n.type.name === 'Tile' ? expand(n.type(n.props)) : [n, ...expand(n.props?.children)]) : []
  const tree=CatalogoLista({onView:id=>clicks.push(id)})
  const all=expand(tree)
  const groups=all.filter(n=>String(n.props?.className).split(' ').includes('calc-catalog-group'))
  assert.equal(groups.length,6)
  for(const group of groups){
    const heading=expand(group).find(n=>n.type==='h3')
    assert.equal(group.props['aria-labelledby'],heading.props.id)
  }
  const buttons=all.filter(n=>n.type==='button')
  for(const button of buttons){assert.match(button.props['aria-label'],/: abrir calculadora$/);button.props.onClick()}
  assert.equal(clicks.length,15)
  assert.deepEqual([...clicks].sort(),CALCULATOR_GROUPS.flatMap(g=>g.calculators).sort())
  assert.deepEqual(clicks.slice(0,3),[...MAIS_USADAS])
  const busca = query => expand(CatalogoLista({query,onView(){}})).filter(n=>n.type==='button').map(n=>n.props['aria-label'])
  assert.deepEqual([...busca('4131')],['Empréstimo externo (4131): abrir calculadora'])
  assert.ok(busca('cambio').includes('Câmbio futuro: abrir calculadora'),'busca sem acento')
  assert.equal(busca('xyz').length,0)
  assert.equal(all.find(n=>n.type==='a').props.href,'#bndes')
  assert.ok(React.isValidElement(tree))
})

test('catálogo e endereços diretos carregam somente o formulário escolhido', async () => {
  const source = await readFile(new URL('../src/Calculadora.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, {
    loader: 'jsx', format: 'cjs', jsx: 'automatic', supported: { 'dynamic-import': false },
  })
  const require = createRequire(import.meta.url)
  const imported = []
  const module = { exports: {} }
  runInNewContext(code, { exports: module.exports, module, require(name) {
    if (name === 'react') return { ...React, lazy: load => Object.assign(() => null, { load }) }
    if (name === './calculatorGroups.js') return { CALCULATOR_GROUPS }
    if (name === './CalculatorIcons.jsx') return new Proxy({}, { get: () => () => null })
    if (name.endsWith('.css')) return {}
    if (name.startsWith('./')) { imported.push(name); return {} }
    return require(name)
  } })
  const render = view => module.exports.default({ view, onView() {} })
  assert.equal(render('').type.name, 'Catalogo')
  assert.deepEqual(imported, [])
  for (const [view, component] of [
    ['investimentos', 'Investimentos'], ['giro', 'CapitalDeGiro'], ['finame-materiais', 'BndesWorkspace'],
    ['bndes-tlp-exigivel', 'BndesWorkspace'], ['cambio-futuro', 'CambioFuturoFluxo'], ['cambio-futuro/euro-yuan', 'CambioFuturoJornada'], ['cambio-futuro/cenarios', 'CambioFuturoCenario'],
    ['cambio-futuro/tir-usd', 'CambioFuturo'], ['arvore-credito', 'ArvoreCredito'],
  ]) {
    const form = render(view)
    assert.equal(form.type, React.Suspense)
    await form.props.children.type.load()
    assert.deepEqual(imported.splice(0), [`./${component}.jsx`])
  }
})
