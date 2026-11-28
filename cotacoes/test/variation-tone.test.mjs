import assert from 'node:assert/strict'
import test from 'node:test'
import { displayedVariation, variationTone } from '../src/variationTone.js'

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

test('small values shown as zero do not acquire a sign or a direction', () => {
  for (const value of [-0.004, 0, 0.004]) {
    assert.equal(displayedVariation(value), 0)
    assert.equal(variationTone(displayedVariation(value)), 'flat')
  }
  assert.equal(displayedVariation(-0.005), -0.01)
  assert.equal(displayedVariation(0.005), 0.01)
  assert.equal(displayedVariation(0.004, 3), 0.004)
  assert.equal(displayedVariation(null), null)
})
