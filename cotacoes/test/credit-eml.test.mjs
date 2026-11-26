// E-mail da Necessidade do Cliente em arquivo do Outlook (.eml), pedido do Fernando em 23/11/2026.
import test from 'node:test'
import assert from 'node:assert/strict'
import { creditEml, creditEmlConteudo } from '../src/creditEml.js'

const linhas = n => Array.from({ length: n }, (_, i) => ({ number: i + 1, date: `2027-${String((i % 12) + 1).padStart(2, '0')}-23`, interest: 1000, amortization: 9000, payment: 10000, balance: 90000 - i * 9000 }))
const op = (label, extra = {}) => ({ ok: true, label, value: 3000000, net: 2917030.73, firstPayment: 149265.14, maxPayment: 149265.14, interest: 582363.24, iof: 82969.27,
  cost: 665332.51, total: 3665332.51, cet: 0.226, rateLabel: 'Prefixada · 1,45% a.m.', systemLabel: 'PRICE · 24 pagamento(s)', lastDate: '2028-11-23', modality: 'giro-pre', rows: linhas(24), ...extra })

test('cinco operações: arquivo de rascunho com a comparação lado a lado, o menor custo e o cronograma de cada uma', () => {
  const results = [op('Giro prefixado'), op('Giro pós-CDI', { modality: 'giro-cdi', floating: true, projectedCost: 0.2185, cet: 0.0709, cetLabel: 'CET · parte fixa (regra do BC)', cost: 643883.39 }),
    op('BNDES', { cost: 440101.33 }), op('FINIMP', { cost: 105000, rows: [{ number: 1, date: '2027-05-22', interest: 90000, amortization: 3000000, payment: 3090000, balance: 0 }] }), op('Outra modalidade')]
  const { html, texto, assunto, nome } = creditEmlConteudo({ results, contexto: { scenario: 'Base', cdi: 13.65 } })
  const limpo = html.replace(/\u00a0/g, ' ')
  assert.match(assunto, /^Comparação de crédito · 5 operações/)
  assert.match(nome, /^Comparacao de credito - R\$ 3\.000\.000,00 - .*\.eml$/)
  for (const t of ['1. Giro prefixado', '5. Outra modalidade', 'Menor custo sobre o valor líquido', '4. FINIMP', 'Custo com CDI projetado (não é CET)', '21,85% a.a.', '22,60% a.a.', '7,09% a.a. (parte fixa, regra do BC)', 'Cronograma · 2. Giro pós-CDI', '22/05/2027', 'Cenário do CDI Base: 13,65% a.a.'])
    assert.ok(limpo.includes(t), t)
  assert.equal((limpo.match(/Cronograma · /g) || []).length, 5)
  assert.match(texto, /Menor custo sobre o valor líquido: 4\. FINIMP/)
  const { conteudo } = creditEml({ results })
  assert.match(conteudo, /^MIME-Version: 1\.0\r\nX-Unsent: 1\r\n/)
})

test('uma operação: cotação, sem leitura de menor custo', () => {
  const { html, assunto } = creditEmlConteudo({ results: [op('Giro prefixado')] })
  assert.match(assunto, /^Cotação de crédito · Giro prefixado/)
  assert.ok(!html.includes('Menor custo sobre o valor líquido'))
  assert.ok(html.includes('Cronograma · Giro prefixado'))
})
