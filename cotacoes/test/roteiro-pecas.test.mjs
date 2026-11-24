// Peças comuns do roteiro das calculadoras (Roteiro.jsx): o aviso de arredondamento da lista "Do que é feito o custo".
// Cada parte é arredondada sozinha ao aparecer; quando as partes mostradas não somam o total mostrado, a lista explica a
// diferença em uma linha, sem ajustar nenhum valor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import * as centavos from '../src/centavosDaTela.js'
import { giroOperation } from '../src/creditComparison.js'
import { cgAddDays } from '../src/contaGarantida.js'

const require = createRequire(import.meta.url)
const source = (await readFile(new URL('../src/Roteiro.jsx', import.meta.url), 'utf8')).replace(/^import ['"].+\.css['"]\s*$/gm, '')
const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
const module = { exports: {} }
runInNewContext(code, { module, exports: module.exports, require: name => name === './centavosDaTela.js' ? centavos : require(name) })
const { ComposicaoDoCusto } = module.exports
const brl = value => value == null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const html = props => renderToStaticMarkup(createElement(ComposicaoDoCusto, { format: brl, ...props })).replaceAll(String.fromCharCode(160), ' ')

test('partes que somam o total: a lista não fala em arredondamento', () => {
  const out = html({ parts: [{ label: 'Juros', value: 100.1 }, { label: 'IOF', value: 20.2 }], total: { label: 'Custo total', value: 120.3 } })
  assert.match(out, /Custo total<\/dt><dd>R\$ 120,30/)
  assert.doesNotMatch(out, /Arredondamento/)
})

test('partes que não somam o total: uma linha diz quanto as partes somam e qual é a diferença, sem mudar nenhum valor', () => {
  // 0,004 + 0,004 aparecem como R$ 0,00 + R$ 0,00, e o total 0,008 aparece como R$ 0,01.
  const out = html({ parts: [{ label: 'Juros', value: 10.004 }, { label: 'IOF', value: 5.004 }], total: { label: 'Custo total', value: 15.008 } })
  assert.match(out, /Juros<\/dt><dd>R\$ 10,00/)
  assert.match(out, /IOF<\/dt><dd>R\$ 5,00/)
  assert.match(out, /Custo total<\/dt><dd>R\$ 15,01/)
  assert.match(out, /Arredondamento: as partes somam R\$ 15,00; a diferença vem de arredondar cada parte em centavos<\/dt><dd>R\$ 0,01/)
})

test('sem resultado (valores vazios) não há total nem aviso a calcular', () => {
  const out = html({ parts: [{ label: 'Juros', value: undefined }], total: { label: 'Custo total', value: undefined } })
  assert.match(out, /Custo total<\/dt><dd>—/)
  assert.doesNotMatch(out, /Arredondamento/)
})

test('Capital de Giro fecha sempre em centavos: a conta já arredonda cada lançamento', () => {
  for (const system of ['price', 'sac']) for (const value of [100000, 123456.78, 987654.32]) {
    const r = giroOperation({ value, n: 24, rate: 2.37, unit: 'am', system, start: '2026-11-21', firstDue: cgAddDays('2026-11-21', 30), fees: 1234.56, financedFees: 0, calendars: ['BR'] })
    assert.equal(r.ok, true)
    assert.equal(centavos.sobraDeCentavos([r.interest, r.iof, r.fees + r.financedFees], r.cost), null)
  }
})
