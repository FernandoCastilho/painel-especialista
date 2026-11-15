import test from 'node:test'
import assert from 'node:assert/strict'
import { curveTable, prazoEmPortugues, PRAZOS_BR } from '../src/curveTable.js'
import { horizonTable } from '../src/cdiFuturo.js'

const compare = [{ id: 'hoje', label: 'Último dia', date: '2026-10-26' }, { id: 'm1', label: '1 mês', date: '2026-09-25' }]

test('curvas em tabela (Brasil): prazos padrão, valor do próprio vértice e interpolação linear sem extrapolar', () => {
  const set = { compare, curves: { '2026-10-26': [[21, 14.9], [126, 14.5], [252, 14], [756, 13]], '2026-09-25': [[126, 14.7], [252, 14.2]] } }
  const t = curveTable(set, 'br')
  assert.deepEqual(t.columns, [{ date: '2026-10-26', label: 'Último dia', small: '26/10/2026' }, { date: '2026-09-25', label: '1 mês', small: '25/09/2026' }])
  const by = Object.fromEntries(t.rows.map((r) => [r.name, r]))
  assert.equal(by['1 ano'].values[0], 14) // vértice exato: sem conta
  assert.equal(by['1 ano'].sub, '252 dias úteis')
  assert.equal(by['2 anos'].values[0], 13.5) // meio do caminho entre 252 (14%) e 756 (13%)
  assert.ok(Math.abs(by['3 meses'].values[0] - (14.9 + (14.5 - 14.9) * (63 - 21) / (126 - 21))) < 1e-9)
  assert.equal(by['1 mês'].values[1], null) // a curva antiga começa em 126 d.u.: sem valor, não extrapola
  assert.equal(by['6 meses'].values[1], 14.7)
  assert.equal(by['5 anos'], undefined) // além do último vértice da curva mais recente: a linha não entra
  assert.deepEqual(t.rows.map((r) => r.name), PRAZOS_BR.filter((p) => p.du >= 21 && p.du <= 756).map((p) => p.label))
})

test('curvas em tabela (EUA e euro): um vencimento por linha, casado pelo prazo exato em cada data', () => {
  const set = { compare, curves: { '2026-10-26': [[1, 4.04, '1 Yr'], [0.25, 4.08, '3 Mo'], [10, 4.2, '10 Yr']], '2026-09-25': [[0.25, 4.1, '3 Mo'], [10, 4.3, '10 Yr']] } }
  const t = curveTable(set, 'us')
  assert.deepEqual(t.rows.map((r) => r.name), ['3 meses', '1 ano', '10 anos'])
  assert.deepEqual(t.rows.map((r) => r.values), [[4.08, 4.1], [4.04, null], [4.2, 4.3]])
})

test('curvas em tabela: sem dado não inventa linha nem coluna', () => {
  assert.deepEqual(curveTable(null, 'br'), { columns: [], rows: [] })
  assert.deepEqual(curveTable({ compare, curves: {} }, 'us'), { columns: [], rows: [] })
  // data de comparação sem curva some das colunas
  assert.equal(curveTable({ compare, curves: { '2026-10-26': [[21, 14], [252, 13]] } }, 'br').columns.length, 1)
})

test('rótulos de vencimento da fonte em português', () => {
  assert.equal(prazoEmPortugues('1 Mo'), '1 mês')
  assert.equal(prazoEmPortugues('6 Mo'), '6 meses')
  assert.equal(prazoEmPortugues('1 Yr'), '1 ano')
  assert.equal(prazoEmPortugues('30 Yr'), '30 anos')
  assert.equal(prazoEmPortugues('1,5 Yr'), '1,5 anos')
  assert.equal(prazoEmPortugues('3M'), '3 meses')
  assert.equal(prazoEmPortugues('30A'), '30 anos')
  assert.equal(prazoEmPortugues('Overnight'), 'Overnight')
})

test('CDI futuro na tabela da página usa a mesma conta da tela de detalhe', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../src/CdiFuturo.jsx', import.meta.url), 'utf8')
  assert.equal(src.match(/horizonTable\(pts\)/g).length, 2) // tabela da página e tabela da tela de detalhe
  const rows = horizonTable([[63, 14.8], [126, 14.6], [252, 14.2]])
  assert.deepEqual(rows.map((r) => r.label), ['3 meses', '6 meses', '1 ano'])
  assert.equal(rows[0].fwd, null)
})
