import test from 'node:test'
import assert from 'node:assert/strict'
import { findPracasContrato } from '../src/pracaBusca.js'
import { PRACAS_CONTRATO, pracaCalendars } from '../src/pracaContrato.js'

const ids = query => findPracasContrato(query).map(p => p.id)

test('busca prefixo e fragmento, sem depender de caixa ou acentos', () => {
  assert.deepEqual(ids('soRoc'), ['SOR'])
  assert.deepEqual(ids('maringa'), ['MGA'])
  assert.deepEqual(ids('  SÃO   PAULO  '), ['SP', 'SPE'])
  assert.deepEqual(ids('  camp sp '), ['CPS'])
  assert.deepEqual(ids('Alphaville'), ['BAR'])
})

test('abre com a lista original e não inventa praças ou calendários', () => {
  assert.deepEqual(ids('  '), PRACAS_CONTRATO.map(p => p.id))
  assert.deepEqual(ids('Votorantim'), [])
  assert.deepEqual(pracaCalendars(ids('Sorocaba')[0]), ['BR', 'SPE', 'SOR'])
})