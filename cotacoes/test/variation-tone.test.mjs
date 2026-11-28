import assert from 'node:assert/strict'
import test from 'node:test'
import { variationTone } from '../src/variationTone.js'

test('positive variations are up and negative variations are down', () => {
  assert.equal(variationTone(0.01), 'up')
  assert.equal(variationTone(-0.01), 'down')
})

test('zero stays neutral; missing and invalid observations receive no direction', () => {
  assert.equal(variationTone(0), 'flat')
  assert.equal(variationTone(-0), 'flat')
  for (const value of [null, undefined, '', '1', NaN, Infinity, -Infinity]) {
    assert.equal(variationTone(value), null)
  }
})
