import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCdsText, buildCdsData, cdsFailure, cdsDue, cdsView, referenceFor, spDate } from '../src/cds.js'

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

test('CDS: variação do dia contra o último valor do dia anterior; salto anormal é recusado', () => {
  const ontem = buildCdsData(null, { value: 165, observedAt: T - 864e5 }, NOW - 864e5)
  assert.equal(ontem.reference, null)
  const hoje = buildCdsData(ontem, { value: 162.85, observedAt: T }, NOW)
  assert.deepEqual(hoje.reference, { date: '2026-11-26', value: 165 })
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
  assert.equal(v.refDate, '26/11')
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
  assert.equal(cdsView({ ...ok, reference: { date: '2026-11-26', value: 80 } }, NOW), null) // salto acima de 30%
  assert.ok(cdsView(ok, T + 3 * 864e5)) // fim de semana: ainda aparece, com o horário da página
})

test('CDS: data civil em Brasília e base do dia anterior', () => {
  assert.equal(spDate(Date.UTC(2026, 10, 28, 2, 0)), '2026-11-27') // 23h de sexta em Brasília
  assert.equal(referenceFor([{ date: '2026-11-27', value: 160, observedAt: T }], T), null)
})
