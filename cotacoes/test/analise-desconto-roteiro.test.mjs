// Análise de desconto no roteiro Demanda, Encargos, Linha do tempo, Resultado (21/11/2026).
// A tela só reparte e reordena números que a conta já devolve; aqui fica provado que as repartições novas fecham.
// A conta do desconto não arredonda no meio do caminho (só a tela arredonda, para centavos). Por isso a soma exata fecha
// sempre, e a soma dos valores já arredondados pode diferir do total em até 2 centavos, como já acontecia com
// bruto − custo = líquido e subtotal + tarifa = custo total na tela anterior.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { discountOperation } from '../src/analiseDesconto.js'
import { sobraDeCentavos } from '../src/centavosDaTela.js'

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

// Quando as partes arredondadas não somam o total arredondado, a tela mostra uma linha "Arredondamento" com a soma das partes
// e a diferença, sem ajustar nenhum valor. Aqui os centavos "como aparecem na tela" são lidos do próprio texto formatado.
const shownCents = value => Number(value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/[^\d-]/g, ''))
const gapOf = r => sobraDeCentavos([r.interest, r.iof, r.titleFee, r.tac], r.cost)
const withTitles = value => discountOperation({ ...base, titleRows: [{ value, count: 30, dueDate: '2026-12-05' }] })

test('arredondamento: quando a soma das partes não fecha, a diferença é o total mostrado menos a soma das partes mostradas', () => {
  // R$ 123.456,78 em títulos: juros 2.409,88 + IOF 777,61 + tarifa 564,00 + TAC 260,00 = 4.011,49; custo total mostrado 4.011,48.
  const sobra = withTitles(123456.78), falta = withTitles(98765.43)
  assert.deepEqual([sobra.interest, sobra.iof, sobra.titleFee, sobra.tac, sobra.cost].map(shownCents), [240988, 77761, 56400, 26000, 401148])
  assert.deepEqual(gapOf(sobra), { sum: 4011.49, diff: -0.01 })
  // R$ 98.765,43 em títulos: 1.927,90 + 622,08 + 564,00 + 260,00 = 3.373,98; custo total mostrado 3.373,99.
  assert.deepEqual([falta.interest, falta.iof, falta.titleFee, falta.tac, falta.cost].map(shownCents), [192790, 62208, 56400, 26000, 337399])
  assert.deepEqual(gapOf(falta), { sum: 3373.98, diff: 0.01 })
})

test('arredondamento: no exemplo de abertura a soma fecha e não há linha a mostrar', () => {
  assert.equal(gapOf(discountOperation(base)), null)
  // Meio centavo: a tela mostra 1,005 como R$ 1,01 e 2,675 como R$ 2,68. A conferência segue a tela, não outra regra.
  assert.deepEqual([1.005, 2.675].map(shownCents), [101, 268])
  assert.equal(sobraDeCentavos([1.005, 2.675], 3.69), null)
  assert.deepEqual(sobraDeCentavos([1.005, 2.675], 3.68), { sum: 3.69, diff: -0.01 })
})

test('arredondamento: em 400 operações, a linha aparece só quando não fecha e sempre com a diferença exata da tela', () => {
  let open = 0
  for (let k = 0; k < 400; k++) {
    const r = withTitles(50000.37 + k * 913.71), gap = gapOf(r)
    const parts = [r.interest, r.iof, r.titleFee, r.tac].map(shownCents).reduce((sum, value) => sum + value, 0)
    if (shownCents(r.cost) === parts) assert.equal(gap, null)
    else { open++; assert.deepEqual(gap, { sum: parts / 100, diff: (shownCents(r.cost) - parts) / 100 }) }
  }
  assert.ok(open > 0 && open < 400, `casos com diferença: ${open}`)
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
