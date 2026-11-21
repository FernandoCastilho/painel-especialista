// Necessidade do Cliente no roteiro Demanda, Encargos, Resultado (21/11/2026; a linha do tempo saiu no mesmo dia).
// A tela só reordena e repete números que a conta já devolve. Aqui fica provado, chamando a conta de cada modalidade,
// que o que o quadro de respostas mostra fecha em centavos.
import test from 'node:test'
import assert from 'node:assert/strict'
import { MODALITIES, evaluateAll, evaluateColumn, initialShared, newColumn } from '../src/creditModalities.js'

const cents = value => Math.round(value * 100)
const shared = (extra = {}) => ({ ...initialShared('2026-11-21', '1.000.000,00'), ...extra })
const ctx = { cdi: 14.9 }

for (const { id, label } of MODALITIES) test(`respostas fecham em centavos: ${label}`, () => {
  const r = evaluateColumn({ ...newColumn(id), ...(id === 'finimp' ? { fDays: '180' } : {}), fees: '3.150,00', monthlyFees: '12,50' }, shared(), ctx)
  assert.equal(r.ok, true, r.error)
  // "Quanto custa", em reais: o que se paga menos o que entra no caixa.
  assert.equal(cents(r.cost), cents(r.paid) - cents(r.net))
  // "Quanto paga no total" = valor contratado + custo. No desconto de duplicata o total é o nominal dos títulos:
  // o custo já saiu na liberação, então total − líquido = custo.
  if (id === 'desconto') assert.equal(cents(r.total) - cents(r.net), cents(r.cost))
  else assert.equal(cents(r.total), cents(r.value) + cents(r.cost))
  // "Quanto entra no caixa" nunca passa do valor contratado; "Quanto paga por mês" é a primeira linha do cronograma.
  assert.ok(cents(r.net) <= cents(r.value) && r.net > 0)
  assert.equal(r.firstPayment, r.rows[0].payment)
  assert.equal(r.lastDate, r.rows.at(-1).date)
})

test('exemplo de abertura da tela: R$ 1 milhão, 24 meses, Price, prefixado a 1,45% a.m. e 100% do CDI + 0,35% a.m.', () => {
  const [pre, pos] = evaluateAll([newColumn('giro-pre'), newColumn('giro-cdi')], shared(), ctx)
  const answers = r => [r.net, r.firstPayment, r.total, r.cost].map(v => v.toFixed(2))
  assert.deepEqual(answers(pre), ['972343.78', '49756.95', '1221823.14', '221823.14'])
  assert.deepEqual(answers(pos), ['972347.19', '49940.08', '1226214.72', '226214.72'])
  assert.deepEqual([pre.cet, pos.cet, pos.projectedCost].map(v => (v * 100).toFixed(2)), ['22.60', '7.07', '23.07'])
})
