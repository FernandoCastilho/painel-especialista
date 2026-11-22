import test from 'node:test'
import assert from 'node:assert/strict'
import { bndesEmailText, bndesEmailLink, LIMITE_LINK } from '../src/bndesEmail.js'

const result = {
  linha: 'Finame Materiais', valor: 1000000, prazo: 48, carencia: 3,
  periodicidade: 'Trimestral', amortizacao: 'SAC', liberacao: '22/11/2026',
  cet: 0.1921, total: 1380223.57, custo: 'tfc', custoFinanceiro: 0.141497,
  taxaBndes: 0.0125, taxaAgente: 0.03, taxa: 0.1921, tac: 0, iof: 0,
  parcelas: Array.from({ length: 48 }, (_, index) => ({
    mes: index + 1, vencimento: `2027-${String((index % 12) + 1).padStart(2, '0')}-15`,
    parcela: index < 3 ? 0 : 30000, juros: index < 3 ? 1000 : 500,
    carencia: index < 3,
  })),
}

test('organiza o e-mail em resumo, taxas e encargos, e parcelas', () => {
  const text = bndesEmailText({ result })
  assert.ok(text.indexOf('RESUMO') < text.indexOf('TAXAS E ENCARGOS'))
  assert.ok(text.indexOf('TAXAS E ENCARGOS') < text.indexOf('PARCELAS'))
  assert.match(text, /Estimativas sujeitas à confirmação/)
})

test('mantém endereço curto em 48 e 120 meses e copia cronograma longo', () => {
  for (const prazo of [48, 120]) {
    const item = { ...result, prazo, parcelas: Array.from({ length: prazo }, (_, index) => ({ ...result.parcelas[0], mes: index + 1 })) }
    const email = bndesEmailLink({ result: item })
    assert.ok(email.href.length <= LIMITE_LINK)
    assert.equal(email.fullText, bndesEmailText({ result: item, completo: true }))
  }
})

test('com comparação, inclui as duas alternativas no corpo', () => {
  const email = bndesEmailLink({ result, alternatives: [result, { ...result, custo: 'tlp', taxa: 0.2 }] })
  assert.match(email.text, /Opção A/)
  assert.match(email.text, /Opção B/)
  assert.match(email.fullText, /TLP/)
})
