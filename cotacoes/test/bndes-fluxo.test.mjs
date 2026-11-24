import test from 'node:test'
import assert from 'node:assert/strict'
import { linhasDoFluxoBndes } from '../src/bndesFluxo.js'

const parcelas = [
  { mes: 1, vencimento: '2026-02-15', parcela: 0, juros: 10, amortizacao: 0, carencia: true },
  { mes: 2, vencimento: '2026-03-15', parcela: 25, juros: 25, amortizacao: 0, carencia: true },
  { mes: 3, vencimento: '2026-04-15', parcela: 120, juros: 20, amortizacao: 100, carencia: false },
  { mes: 4, vencimento: '2026-05-15', parcela: 110, juros: 10, amortizacao: 100, carencia: false },
]

test('remove meses de carência sem pagamento e preserva pagamentos só de juros', () => {
  const rows = linhasDoFluxoBndes(parcelas)
  assert.deepEqual(rows.map(row => row.number), [1, 2, 3])
  assert.deepEqual(rows[0], {
    number: 1, date: '2026-03-15', payment: 25, interest: 25,
    amortization: 0, juros: true, fixed: false,
  })
})

test('soma pagamentos e calcula principal a partir de parcela menos juros', () => {
  const rows = linhasDoFluxoBndes(parcelas)
  assert.equal(rows.reduce((sum, row) => sum + row.payment, 0), 255)
  assert.equal(rows[2].amortization, 100)
})

test('mantém correção embutida no principal apresentado em cronograma pós-fixado', () => {
  const [row] = linhasDoFluxoBndes([{ vencimento: '2026-04-15', parcela: 130, juros: 30, correcao: 10, carencia: false }])
  assert.equal(row.amortization, 100)
  assert.equal(row.payment - row.interest, 100)
})
