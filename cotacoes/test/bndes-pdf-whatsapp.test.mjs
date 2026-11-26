import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bndesPdf, bndesPdfEml } from '../src/bndesPdfEml.js'

const item = { custo: 'tfb', valor: 100000, prazo: 48, carencia: 3, custoFinanceiro: 12, taxaBndes: 1.15, taxaAgente: 3.1, tac: 1000, cet: 18.42, taxa: 17, total: 122000, parcelas: Array.from({ length: 48 }, (_, i) => ({ mes: i + 1, vencimento: '2027-01-15', parcela: 2500, juros: 500, amortizacao: 2000, saldo: 45000 })) }

test('PDF do WhatsApp é o mesmo anexo do envelope PDF, em ASCII', () => {
  const pdf = bndesPdf({ itens: [item, { ...item, custo: 'lcd' }] })
  assert.match(pdf, /^%PDF-1\.4/)
  assert.match(pdf, /%%EOF\n$/)
  assert.ok([...pdf].every(c => c.charCodeAt(0) < 128), 'só ASCII: o arquivo do WhatsApp sai byte a byte igual')
  const { conteudo } = bndesPdfEml({ itens: [item, { ...item, custo: 'lcd' }] })
  const anexo = /filename="BNDES-Finame-Simulacao\.pdf"\r\n\r\n([\s\S]*?)\r\n--/.exec(conteudo)[1]
  assert.equal(Buffer.from(anexo, 'base64').toString('ascii'), pdf)
  assert.throws(() => bndesPdf({ itens: [] }), /Cotação sem resultado/)
})

test('BNDES mostra o WhatsApp com PDF ao lado do envelope PDF, com as mesmas opções', () => {
  const finame = readFileSync(new URL('../src/FinameMateriais.jsx', import.meta.url), 'utf8')
  assert.match(finame, /<EmailEnvelopePdf itens=\{emailAlternatives\} historico=\{historicoPdf\} \/><WhatsAppPdf itens=\{emailAlternatives\} historico=\{historicoPdf\} \/>/)
  const whats = readFileSync(new URL('../src/WhatsAppCotacao.jsx', import.meta.url), 'utf8')
  assert.match(whats, /type: 'application\/pdf'/)
  assert.match(whats, /PDF baixado\. Anexe na conversa do WhatsApp\./)
  assert.match(whats, /Enviar a simulação em PDF pelo WhatsApp/)
})
