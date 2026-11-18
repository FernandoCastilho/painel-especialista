import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { readCvmRows, cvmValue, buildBankCvm, mergeBankCvm, cvmZipUrl } from '../scripts/cvm-lib.mjs'
import { cvmSeries, cvmYearOverYear, CVM_BANKS, CVM_METRICS } from '../src/bancosCvm.js'

const header = 'CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;GRUPO_DFP;MOEDA;ESCALA_MOEDA;ORDEM_EXERC;DT_INI_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;ST_CONTA_FIXA'
const line = (cvm, version, order, ini, end, code, name, value, scale = 'MIL') => `1;${end};${version};X;${String(cvm).padStart(6, '0')};g;REAL;${scale};${order};${ini};${end};${code};${name};${value};S`
const csv = lines => [header, ...lines].join('\n')
const bank = { id: 'itau', name: 'Itaú', cvmCode: 19348 }

test('leitura: só os bancos pedidos, escala MIL vira reais, escala desconhecida é recusada', () => {
  const rows = readCvmRows(csv([line(19348, 1, 'ÚLTIMO', '', '2025-12-31', '1', 'Ativo Total', '3000'), line(999, 1, 'ÚLTIMO', '', '2025-12-31', '1', 'Ativo Total', '5')]), [19348])
  assert.equal(rows.length, 1)
  assert.equal(cvmValue(rows[0]), 3_000_000)
  assert.equal(cvmValue({ value: '7', scale: 'UNIDADE' }), 7)
  assert.throws(() => cvmValue({ value: '7', scale: 'MILHAO' }), /Escala/)
  assert.throws(() => readCvmRows('A;B\n1;2', [1]), /Layout/)
})

test('indicadores são reconhecidos pelo nome da conta, mesmo com código diferente entre bancos', () => {
  const rowsOf = (plPatrimonio, plFunding) => csv([
    line(19348, 1, 'ÚLTIMO', '', '2025-12-31', '1', 'Ativo Total', '100'),
    line(19348, 1, 'ÚLTIMO', '', '2025-12-31', plFunding, 'Passivos Financeiros ao Custo Amortizado', '60'),
    line(19348, 1, 'ÚLTIMO', '', '2025-12-31', plPatrimonio, 'Patrimônio Líquido Consolidado', '30'),
    line(19348, 1, 'ÚLTIMO', '', '2025-12-31', '2.03', 'Provisões', '999'),
  ])
  for (const [pl, funding] of [['2.08', '2.03'], ['2.07', '2.02']]) {
    const dfpRows = readCvmRows(rowsOf(pl, funding), [19348])
    const point = buildBankCvm(bank, { dfp: { 2025: dfpRows }, itr: {} }).quarterly.find(p => p.period === 202512)
    assert.equal(point.metrics.assets, 100_000)
    assert.equal(point.metrics.equity, 30_000)
    assert.equal(point.metrics.funding, 60_000)
  }
  assert.ok(CVM_METRICS.profit.match('3.09', 'Lucro/Prejuízo Consolidado do Período'))
  assert.ok(CVM_METRICS.profit.match('3.11', 'Lucro ou Prejuízo Líquido Consolidado do Período'))
  assert.ok(!CVM_METRICS.profit.match('3.09', 'Lucro ou Prejuízo antes das Participações e Contribuições'))
})

test('4º trimestre = ano menos nove meses, marcado como calculado; saldos vêm do fim do período', () => {
  const dfp = readCvmRows(csv([
    line(19348, 1, 'ÚLTIMO', '2025-01-01', '2025-12-31', '3.09', 'Lucro/Prejuízo Consolidado do Período', '45849'),
    line(19348, 1, 'ÚLTIMO', '2025-01-01', '2025-12-31', '3.01', 'Receitas da Intermediação Financeira', '387118'),
    line(19348, 1, 'ÚLTIMO', '', '2025-12-31', '1', 'Ativo Total', '3066169'),
  ]), [19348])
  const itr = readCvmRows(csv([
    line(19348, 1, 'ÚLTIMO', '2025-01-01', '2025-09-30', '3.09', 'Lucro/Prejuízo Consolidado do Período', '33705'),
    line(19348, 1, 'ÚLTIMO', '2025-07-01', '2025-09-30', '3.09', 'Lucro/Prejuízo Consolidado do Período', '11600'),
    line(19348, 1, 'ÚLTIMO', '2025-01-01', '2025-09-30', '3.01', 'Receitas da Intermediação Financeira', '289654'),
    line(19348, 1, 'PENÚLTIMO', '2024-07-01', '2024-09-30', '3.09', 'Lucro/Prejuízo Consolidado do Período', '10595'),
    line(19348, 1, 'ÚLTIMO', '', '2025-09-30', '1', 'Ativo Total', '2969351'),
  ]), [19348])
  const out = buildBankCvm(bank, { dfp: { 2025: dfp }, itr: { 2025: itr } })
  const q3 = out.quarterly.find(p => p.period === 202509), q4 = out.quarterly.find(p => p.period === 202512)
  assert.equal(q3.metrics.profit, 11_600_000, 'usa o trimestre isolado, não o acumulado nem o ano anterior')
  assert.equal(q4.metrics.profit, (45849 - 33705) * 1000)
  assert.deepEqual(q4.derived.sort(), ['profit', 'revenue'])
  assert.equal(q4.metrics.assets, 3_066_169_000)
  assert.equal(out.annual[0].metrics.profit, 45_849_000)
})

test('reapresentação: vale a versão mais alta; sem nove meses não há 4º trimestre inventado', () => {
  const rows = readCvmRows(csv([
    line(19348, 1, 'ÚLTIMO', '', '2025-12-31', '1', 'Ativo Total', '100'),
    line(19348, 2, 'ÚLTIMO', '', '2025-12-31', '1', 'Ativo Total', '110'),
    line(19348, 2, 'ÚLTIMO', '2025-01-01', '2025-12-31', '3.09', 'Lucro/Prejuízo Consolidado do Período', '50'),
  ]), [19348])
  const out = buildBankCvm(bank, { dfp: { 2025: rows }, itr: {} })
  assert.equal(out.annual[0].metrics.assets, 110_000)
  assert.equal(out.quarterly[0].metrics.profit, undefined)
})

test('conta duplicada com valores diferentes não é publicada', () => {
  const rows = readCvmRows(csv([
    line(19348, 1, 'ÚLTIMO', '', '2025-12-31', '1', 'Ativo Total', '100'),
    line(19348, 1, 'ÚLTIMO', '', '2025-12-31', '1', 'Ativo Total', '101'),
  ]), [19348])
  assert.equal(buildBankCvm(bank, { dfp: { 2025: rows }, itr: {} }).annual.length, 0)
})

test('junção preserva períodos antigos e deixa o dado novo vencer', () => {
  const merged = mergeBankCvm(
    { annual: [{ year: 2023, metrics: { assets: 1 } }, { year: 2024, metrics: { assets: 2 } }], quarterly: [] },
    { id: 'itau', annual: [{ year: 2024, metrics: { assets: 3 } }], quarterly: [{ period: 202603, metrics: { assets: 9 } }] })
  assert.deepEqual(merged.annual.map(p => [p.year, p.metrics.assets]), [[2023, 1], [2024, 3]])
  assert.equal(merged.quarterly.length, 1)
})

test('séries e variação: só comparam períodos equivalentes, sem estimar lacunas', () => {
  const b = { annual: [{ year: 2023, metrics: { assets: 100 } }, { year: 2024, metrics: { assets: 110 } }, { year: 2026, metrics: { assets: 150 } }],
    quarterly: [{ period: 202503, metrics: { profit: 10 } }, { period: 202603, metrics: { profit: 12 } }, { period: 202606, metrics: { profit: 5 } }] }
  const annual = cvmSeries(b, 'assets', 'annual')
  assert.deepEqual(cvmYearOverYear(annual, 'annual').map(v => v === null ? null : Math.round(v)), [null, 10, null])
  const quarterly = cvmSeries(b, 'profit', 'quarterly')
  assert.deepEqual(cvmYearOverYear(quarterly, 'quarterly'), [null, null, null], 'trimestres não consecutivos não viram comparação anual')
  assert.equal(cvmSeries(b, 'equity', 'annual')[0].value, null)
})

test('endereço da CVM é oficial e fixo', () => {
  assert.equal(cvmZipUrl('dfp', 2025), 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS/dfp_cia_aberta_2025.zip')
  assert.equal(cvmZipUrl('ITR', 2026), 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_2026.zip')
})

test('base publicada: bancos do catálogo, contas fecham e valores são plausíveis', async () => {
  const data = JSON.parse(await readFile(new URL('../public/bancos-cvm.json', import.meta.url)))
  assert.deepEqual(data.banks.map(b => b.id).sort(), CVM_BANKS.map(b => b.id).sort())
  for (const b of data.banks) {
    assert.ok(b.annual.length >= 3, `${b.id}: três anos`)
    for (const p of [...b.annual, ...b.quarterly]) {
      const { assets, equity, funding } = p.metrics
      assert.ok(assets > 1e11, `${b.id}: ativo em reais, não em milhares`)
      if (equity != null) assert.ok(equity > 0 && equity < assets, `${b.id}: patrimônio dentro do ativo`)
      if (funding != null) assert.ok(funding < assets, `${b.id}: passivo dentro do ativo`)
    }
  }
  const itau = data.banks.find(b => b.id === 'itau')
  assert.equal(Math.round(itau.annual.find(p => p.year === 2025).metrics.assets / 1e9), 3066)
})
