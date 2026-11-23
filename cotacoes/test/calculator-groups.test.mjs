import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { CALCULATOR_GROUPS } from '../src/calculatorGroups.js'
const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : n && typeof n === 'object' ? [n, ...nodes(n.props?.children)] : []
test('catálogo agrupa os 13 destinos uma vez, com BNDES primeiro e sem expor árvore', async () => {
  const source = await readFile(new URL('../src/Calculadora.jsx', import.meta.url), 'utf8')
  const original = [...source.slice(source.indexOf('const CALCS'),source.indexOf('// Aba Calculadoras')).matchAll(/id: '([^']+)'/g)].map(m=>m[1])
  const grouped = CALCULATOR_GROUPS.flatMap(g=>g.calculators)
  assert.equal(grouped.length,13)
  assert.equal(new Set(grouped).size,13)
  assert.deepEqual([...grouped].sort(),original.sort())
  assert.equal(grouped[0],'finame-materiais')
  assert.ok(!grouped.includes('arvore-credito'))
  assert.deepEqual(CALCULATOR_GROUPS.map(g=>g.title),['Crédito e capital de giro','Crédito internacional','Taxas e câmbio','Planejamento e análise'])
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
  const tree=module.exports.default({view:'',onView:id=>clicks.push(id)})
  const all=nodes(tree)
  const groups=all.filter(n=>n.props?.className==='calc-catalog-group')
  assert.equal(groups.length,4)
  for(const group of groups){
    const heading=nodes(group).find(n=>n.type==='h3')
    assert.equal(group.props['aria-labelledby'],heading.props.id)
  }
  const buttons=all.filter(n=>n.type==='button')
  for(const button of buttons){assert.match(button.props['aria-label'],/: abrir calculadora$/);button.props.onClick()}
  assert.deepEqual(clicks,CALCULATOR_GROUPS.flatMap(g=>g.calculators))
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
  assert.equal(render('').props.className.includes('calc-catalog'), true)
  assert.deepEqual(imported, [])
  for (const [view, component] of [
    ['giro', 'CapitalDeGiro'], ['finame-materiais', 'BndesWorkspace'],
    ['bndes-tlp-exigivel', 'BndesWorkspace'], ['cambio-futuro', 'CambioFuturoCenario'],
    ['cambio-futuro/tir-usd', 'CambioFuturo'], ['arvore-credito', 'ArvoreCredito'],
  ]) {
    const form = render(view)
    assert.equal(form.type, React.Suspense)
    await form.props.children.type.load()
    assert.deepEqual(imported.splice(0), [`./${component}.jsx`])
  }
})
