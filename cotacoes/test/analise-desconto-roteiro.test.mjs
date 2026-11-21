// Análise de desconto no roteiro Demanda, Encargos, Linha do tempo, Resultado (21/11/2026).
// A tela só reparte e reordena números que a conta já devolve; aqui fica provado que as repartições novas fecham.
// A conta do desconto não arredonda no meio do caminho (só a tela arredonda, para centavos). Por isso a soma exata fecha
// sempre, e a soma dos valores já arredondados pode diferir do total em até 2 centavos, como já acontecia com
// bruto − custo = líquido e subtotal + tarifa = custo total na tela anterior.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { discountOperation } from '../src/analiseDesconto.js'

const cents = value => Math.round(value * 100)
const close = (a, b) => Math.abs(a - b) < 1e-6
const base = { titleRows: [{ value: 225600.43, count: 30, dueDate: '2026-12-05' }], date: '2026-11-05', rate: 1.83, feeMode: 'total', fee: 564, tac: 260 }
const cases = [
  ['exemplo de abertura, tarifa total', {}],
  ['tarifa unitária', { feeMode: 'unit', fee: 18.8 }],
  ['tarifa percentual', { feeMode: 'percent', fee: 0.25 }],
  ['desconto racional (por dentro)', { convention: 'rational30' }],
  ['Simples confirmado até R$ 30 mil', { titleRows: [{ value: 28750.9, count: 4, dueDate: '2026-12-21' }], taxProfile: 'simples', eligible: true }],
  ['três grupos com vencimentos diferentes', { titleRows: [{ value: 80000.17, count: 10, dueDate: '2026-12-05' }, { value: 45310.4, count: 6, dueDate: '2027-01-20' }, { value: 12999.99, count: 1, dueDate: '2027-03-15' }] }],
  ['sem TAC e sem tarifa', { fee: 0, tac: 0 }],
]

for (const [name, extra] of cases) test(`resultado do desconto fecha: ${name}`, () => {
  const r = discountOperation({ ...base, ...extra })
  assert.equal(r.ok, true)
  // "Do que é feito o custo": juros + IOF + tarifa dos títulos + TAC = custo total completo.
  assert.ok(close(r.interest + r.iof + r.titleFee + r.tac, r.cost))
  assert.ok(Math.abs(cents(r.interest) + cents(r.iof) + cents(r.titleFee) + cents(r.tac) - cents(r.cost)) <= 2, 'valores arredondados: no máximo 2 centavos')
  // Linha "Subtotal sem tarifa de títulos (TAC + juros + IOF)".
  assert.ok(close(r.tac + r.interest + r.iof, r.costWithoutTitles))
  // Linha do tempo, operação: títulos menos o que é descontado = o que entra no caixa.
  assert.ok(close(r.value - r.cost, r.net))
  // Base do IOF: nominal menos juros antecipados.
  assert.ok(close(r.value - r.interest, r.base))
  // Linha do tempo, vencimento: o que vence é o valor bruto dos títulos; datas e dias vêm de cada grupo.
  assert.ok(close(r.rows.reduce((sum, row) => sum + row.value, 0), r.value))
  assert.equal(r.rows.reduce((sum, row) => sum + row.count, 0), r.titles)
  for (const row of r.rows) assert.ok(row.paymentDate >= row.dueDate && row.days > 0)
})

test('exemplo de abertura da tela fecha em centavos e repete os números de antes', () => {
  const r = discountOperation(base)
  const shown = [r.interest, r.iof, r.titleFee, r.tac, r.cost, r.costWithoutTitles, r.net, r.base].map(cents)
  assert.deepEqual(shown, [440372, 142097, 56400, 26000, 664869, 608469, 21895174, 22119671])
  assert.equal(shown[0] + shown[1] + shown[2] + shown[3], shown[4], 'juros + IOF + tarifa + TAC = custo total')
  assert.equal(cents(r.value) - shown[4], shown[6], 'títulos − custo = líquido')
  assert.equal(shown[5] + shown[2], shown[4], 'subtotal + tarifa = custo total')
  // Linha do tempo: 05/12/2026 é sábado; o título é pago em 07/12, 32 dias corridos depois da operação.
  assert.deepEqual(r.rows.map(row => [row.paymentDate, row.days, row.adjusted]), [['2026-12-07', 32, true]])
  assert.equal((r.cet * 100).toFixed(2), '41.45')
  assert.equal((r.termCost * 100).toFixed(2), '40.66')
})

test('a tela usa as peças e os nomes do roteiro, e a comparação com o giro não leva número', async () => {
  // A ordem dos blocos na tela montada é conferida em analise-desconto-view.test.mjs.
  const source = await readFile(new URL('../src/AnaliseDesconto.jsx', import.meta.url), 'utf8')
  for (const piece of ["step(1, 'Demanda do cliente')", "step(2, 'Encargos')", '<LinhaDoTempo ', '<Resultado ']) assert.ok(source.includes(piece), piece)
  for (const question of ['Quanto entra no caixa', 'Quanto é descontado', 'Quanto custa']) assert.ok(source.includes(`'${question}'`), question)
  for (const part of ['Juros', 'IOF', 'Tarifa dos títulos', 'TAC']) assert.ok(source.includes(`{ label: '${part}', value: operation?.`), part)
  assert.doesNotMatch(source, /<h3>\d\. /)
  assert.doesNotMatch(source, /Tarifa de contratação por operação \(TAC\)|Valor bruto dos títulos/)
})
