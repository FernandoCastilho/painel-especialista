import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createTfbReference } from '../src/bndesTfbReference.js'
import { fullInput } from './fixtures/bndes-tfb/full-input.mjs'
import { fullRows } from './fixtures/bndes-tfb/full-evidence.mjs'
import { reconcileCreditoPequenasEmpresas } from '../src/bndesCreditoPequenasEmpresas.js'
import { finameFundingOption, finameFundingAnnualRate } from '../src/finameFunding.js'
import { parseCommand } from '../src/terminal.js'
import { buildSearchIndex } from '../scripts/build-search-index.mjs'
const source = file => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8')

test('referência integrada preserva o input conciliado e não transforma o CET original em alvo', () => {
  assert.deepEqual(createTfbReference(), fullInput())
  const a = createTfbReference(); a.principalCents = 1
  assert.equal(createTfbReference().principalCents, 300000000)
  const r = reconcileCreditoPequenasEmpresas(createTfbReference())
  assert.equal(r.ok, true); assert.equal(r.rows.length, 34)
  for (let i = 0; i < fullRows.length; i++) for (const key of Object.keys(fullRows[i])) assert.equal(r.rows[i][key], fullRows[i][key], `Linha ${i + 1}: ${key}`)
  assert.equal(r.rows.at(-1).closingCents, 0)
  assert.equal(r.cet.reportedAnnualRateDecimal, null)
  assert.equal(r.cet.calculatedAnnualRateDecimal.toFixed(10), '0.2015688993')
  assert.equal(r.cet.validated, false)
})
test('TFB integrada conta IOF retido e tarifa exatamente uma vez', () => {
  const r = reconcileCreditoPequenasEmpresas(createTfbReference())
  assert.equal(r.netDisbursementCents, 290581727)
  assert.equal(r.iof.totalCents, 9418273)
  assert.equal(r.cashFlows.slice(1).reduce((sum, row) => sum + row.iofPaidCents, 0), 0)
  assert.equal(r.cashFlows.reduce((sum, row) => sum + row.feeCents, 0), 220000)
  assert.equal(r.cashFlows.slice(1).reduce((sum, row) => sum + row.cashOutCents, 0), 384517058)
  assert.equal(r.rows.reduce((sum, row) => sum + row.interestCents, 0), 84297058)
  assert.equal(r.firstCashOutCents, 15472044)
})
test('UI executa motores corretos e separa seus limites em vez de expor números estáticos como cálculo', () => {
  assert.match(source('BndesCreditoTfb.jsx'), /reconcileCreditoPequenasEmpresas\(input\)/)
  assert.match(source('BndesCreditoTfb.jsx'), /result\.rows\.map/)
  assert.match(source('BndesCreditoTfb.jsx'), /result\.cashFlows\.map/)
  assert.match(source('BndesCreditoTfb.jsx'), /Não é cotação atual/)
  assert.match(source('BndesTlpExigivel.jsx'), /simulateTlpExigivel\(/)
  assert.match(source('BndesTlpExigivel.jsx'), /mode: 'projection'/)
  assert.match(source('BndesTlpExigivel.jsx'), /Não é TLPCAP nem CET/)
})
test('Finame nunca executa TLP pelo motor mensal capitalizado', () => {
  assert.equal(finameFundingOption('tlp').mode, 'dedicated')
  assert.equal(finameFundingAnnualRate('tlp', { tlp: 8.12 }), null)
  assert.match(source('FinameMateriais.jsx'), /const pronto = funding\?\.mode === 'inline'/)
  assert.doesNotMatch(source('FinameMateriais.jsx'), /na TLP, iguais em termos reais|a diferença se compensa|correção pelo IPCA \(TLP\) \+ IOF/)
  assert.doesNotMatch(source('FinameMateriais.jsx'), /id="fm-finame-eligible"/)
})
test('rotas de calculadoras e atalhos não confundem produtos', async () => {
  const { documents } = await buildSearchIndex()
  for (const [command, view] of [['TLPEXIGIVEL', 'bndes-tlp-exigivel'], ['CREDITOTFB', 'bndes-credito-tfb']]) {
    assert.deepEqual(parseCommand(command), { kind: 'tab', id: 'calculadora', sub: view })
    assert.match(source('Calculadora.jsx'), new RegExp(`view === '${view}'`))
    assert.ok(documents.some(doc => doc.route === 'calculadora/' + view))
  }
  assert.ok(documents.some(doc => doc.route === 'calculadora/finame-materiais'))
})
