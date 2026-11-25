import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bcbSeries, parseSeriesCsv, compareHistory, compareDailyHistory, metrics, simulateHistory, comparisonCsv, loadBcb,
} from '../src/investmentHistory.js'

const rows = values => values.map((value, i) => ['2025-0' + (i + 1) + '-28', value])
const item = (id, currency, values) => ({ id, name: id, currency, rows: rows(values) })
const closeTo = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-10, value + ' ≠ ' + expected)

test('SGS: compõe CDI diário, alinha IPCA ao fim do mês e conserva cotações', () => {
  const input = [{ data: '01/02/2025', valor: '2' }, { data: '01/01/2025', valor: '1' }]
  assert.deepEqual(bcbSeries(input, 'level', '2025-04-10'), rows([1, 2]).map(([date, value]) => [date.slice(0, 8) + '01', value]))
  const daily = bcbSeries(input, 'daily-rate', '2025-04-10')
  closeTo(daily[1][1] / daily[0][1] - 1, 0.02)
  assert.deepEqual(bcbSeries(input, 'monthly-rate', '2025-02-15'), [['2025-01-31', 1.01]])
})

test('SGS: consulta usa intervalo delimitado e rejeita resposta inválida', async () => {
  await assert.rejects(loadBcb({ code: 12, kind: 'daily-rate' }, '2025-04-10', undefined, async url => {
    const data = new URL(url)
    assert.equal(data.searchParams.get('dataInicial'), '01/01/2019')
    assert.equal(data.searchParams.get('dataFinal'), '10/04/2025')
    return { ok: true, json: async () => [{ data: '01/01/2025', valor: '' }] }
  }), /Série inválida/)
})

test('CSV: aceita padrão brasileiro, rejeita datas inválidas ou repetidas e separador ambíguo', () => {
  assert.deepEqual(parseSeriesCsv('data;valor\n2025-02-28;101,50\n2025-01-31;100,00'), [
    ['2025-01-31', 100], ['2025-02-28', 101.5],
  ])
  assert.throws(() => parseSeriesCsv('data;valor\n2025-02-30;1\n2025-03-31;2'))
  assert.throws(() => parseSeriesCsv('data;valor\n2025-02-28;1\n2025-02-28;2'))
  assert.throws(() => parseSeriesCsv('data;valor\n2025-01-31;0,00000000000001\n2025-02-28;10'))
  assert.throws(() => parseSeriesCsv('data,valor\n2025-02-28,1,2\n2025-03-31,1'))
})

test('comparação: converte moeda, alinha o início e não usa o mês corrente nem preenche lacunas', () => {
  const selected = [item('BR', 'BRL', [100, 110, 121, 115]), item('EUA', 'USD', [10, 10, 11, 200])]
  const result = compareHistory(selected, 6, 'EUR', { USD: rows([5, 5.5, 6]), EUR: rows([6, 6, 6]) }, '2025-04')
  assert.deepEqual(result.timeline, ['2025-01', '2025-02', '2025-03'])
  assert.equal(result.fullPeriod, false)
  assert.equal(result.endsEarly, false)
  assert.equal(compareHistory(selected.slice(0, 1), 6, 'BRL', {}, '2025-07').endsEarly, true)
  closeTo(result.tracks[1].values[2], 1.32)
  selected[1].rows.splice(1, 1)
  assert.equal(compareHistory(selected, 6, 'BRL', { USD: rows([5, 5.5, 6]) }, '2025-04'), null)
})

test('risco e carteira: usa posições iniciais fixas, volatilidade mensal anualizada e pico anterior', () => {
  const portfolio = simulateHistory([{ values: [1, 1.2, 1] }, { values: [1, 1, 0.9] }], [100, 300])
  assert.deepEqual(portfolio, [1, 1.05, 0.925])
  const risk = metrics(portfolio)
  closeTo(risk.total, -0.075)
  closeTo(risk.drawdown, 0.925 / 1.05 - 1)
  closeTo(risk.volatility, Math.abs(0.05 - (0.925 / 1.05 - 1)) * Math.sqrt(6))
  assert.equal(metrics([1, 1.05]).volatility, null)
  assert.equal(simulateHistory([{ values: [1, 2] }], [NaN]), null)
  assert.equal(simulateHistory([{ values: [1, 2] }], [0]), null)
  assert.equal(simulateHistory([{ values: [1, 2] }], [1e308]), null)
})

test('gráfico diário usa a data exata, inclui o mês em curso e deixa a cota ausente em branco', () => {
  const cdi = { id: 'cdi', name: 'CDI', currency: 'BRL', rows: [
    ['2025-10-31', 100], ['2025-11-03', 101], ['2025-11-04', 102], ['2025-11-05', 103],
  ] }
  const fundo = { id: 'fundo', name: 'Fundo', currency: 'BRL', rows: [
    ['2025-11-03', 50], ['2025-11-04', 55],
  ] }
  const result = compareDailyHistory([cdi, fundo], 6, 'BRL', {})
  assert.equal(result.start, '2025-11-03')
  assert.deepEqual(result.timeline, ['2025-11-03', '2025-11-04', '2025-11-05'])
  closeTo(result.tracks[0].changes[0], 0.01)
  closeTo(result.tracks[1].changes[1], 0.1)
  closeTo(result.tracks[1].values[1], 1.1)
  assert.equal(result.tracks[1].values[2], null)
  assert.equal(result.tracks[1].changes[2], null)
  assert.match(comparisonCsv(result, 'BRL'), /^"Data";.*\r\n[\s\S]*"2025-11-05";"BRL";[^;]+;$/)
})

test('gráfico usa referência mensal sem inventar IPCA diário e exige câmbio na data do ponto', () => {
  const base = { id: 'dolar', name: 'Dólar', currency: 'USD', rows: [
    ['2025-10-31', 10], ['2025-11-03', 11], ['2025-11-04', 12], ['2025-11-05', 13], ['2025-11-28', 14],
  ] }
  const ipca = { id: 'ipca', name: 'IPCA', kind: 'monthly-rate', currency: 'BRL', rows: [
    ['2025-10-31', 100], ['2025-11-30', 101],
  ] }
  const result = compareDailyHistory([base, ipca], 6, 'BRL', { USD: [
    ['2025-10-31', 5], ['2025-11-03', 6], ['2025-11-05', 7], ['2025-11-28', 7],
  ] })
  assert.deepEqual(result.timeline, ['2025-10-31', '2025-11-03', '2025-11-05', '2025-11-28', '2025-11-30'])
  closeTo(result.tracks[0].values[1], 1.32)
  assert.equal(result.tracks[0].changes[2], null)
  closeTo(result.tracks[1].values.at(-1), 1.01)
  assert.ok(result.tracks[1].changes.every(change => change === null))
})

test('CSV exportado protege nomes de fórmulas e preserva sinais dos retornos', () => {
  const csv = comparisonCsv({ timeline: ['2025-01', '2025-02'], tracks: [{ name: '=2+2', values: [1, 0.9] }] }, 'BRL')
  assert.match(csv, /"'=2\+2 \(%\)"/)
  assert.match(csv, /-10,000000$/)
})
