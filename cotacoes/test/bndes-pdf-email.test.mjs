import test from 'node:test'
import assert from 'node:assert/strict'
import { bndesPdfEml } from '../src/bndesPdfEml.js'
import { bndesDiNoPrazo, historicoIndexadores, historicoParaPdf, serieDi } from '../src/bndesHistorico.js'
import { AVISOS_CDC } from '../src/cdcEmail.js'

const item = { custo: 'tfb', valor: 100000, prazo: 48, carencia: 3, custoFinanceiro: 12, taxaBndes: 1.15, taxaAgente: 3.1, tac: 1000, cet: 18.42, taxa: 17, total: 122000, parcelas: Array.from({ length: 48 }, (_, i) => ({ mes: i + 1, vencimento: '2027-01-15', parcela: 2500, juros: 500, amortizacao: 2000, saldo: 45000 })) }

test('rascunho em texto simples, com PDF real separado e cronograma completo', () => {
  const { conteudo, nome } = bndesPdfEml({ itens: [item, { ...item, custo: 'lcd', cet: 17.45 }] })
  assert.match(nome, /PDF\.eml$/)
  assert.match(conteudo, /X-Unsent: 1\r\n/)
  assert.match(conteudo, /multipart\/mixed/)
  const body = Buffer.from(conteudo.split('Content-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0], 'base64').toString('utf8')
  for (const v of ['Valor financiado:', 'Prazo:', 'Carência:', 'TFB:', 'Taxa do BNDES:', 'Spread do agente financeiro:', 'TAC:', 'CET estimado:', '18,42% a.a.', '17,45% a.a.', 'Simulação indicativa']) assert.ok(body.includes(v), v)
  assert.doesNotMatch(body, /15\/01\/2027|Cronograma de pagamentos/)
  const att = /Content-Disposition: attachment; filename="[^"]+\.pdf"\r\n\r\n([\s\S]*?)\r\n--/.exec(conteudo)
  const pdf = Buffer.from(att[1], 'base64').toString('ascii')
  assert.match(pdf, /^%PDF-1\.4/)
  // Duas opções de 48 parcelas (duas páginas cada) e, por último, a página do histórico e dos avisos.
  assert.match(pdf, /\/Count 5\b/)
  const lineHex = Buffer.from('48  ', 'ascii').toString('hex')
  assert.ok(pdf.includes('<' + lineHex))
  const offset = Number(/startxref\n(\d+)/.exec(pdf)[1])
  assert.equal(pdf.slice(offset, offset + 4), 'xref')
})

test('DI no prazo da operação usa a curva mais recente e não extrapola', () => {
  const br = { compare: [{ date: '2026-11-25' }, { date: '2026-11-24' }], curves: { '2026-11-25': [[21, 12], [63, 14]], '2026-11-24': [[21, 20], [63, 21]] } }
  assert.deepEqual(bndesDiNoPrazo(br, 2), { data: '2026-11-25', taxa: 13 })
  assert.deepEqual(bndesDiNoPrazo(br, 3), { data: '2026-11-25', taxa: 14 })
  assert.equal(bndesDiNoPrazo(br, 4), null)
  assert.equal(bndesDiNoPrazo(null, 4), null)
})

test('cada pós-fixado traz o histórico do índice observado sem misturar unidades', () => {
  const data = { ipca: { series: { points: [{ period: '2026-10', y12: 4.7 }] } }, selic: [[Date.UTC(2026, 10, 25), 14]], dolar: [['2026-11-25', 5.4]] }
  assert.deepEqual(historicoIndexadores(['tfc', 'tfb'], data), [])
  const series = historicoIndexadores(['tlp', 'lcd', 'tfbd'], data)
  assert.deepEqual(series.map(s => [s.id, s.unit, s.list[0]?.period, s.list[0]?.value]), [
    ['ipca', '% a.a.', '2026-10-01', 4.7], ['selic', '% a.a.', '2026-11-25', 14], ['usd', 'R$', '2026-11-25', 5.4],
  ])
  assert.deepEqual(historicoIndexadores(['tfbd'], {})[0].list, [])
})

const pdfDe = conteudo => Buffer.from(/Content-Disposition: attachment; filename="[^"]+\.pdf"\r\n\r\n([\s\S]*?)\r\n--/.exec(conteudo)[1], 'base64').toString('latin1')
const hexDe = texto => Buffer.from(texto, 'latin1').toString('hex')

test('PDF organizado: resumo em grupos, cronograma e, por último, gráfico do DI com o indexador e os avisos do CDC', () => {
  const dias = ['2026-01-05', '2026-06-05', '2026-11-25']
  const historico = { inicio: dias[0], fim: dias[2], series: [{ nome: 'DI · taxa do dia (CDI)', pontos: dias.map(d => [d, 14.9]) }, { nome: 'TFC · C26', pontos: dias.map((d, i) => [d, 11 + i / 2]) }] }
  const pdf = pdfDe(bndesPdfEml({ itens: [{ ...item, custo: 'tfc' }], historico }).conteudo)
  const posicao = trecho => pdf.indexOf(hexDe(trecho))
  const ordem = ['Operação', 'Taxas', 'Custo para o cliente', 'Cronograma de pagamentos', 'Histórico do DI e do indexador', 'Avisos importantes'].map(posicao)
  assert.ok(ordem.every((at, k) => at > 0 && (k === 0 || at > ordem[k - 1])), `ordem: ${ordem}`)
  // Os mesmos avisos do CDC, inclusive o de que não há compromisso entre as partes (texto quebrado em linhas).
  for (const aviso of AVISOS_CDC) for (const palavra of aviso.split(' ').slice(-3)) assert.ok(pdf.includes(hexDe(palavra)), palavra)
  assert.ok(pdf.includes(hexDe('gera obrigação para nenhuma das partes.')))
  // Duas linhas no gráfico, cada uma traçada com as próprias datas.
  assert.equal((pdf.match(/ RG 1\.4 w 1 j /g) || []).length, 2)
  assert.ok(pdf.includes(hexDe('DI · taxa do dia (CDI) | último 14,90%')))
  assert.ok(pdf.includes(hexDe('\x95 Simulação de caráter')), 'marcador em WinAnsi, sem ponto de interrogação')
})

test('sem histórico, o PDF ainda termina nos avisos e não desenha gráfico vazio', () => {
  const pdf = pdfDe(bndesPdfEml({ itens: [item] }).conteudo)
  assert.ok(pdf.includes(hexDe('Avisos importantes')))
  assert.equal(pdf.includes(hexDe('Histórico do DI e do indexador')), false)
  assert.equal((pdf.match(/ RG 1\.4 w 1 j /g) || []).length, 0)
})

test('linha do DI usa a taxa do dia (CDI) e o PDF recebe o mesmo recorte da tela', () => {
  const di = serieDi([[Date.UTC(2025, 10, 24), 15], [Date.UTC(2026, 0, 2), 14.9], [Date.UTC(2026, 10, 25), 14.9]])
  assert.deepEqual([di.id, di.short, di.unit, di.list.length], ['di', 'DI', '% a.a.', 3])
  assert.deepEqual(serieDi(undefined).list, [])
  const recorte = historicoParaPdf([di], { start: '2025-11-25', end: '2026-11-25' })
  assert.deepEqual(recorte, { inicio: '2025-11-25', fim: '2026-11-25', series: [{ nome: 'DI · taxa do dia (CDI)', pontos: [['2026-01-02', 14.9], ['2026-11-25', 14.9]] }] })
  assert.equal(historicoParaPdf([di], null), null)
})
