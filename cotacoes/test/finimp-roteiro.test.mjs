// FINIMP no roteiro Demanda, Encargos, Linha do tempo, Resultado (21/11/2026).
// A tela só reparte e reordena números que a conta já devolve; aqui fica provado que as repartições fecham.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { FINIMP_TERMS, compareFinimp } from '../src/finimpComparison.js'

const cents = value => Math.round(value * 100)
// Exemplos fictícios. A TAC já vem na moeda do principal (R$ 1.000 e R$ 1.500 ao câmbio de 5 = 200 e 300).
const cases = [
  ['exemplo das fotos', { principal: 1000000, competitor: { annualRate: 6.5, flatRate: 0.5 }, itau: { annualRate: 6.1, flatRate: 1 } }],
  ['exemplo da conferência de tela', { principal: 100000, competitor: { annualRate: 6, flatRate: 1 }, itau: { annualRate: 8, flatRate: 0.5 } }],
  ['com TAC à vista', { principal: 100000, competitor: { annualRate: 6, flatRate: 1, tac: 200 }, itau: { annualRate: 8, flatRate: 0.5, tac: 300 } }],
  ['sem flat', { principal: 250000, competitor: { annualRate: 7.25, flatRate: 0 }, itau: { annualRate: 7, flatRate: 0 } }],
]

// A conta não arredonda (os centavos só aparecem na tela, linha a linha, como na tabela dos doze prazos).
// Por isso: sem arredondar, as partes somam exatamente; em centavos, fecham quando nenhum valor tem fração de centavo
// e diferem no máximo um centavo quando têm (dízima dos juros em prazos como 30 dias).
const wholeCents = value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6
for (const [name, input] of cases) test(`resultado e linha do tempo fecham nos doze prazos: ${name}`, () => {
  let exactTerms = 0
  for (const days of FINIMP_TERMS) {
    const r = compareFinimp({ ...input, days })
    assert.equal(r.ok, true)
    const exact = [r.competitor, r.itau].every(cost => [cost.interest, cost.flat, cost.tac].every(wholeCents))
    const closes = (shown, expected, label) => exact ? assert.equal(shown, expected, `${days} dias: ${label}`) : assert.ok(Math.abs(shown - expected) <= 1, `${days} dias: ${label}`)
    if (exact) exactTerms++
    for (const cost of [r.competitor, r.itau]) {
      // "Do que é feito o custo": juros + flat + TAC = custo total.
      assert.equal(cost.interest + cost.flat + cost.tac, cost.cost)
      closes(cents(cost.interest) + cents(cost.flat) + cents(cost.tac), cents(cost.cost), 'partes do custo')
      // Linha do tempo: o que se paga no vencimento (principal + juros), mais flat e TAC, é o principal mais o custo.
      assert.ok(Math.abs(input.principal + cost.interest + cost.flat + cost.tac - cost.principalAndCosts) < 1e-6)
      closes(cents(input.principal + cost.interest) + cents(cost.flat) + cents(cost.tac), cents(cost.principalAndCosts), 'vencimento')
      // "Quanto recebe" + "Quanto custa" = principal mais custos.
      closes(cents(input.principal) + cents(cost.cost), cents(cost.principalAndCosts), 'principal e custo')
    }
    // "Qual a diferença": Instituição 2 menos Instituição 1.
    assert.equal(r.difference, r.itau.cost - r.competitor.cost)
    closes(cents(r.difference), cents(r.itau.cost) - cents(r.competitor.cost), 'diferença')
  }
  assert.ok(exactTerms >= 2, 'há prazos sem fração de centavo, conferidos em centavos exatos')
})

test('exemplo das fotos: USD 1.000.000,00 por 180 dias', () => {
  const r = compareFinimp({ ...cases[0][1], days: 180 })
  assert.deepEqual([r.competitor.interest, r.competitor.flat, r.competitor.cost, r.competitor.periodPercent], [32500, 5000, 37500, 3.75])
  assert.deepEqual([r.itau.interest, r.itau.flat, r.itau.cost, r.itau.periodPercent].map(cents), [3050000, 1000000, 4050000, 405])
  assert.equal(cents(r.difference), 300000)
  assert.deepEqual([1000000 + r.competitor.interest, 1000000 + r.itau.interest].map(cents), [103250000, 103050000])
})

test('câmbio quebrado e dízima juntos: as partes somam exatamente o custo e, linha a linha, diferem no máximo um centavo', () => {
  // TAC convertida por um câmbio quebrado e juros com dízima: duas partes com fração de centavo, como já ocorre na tabela.
  const r = compareFinimp({ principal: 123456.78, days: 30, competitor: { annualRate: 6.1234567, flatRate: 0.1234567, tac: 1234.56 / 5.432109876 }, itau: { annualRate: 8, flatRate: 0.5, tac: 654.32 / 5.432109876 } })
  for (const cost of [r.competitor, r.itau]) {
    assert.equal(cost.interest + cost.flat + cost.tac, cost.cost)
    assert.ok(Math.abs(cents(cost.interest) + cents(cost.flat) + cents(cost.tac) - cents(cost.cost)) <= 1)
  }
})

test('a tela segue a ordem do roteiro, com os nomes padrão, e não aponta vencedor', async () => {
  const source = await readFile(new URL('../src/FinimpComparacao.jsx', import.meta.url), 'utf8')
  const order = ["step(1, 'Demanda do cliente')", 'htmlFor="fi-term">Prazo<', "step(2, 'Encargos')", '<Resultado id="fi-result-title" number={3}', '<span>Atingir meta de custo</span>', 'title="Tabela comparativa FINIMP"'].map(text => source.indexOf(text))
  assert.ok(order.every((at, k) => at > 0 && (k === 0 || at > order[k - 1])), `blocos na ordem do roteiro: ${order}`)
  for (const text of ['Taxa de juros <small>', 'Flat <small>', "'TAC à vista (R$)'", "'Quanto recebe (antes do flat)'", "'Quanto custa na Instituição 1'", "'Quanto custa na Instituição 2'", "'Qual a diferença'", 'Do que é feito o custo']) assert.ok(source.includes(text), text)
  assert.doesNotMatch(source, /Resultado da comparação|<span>Condições<\/span>|Taxa anual simples \(%\)|Flat único sobre o principal \(%\)/)
  assert.doesNotMatch(source, /mais barata|menor custo|maior custo|Custos iguais/i)
  // A linha do tempo saiu em 21/11/2026.
  assert.doesNotMatch(source, /LinhaDoTempo/)
})
