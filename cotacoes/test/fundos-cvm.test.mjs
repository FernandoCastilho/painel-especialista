import assert from 'node:assert/strict'
import test from 'node:test'
import { compareHistory, simulateHistory } from '../src/investmentHistory.js'
import { buscarFundos, cotasDoFundo, isFundoCvm } from '../src/fundosCvm.js'

const classe = ['cvm-c-00017024000153', 'Classe Crédito Privado', '00017024000153']
const subclasse = ['cvm-c-00017024000153-A1', 'Classe Crédito Privado — Varejo', '00017024000153']
const rows = [['2026-09-30', 100], ['2026-10-15', 102], ['2026-10-30', 105], ['2026-11-20', 110]]

test('a busca encontra nome sem acentos e CNPJ formatado, distinguindo subclasses', () => {
  assert.deepEqual(buscarFundos([classe, subclasse], 'credito  privado'), [classe, subclasse])
  assert.deepEqual(buscarFundos([classe, subclasse], '00.017.024/0001-53'), [classe, subclasse])
  assert.deepEqual(buscarFundos([classe, subclasse], 'varejo'), [subclasse])
  assert.ok(isFundoCvm(subclasse[0]))
  assert.ok(!isFundoCvm('cvm-c-00017024000153/..'))
})

test('cotas diárias preservam a subclasse e alimentam comparação e carteira por mês fechado', () => {
  const item = cotasDoFundo({ [subclasse[0]]: rows, [classe[0]]: [['2026-10-30', 999]] }, subclasse)
  assert.deepEqual(item.rows, rows)
  const cdi = { id: 'cdi', currency: 'BRL', rows: [['2026-09-30', 1], ['2026-10-30', 1.01]] }
  const comparison = compareHistory([item, cdi], 6, 'BRL', {}, '2026-11')
  assert.deepEqual(comparison.timeline, ['2026-09', '2026-10'])
  assert.deepEqual(comparison.tracks[0].values, [1, 1.05])
  assert.deepEqual(simulateHistory(comparison.tracks, [500, 500]), [1, 1.03])
})

test('cotas inválidas, duplicadas ou indisponíveis não viram série de investimento', () => {
  assert.throws(() => cotasDoFundo({}, classe), /cotas/)
  assert.throws(() => cotasDoFundo({ [classe[0]]: [...rows, rows.at(-1)] }, classe), /cotas/)
  assert.throws(() => cotasDoFundo({ [classe[0]]: [...rows, ['2026-11-31', 5]] }, classe), /cotas/)
})
