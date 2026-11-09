import test from 'node:test'
import assert from 'node:assert/strict'
import { recoveryCellLabel } from '../src/recoveryMapLabels.js'
const measure = text => text.length * 7

test('full sector names only appear when both complete name and count fit', () => {
  assert.deepEqual(recoveryCellLabel('Comércio', 15, 100, 50, measure), {mode:'full', number:'15'})
  assert.equal(recoveryCellLabel('Comércio varejista de alimentos', 15, 100, 50, measure).mode, 'number')
  assert.equal(recoveryCellLabel('Comércio', 15, 100, 25, measure).mode, 'number')
})
test('compact labels show actual counts, never sector indexes, percentages or ellipses', () => {
  assert.deepEqual(recoveryCellLabel('Um setor extenso', 1200, 55, 30, measure), {mode:'number', number:'1.200'})
  assert.deepEqual(recoveryCellLabel('Um setor extenso', 1, 22, 18, measure), {mode:'number', number:'1'})
})
test('unreadably small cells defer to accessible tooltip and complete legend', () => {
  assert.equal(recoveryCellLabel('Setor', 123, 24, 25, measure).mode, 'none')
  assert.equal(recoveryCellLabel('Setor', 1, 25, 15, measure).mode, 'none')
})
test('label mode responds to CSS pixel size rather than SVG coordinates', () => {
  assert.equal(recoveryCellLabel('Comércio', 5, 120, 60, measure).mode, 'full')
  assert.equal(recoveryCellLabel('Comércio', 5, 60, 30, measure).mode, 'number')
})
