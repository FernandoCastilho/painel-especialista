import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { findIbgeActivities } from '../src/cbsActivitySearch.js'

const { datasets } = JSON.parse(readFileSync(new URL('../src/ibgeCbsSnapshot.json', import.meta.url)))

test('IBGE search ignores accents and case and matches partial names across sectors', () => {
  assert.deepEqual(findIbgeActivities(datasets, '  FABRICAÇÃO  '), findIbgeActivities(datasets, 'fabricacao'))
  const results = findIbgeActivities(datasets, 'alimen')
  assert.deepEqual([...new Set(results.map(group => group.kind))].sort(), ['comercio', 'industria', 'servicos'])
})

test('IBGE search supports codes and combined words without inventing a fallback', () => {
  assert.ok(findIbgeActivities(datasets, '46.3').some(group => group.id === 'comercio-83319'))
  assert.equal(findIbgeActivities(datasets, 'industria-116911')[0].kind, 'industria')
  assert.ok(findIbgeActivities(datasets, 'transporte servicos').every(group => group.kind === 'servicos'))
  assert.deepEqual(findIbgeActivities(datasets, 'atividadequenaoexiste999'), [])
})

test('empty IBGE search includes the entire available base and leaves input data intact', () => {
  const before = JSON.stringify(datasets)
  const results = findIbgeActivities(datasets, '')
  assert.equal(results.length, datasets.reduce((count, dataset) => count + dataset.groups.length, 0))
  assert.equal(new Set(results.map(group => group.id)).size, results.length)
  findIbgeActivities(datasets, 'alimen')
  assert.equal(JSON.stringify(datasets), before)
})
