import test from 'node:test'
import assert from 'node:assert/strict'
import { CATALOGO_SETORIAL, TOPICOS_ESTUDO, normalizeSector } from '../src/centralSetorial.js'

test('catálogo reúne quinze setores, subsetores únicos por grupo e oito temas de estudo', () => {
  assert.equal(CATALOGO_SETORIAL.length, 15)
  assert.equal(new Set(CATALOGO_SETORIAL.map(g => g.id)).size, 15)
  assert.equal(TOPICOS_ESTUDO.length, 8)
  for (const group of CATALOGO_SETORIAL) assert.equal(new Set(group.topics).size, group.topics.length)
  assert.equal(normalizeSector('Compensadós'), 'compensados')
})



test('novos setores preservam recortes distintos e os IDs legados', () => {
  assert.deepEqual(CATALOGO_SETORIAL.slice(-4).map(group => group.id), ['turismo','varejo','saude','pet'])
  assert.equal(CATALOGO_SETORIAL.find(group => group.id === 'alimentos-agroindustria').topics[5], 'Bebidas')
  assert.equal(CATALOGO_SETORIAL.find(group => group.id === 'textil').topics[4], 'Confecção')
  assert.deepEqual(CATALOGO_SETORIAL.find(group => group.id === 'varejo').topics, ['Alimentos','Bebidas','Vestuário'])
  assert.equal(CATALOGO_SETORIAL.reduce((sum, group) => sum + group.topics.length, 0), 81)
})
