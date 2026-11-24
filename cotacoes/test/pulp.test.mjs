import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildPulp, pulpPublication, pulpQueries, collectPulpApi, PULP_API } from '../scripts/pulp-lib.mjs'
import { commodityFallback } from '../scripts/commodities-lib.mjs'
import { COMMODITY_IDS, contextItems } from '../src/marketContext.js'
const load = name => JSON.parse(readFileSync(new URL(`./fixtures/pulp-comex/${name}.json`, import.meta.url)))
const now = new Date('2026-11-17T10:00:00Z')
const publication = pulpPublication(load('publication'), now)
const responses = () => [load('2025'), load('2026')]
const aggregates = () => [load('aggregate-2025'), load('aggregate-2026')]
test('API oficial: celulose usa soma FOB/peso líquido em US$/t, 13 meses e publicação real', () => {
  const item = buildPulp(responses(), publication, now, aggregates())
  assert.equal(item.history.length, 13); assert.equal(item.period, '2026-10')
  assert.equal(item.value, 1026705212 / 1958055927 * 1000)
  assert.equal(item.previousValue, 967332979 / 1908928972 * 1000)
  assert.equal(item.releaseDate, '2026-11-06'); assert.equal(item.stale, false)
  assert.equal(contextItems({ commodities: [item] }, 'commodities', COMMODITY_IDS)[0].id, 'pulp-br')
  assert.match(item.nature, /FOB mensal/)
})
test('consulta isola anos, exportação, produtos 4701–4706 e métricas oficiais', () => {
  const qs = pulpQueries(publication)
  assert.deepEqual(qs.map(q => q.period), [{ from: '2025-10', to: '2025-12' }, { from: '2026-01', to: '2026-10' }])
  for (const q of qs) {
    assert.equal(q.flow, 'export'); assert.deepEqual(q.details, ['heading'])
    assert.deepEqual(q.filters, [{ filter: 'heading', values: [4701,4702,4703,4704,4705,4706] }])
    assert.deepEqual(q.metrics, ['metricFOB','metricKG'])
  }
})
test('rejeita soja, aparas, HTML, massa zero, número inválido, duplicidades e lacunas', () => {
  for (const change of [row => { row.headingCode = '1201' }, row => { row.headingCode = '4707' }, row => { row.metricKG = '0' }, row => { row.metricFOB = 'NaN' }, row => { row.monthNumber = '13' }, row => { row.year = '2028' }]) {
    const data = responses(); change(data[1].data.list[0]); assert.throws(() => buildPulp(data, publication, now, aggregates()))
  }
  const duplicate = responses(); duplicate[1].data.list.push(duplicate[1].data.list[0]); assert.throws(() => buildPulp(duplicate, publication, now, aggregates()))
  const missing = responses(); missing[1].data.list = missing[1].data.list.filter(r => r.monthNumber !== '10'); assert.throws(() => buildPulp(missing, publication, now, aggregates()))
  assert.throws(() => buildPulp('<h6>Celulose</h6><table>Soja</table>', publication, now, aggregates()))
  assert.throws(() => buildPulp([{ success:false }, load('2026')], publication, now, aggregates()))
})
test('metadados rejeitam publicação futura, datas inválidas e mês ainda aberto', () => {
  for (const patch of [{updated:'2026-12-01'}, {updated:'2026-02-30'}, {monthNumber:'11'}, {year:'2027'}, {monthNumber:'0'}]) {
    const meta=load('publication'); Object.assign(meta.data,patch); assert.throws(() => pulpPublication(meta,now))
  }
})
test('fallback preserva preço e data verificados; ausência nunca vira zero', () => {
  const item=buildPulp(responses(),publication,now,aggregates()), fallback=commodityFallback('pulp-br',[item],new Error('Fonte indisponível'))
  assert.equal(fallback.value,item.value); assert.equal(fallback.checkedAt,item.checkedAt); assert.equal(fallback.stale,true)
  assert.equal(commodityFallback('pulp-br',[],'falha').value,null)
  assert.equal(buildPulp(responses(),publication,new Date('2027-02-01'),aggregates()).stale,true)
})
test('coleta lê publicação antes das consultas e propaga falhas sem fabricar dado', async () => {
  const calls=[]
  const item=await collectPulpApi(async (url,body)=>{calls.push({url,body});return !body?load('publication'):load(`${body.details.length ? '' : 'aggregate-'}${body.period.from.slice(0,4)}`)},now)
  assert.equal(calls[0].url,`${PULP_API}/general/dates/updated`); assert.equal(calls.length,5); assert.equal(item.period,'2026-10')
  await assert.rejects(collectPulpApi(async()=>{throw Error('offline')},now))
})

test('reconciliação detecta remoção apenas de 4703 sem inventar transação para códigos ausentes', () => {
  const data = responses(); data[1].data.list = data[1].data.list.filter(r => !(r.monthNumber === '10' && r.headingCode === '4703'))
  assert.throws(() => buildPulp(data,publication,now,aggregates()), /não confere/)
  const actual = buildPulp(responses(),publication,now,aggregates()); assert.equal(actual.period,'2026-10')
  const badTotal = aggregates(); badTotal[1].data.list[0].metricKG = '1'
  assert.throws(() => buildPulp(responses(),publication,now,badTotal), /não confere/)
  assert.throws(() => buildPulp(responses(),publication,now), /ausentes/)
})
