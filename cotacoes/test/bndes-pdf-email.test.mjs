import test from 'node:test'
import assert from 'node:assert/strict'
import { bndesPdfEml } from '../src/bndesPdfEml.js'
import { bndesDiNoPrazo, historicoIndexadores } from '../src/bndesHistorico.js'

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
  assert.match(pdf, /\/Count 4\b/)
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
