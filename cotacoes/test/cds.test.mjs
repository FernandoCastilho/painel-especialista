import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCdsText, buildCdsData, cdsFailure, cdsDue, cdsView, referenceFor, spDate, chartHistory, closeDate, cdsSerie } from '../src/cds.js'

// Trecho do texto da página já carregada (World Government Bonds, 27/11/2026), como o navegador o entrega.
const PAGINA = `SOVEREIGN CREDIT DEFAULT SWAP
BRAZIL - 5 Years CDS
162.85
 18.50%
1 month
Last Update: 27 Nov 2026 18:46 GMT+0
As of the latest update on 27 Nov 2026 18:46 GMT+0, the Brazil 5 Years Credit Default Swap (CDS) value stands at 162.85 basis points.`
const T = Date.UTC(2026, 10, 27, 18, 46)
const NOW = T + 30 * 60000

test('CDS: lê valor e horário da página carregada', () => {
  assert.deepEqual(parseCdsText(PAGINA), { value: 162.85, observedAt: T })
  // vírgula depois do ano, como no esqueleto da página
  assert.equal(parseCdsText('Last Update: 3 Dec 2026, 09:05 GMT+0 ... value stands at 150 basis points').observedAt, Date.UTC(2026, 11, 3, 9, 5))
})

test('CDS: página ainda sem número ("----") não vira leitura', () => {
  assert.throws(() => parseCdsText('Last Update: -- --- ----, --:-- GMT+0 value stands at ---- basis points.'), /não encontrados/)
  assert.throws(() => parseCdsText(''), /não encontrados/)
})

test('CDS: valor fora da faixa de 50 a 1.000 pb é recusado', () => {
  assert.throws(() => buildCdsData(null, { value: 16285, observedAt: T }, NOW), /fora da faixa/)
  assert.throws(() => buildCdsData(null, { value: 12, observedAt: T }, NOW), /fora da faixa/)
  assert.throws(() => buildCdsData(null, { value: 160, observedAt: NOW + 3600000 }, NOW), /futuro/)
})

test('CDS: variação do dia contra o fechamento do dia útil anterior; salto anormal é recusado', () => {
  const ontem = buildCdsData(null, { value: 165, observedAt: T - 864e5 }, NOW - 864e5)
  assert.equal(ontem.reference, null)
  assert.equal(ontem.date, '2026-11-25', 'publicado na quinta 26: fechamento de quarta 25')
  const hoje = buildCdsData(ontem, { value: 162.85, observedAt: T }, NOW)
  assert.equal(hoje.date, '2026-11-26')
  assert.equal(hoje.datedBy, 'fechamento')
  assert.deepEqual(hoje.reference, { date: '2026-11-25', value: 165 })
  assert.equal(hoje.history.length, 2)
  // segunda leitura no mesmo dia substitui a do dia, sem mudar a base
  const tarde = buildCdsData(hoje, { value: 163.5, observedAt: T + 3600000 }, NOW + 3600000)
  assert.equal(tarde.history.length, 2)
  assert.equal(tarde.reference.value, 165)
  assert.throws(() => buildCdsData(hoje, { value: 300, observedAt: T + 3600000 }, NOW + 3600000), /salto/)
  assert.throws(() => buildCdsData(hoje, { value: 160, observedAt: T - 3600000 }, NOW), /mais antigo/)
})

test('CDS: falha mantém o último dado válido e registra a tentativa', () => {
  const ok = buildCdsData(null, { value: 162.85, observedAt: T }, NOW)
  const f = cdsFailure(ok, new Error('site respondeu HTTP 403'), NOW + 7200000)
  assert.equal(f.value, 162.85)
  assert.equal(f.error, 'site respondeu HTTP 403')
  assert.equal(f.lastAttemptAt, NOW + 7200000)
  assert.equal(cdsFailure(null, 'x', NOW).value, null)
})

test('CDS: visita o site no máximo a cada ~2 h', () => {
  assert.equal(cdsDue(null, NOW), true)
  assert.equal(cdsDue({ lastAttemptAt: NOW - 60 * 60000 }, NOW), false)
  assert.equal(cdsDue({ lastAttemptAt: NOW - 120 * 60000 }, NOW), true)
})

test('CDS na tela: padrão brasileiro, fonte e horário de Brasília', () => {
  const ontem = buildCdsData(null, { value: 165, observedAt: T - 864e5 }, NOW - 864e5)
  const v = cdsView(buildCdsData(ontem, { value: 162.85, observedAt: T }, NOW), NOW)
  assert.equal(v.value, '162,85')
  assert.equal(v.change, '−2,15')
  assert.equal(v.pct, '−1,30%')
  assert.equal(v.tone, 'down')
  assert.equal(v.refDate, '25/11')
  assert.equal(v.close, '26/11', 'o valor publicado na sexta 27 é o fechamento de quinta 26')
  assert.equal(v.when, '27/11 15:46')
  assert.equal(v.sourceName, 'World Government Bonds')
  // sem dia anterior: valor aparece, variação não
  const so = cdsView(ontem, NOW - 864e5)
  assert.equal(so.change, null)
  assert.equal(so.pct, null)
})

test('CDS na tela: some quando o dado é estranho, velho ou ausente', () => {
  const ok = buildCdsData(null, { value: 162.85, observedAt: T }, NOW)
  assert.equal(cdsView(null, NOW), null)
  assert.equal(cdsView({ ...ok, value: 1628.5 }, NOW), null)
  assert.equal(cdsView({ ...ok, value: 'x' }, NOW), null)
  assert.equal(cdsView(ok, T + 5 * 864e5), null) // mais de 4 dias sem dado novo
  assert.equal(cdsView({ ...ok, observedAt: NOW + 2 * 3600000 }, NOW), null)
  assert.equal(cdsView({ ...ok, reference: { date: '2026-11-25', value: 80 } }, NOW), null) // salto acima de 30%
  assert.ok(cdsView(ok, T + 3 * 864e5)) // fim de semana: ainda aparece, com o horário da página
})

test('CDS: data civil em Brasília e base do dia anterior', () => {
  assert.equal(spDate(Date.UTC(2026, 10, 28, 2, 0)), '2026-11-27') // 23h de sexta em Brasília
  assert.equal(referenceFor([{ date: '2026-11-26', value: 160, observedAt: T }], T), null)
  assert.equal(referenceFor([{ date: '2026-11-25', value: 160, observedAt: T }], T).date, '2026-11-25')
})

test('CDS: a fonte publica no dia D o fechamento do dia útil anterior', () => {
  // Conferido em 28/11/2026: o ponto de sábado 21/11 (175,36 pb) é o fechamento de sexta 20/11 noticiado pela imprensa.
  assert.equal(closeDate('2026-11-21'), '2026-11-20') // sábado -> sexta
  assert.equal(closeDate('2026-11-22'), '2026-11-20') // domingo -> sexta
  assert.equal(closeDate('2026-11-23'), '2026-11-20') // segunda -> sexta (domingo não negocia)
  assert.equal(closeDate('2026-11-24'), '2026-11-23') // terça -> segunda
  assert.equal(closeDate('2026-11-27'), '2026-11-26')
})

test('CDS: arquivo antigo (datas da publicação) é convertido para datas de fechamento', () => {
  const antigo = { observedAt: T, value: 162.85, source: { name: 'World Government Bonds' }, reference: { date: '2026-11-26', value: 171.3 },
    history: [['2026-11-20', 164.57], ['2026-11-21', 175.36], ['2026-11-22', 175.36], ['2026-11-23', 175.36], ['2026-11-24', 176.98], ['2026-11-25', 170.94], ['2026-11-26', 171.3], ['2026-11-27', 162.85]]
      .map(([date, value]) => ({ date, value, observedAt: Date.parse(date) })) }
  const v = cdsView(antigo, NOW)
  assert.equal(v.close, '26/11'); assert.equal(v.refDate, '25/11'); assert.equal(v.change, '−8,45')
  const d = buildCdsData(antigo, { value: 162.85, observedAt: T + 3 * 3600000 }, NOW + 3 * 3600000)
  assert.deepEqual(d.history.map((p) => p.date), ['2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26'])
  assert.equal(d.history.find((p) => p.date === '2026-11-20').value, 175.36, 'fechamento de sexta 20/11')
  assert.deepEqual(d.reference, { date: '2026-11-25', value: 171.3 })
})

test('CDS na tela: acumulado no mês e no ano contra o último fechamento antes da virada', () => {
  const fech = (date, value) => ({ date, value, observedAt: Date.parse(date + 'T21:00:00Z') })
  const data = { datedBy: 'fechamento', observedAt: T, value: 162.85, reference: { date: '2026-11-25', value: 171.3 },
    history: [fech('2025-12-31', 140), fech('2026-10-30', 146), fech('2026-11-03', 150), fech('2026-11-25', 171.3), fech('2026-11-26', 162.85)] }
  const v = cdsView(data, NOW)
  assert.equal(v.month, '+11,54%') // 162,85 ÷ 146 (30/10)
  assert.equal(v.year, '+16,32%') // 162,85 ÷ 140 (31/12/2025)
  assert.equal(v.monthTone, 'up')
  // Lacuna de mais de 7 dias junto à virada: sem acumulado.
  const lacuna = { ...data, history: data.history.filter((p) => p.date !== '2026-10-30' && p.date !== '2025-12-31') }
  assert.equal(cdsView(lacuna, NOW).month, null)
  assert.equal(cdsView(lacuna, NOW).year, null)
})

// Série diária do gráfico da própria página (instante UTC da data, pb), um ponto por dia corrido, como a fonte entrega.
const DIA = 864e5
const serie = (dias, ultimo = 162.85) => Array.from({ length: dias }, (_, i) => {
  const t = Date.UTC(2026, 10, 27) - (dias - 1 - i) * DIA
  return [t, i === dias - 1 ? ultimo : +(155 + 8 * Math.sin(i / 20)).toFixed(2)]
})

test('CDS: gráfico da página vira histórico de 12 meses e dá a variação já no primeiro dia', () => {
  const leitura = parseCdsText(PAGINA)
  const pontos = chartHistory(serie(3375), leitura, NOW)
  assert.ok(pontos.length >= 255 && pontos.length <= 263, `12 meses de fechamentos em dias úteis (${pontos.length})`)
  assert.equal(pontos.at(-1).date, '2026-11-26', 'ponto publicado na sexta 27 = fechamento de quinta 26')
  assert.equal(pontos.some((p) => [0, 6].includes(new Date(p.date + 'T12:00:00Z').getUTCDay())), false, 'sem sábado nem domingo')
  const d = buildCdsData(null, leitura, NOW, pontos)
  assert.equal(d.history.at(-1).observedAt, T, 'leitura própria vale mais que o ponto do gráfico no mesmo dia')
  assert.equal(d.reference.date, '2026-11-25')
  assert.ok(d.history.length <= 367)
  assert.ok(d.history[0].observedAt >= T - 366 * DIA)
})

test('CDS: gráfico estranho não entra (não bate com o número do dia, salto entre dias, curto ou fora da faixa)', () => {
  const leitura = parseCdsText(PAGINA)
  assert.deepEqual(chartHistory(serie(400, 120), leitura, NOW), [], 'último ponto longe do número lido')
  const salto = serie(400); salto[200][1] = 400
  assert.deepEqual(chartHistory(salto, leitura, NOW), [], 'salto de um dia para o outro')
  assert.deepEqual(chartHistory(serie(10), leitura, NOW), [], 'poucos pontos')
  const fora = serie(400); fora[300][1] = 20
  assert.deepEqual(chartHistory(fora, leitura, NOW), [])
  assert.deepEqual(chartHistory(null, leitura, NOW), [])
  // Sem gráfico, a coleta segue só com o número do dia.
  assert.equal(buildCdsData(null, leitura, NOW, []).history.length, 1)
})

test('CDS: histórico guardado fica em 12 meses mesmo com coletas acumuladas', () => {
  const velho = { history: Array.from({ length: 500 }, (_, i) => { const t = T - (500 - i) * DIA; return { date: spDate(t), value: 160, observedAt: t } }) }
  const d = buildCdsData(velho, parseCdsText(PAGINA), NOW)
  assert.ok(d.history.length <= 367 && d.history[0].observedAt >= T - 366 * DIA)
})

test('CDS: série do gráfico aberto pela tabela usa datas de fechamento, em ordem, sem pontos inválidos', () => {
  const pts = [['2026-11-24', 176.98], ['2026-11-23', 175.36], ['2026-11-25', 'x'], ['2026-11-26', 171.3]].map(([date, value]) => ({ date, value, observedAt: Date.parse(date) }))
  assert.deepEqual(cdsSerie({ datedBy: 'fechamento', history: pts }).map((p) => [p.date, p.value]), [['2026-11-23', 175.36], ['2026-11-24', 176.98], ['2026-11-26', 171.3]])
  assert.deepEqual(cdsSerie({ history: pts }).map((p) => p.date), ['2026-11-20', '2026-11-23', '2026-11-25'], 'arquivo antigo: data da publicação vira a do fechamento')
  assert.deepEqual(cdsSerie(null), [])
})
