import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { recoveryPeriod, filterRecovery, groupRecovery, recoveryTreemap, validateRecoveryHistory, UNKNOWN_UF, UNKNOWN_SECTOR } from '../src/recoveryHistory.js'

const published = JSON.parse(await readFile(new URL('../public/recuperacao-historico.json', import.meta.url), 'utf8'))
const referenceDate = '2026-11-09'
const dataset = { ...published, editions: published.editions.filter(date => date <= referenceDate),
  records: published.records.filter(row => row.date <= referenceDate) }

test('public dataset has an edition for every mention and rejects private fields, impossible dates and duplicate IDs', () => {
  assert.equal(validateRecoveryHistory(published), published)
  assert.throws(() => validateRecoveryHistory({...dataset, records:[{...dataset.records[0], cnpj:'x'}]}))
  assert.throws(() => validateRecoveryHistory({...dataset, records:[dataset.records[0],dataset.records[0]]}))
  assert.throws(() => validateRecoveryHistory({...dataset, editions:['2026-02-30']}))
})

test('Jan–Oct comparison reconciles the published snapshot, including the UF and sector gaps', () => {
  const result = recoveryPeriod(dataset, 2026, 1, 10)
  assert.equal(result.current.length, 160)
  assert.equal(result.previous.length, 552)
  assert.equal(result.editionCount, 204)
  assert.equal(result.previousEditionCount, 211)
  assert.equal(filterRecovery(result.current, UNKNOWN_UF, '').length, 67)
  assert.equal(filterRecovery(result.current, '', UNKNOWN_SECTOR).length, 11)
  const groups = groupRecovery(result.current, 'uf', UNKNOWN_UF)
  assert.equal(groups.reduce((sum, group) => sum + group.count, 0), result.current.length)
})

test('incomplete month uses the same end date in the previous year', () => {
  const result = recoveryPeriod(dataset, 2026, 11, 11)
  assert.equal(result.end, '2026-11-09')
  assert.equal(result.previousEnd, '2025-11-09')
  assert.equal(result.current.length, 6)
  assert.ok(result.previous.every(row => row.date <= result.previousEnd))
})

test('treemap preserves proportional area including the unnamed sector', () => {
  const groups = [{label:'Comércio',count:5},{label:UNKNOWN_SECTOR,count:3},{label:'Serviços',count:2}]
  const cells = recoveryTreemap(groups, 100, 70)
  for (const cell of cells) assert.ok(Math.abs(cell.w * cell.h - cell.count * 700) < 1e-8)
})
