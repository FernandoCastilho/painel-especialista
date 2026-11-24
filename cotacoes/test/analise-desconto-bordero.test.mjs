// Análise de desconto por prazo médio (premissas de Fernando, 24/11/2026): com valor total, prazo médio e ticket médio,
// a calculadora monta um borderô hipotético e faz a mesma conta título a título. Aqui fica provado que o borderô fecha
// no que foi digitado e que juros, IOF e CET são os da conta de sempre, sem regra nova.
import test from 'node:test'
import assert from 'node:assert/strict'
import { DISCOUNT_INITIAL_FORM, discountOperation, hypotheticalTitles, parseDiscountForm } from '../src/analiseDesconto.js'

const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`)
const date = '2026-11-24'
const daysOf = row => (Date.parse(row.dueDate) - Date.parse(date)) / 86400000
const total = rows => rows.reduce((sum, row) => sum + row.value, 0)
const averageDays = rows => rows.reduce((sum, row) => sum + row.value * daysOf(row), 0) / total(rows)
const form = changes => parseDiscountForm({ ...DISCOUNT_INITIAL_FORM, date, titleFeeMode: 'total', ...changes })

test('borderô hipotético fecha no valor total, na quantidade, no ticket e no prazo médio digitados', () => {
  for (const [value, days, ticket, count] of [[225600.43, 30, 7520, 30], [225600.43, 60, 7520, 30], [50000, 45, 3333, 15], [1000, 2, 400, 3], [987654.32, 91, 1234.5, 800], [300000, 365, 100, 3000]]) {
    const h = hypotheticalTitles({ value, averageDays: days, ticket, date })
    assert.equal(h.ok, true)
    assert.equal(h.titles, count)
    assert.equal(h.titleRows.reduce((sum, row) => sum + row.count, 0), count)
    near(total(h.titleRows), value)
    near(h.ticket, value / count)
    near(averageDays(h.titleRows), days)
  }
})

test('vencimentos vão da metade a uma vez e meia do prazo médio, sempre depois da operação', () => {
  const h = hypotheticalTitles({ value: 225600.43, averageDays: 30, ticket: 7520, date })
  assert.equal(h.firstDays, 15)
  assert.equal(h.lastDays, 45)
  assert.deepEqual([daysOf(h.titleRows[0]), daysOf(h.titleRows.at(-1))], [15, 45])
  assert.ok(h.titleRows.every((row, index) => daysOf(row) >= 1 && (index === 0 || row.dueDate > h.titleRows[index - 1].dueDate)))
  // Um boleto só vence no próprio prazo médio, e é isso que a tela informa.
  const single = hypotheticalTitles({ value: 225600.43, averageDays: 30, ticket: 225600.43, date })
  assert.deepEqual([single.firstDays, single.lastDays, daysOf(single.titleRows[0])], [30, 30, 30])
  const short = hypotheticalTitles({ value: 9000, averageDays: 1, ticket: 3000, date })
  assert.deepEqual(short.titleRows.map(daysOf), [1])
  assert.equal(short.titleRows[0].count, 3)
})

test('quantidade de boletos arredonda o meio exato sempre para cima, sem ruído de ponto flutuante', () => {
  for (const [value, ticket, count] of [[0.35, 0.1, 4], [1.89, 0.54, 4], [35000, 10000, 4], [25000, 10000, 3], [24999.99, 10000, 2], [14999.99, 10000, 1]]) assert.equal(hypotheticalTitles({ value, averageDays: 30, ticket, date }).titles, count, `${value} ÷ ${ticket}`)
})

test('boletos têm valores bem variados, de metade a uma vez e meia do ticket médio, em sequência fixa', () => {
  const input = { value: 225600.43, averageDays: 30, ticket: 7520, date }
  const h = hypotheticalTitles(input)
  // A faixa vai de metade a uma vez e meia do ticket, e uma das pontas é sempre alcançada.
  assert.ok(h.minValue >= 0.5 * h.ticket - 1e-9 && h.maxValue <= 1.5 * h.ticket + 1e-9)
  assert.ok(Math.abs(h.minValue - 0.5 * h.ticket) < 1e-9 || Math.abs(h.maxValue - 1.5 * h.ticket) < 1e-9)
  const values = h.titleRows.map(row => row.value)
  assert.ok(values.every(value => value >= h.minValue - 1e-9 && value <= h.maxValue + 1e-9))
  // 30 boletos, 15 valores diferentes: cada valor aparece em dois boletos, um antes e outro depois do prazo médio.
  assert.equal(new Set(values.map(value => value.toFixed(2))).size, 15)
  assert.deepEqual(values.map(value => value.toFixed(6)), [...values].reverse().map(value => value.toFixed(6)))
  // Sem sorteio: a mesma entrada devolve sempre o mesmo borderô.
  assert.deepEqual(hypotheticalTitles(input), h)
  // Um boleto só, ou dois: não há como variar sem sair do ticket; ficam no ticket médio.
  for (const ticket of [225600.43, 112800]) { const few = hypotheticalTitles({ ...input, ticket }); near(few.minValue, few.ticket); near(few.maxValue, few.ticket) }
})

test('conta por prazo médio é a conta título a título aplicada ao borderô hipotético', () => {
  const { operation, hypothetical, errors } = form()
  assert.deepEqual(errors, {})
  const byTitles = discountOperation({ titleRows: hypothetical.titleRows, date, rate: 1.83, feeMode: 'total', fee: 564, tac: 260 })
  for (const key of ['value', 'interest', 'iof', 'base', 'cost', 'net', 'cet', 'termCost', 'averageDays']) near(operation[key], byTitles[key], 1e-9)
  // Conferência independente, boleto a boleto: juros comerciais e IOF (0,38% + 0,0082% ao dia) até a data de pagamento.
  let interest = 0, iof = 0
  for (const row of operation.rows) {
    const days = (Date.parse(row.paymentDate) - Date.parse(date)) / 86400000
    const rowInterest = row.value * 0.0183 * days / 30
    interest += rowInterest
    iof += (row.value - rowInterest) * (0.0038 + 0.000082 * Math.min(days, 365))
  }
  near(operation.interest, interest)
  near(operation.iof, iof)
  near(operation.net, 225600.43 - interest - iof - 564 - 260)
})

test('prazo médio efetivo conta o ajuste de dia útil e nunca fica abaixo do digitado', () => {
  const { operation } = form()
  assert.ok(operation.averageDays >= 30 && operation.averageDays < 32, String(operation.averageDays))
  assert.ok(operation.rows.some(row => row.adjusted), 'há vencimento em fim de semana no exemplo')
  near(operation.averageDays, operation.rows.reduce((sum, row) => sum + row.value * row.days, 0) / operation.value)
})

test('prazo médio maior aumenta juros e IOF; ticket médio muda a quantidade de boletos e a tarifa por título', () => {
  const a = form().operation, b = form({ averageDays: '60' }).operation
  assert.ok(b.interest > a.interest * 1.9 && b.iof > a.iof)
  const unit = form({ titleFeeMode: 'unit', titleFeeUnit: '10,00' }).operation, smaller = form({ titleFeeMode: 'unit', titleFeeUnit: '10,00', averageTicket: '3.760,00' }).operation
  assert.equal(unit.titles, 30)
  assert.equal(smaller.titles, 60)
  near(unit.titleFee, 300)
  near(smaller.titleFee, 600)
})

test('campos do prazo médio: vazio, zero e fora do limite bloqueiam o resultado com aviso no campo certo', () => {
  for (const [changes, key] of [[{ totalValue: '' }, 'totalValue'], [{ totalValue: '0,00' }, 'totalValue'], [{ averageDays: '' }, 'averageDays'], [{ averageDays: '0' }, 'averageDays'], [{ averageDays: '366' }, 'averageDays'], [{ averageTicket: '' }, 'averageTicket'], [{ averageTicket: '300.000,00' }, 'averageTicket'], [{ totalValue: '2.000.000,00', averageTicket: '1,00' }, 'averageTicket']]) {
    const r = form(changes)
    assert.ok(r.errors[key], `${key}: ${JSON.stringify(changes)}`)
    assert.equal(r.errors.operation, undefined)
    assert.equal(r.operation, null)
    assert.equal(r.result, null)
  }
  assert.equal(hypotheticalTitles({ value: 1000, averageDays: 30, ticket: 100, date: '2026-02-30' }).ok, false)
})

test('título a título ignora os campos do prazo médio; por prazo médio ignora os grupos digitados', () => {
  const titles = form({ titleMode: 'titles', totalValue: '', averageDays: '', averageTicket: '' })
  assert.deepEqual(titles.errors, {})
  assert.equal(titles.hypothetical, null)
  assert.equal(titles.operation.rows.length, 1)
  const average = form({ titleRows: [] })
  assert.deepEqual(average.errors, {})
  assert.equal(average.operation.titles, 30)
})

test('Simples até R$ 30 mil e projeção mensal continuam valendo sobre o borderô hipotético', () => {
  const simples = form({ taxProfile: 'simples', eligible: true, totalValue: '30.000,00', averageTicket: '1.000,00', averageValue: '31.000,00' })
  near(simples.operation.tax.daily, 0.00274)
  near(simples.result.projected.tax.daily, 0.0082)
  // R$ 30.000,00 exatos em 9 boletos: a soma dos boletos passa de 30.000 por fração de centavo e o Simples continua valendo.
  const edge = form({ taxProfile: 'simples', eligible: true, totalValue: '30.000,00', averageDays: '7', averageTicket: '3.333,33' })
  assert.equal(edge.operation.titles, 9)
  near(edge.operation.tax.daily, 0.00274)
  const doubled = form({ averageValue: '451.200,86', discountRate: '1,83' })
  near(doubled.result.projected.interest, 2 * doubled.operation.interest)
  near(doubled.result.projected.iof, 2 * doubled.operation.iof)
})
