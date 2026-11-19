import test from 'node:test'
import assert from 'node:assert/strict'
import { diaBrasilia, diasUteis, escolherDoDia, juntar, urlBuscaDia, contarDias } from '../scripts/fx-noticias-lib.mjs'
import { eventosDiarios, eventosDoDia, itensDoDia } from '../src/fxNoticias.js'

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
    item('Empresa transfere bilhões de dólares em ações', '2026-10-15T16:00:00Z'),
    item('Açúcar recua em Nova York com pressão do câmbio', '2026-10-15T16:10:00Z'),
    item('Ouro cai com valorização do dólar', '2026-10-15T16:20:00Z'),
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

test('horário cheio vira "sem hora" e fica fora do gráfico do dia', () => {
  const [n] = escolherDoDia([item('Dólar sobe', '2026-10-15T07:00:00Z')], '2026-10-15', 'USD')
  assert.equal(n.semHora, true)
  const [m] = escolherDoDia([item('Dólar sobe', '2026-10-15T07:12:30Z')], '2026-10-15', 'USD')
  assert.equal(m.semHora, undefined)
  const arq = { moedas: { USD: { dias: { '2026-10-15': { itens: [n] } } } } }
  assert.deepEqual(eventosDoDia([ponto('2026-10-15T06:00:00Z', 5), ponto('2026-10-15T20:00:00Z', 5)], arq, 'USD', '2026-10-15'), [])
})

test('outras moedas: euro aceita manchete que começa por euro ou dólar, recusa a de outro ativo', () => {
  const itens = [item('Euro cai a R$ 5,62 com BCE', '2026-10-15T15:00:01Z'), item('Dólar sobe e euro cai ante o real', '2026-10-15T15:10:01Z'), item('Ouro sobe com euro fraco', '2026-10-15T15:20:01Z'), item('Iene renova mínima', '2026-10-15T15:30:01Z')]
  assert.deepEqual(escolherDoDia(itens, '2026-10-15', 'EUR').map((n) => n.title), ['Euro cai a R$ 5,62 com BCE', 'Dólar sobe e euro cai ante o real'])
  assert.deepEqual(escolherDoDia([item('Euro cai a R$ 5,62', '2026-10-15T15:00:01Z')], '2026-10-15', 'USD'), [])
})

test('mercado do dia completa a moeda até 4 manchetes, sem repetir, marcadas como gerais', () => {
  const m = item('Ibovespa cai e juros sobem', '2026-10-15T18:00:00Z')
  const arq = { moedas: {
    JPY: { dias: { '2026-10-15': { itens: [item('Iene sobe', '2026-10-15T15:00:00Z')] } } },
    MERCADO: { dias: { '2026-10-15': { itens: [m, item('Bolsa 2', '2026-10-15T19:00:00Z'), item('Bolsa 3', '2026-10-15T19:30:00Z'), item('Bolsa 4', '2026-10-15T20:00:00Z')] } } },
  } }
  const out = itensDoDia(arq, 'JPY', '2026-10-15')
  assert.equal(out.length, 4)
  assert.equal(out[0].title, 'Iene sobe')
  assert.equal(out[0].geral, undefined)
  assert.ok(out.slice(1).every((n) => n.geral))
  // moeda sem arquivo próprio ainda ganha bolinha pelas manchetes de mercado
  const pts = [ponto('2026-10-14T22:00:00Z', 0.03), ponto('2026-10-15T22:00:00Z', 0.031)]
  const ev = eventosDiarios(pts, { moedas: { MERCADO: arq.moedas.MERCADO } }, 'CNH')
  assert.equal(ev.length, 1)
  assert.ok(ev[0].itens.every((n) => n.geral))
})

test('iene e yuan exigem o nome da moeda; mercado do dia prioriza bolsa, dólar e juros', () => {
  assert.deepEqual(escolherDoDia([item('Banco central da China eleva compulsório cambial', '2026-10-15T15:00:01Z')], '2026-10-15', 'JPY'), [])
  assert.equal(escolherDoDia([item('Iene recua com BoJ', '2026-10-15T15:00:01Z')], '2026-10-15', 'JPY').length, 1)
  const m = escolherDoDia([item('Minério de ferro recua em Dalian', '2026-10-15T12:00:01Z'), item('Ibovespa cai com fiscal', '2026-10-15T18:00:01Z')], '2026-10-15', 'MERCADO')
  assert.equal(m[0].title, 'Ibovespa cai com fiscal')
})
