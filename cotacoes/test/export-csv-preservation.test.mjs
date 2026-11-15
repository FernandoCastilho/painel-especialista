import test from 'node:test'
import assert from 'node:assert/strict'
import { exportCsvs } from '../scripts/export-csv.mjs'
import { toCsv } from '../scripts/csv-lib.mjs'

const previous = toCsv([['C01', 'TFC', '2026-11-10', 12.5, '% a.a.']])
const empty = toCsv([])

test('missing source preserves previous CSV bytes, including BOM and dates', async () => {
  const saved = {}, warnings = []
  const result = await exportCsvs({ load: async () => previous, save: async (n,t) => { saved[n]=t }, warn: t => warnings.push(t) })
  assert.equal(result.preserved.length, 4)
  assert.equal(Object.keys(saved).length, 4)
  assert.ok(Object.values(saved).every(t => t === previous))
  assert.equal(warnings.length, 4)
})

test('missing valid previous TFC aborts entire export before any writes', async () => {
  const saved = []
  await assert.rejects(exportCsvs({ load: async n => n === 'csv/tfc.csv' ? empty : previous, save: async n => saved.push(n) }), /CSV inválido ou sem dados/)
  assert.deepEqual(saved, [])
})

test('unreachable previous data aborts before writes', async () => {
  const saved = []
  await assert.rejects(exportCsvs({ load: async () => { throw new Error('HTTP 503') }, save: async n => saved.push(n) }), /HTTP 503/)
  assert.deepEqual(saved, [])
})

test('valid recovered TFC uses new series and preserves other CSVs unchanged', async () => {
  const loaded = [], saved = {}
  const result = await exportCsvs({ moedas: { series: { C01: {points: [['2026-11-13', 12.7]]} } }, load: async n => { loaded.push(n); return previous }, save: async (n,t) => {saved[n]=t}, warn: () => {} })
  assert.ok(!loaded.includes('csv/tfc.csv'))
  assert.match(saved['tfc.csv'], /2026-11-13,12.7/)
  assert.equal(saved['tfb.csv'], previous)
  assert.equal(saved['tlp.csv'], previous)
  assert.equal(saved['moedas.csv'], previous)
  assert.equal(result.preserved.length, 3)
})

test('workflow does not bypass CSV export failure', async () => {
  const { readFile } = await import('node:fs/promises')
  const workflow = await readFile(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8')
  const step = workflow.split('- name: Gerar CSV das séries do BNDES (Power Query)')[1].split('- name:')[0]
  assert.match(step, /run: node scripts\/export-csv.mjs/)
  assert.doesNotMatch(step, /continue-on-error:\s*true/)
})
