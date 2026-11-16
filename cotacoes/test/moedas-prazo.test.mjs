import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { collectMoedas, fetchMoedas } from '../scripts/fetch-moedas.mjs'
import { MOEDAS_CATALOG } from '../scripts/moedas-lib.mjs'

const codeOf = url => url.match(/um(.*?)\.txt$/)[1]
const observations = '13/11/2026; 4,300000\n'

test('cada série tem uma tentativa antes de nova consulta; até três simultâneas, sem consultar LD1', async () => {
  const calls = []
  let running = 0, peak = 0
  const data = await fetchMoedas({
    fetchImpl: async url => {
      const id = codeOf(url)
      calls.push(id)
      running++
      peak = Math.max(peak, running)
      await Promise.resolve()
      running--
      return new Response(id === '604' && calls.filter(s => s === id).length === 1 ? '<html>falha</html>' : observations)
    },
    wait: async () => {},
  })
  const expected = MOEDAS_CATALOG.length - 1
  assert.equal(new Set(calls.slice(0, expected)).size, expected)
  assert.equal(calls[expected], '604')
  assert.equal(calls[0], '604')
  assert.equal(peak, 3)
  assert.ok(!calls.includes('LD1'))
  assert.equal(Object.keys(data.series).length, expected)
  assert.equal(data.errors.length, 1)
  assert.match(data.errors[0], /LD1/)
})

test('prazo total produz resultado parcial sem novas chamadas depois do limite', async () => {
  let time = 0, calls = 0
  const data = await fetchMoedas({
    now: () => time,
    deadlineMs: 1000,
    wait: async () => {},
    fetchImpl: async () => {
      calls++
      await Promise.resolve()
      time = 1000
      return new Response(observations)
    },
  })
  assert.equal(calls, 3)
  assert.ok(data.series['143'])
  assert.ok(data.errors.some(error => error.includes('prazo da coleta esgotado')))
})

test('uma base anterior ilegível encerra a coleta antes da gravação', async () => {
  await assert.rejects(collectMoedas({
    collect: async () => ({ series: {}, generatedAt: Date.now() }),
    previous: async () => ({ status: 'unreadable', data: null }),
  }), /Base anterior de moedas ilegível/)
})

test('prazo de coleta reserva tempo para publicar a base preservada', async () => {
  const script = await readFile(new URL('../scripts/fetch-moedas.mjs', import.meta.url), 'utf8')
  const workflow = await readFile(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8')
  const prazo = Number(script.match(/PRAZO_MS = Number\(process\.env\.MOEDAS_PRAZO_MS\) \|\| (\d+) \* 60e3/)?.[1])
  const etapa = Number(workflow.match(/name: Coletar TFC e moedas contratuais do BNDES[\s\S]*?timeout-minutes: (\d+)/)?.[1])
  assert.ok(prazo > 0 && etapa > 0 && prazo + 1 <= etapa)
})

test('coleta do primeiro horário UTC guarda somente referências em vigor no dia de Brasília', async () => {
  const publishedAt = Date.UTC(2026, 10, 16, 1)
  const publish = async now => collectMoedas({
    collect: async () => ({ generatedAt: now, errors: [], series: { '143': { points: [
      ['2026-11-13', 4.3], ['2026-11-16', 4.4], ['2026-11-17', 4.5],
    ] } } }),
    previous: async () => ({ status: 'ok', data: { generatedAt: publishedAt, series: { '143': { points: [
      ['2026-11-12', 4.2], ['2026-11-17', 4.5],
    ] } } } }),
  })
  const sunday = await publish(publishedAt)
  assert.deepEqual(sunday.series['143'].points, [['2026-11-12', 4.2], ['2026-11-13', 4.3]])
  assert.equal(sunday.stale['143'], undefined)
  const monday = await publish(Date.UTC(2026, 10, 16, 3))
  assert.deepEqual(monday.series['143'].points, [['2026-11-12', 4.2], ['2026-11-13', 4.3], ['2026-11-16', 4.4]])
})
