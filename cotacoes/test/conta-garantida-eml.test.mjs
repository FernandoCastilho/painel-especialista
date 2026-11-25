// E-mail .eml da Conta Garantida e do comparativo com o giro parcelado (24/11/2026): só apresentação dos números da tela.
import test from 'node:test'
import assert from 'node:assert/strict'
import { cgInitialForm, parseContaGarantidaForm } from '../src/contaGarantida.js'
import { initialAlongamentoForm, parseAlongamentoForm } from '../src/alongamento.js'
import { contaGarantidaEml, contaGarantidaEmlConteudo, alongamentoEmlConteudo } from '../src/contaGarantidaEml.js'
import { linhasDoFluxoAlongamento, prazoDoGiro } from '../src/alongamentoFluxo.js'

const simulate = extra => parseContaGarantidaForm({ ...cgInitialForm('2026-11-23'), ...extra, rateBase: '30', conversion: 'proportional', status: 'performing' })
const emitidoEm = new Date('2026-11-24T12:00:00')
const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

test('utilização única: custos, CET, para cobrir e apuração mensal no e-mail', () => {
  const { params, result, cet } = simulate({ amount: '1.000.000,00', rate: '2,5', duration: '10', limit: '2.000.000,00' })
  const c = contaGarantidaEmlConteudo({ modo: 'single', params, result, cet, taxa: '2,5', diasLabel: 'Todos os dias corridos', perfilLabel: 'PJ', emitidoEm })
  for (const texto of ['Conta garantida · utilização única', '2,50% a.m.', brl(result.totals.cost), brl(result.totals.draw + result.totals.cost), 'Apuração mensal', 'art. 6º'])
    assert.ok(c.html.includes(texto), texto)
  assert.ok(!c.html.includes('Lançamentos informados'))
  assert.match(c.assunto, /^Conta garantida · /)
  assert.match(c.nome, /^Conta garantida - R\$ 1\.000\.000,00 - 24-11-2026\.eml$/)
  const { conteudo } = contaGarantidaEml({ modo: 'single', params, result, cet, taxa: '2,5', emitidoEm })
  assert.match(conteudo, /^MIME-Version: 1\.0\r\nX-Unsent: 1\r\n/)
})

test('lançamentos por dia: tabela só com as datas que tiveram movimento e sem CET quando falta o limite', () => {
  const rows = [{ id: 'a', date: '2026-11-23', draw: '100.000,00', payment: '' }, { id: 'b', date: '2026-11-30', draw: '', payment: '40.000,00' }]
  const { params, result, cet } = simulate({ mode: 'ledger', start: '2026-11-23', end: '2026-12-10', rows, rate: '3' })
  assert.ok(result?.ok)
  const c = contaGarantidaEmlConteudo({ modo: 'ledger', params, result, cet, taxa: '3', lancamentos: result.rows, emitidoEm })
  assert.ok(c.html.includes('Lançamentos informados'))
  assert.ok(c.html.includes('23/11/2026') && c.html.includes('30/11/2026'))
  assert.equal((c.html.match(/01\/12\/2026/g) || []).length, 0, 'dia sem movimento fica de fora')
  assert.ok(c.html.includes('Não calculado: informe o limite contratado'))
  assert.ok(c.html.includes(brl(60000)), 'saldo devedor final')
})

test('comparativo: cronograma do giro com todas as parcelas, valor digitado e notas', () => {
  const form = { ...initialAlongamentoForm('2026-11-06'), balance: '200.000,00', cgRate: '3', amount: '200.000,00', loanRate: '1,5', n: '12', graceMonths: '2' }
  const { result } = parseAlongamentoForm(form)
  assert.ok(result.ok)
  const c = alongamentoEmlConteudo({ result, form, valor: 200000, emitidoEm })
  const parcelas = result.months.filter(m => m.installment > 0)
  assert.equal(parcelas.length, 12)
  for (const m of parcelas) assert.ok(c.html.includes(m.date.split('-').reverse().join('/')), m.date)
  for (const texto of ['Valor substituído', brl(200000), '12 parcelas', '2 meses de carência', 'Price · parcelas fixas', 'Comparação no mesmo horizonte', 'Não calcula CET'])
    assert.ok(c.html.includes(texto), texto)
})

test('fluxo do comparativo: carência fora, soma igual às parcelas; curva até carência + parcelas', () => {
  const form = { ...initialAlongamentoForm('2026-11-06'), balance: '200.000,00', cgRate: '3', amount: '200.000,00', loanRate: '1,5', n: '12', graceMonths: '2', system: 'sac' }
  const { result } = parseAlongamentoForm(form)
  const linhas = linhasDoFluxoAlongamento(result.months)
  assert.equal(linhas.length, 12)
  assert.deepEqual(linhas.map(l => l.number), [...Array(12)].map((_, i) => i + 1))
  const soma = linhas.reduce((s, l) => s + l.payment, 0)
  assert.ok(Math.abs(soma - result.months.reduce((s, m) => s + m.installment, 0)) < 1e-6)
  for (const l of linhas) assert.ok(Math.abs(l.payment - l.interest - l.amortization) < 1e-6)
  assert.equal(prazoDoGiro('12', '2'), 14)
  assert.equal(prazoDoGiro('24', ''), 24)
  assert.equal(prazoDoGiro('', '0'), undefined)
  assert.equal(prazoDoGiro('1,5', '0'), undefined)
})
