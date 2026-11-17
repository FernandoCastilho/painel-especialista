import { test } from 'node:test'
import assert from 'node:assert/strict'
import { manchete } from '../src/manchete.js'
import { rollPlan } from '../src/rollNumber.js'

const texto = (partes) => partes.map((p) => p.text).join('')

test('manchete usa só os textos dos quadros, com a referência do Ibovespa', () => {
  const itens = [
    { key: 'USDBRL', value: '5,7731', text: '-0,19%', tone: 'down' },
    { key: 'EURBRL', value: '6,3546', text: '-0,10%', tone: 'down' },
    { key: 'IBOV', value: '169.812', text: '+0,31%', tone: 'up', note: '17/11' },
  ]
  const partes = manchete(itens)
  assert.equal(texto(partes), 'Dólar a 5,7731, -0,19% no dia. Ibovespa +0,31% no fechamento de 17/11.')
  assert.deepEqual(partes.filter((p) => p.tone).map((p) => [p.text, p.tone]), [['-0,19%', 'down'], ['+0,31%', 'up']])
})

test('manchete não inventa variação nem aparece sem o dólar', () => {
  assert.equal(manchete([]), null)
  assert.equal(manchete(null), null)
  assert.equal(manchete([{ key: 'IBOV', value: '169.812', text: '+0,31%', tone: 'up' }]), null)
  assert.equal(texto(manchete([{ key: 'USDBRL', value: '5,7731', text: null, tone: 'flat' }])), 'Dólar a 5,7731.')
  // Ibovespa sem variação ou com arquivo parado fica de fora
  assert.equal(texto(manchete([{ key: 'USDBRL', value: '5,7731', text: '+0,10%', tone: 'up' }, { key: 'IBOV', value: '169.812', text: null }])), 'Dólar a 5,7731, +0,10% no dia.')
  assert.equal(texto(manchete([{ key: 'USDBRL', value: '5,7731', text: '+0,10%', tone: 'up' }, { key: 'IBOV', value: '169.812', text: '+0,31%', tone: 'up', stale: true }])), 'Dólar a 5,7731, +0,10% no dia.')
})

test('número que rola termina exatamente no texto novo e mantém o formato', () => {
  const p = rollPlan('5,7731', '5,7751')
  assert.equal(p.up, true)
  assert.equal(p.at(0), '5,7731')
  assert.equal(p.at(0.5), '5,7741')
  assert.equal(p.at(1), '5,7751')
  assert.equal(rollPlan('169.812', '169.500').at(0.5), '169.656')
  assert.equal(rollPlan('169.812', '169.500').up, false)
  assert.equal(rollPlan('4,63%', '4,71%').at(0.5), '4,67%')
  assert.equal(rollPlan('0,03623', '0,03625').at(1), '0,03625')
})

test('número só rola entre textos de mesmo formato', () => {
  assert.equal(rollPlan('5,7731', '5,7731'), null)
  assert.equal(rollPlan('—', '5,7731'), null)
  assert.equal(rollPlan('5,77', '5,7731'), null)
  assert.equal(rollPlan('4,63%', '4,63'), null)
  assert.equal(rollPlan(undefined, '5,7731'), null)
})
