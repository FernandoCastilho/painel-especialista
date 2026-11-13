import test from 'node:test'
import assert from 'node:assert/strict'
import { rateDirection } from '../src/rateDirection.js'
import { snapshotRows } from '../src/ratesSnapshot.js'
import { policyRows } from '../src/policyRates.js'
test('juros: alta, queda e estabilidade do histórico para atual', () => {
  assert.equal(rateDirection(15,14), 'up')
  assert.equal(rateDirection(13.75,15), 'down')
  assert.equal(rateDirection(13.75,13.75), 'flat')
  for (const missing of [null,undefined,NaN,'15']) assert.equal(rateDirection(15,missing), null)
})
test('Fed: compara os limites sem inventar taxa média', () => {
  assert.equal(rateDirection([3.75,4],[3.5,3.75]), 'up')
  assert.equal(rateDirection([3.5,3.75],[3.75,4]), 'down')
  assert.equal(rateDirection([3.75,4],[3.75,4]), 'flat')
  assert.equal(rateDirection([3.5,4],[3.75,3.75]), null)
  assert.equal(rateDirection([3.75,4],3.75), null)
})
test('adaptações preservam valores numéricos para comparação sem ler textos formatados', () => {
  const periods = [{id:'day',date:'2026-11-13'}]
  const row = snapshotRows({macro:{selic:[[Date.UTC(2026,10,12),13.75]]},periods})[0]
  assert.equal(row.cells.day.comparisonValue,13.75)
  const fed = policyRows({series:{FED:{points:[{date:'2026-11-12',lower:3.75,upper:4}]}}},periods)[0]
  assert.deepEqual(fed.cells.day.comparisonValue,[3.75,4])
})
