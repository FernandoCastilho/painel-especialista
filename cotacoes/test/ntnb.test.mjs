import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { buildNtnbData, historicoNtnb, ntnbAccept, ntnbDue, ntnbFailure, ntnbView, parseNtnbCsv, rotuloVenc, taxaEm, vencPadrao } from '../src/ntnb.js'

const HEAD = 'Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha'
const NTNB = 'Tesouro IPCA+ com Juros Semestrais'
const dmy = (iso) => iso.split('-').reverse().join('/')
const linha = (tipo, venc, data, taxa) => `${tipo};${dmy(venc)};${dmy(data)};${taxa};${taxa};4000,00;3990,00;3990,00`
const dias = (fim, n) => Array.from({ length: n }, (_, i) => new Date(Date.parse(`${fim}T12:00:00Z`) - (n - 1 - i) * 864e5).toISOString().slice(0, 10))
const VENCS = ['2030-08-15', '2035-05-15', '2045-05-15', '2050-08-15']
// Planilha fictícia: 4 NTN-B em oferta, uma vencida, uma fora de oferta (taxa 0) e outros títulos que não entram.
function planilha({ fim = '2026-11-27', n = 400 } = {}) {
  const rows = [HEAD]
  for (const d of dias(fim, n)) {
    VENCS.forEach((v, k) => rows.push(linha(NTNB, v, d, (7 + k / 10 + (d === fim ? 0.05 : 0)).toFixed(2).replace('.', ','))))
    rows.push(linha(NTNB, '2026-08-15', d, d < '2026-08-15' ? '6,00' : '0,00')) // venceu: some da curva
    rows.push(linha(NTNB, '2028-08-15', d, '0,00')) // fora de oferta para compra
    rows.push(linha('Tesouro IPCA+', '2035-05-15', d, '9,99')) // NTN-B Principal: outro título
    rows.push(linha('Tesouro Prefixado', '2031-01-01', d, '13,87'))
  }
  return rows.join('\r\n')
}

test('NTN-B: lê só a NTN-B com cupom, taxa com vírgula, e ignora taxa zero (fora de oferta)', () => {
  const m = parseNtnbCsv('\uFEFF' + planilha({ n: 120 }))
  assert.deepEqual([...m.keys()].sort(), ['2026-08-15', ...VENCS].sort())
  assert.equal(m.get('2035-05-15').get('2026-11-27'), 7.15)
  assert.equal(m.get('2035-05-15').get('2026-11-26'), 7.1)
  assert.ok(!m.has('2028-08-15'))
})

test('NTN-B: recusa planilha vazia, formato mudado, data e taxa inválidas', () => {
  assert.throws(() => parseNtnbCsv(''), /vazia/)
  assert.throws(() => parseNtnbCsv('a;b\n1;2'), /formato/)
  assert.throws(() => parseNtnbCsv(`${HEAD}\n${NTNB};31/02/2035;27/11/2026;7,1;7,2;1;1;1`), /data inválida/)
  assert.throws(() => parseNtnbCsv(`${HEAD}\n${linha(NTNB, '2035-05-15', '2026-11-27', '71,9')}`), /fora do esperado/)
  assert.throws(() => parseNtnbCsv(`${HEAD}\n${linha(NTNB, '2035-05-15', '2026-11-27', 'abc')}`), /taxa inválida/)
  assert.throws(() => parseNtnbCsv(`${HEAD}\n${linha('Tesouro Selic', '2031-03-01', '2026-11-27', '0,1')}`), /sem NTN-B/)
})

test('NTN-B: arquivo com vencimentos de hoje, histórico alinhado e curvas de hoje, 1 mês e 1 ano', () => {
  const d = buildNtnbData(parseNtnbCsv(planilha()), Date.parse('2026-11-28T12:00:00Z'))
  assert.equal(d.ref, '2026-11-27')
  assert.deepEqual(d.vencimentos, VENCS)
  assert.equal(d.dates.length, 400)
  assert.ok(VENCS.every((v) => d.series[v].length === d.dates.length))
  assert.equal(d.series['2035-05-15'].at(-1), 7.15)
  assert.deepEqual(d.curve.compare.map((c) => [c.id, c.date]), [['hoje', '2026-11-27'], ['mes', '2026-10-28'], ['ano', '2025-11-27']])
  assert.deepEqual(d.curve.curves['2026-11-27'].map((p) => p[2]), ['2030', '2035', '2045', '2050'])
  assert.deepEqual(d.curve.curves['2026-11-27'][0], [2030.583, 7.05, '2030'])
  // vencida não entra nem na curva de 1 ano atrás: compara os mesmos títulos de hoje
  assert.ok(d.curve.curves['2025-11-27'].every((p) => p[2] !== '2026'))
  assert.equal(d.stale, false)
})

test('NTN-B: histórico guarda no máximo 10 anos e recusa poucos vencimentos', () => {
  const d = buildNtnbData(parseNtnbCsv(planilha({ n: 4000 })))
  assert.ok(d.dates[0] >= '2016-11-26' && d.dates[0] <= '2016-11-28', d.dates[0])
  const poucos = [HEAD, ...dias('2026-11-27', 5).map((x) => linha(NTNB, '2035-05-15', x, '7,1'))].join('\n')
  assert.throws(() => buildNtnbData(parseNtnbCsv(poucos)), /poucos vencimentos/)
})

test('NTN-B: nova leitura não recua no tempo; falha mantém o último dado como pendente; visita a cada 3 h', () => {
  const novo = buildNtnbData(parseNtnbCsv(planilha()))
  assert.throws(() => ntnbAccept({ ref: '2026-11-30' }, novo), /anterior/)
  assert.equal(ntnbAccept({ ref: '2026-11-26' }, novo), novo)
  const f = ntnbFailure(novo, new Error('HTTP 503'), 5)
  assert.equal(f.stale, true); assert.equal(f.error, 'HTTP 503'); assert.equal(f.lastAttemptAt, 5); assert.deepEqual(f.vencimentos, VENCS)
  assert.equal(ntnbFailure(null, new Error('x')).vencimentos, undefined)
  assert.equal(ntnbDue(null), true)
  assert.equal(ntnbDue({ lastAttemptAt: 0 }, 3 * 3600e3 - 1), false)
  assert.equal(ntnbDue({ lastAttemptAt: 0 }, 3 * 3600e3), true)
})

test('NTN-B na tela: confere o arquivo, marca atraso, abre na 2035 e desenha só dias com taxa', () => {
  const d = buildNtnbData(parseNtnbCsv(planilha()))
  const agora = Date.parse('2026-11-28T15:00:00Z')
  assert.equal(ntnbView(null), null)
  assert.equal(ntnbView({ ...d, schemaVersion: 2 }, agora), null)
  assert.equal(ntnbView({ ...d, series: { ...d.series, '2035-05-15': [1] } }, agora), null)
  const v = ntnbView(d, agora)
  assert.equal(v.atrasado, false)
  assert.equal(ntnbView(d, Date.parse('2026-12-04T15:00:00Z')).atrasado, true)
  assert.equal(ntnbView({ ...d, stale: true }, agora).atrasado, true)
  assert.equal(vencPadrao(v), '2035-05-15')
  assert.equal(vencPadrao({ vencimentos: ['2030-08-15', '2040-08-15', '2050-08-15'] }), '2040-08-15')
  assert.equal(rotuloVenc('2035-05-15'), 'NTN-B 2035')
  const comBuraco = { ...v, series: { ...v.series, '2035-05-15': v.series['2035-05-15'].map((x, i) => (i === 3 ? null : x)) } }
  const h = historicoNtnb(comBuraco, '2035-05-15')
  assert.equal(h.length, 399)
  assert.deepEqual(h.at(-1), { t: Date.parse('2026-11-27T12:00:00Z'), bid: 7.15 })
  assert.deepEqual(taxaEm(v, '2035-05-15', '2026-11-29'), { date: '2026-11-27', taxa: 7.15 })
  assert.equal(taxaEm(v, '2035-05-15', '2000-01-01'), null)
})

test('NTN-B: coleta baixa a planilha, grava o arquivo e mantém o anterior quando a fonte falha', async () => {
  let status = 200
  const server = http.createServer((req, res) => { res.writeHead(status, { 'content-type': 'text/csv' }); res.end(status === 200 ? planilha() : 'erro') })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const dir = await mkdtemp(join(tmpdir(), 'ntnb-'))
  const run = () => promisify(execFile)(process.execPath, [new URL('../scripts/fetch-ntnb.mjs', import.meta.url).pathname], { env: { ...process.env, DATA_DIR: dir, NTNB_CSV_URL: `http://127.0.0.1:${server.address().port}/x.csv` } })
  try {
    await run()
    const ok = JSON.parse(await readFile(join(dir, 'ntnb.json'), 'utf8'))
    assert.equal(ok.ref, '2026-11-27'); assert.equal(ok.stale, false)
    await run() // menos de 3 h: não visita de novo
    assert.equal(JSON.parse(await readFile(join(dir, 'ntnb.json'), 'utf8')).lastAttemptAt, ok.lastAttemptAt)
    status = 503
    await writeFile(join(dir, 'ntnb.json'), JSON.stringify({ ...ok, lastAttemptAt: 0 }))
    await run()
    const falha = JSON.parse(await readFile(join(dir, 'ntnb.json'), 'utf8'))
    assert.equal(falha.stale, true); assert.match(falha.error, /HTTP 503/); assert.deepEqual(falha.vencimentos, VENCS)
  } finally {
    server.close()
  }
})
