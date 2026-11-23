// E-mail do BNDES em arquivo do Outlook (.eml), pedido do Fernando em 23/11/2026.
import test from 'node:test'
import assert from 'node:assert/strict'
import { bndesEml, bndesEmlConteudo } from '../src/bndesEml.js'
import { base64Utf8, montarEml, nomeDeArquivo } from '../src/emlOutlook.js'

const decodifica = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\r\n/g, '')), c => c.charCodeAt(0)))
const parcelas = Array.from({ length: 48 }, (_, i) => ({ mes: i + 1, vencimento: `20${27 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-15`,
  parcela: i === 0 ? 0 : i === 2 ? 40933.51 : 30000, juros: i === 2 ? 40933.51 : 8000, saldo: 1000000 - i * 20000, carencia: i < 3 }))
const a = { custo: 'tfc', valor: 1000000, prazo: 48, carencia: 3, periodicidade: 'Trimestral', amortizacao: 'sac', liberacao: '23/11/2026',
  cet: 19.21, total: 1379726.31, primeiraParcela: 35684.67, custoFinanceiro: 14.1497, taxaBndes: 1.25, taxaAgente: 3, taxa: 19.04, tac: 2600, iof: 0, juros: 377126.31, parcelas }

test('o arquivo é um rascunho do Outlook, com assunto em UTF-8 e versões em texto e HTML', () => {
  const { nome, conteudo } = bndesEml({ itens: [a], emitidoEm: new Date(2026, 10, 23) })
  assert.equal(nome, 'BNDES Finame - simulacao R$ 1.000.000,00 - 23-11-2026.eml')
  assert.match(conteudo, /^MIME-Version: 1\.0\r\nX-Unsent: 1\r\nSubject: =\?UTF-8\?B\?/)
  assert.match(conteudo, /Content-Type: text\/plain; charset="UTF-8"/)
  assert.match(conteudo, /Content-Type: text\/html; charset="UTF-8"/)
  assert.ok(conteudo.split('\r\n').every(linha => linha.length <= 998), 'nenhuma linha longa demais')
  const assunto = decodifica(conteudo.match(/Subject: =\?UTF-8\?B\?(.+)\?=/)[1])
  assert.equal(assunto.replace(/\u00a0/g, ' '), 'BNDES Finame · simulação de R$ 1.000.000,00 · 48 meses')
})

test('o HTML traz destaques, condições, taxas e o cronograma completo, só com os meses pagos', () => {
  const { html } = bndesEmlConteudo({ itens: [a] })
  const limpo = html.replace(/\u00a0/g, ' ')
  for (const trecho of ['Valor financiado', 'CET estimado', '19,21% a.a.', 'Condições da operação', 'Taxas e encargos', 'Cronograma de pagamentos', 'SAC', '14,15% a.a.', 'R$ 2.600,00', 'a proposta do agente financeiro prevalece'])
    assert.ok(limpo.includes(trecho), trecho)
  // 47 meses com pagamento (o 1º mês da carência não tem): uma linha por pagamento, numerada de 1 a 47.
  assert.ok(limpo.includes('>47<') && !limpo.includes('>48<'), '47 pagamentos no cronograma')
  assert.ok(limpo.includes('15/03/2027'), 'datas no formato brasileiro')
  assert.ok(!limpo.includes('2027-03-15'))
  assert.ok(limpo.includes('· só juros'), 'pagamento da carência marcado')
})

test('com comparação, as opções aparecem lado a lado', () => {
  const b = { ...a, custo: 'tlp', taxa: 20.1, cet: 20.5, total: 1400000 }
  const { html, texto } = bndesEmlConteudo({ itens: [a, b] })
  assert.ok(html.includes('Opção A · TFC') && html.includes('Opção B · TLP'))
  assert.ok(html.includes('Parcela · Opção B · TLP'))
  assert.match(texto, /Opção B · TLP/)
})

test('peças do arquivo: base64 em UTF-8 e nome seguro', () => {
  assert.equal(decodifica(base64Utf8('Simulação · R$ 1,00')), 'Simulação · R$ 1,00')
  assert.equal(nomeDeArquivo('a/b:c*?'), 'a-b-c-.eml')
  assert.equal(nomeDeArquivo('Simulação Opção'), 'Simulacao Opcao.eml')
  assert.match(montarEml({ assunto: 'x', texto: 'y', html: '<p>z</p>', fronteira: 'F' }), /--F--\r\n$/)
})

test('com a garantia FGI marcada, o ECG aparece em Taxas e encargos (achado do Auditor, 23/11/2026)', () => {
  const sem = bndesEmlConteudo({ itens: [a] }).html
  assert.ok(!sem.includes('Garantia FGI'))
  const com = bndesEmlConteudo({ itens: [{ ...a, fgi: { ecg: 51234.56, incorporar: false } }] }).html.replace(/\u00a0/g, ' ')
  assert.ok(com.includes('Garantia FGI · ECG') && com.includes('R$ 51.234,56 (à vista)'))
})
