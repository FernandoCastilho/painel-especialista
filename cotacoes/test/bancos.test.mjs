import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { BANKS, latestBankPoint, metricChange, bankComparison, bankSummary, shiftQuarter } from '../src/bancos.js'
import { normalizeBankQuarter } from '../scripts/bancos-lib.mjs'

const point = (period, origin, value, basis = 'same') => ({ period, origin, metrics: { basel: { value, basis } } })
test('seção Bancos mantém os sete bancos solicitados, sem ABC e Daycoval', () => {
  assert.deepEqual(BANKS.map(bank => bank.id), ['itau', 'bb', 'bradesco', 'santander', 'caixa', 'safra', 'btg'])
  assert.ok(BANKS.every(bank => bank.logo === `bank-logos/${bank.id}.png`))
})
test('latest result selects per bank; BC view keeps the original quarter; no older metric fills a new release', () => {
  const bank = { observations: [{ ...point(202606, 'bc', 15), metrics: { assets: { value: 9e9 } } }], releases: [point(202609, 'ri', 16)] }
  assert.equal(latestBankPoint(bank).period, 202609)
  assert.equal(latestBankPoint(bank, 'bc').period, 202606)
  assert.equal(latestBankPoint(bank).metrics.assets, undefined)
})
test('percentage points, rounding and absent/zero values remain distinct', () => {
  assert.equal(metricChange(point(202609, 'ri', 15.3), point(202606, 'ri', 15.4), 'basel').unit, 'p.p.')
  assert.equal(metricChange(point(202609, 'ri', 15.400001), point(202606, 'ri', 15.4), 'basel').direction, 'estável')
  assert.equal(metricChange(point(202609, 'ri', 0), point(202606, 'ri', null), 'basel'), null)
  assert.equal(metricChange(point(202609, 'ri', 0), point(202606, 'ri', 1), 'basel').direction, 'caiu')
  assert.equal(metricChange(point(202609, 'ri', 1), point(202606, 'ri', 1, 'different'), 'basel'), null)
})
test('no growth or provision score; lower delinquency improves; exact quarter and origin required', () => {
  const a = point(202609, 'ri', 16), b = point(202606, 'bc', 15)
  assert.equal(bankComparison({ observations: [b] }, a, -1), null)
  assert.equal(shiftQuarter(202603, -1), 202512)
  assert.equal(shiftQuarter(202609, -4), 202509)
  const p = v => ({ metrics: { nplTotal: { value: v, basis: 'npl' }, creditPJ: { value: v, basis: 'pj' } } })
  assert.equal(metricChange(p(2), p(3), 'nplTotal').assessment, 'melhora')
  assert.equal(metricChange(p(4), p(3), 'creditPJ').assessment, 'neutro')
  assert.match(bankSummary({ observations: [] }, a), /Sem base equivalente/)
})
test('Cosif quarter profit subtracts the first quarter; expected loss uses matching gross scope', () => {
  const row = (Conta, Saldo) => ({ CodInst: BANKS[0].code, Conta, Saldo })
  const reports = { '1': [row('141870', 100), row('79664', .15)], '2': [row('140202', -2), row('140208', 0), row('140213', -3), row('145832', 0), row('140201', 50), row('140207', 0), row('140212', 50), row('145831', 0)], '11': [row('24452', 30)], '13': [row('24453', 70)], '16': [row('148834', 5), row('24454', 100)] }
  const previous = { '1': [row('141870', 40)] }
  const result = normalizeBankQuarter(202606, reports, previous)[0]
  assert.equal(result.metrics.profit.value, 60)
  assert.equal(result.metrics.basel.value, 15)
  assert.equal(result.metrics.provisionTotal.value, 5)
  assert.equal(result.metrics.provisionRatioTotal.value, 5)
  assert.equal(result.metrics.nplTotal.value, 5)
  assert.equal(result.metrics.provisionPF, undefined)
  assert.equal(normalizeBankQuarter(202606, reports)[0].metrics.profit, undefined)
  reports['2'].pop()
  assert.equal(normalizeBankQuarter(202606, reports)[0].metrics.provisionRatioTotal, undefined)
})
test('published snapshot covers selected banks with finite, source-backed values and exact quarters', async () => {
  const data = JSON.parse(await readFile(new URL('../public/bancos.json', import.meta.url)))
  assert.equal(new Set(data.banks.map(b => b.id)).size, data.banks.length)
  assert.ok(BANKS.every(bank => data.banks.some(item => item.id === bank.id)))
  for (const bank of data.banks) {
    assert.ok(latestBankPoint(bank)?.metrics.basel)
    assert.ok(latestBankPoint(bank)?.metrics.roe, bank.name + ': ROE deve ter fonte e critério explícitos')
    for (const p of [...bank.observations, ...bank.releases]) {
      assert.ok([3, 6, 9, 12].includes(p.period % 100))
      for (const m of Object.values(p.metrics)) {
        assert.ok(Number.isFinite(m.value)); assert.match(m.source, /^https:\/\//); assert.ok(m.basis)
      }
    }
  }
})

// Conferência independente nas imagens do relatório Bradesco: páginas 7 e 13.
test('Bradesco uses PF dashed red NPL and quarterly solid gray ROAE, excluding MPME and pro forma lines', async () => {
  const data = JSON.parse(await readFile(new URL('../public/bancos-ri.json', import.meta.url)))
  const points = data.banks.bradesco
  assert.deepEqual(points.map(p => p.metrics.nplPF.value), [5.8, 5.5, 5.4])
  assert.deepEqual(points.map(p => p.metrics.roe.value), [15.6, 16.2, 14.7])
  assert.ok(points.every(p => p.metrics.nplPF.page === 13 && p.metrics.roe.page === 7))
})
