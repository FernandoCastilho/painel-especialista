import test from 'node:test'
import assert from 'node:assert/strict'
import { diaBrasilia, diasUteis, escolherDoDia, juntar, urlBuscaDia, contarDias } from '../scripts/fx-noticias-lib.mjs'
import { eventosDiarios, eventosDoDia } from '../src/fxNoticias.js'

const T = (iso) => Date.parse(iso)
const item = (title, iso, source = 'Folha') => ({ title, link: `https://ex.com/${encodeURIComponent(title)}`, source, t: T(iso) })

test('dia de Brasília: 01h UTC ainda é o dia anterior', () => {
  assert.equal(diaBrasilia(T('2026-10-16T01:00:00Z')), '2026-10-15')
  assert.equal(diaBrasilia(T('2026-10-16T03:00:00Z')), '2026-10-16')
})

test('dias úteis pulam sábado e domingo', () => {
  const dias = diasUteis(7, T('2026-11-17T15:00:00Z')) // terça
  assert.deepEqual(dias, ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17'])
})

test('busca por data tem folga de um dia em cada lado', () => {
  const u = decodeURIComponent(urlBuscaDia('dólar', '2026-10-15'))
  assert.match(u, /after:2026-10-14 before:2026-10-16/)
})

test('escolhe só manchetes do dia, sobre o dólar, sem repetir, movimento primeiro', () => {
  const itens = [
    item('Ibovespa sobe com bancos', '2026-10-15T14:00:00Z'),
    item('Dólar opera estável à espera do Fed', '2026-10-15T13:00:00Z'),
    item('Dólar fecha em alta de 1% com tensão fiscal', '2026-10-15T20:30:00Z'),
    item('Dólar fecha em alta de 1% com tensão fiscal', '2026-10-15T20:31:00Z'),
    item('Dólar cai no dia seguinte', '2026-10-16T14:00:00Z'),
    { title: 'Dólar sem link', link: '', t: T('2026-10-15T15:00:00Z') },
  ]
  const out = escolherDoDia(itens, '2026-10-15', 'USD')
  assert.deepEqual(out.map((n) => n.title), ['Dólar fecha em alta de 1% com tensão fiscal', 'Dólar opera estável à espera do Fed'])
})

test('juntar soma manchetes do mesmo dia, respeita o limite e descarta dias velhos e arquivos inválidos', () => {
  const agora = T('2026-11-17T15:00:00Z')
  const a = { moedas: { USD: { dias: { '2026-10-15': { itens: [item('Dólar sobe 1', '2026-10-15T13:00:00Z'), item('Dólar sobe 2', '2026-10-15T14:00:00Z')], coletadoEm: 1 } } } } }
  const b = { moedas: { USD: { dias: { '2026-10-15': { itens: [item('Dólar sobe 3', '2026-10-15T15:00:00Z'), item('Dólar sobe 4', '2026-10-15T16:00:00Z'), item('Dólar sobe 5', '2026-10-15T17:00:00Z')], coletadoEm: 2 } } } } }
  b.moedas.USD.dias['2020-01-02'] = { itens: [item('Dólar velho', '2020-01-02T15:00:00Z')] }
  const out = juntar([a, null, { moedas: 'lixo' }, b], agora)
  assert.equal(out.moedas.USD.dias['2026-10-15'].itens.length, 4)
  assert.equal(out.moedas.USD.dias['2026-10-15'].coletadoEm, 2)
  assert.equal(out.moedas.USD.dias['2020-01-02'], undefined)
  assert.equal(contarDias(out), 1)
})

const ponto = (iso, bid) => ({ t: T(iso), bid })
const arquivo = { moedas: { USD: { dias: {
  '2026-10-14': { itens: [item('Dólar sobe forte', '2026-10-14T15:00:00Z')] },
  '2026-10-15': { itens: [item('Dólar cai', '2026-10-15T15:00:00Z')] },
  '2026-10-16': { itens: [item('Dólar estável', '2026-10-16T15:00:00Z')] },
} } } }
const pts = [
  ponto('2026-10-13T22:00:00Z', 5.00),
  ponto('2026-10-14T22:00:00Z', 5.10), // +2%
  ponto('2026-10-15T22:00:00Z', 5.049), // -1%
  ponto('2026-10-16T22:00:00Z', 5.05), // ~0%
  ponto('2026-10-19T22:00:00Z', 5.30), // +5%, mas sem manchete guardada
]

test('gráfico diário: só dias com manchete e variação de 0,5% ou mais', () => {
  const ev = eventosDiarios(pts, arquivo, 'USD')
  assert.deepEqual(ev.map((e) => [e.dia, e.tom]), [['2026-10-14', 'up'], ['2026-10-15', 'down']])
  assert.ok(Math.abs(ev[0].pct - 2) < 1e-9)
})

test('gráfico diário: limita às maiores altas e baixas', () => {
  const ev = eventosDiarios(pts, arquivo, 'USD', { maiores: 1, minimo: 0 })
  assert.equal(ev.filter((e) => e.tom === 'up').length, 1)
  assert.equal(ev.filter((e) => e.tom === 'down').length, 1)
})

test('sem arquivo ou outra moeda: nenhuma bolinha', () => {
  assert.deepEqual(eventosDiarios(pts, null, 'USD'), [])
  assert.deepEqual(eventosDiarios(pts, arquivo, 'EUR'), [])
})

test('gráfico do dia: bolinha no horário da manchete, sobre a cotação mais próxima', () => {
  const intra = [ponto('2026-10-15T12:00:00Z', 5.08), ponto('2026-10-15T15:05:00Z', 5.06), ponto('2026-10-15T20:00:00Z', 5.05)]
  const ev = eventosDoDia(intra, arquivo, 'USD', '2026-10-15')
  assert.equal(ev.length, 1)
  assert.equal(ev[0].bid, 5.06)
  assert.equal(ev[0].tom, 'news')
})
