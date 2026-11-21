// Conta Garantida no roteiro Demanda, Encargos, Resultado (21/11/2026; a linha do tempo saiu no mesmo dia), só no modo Utilização única.
// A tela só reparte e reordena números que a conta já devolve; aqui fica provado que as repartições novas fecham em centavos.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { cgAddDays, cgInitialForm, parseContaGarantidaForm } from '../src/contaGarantida.js'

const cents = value => Math.round(value * 100)
// O mesmo caminho da tela: parseContaGarantidaForm com as convenções fixas que ContaGarantida.jsx passa.
const simulate = extra => parseContaGarantidaForm({ ...cgInitialForm('2026-11-23'), limit: '2.000.000,00', ...extra, rateBase: '30', conversion: 'proportional', status: 'performing' })
const amounts = ['1.000.000,00', '100.000,00', '123.456,78', '250.000,00', '37.512,49', '999,99', '5.000.000,00']
const rates = ['2,50', '3', '1,99', '2,37', '0', '4,125']
const durations = ['0', '1', '7', '10', '30', '45', '93']
const grid = amounts.flatMap(amount => rates.flatMap(rate => durations.flatMap(duration => ['calendar', 'business'].map(dayCount => ({ amount, rate, duration, dayCount })))))

test('exemplo das fotos: R$ 1 milhão por 10 dias a 2,50% a.m., limite de R$ 2 milhões', () => {
  const { result, cet, params } = simulate({ amount: '1.000.000,00', rate: '2,50', duration: '10' })
  const t = result.totals
  assert.deepEqual([t.draw, t.payment, result.balance, result.calendarDays, t.interestDays, params.end], [1000000, 1000000, 0, 10, 10, '2026-12-03'])
  assert.deepEqual([t.interest, t.dailyIof, t.additionalIof, t.cost].map(cents), [833333, 82000, 380000, 1295333])
  assert.equal(cents(t.payment + t.cost), 101295333) // "Quanto paga para cobrir": R$ 1.012.953,33
  assert.equal((cet.annual * 100).toFixed(2), '45.63')
  assert.equal(cents(cet.payment), 205492000)
})

test('"Quanto paga para cobrir" fecha em centavos: valor utilizado + custo total, em 588 combinações', () => {
  for (const item of grid) {
    const { result, params } = simulate(item)
    assert.equal(result?.ok, true, JSON.stringify(item))
    const t = result.totals
    // Na utilização única a cobertura devolve tudo o que foi utilizado: o saldo final é zero.
    assert.equal(t.payment, t.draw, JSON.stringify(item))
    assert.equal(result.balance, 0, JSON.stringify(item))
    // Respostas: "Quanto usou" + "Quanto custa" = "Quanto paga para cobrir".
    assert.equal(cents(t.draw) + cents(t.cost), cents(t.payment + t.cost), JSON.stringify(item))
    // O período de uso é o prazo digitado, e a cobertura cai na data final que a conta devolve.
    assert.equal(result.calendarDays, Number(item.duration), JSON.stringify(item))
    assert.equal(params.end, cgAddDays('2026-11-23', Number(item.duration)), JSON.stringify(item))
    assert.ok(t.interestDays <= result.calendarDays, JSON.stringify(item))
    if (item.dayCount === 'calendar') assert.equal(t.interestDays, result.calendarDays, JSON.stringify(item))
  }
})

test('"Do que é feito o custo": juros + IOF diário + IOF adicional = custo total', () => {
  let exact = 0
  for (const item of grid) {
    const t = simulate(item).result.totals
    // Na conta, com precisão completa, as três partes somam o custo total.
    assert.ok(Math.abs(t.interest + t.dailyIof + t.additionalIof - t.cost) < 1e-6, JSON.stringify(item))
    // Na tela, cada linha é arredondada para centavos só na exibição (a conta não arredonda no meio). É a mesma lista do quadro
    // antigo e a ressalva já consta em "Premissas e fórmulas": a soma dos centavos exibidos pode diferir do total em até 1 centavo.
    const gap = Math.abs(cents(t.interest) + cents(t.dailyIof) + cents(t.additionalIof) - cents(t.cost))
    assert.ok(gap <= 1, JSON.stringify(item))
    if (gap === 0) exact++
  }
  assert.ok(exact >= grid.length * 0.9, `fecha em centavos em ${exact} de ${grid.length} combinações`)
  // Casos de referência das conferências de tela fecham em centavos.
  for (const item of [{ amount: '100.000', rate: '2', duration: '10' }, { amount: '100000', rate: '3', duration: '10' }, { amount: '1.000.000,00', rate: '2,50', duration: '10' }]) {
    const t = simulate(item).result.totals
    assert.equal(cents(t.interest) + cents(t.dailyIof) + cents(t.additionalIof), cents(t.cost), JSON.stringify(item))
  }
})

test('o limite contratado só entra no CET: não muda nenhum número do período', () => {
  const [com, sem] = ['2.000.000,00', ''].map(limit => simulate({ amount: '1.000.000,00', rate: '2,50', duration: '10', limit }))
  assert.deepEqual(com.result.totals, sem.result.totals)
  assert.equal(sem.cet, null)
})

test('a tela segue a ordem do roteiro só na utilização única; os outros modos mantêm os nomes de antes', async () => {
  const source = await readFile(new URL('../src/ContaGarantida.jsx', import.meta.url), 'utf8')
  const order = ["step(1, 'Demanda do cliente')", "step(2, 'Encargos')", '<Resultado id="cg-result-title" number={3}'].map(text => source.indexOf(text))
  assert.ok(order.every((at, k) => at > 0 && (k === 0 || at > order[k - 1])), 'blocos na ordem 1 a 3')
  assert.doesNotMatch(source, /LinhaDoTempo/, 'sem linha do tempo (21/11/2026)')
  for (const question of ['Quanto usou', 'Quanto paga para cobrir', 'Quanto custa']) assert.ok(source.includes(`'${question}'`), question)
  assert.match(source, /<summary>Enquadramento do IOF/)
  assert.doesNotMatch(source, /Condições do produto/)
  // Lançamentos por dia: mesmos quadros e mesmo resultado ao lado.
  for (const text of ['1. Período e lançamentos', '2. Juros e convenções do contrato', '3. Referência de IOF', 'className="cg-result-col"', "'Taxa do contrato (% a.m.)'"]) assert.ok(source.includes(text), text)
  assert.match(source, /<div hidden=\{!comparing\}><ComparativoAlongamento \/><\/div>/)
})
