// Empréstimo externo (4131) no roteiro Demanda, Encargos, Linha do tempo, Resultado (21/11/2026).
// A tela só reordena e renomeia números que a conta já devolve. Aqui fica provado, chamando a própria conta, que o que
// a linha do tempo mostra fecha com a tabela de parcelas e com o resultado, e que os blocos estão na ordem combinada.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { hedge4131, loan4131 } from '../src/emprestimo4131.js'

const cents = value => Math.round(value * 100)
// Exemplo fictício: R$ 10 milhões a 5,40, dólar + 5,80% a.a., DI de 12,75% e cupom cambial de 5,20%.
const base = { currency: 'USD', principal: 1e7 / 5.4, rate: 5.8, spot: 5.4, start: '2026-11-23', months: 36, freq: 1, irrf: 15, grossUp: false, amort: 'parcelas', grace: 0, calendar: '30d' }
const cases = [
  ['36 parcelas mensais, como abre a tela', {}],
  ['carência de 6 pagamentos', { grace: 6 }],
  ['tarifa, fiança e IR somado, pagos ao exterior', { flat: 1, guarantee: 1, grossUp: true, feesAbroad: true }],
  ['12 parcelas mensais em dia fixo, com IOF-câmbio de 3,5%', { months: 12, calendar: 'mes' }],
  ['principal no vencimento, juros semestrais', { amort: 'bullet', freq: 6, months: 24 }],
  ['pagamento único em 6 meses', { amort: 'bullet', freq: 0, months: 6 }],
  ['euro, parcelas trimestrais', { currency: 'EUR', principal: 1e7 / 6.2, spot: 6.2, freq: 3 }],
]

for (const [name, extra] of cases) test(`linha do tempo fecha com as parcelas: ${name}`, () => {
  const loan = loan4131({ ...base, ...extra })
  assert.equal(loan.ok, true)
  const hedge = hedge4131(loan, { di: 12.75, cupom: 5.2 })
  assert.equal(hedge.ok, true)
  const n = loan.flows.length
  // Desembolso: o valor em reais é o líquido na moeda (principal menos tarifa, IOF e IR da entrada) pela cotação de partida.
  const entrada = loan.flatUsd + loan.iofUsd + loan.flatIrUsd
  assert.equal(cents(loan.netUsd), cents(loan.principal - entrada))
  assert.equal(cents(loan.netBrl), cents(loan.netUsd * loan.spot))
  // Carência e parcelas: os pagamentos só de juros mais as parcelas de principal somam todos os pagamentos.
  const comPrincipal = loan.flows.filter(flow => flow.principal > 0)
  if (loan.amort === 'parcelas') {
    assert.equal(loan.grace + comPrincipal.length, n)
    assert.equal(loan.flows[loan.grace], comPrincipal[0], 'a 1ª parcela de principal vem logo depois da carência')
    assert.ok(loan.flows.slice(0, loan.grace).every(flow => flow.principal === 0), 'na carência só há juros e encargos')
  } else {
    assert.deepEqual(comPrincipal, [loan.flows.at(-1)], 'principal de uma vez, no vencimento')
  }
  // Parcelas: cada parcela em reais é a parcela na moeda convertida pela taxa futura daquele vencimento.
  for (const flow of hedge.flows) assert.equal(cents(flow.brl), cents(flow.usd * flow.ndfRate))
  assert.equal(cents(comPrincipal.reduce((sum, flow) => sum + flow.principal, 0)), cents(loan.principal))
  // Quitação: a data é a do último pagamento, e o total é a soma das parcelas em reais, o mesmo "Total das parcelas" do resultado.
  assert.equal(loan.end, loan.flows.at(-1).date)
  assert.equal(hedge.flows.length, n)
  assert.equal(cents(hedge.ndf.totalBrl), cents(hedge.flows.reduce((sum, flow) => sum + flow.brl, 0)))
})

test('IOF-câmbio mostrado nos encargos é o que a conta aplica na entrada', () => {
  const curto = loan4131({ ...base, months: 12, calendar: 'mes' })
  assert.equal(curto.iofRate, 3.5)
  assert.equal(cents(curto.iofUsd), cents(curto.principal * 0.035))
  const longo = loan4131(base)
  assert.deepEqual([longo.iofRate, longo.iofUsd], [0, 0])
})

test('a tela segue a ordem do roteiro, com os nomes combinados', async () => {
  const source = await readFile(new URL('../src/Emprestimo4131.jsx', import.meta.url), 'utf8')
  const tela = source.slice(source.indexOf('<section className="cx bw e4 calc-standard"'))
  const order = [
    "step(1, 'Demanda do cliente')", 'Detalhes do contrato<small>', "step(2, 'Encargos')", 'Proteção cambial (NDF)</h4>', 'Mais encargos<small>',
    '<LinhaDoTempo ', "step(4, 'Resultado · custo final para o cliente')", '<Emprestimo4131Presentation ',
    'Atingir meta{', '<summary>Condições da operação</summary>', '<summary>Comparar com swap e sem proteção</summary>', '<summary>Composição do custo em ', '<summary>Sem proteção · custo conforme o ',
    '<summary>Premissas e limites da simulação</summary>', '<summary>Parcelas</summary>', '<ReferenciaMercado ',
  ].map(text => tela.indexOf(text))
  // "Condições da operação" continua dentro do quadro do resultado (última linha dele): vem antes dos botões e do Atingir meta.
  const [condicoes] = order.splice(9, 1)
  assert.ok(order.every((at, k) => at > 0 && (k === 0 || at > order[k - 1])), `blocos na ordem do roteiro: ${order}`)
  assert.ok(condicoes > order[6] && condicoes < order[7], 'condições da operação dentro do quadro do resultado')
  const pieces = await readFile(new URL('../src/Roteiro.jsx', import.meta.url), 'utf8')
  assert.match(pieces, /LinhaDoTempo\(\{ id, number = 3, title = 'Linha do tempo da operação'/)
  assert.match(tela, /`Taxa de juros all-in \(\$\{cur\.Nome\} \+\)`/, 'taxa de juros com o indexador')
  assert.match(tela, /4131 com NDF · \{hedge\?\.source === 'mesa'/, '4131 com NDF como subtítulo do resultado')
  assert.match(source, /const \[parcelasAbertas, setParcelasAbertas\] = useState\(false\)/, 'a tabela de parcelas abre fechada')
  assert.match(tela, /e4-parcelas" open=\{parcelasAbertas\}/)
  assert.doesNotMatch(tela, /Mais opções|Cotação · 4131 com NDF|>Operação</)
})

test('a referência de mercado é o último bloco da simulação e mostra a moeda da tela', async () => {
  const source = await readFile(new URL('../src/Emprestimo4131.jsx', import.meta.url), 'utf8')
  const at = source.indexOf("<ReferenciaMercado tipos={['cambio']} moeda={currency} />")
  assert.ok(at > source.indexOf('<summary>Parcelas</summary>') && at > source.indexOf('<p className="status">Regras conferidas em'), 'depois das parcelas e da nota das regras')
  assert.match(source.slice(at), /^<ReferenciaMercado tipos=\{\['cambio'\]\} moeda=\{currency\} \/>\s*<\/section>\s*<\/div>\s*<div hidden=\{area !== 'rules'\}/, 'nada depois dela na simulação')
})
