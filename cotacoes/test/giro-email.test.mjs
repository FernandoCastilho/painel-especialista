// E-mail do resultado do Capital de Giro (21/11/2026): três blocos (Resumo, Taxas e encargos, Parcelas), números da conta.
import test from 'node:test'
import assert from 'node:assert/strict'
import { giroConta } from '../src/giroConta.js'
import { giroEmailLink, giroEmailText } from '../src/giroEmail.js'

const base = { value: 1000000, n: 24, rate: 2, unit: 'am', system: 'price', start: '2026-11-21', firstDue: '2026-12-21', calendars: ['BR'], fees: 15000 }
const request = (extra = {}) => ({ term: 24, grace: 0, start: base.start, graceInterest: false, systemLabel: 'Price', periodLabel: 'Mensal',
  paymentLabel: 'Quanto paga por mês (1ª parcela)', rate: 2, unit: 'am', profileLabel: 'Pessoa jurídica geral',
  charges: [{ label: 'IOF', value: 0, timing: 'à vista, na liberação' }, { label: 'Fee', value: 15000, timing: 'à vista, na liberação', note: '1,5% do valor solicitado' }], ...extra })

test('corpo com Resumo, Taxas e encargos e Parcelas, nesta ordem, e os números da conta', () => {
  const result = giroConta({ ...base, flex: { 5: { payment: 100000 } } })
  const { subject, body } = giroEmailText({ result, request: request() })
  assert.match(subject, /Capital de Giro/)
  const [resumo, taxas, parcelas] = ['RESUMO', 'TAXAS E ENCARGOS', 'PARCELAS'].map(title => body.indexOf(title))
  assert.ok(resumo > 0 && taxas > resumo && parcelas > taxas)
  for (const text of ['Valor solicitado: R$ 1.000.000,00', 'Prazo: 24 meses', 'Carência: Sem carência', 'Periodicidade: Mensal', 'Amortização: Price',
    `Quanto entra no caixa: ${result.net.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 'Taxa de juros: 2,00% a.m. (26,8242% a.a.), prefixada',
    'Fee: R$ 15.000,00 (1,5% do valor solicitado) · à vista, na liberação', 'Perfil tributário: Pessoa jurídica geral', '5 (ajustada) | 22/04/2027 | 82.126,80 | 17.873,20 | 100.000,00 | 782.419,30']) {
    // 21/04/2027 é feriado: a parcela 5 vence no dia 22. O espaço depois de R$ é o espaço fixo do formato brasileiro.
    assert.ok(body.replace(/\u00a0/g, ' ').includes(text.replace(/\u00a0/g, ' ')), text)
  }
  assert.equal(body.split('\r\n').filter(line => /^\d+( \(|\s\|)/.test(line)).length, result.rows.length, 'uma linha por parcela')
})

test('60 parcelas: o link inclui todas; tamanho registrado para o relato', () => {
  const result = giroConta({ ...base, n: 60, firstDue: '2026-12-21' })
  const link = giroEmailLink({ result, request: request({ term: 60 }) })
  const body = decodeURIComponent(link.split('&body=')[1])
  assert.equal(body.split('\r\n').filter(line => /^\d+ \|/.test(line)).length, 60)
  assert.ok(link.startsWith('https://outlook.office.com/mail/deeplink/compose?subject='))
  console.log(`tamanho do link com 60 parcelas: ${link.length} caracteres; com 24: ${giroEmailLink({ result: giroConta(base), request: request() }).length}`)
})
