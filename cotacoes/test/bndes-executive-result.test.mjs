import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url)
async function render(props) {
  const source = await readFile(new URL('../src/BndesExecutiveResult.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, require })
  return renderToStaticMarkup(React.createElement(module.exports.default, props))
}
const base = {
  annualCet: '19,21% a.a.', monthlyCet: '1,47% a.m.', total: 'R$ 1.380.223,57', tax: '19,04% a.a.',
  equivalent: 'CDI + 4,75% a.a.', cdiReference: 'CDI de 13,64% a.a. em 19/11/2026',
  reference: { name: 'TFC', code: 'C03', rate: '14,1453% a.a.', date: '19/11/2026', source: 'Painel BNDES' },
  conditions: [['Valor financiado', 'R$ 1.000.000,00'], ['Prazo total', '48 meses']],
  installments: [['Primeira parcela após carência', 'R$ 35.684,67'], ['Última parcela', 'R$ 22.586,02']],
  expenses: [['Juros totais', 'R$ 377.623,57'], ['TAC à vista', 'R$ 2.600,00'], ['IOF', 'R$ 0,00']],
}
test('resumo executivo mostra cada indicador uma única vez e conserva os valores recebidos', async () => {
  const html = await render(base)
  for (const value of [base.annualCet, base.monthlyCet, base.total, 'R$ 377.623,57', 'R$ 1.000.000,00']) assert.equal(html.split(value).length - 1, 1, value)
  for (const text of ['Resultado financeiro', 'Condições da operação', 'C03', '14,1453% a.a.', '19/11/2026', 'CDI de 13,64%', 'Primeira parcela após carência']) assert.ok(html.includes(text), text)
  assert.equal((html.match(/<button/g) || []).length, 0, 'sem maximizações dentro do resultado')
})
test('taxa manual mantém a fonte original datada e avisa referência retida', async () => {
  const html = await render({ ...base, reference: { ...base.reference, manual: true, retained: true } })
  for (const text of ['Taxa manual', 'Referência retida', '19/11/2026', 'C03']) assert.ok(html.includes(text), text)
})
test('pós-fixado mantém parte fixa e índice projetado sem criar equivalência CDI ausente', async () => {
  const html = await render({ ...base, equivalent: null, cdiReference: null, cetLabel: 'Custo com índice projetado', extraMetrics: [['CET · parte fixa', '10,50% a.a.'], ['IPCA projetado', '4,50% a.a.']] })
  assert.ok(html.includes('Custo com índice projetado'))
  assert.ok(html.includes('CET · parte fixa'))
  assert.ok(html.includes('IPCA projetado'))
  assert.ok(!html.includes('CDI +'))
})
