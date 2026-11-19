import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url)
const source = name => readFile(new URL('../src/' + name, import.meta.url), 'utf8')
test('calculators and BNDES profiles use the compact standard and expansion shell', async () => {
  for (const name of ['OperacaoDi','CbsCaixa','ContaGarantida','FinimpComparacao','AnaliseDesconto','Faturamento','Emprestimo4131','BndesTlpExigivel','BndesLcdCap','BndesCreditoTfb']) {
    const text = await source(name+'.jsx')
    assert.match(text, /import '\.\/CalculatorStandard.css'/, name)
    assert.match(text, /className="cx[^"]*calc-standard/, name)
    assert.match(text, /ExpandablePanel/, name)
  }
  const css = await source('CalculatorStandard.css')
  assert.match(css, /repeat\(auto-fit,minmax\(min\(100%,220px\),1fr\)\)/)
  assert.doesNotMatch(css, /--cx-select-bg:/, 'herda a seleção âmbar do Comparador')
  assert.match(css, /background:var\(--bw-tint\)/)
})
test('expansion shell renders one copy of results and an explicitly labelled control', async () => {
  const raw = (await source('ExpandablePanel.jsx')).replace(/^import ['"].+\.css['"]\s*$/gm, '')
  const { code } = await transform(raw,{loader:'jsx',format:'cjs',jsx:'automatic'})
  const module={exports:{}}
  runInNewContext(code,{module,exports:module.exports,require:name=>['./BndesIcon.jsx','./ExpandIcon.jsx'].includes(name)?()=>null:require(name)})
  const html=renderToStaticMarkup(React.createElement(module.exports.default,{title:'Parcelas'},React.createElement('p',null,'RESULTADO_UNICO')))
  assert.equal(html.match(/RESULTADO_UNICO/g).length,1)
  assert.match(html,/aria-label="Ampliar: Parcelas"/)
  assert.match(html,/<dialog/)
  assert.match(html,/aria-expanded="false"/)
})

test('secondary explanations move to help without hiding essential simulation limitations', async () => {
  const capital = await source('CapitalDeGiro.jsx')
  assert.match(capital, /<Help title="Capital de Giro: cálculo e premissas">\s*<p>Operação prefixada com juros por dias corridos/)
  const tlp = await source('BndesTlpExigivel.jsx')
  assert.match(tlp, /<p className="status">Projeção de IPCA constante/)
  assert.match(tlp, /<Help title="Composição da TLP exigível">/)
  const cbs = await source('CbsCaixa.jsx')
  assert.match(cbs, /<Help title="O que esta simulação faz">/)
  assert.match(cbs, /<p className="cbs-assumptions">Simulação educativa/)
  assert.match(cbs, /<p className="cbs-critical">Lucro Real:/)
  const desconto = await source('AnaliseDesconto.jsx')
  assert.match(desconto, /A média mensal all-in não é a parcela contratual/)
  const conta = await source('ContaGarantida.jsx')
  assert.match(conta, /<CalculatorHelp title="Como calculamos o CET"><p>Fluxo do CET:/)
  assert.match(conta, /Alíquotas consultadas em 05\/11\/2026; sem atualização automática/)
})

// Regression: the shared input padding must not override MoneyInput's prefix gutter.
test('standard inputs retain the currency prefix gutter and section spacing', async () => {
  const css = await source('CalculatorStandard.css')
  assert.match(css, /\.calc-standard \.cx-field \.money-wrap > input \{ padding-left:42px; \}/)
  assert.match(css, /gap:20px;/)
})
test('Finame history keeps instructions available through help', async () => {
  assert.match(await source('FinameMateriais.jsx'), /<ComparaSeries compactHelp items=/)
  const comparison = await source('BndesCompare.jsx')
  assert.match(comparison, /compactHelp = false/)
  assert.match(comparison, /<CalculatorHelp title="Como ler o histórico dos indexadores">/)
  assert.match(comparison, /taxas são comparadas em pontos percentuais/)
})
