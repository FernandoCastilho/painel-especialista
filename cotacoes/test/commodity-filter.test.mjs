import test from 'node:test'
import assert from 'node:assert/strict'
import * as market from '../src/marketContext.js'

const items = [
  { id: 'coffee', label: 'Café arábica' },
  { id: 'coffee-ny', label: 'Café arábica · bolsa de Nova York' },
  { id: 'anp-diesel', label: 'Diesel S10' },
  { id: 'soja-saca', label: 'Soja em reais' },
  { id: 'ic-br', label: 'IC-Br' },
]

test('busca parcial por nome sem distinção de acentos, caixa ou ordem', () => {
  assert.deepEqual(market.filterCommodities(items, ' CAFE '), items.slice(0, 2))
  assert.deepEqual(market.filterCommodities(items, 'york cafe'), [items[1]])
  assert.deepEqual(market.filterCommodities(items, 's10'), [items[2]])
  assert.deepEqual(market.filterCommodities(items, 'ic br'), [items[4]])
})

test('busca vazia restaura a lista original; ausência de resultado não altera os dados', () => {
  assert.equal(market.filterCommodities(items, '  '), items)
  assert.deepEqual(market.filterCommodities(items, 'banana'), [])
  assert.equal(items.length, 5)
})
