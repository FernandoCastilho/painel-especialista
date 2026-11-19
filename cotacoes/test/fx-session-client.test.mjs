import test from 'node:test'
import assert from 'node:assert/strict'
import { centralMaxAge } from '../src/useQuotes.js'

test('coleta central: em feriado da B3 a cotação de horas atrás ainda vale, sem consulta direta de cada navegador', () => {
  assert.equal(centralMaxAge(Date.parse('2026-11-20T15:00:00Z')), 4 * 3600000) // Consciência Negra
  assert.equal(centralMaxAge(Date.parse('2026-11-19T15:00:00Z')), 45 * 60000) // dia de pregão, 12h
  assert.equal(centralMaxAge(Date.parse('2026-11-19T02:00:00Z')), 75 * 60000) // madrugada de dia útil
})
