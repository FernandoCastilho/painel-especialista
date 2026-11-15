import test from 'node:test'
import assert from 'node:assert/strict'
import { INDICATORS, INSTITUTIONS, scenarioValue } from '../src/scenarios.js'
const focus = { rows: [{ label: 'PIB', values: { 2026: { median: 2.5 }, 2027: { median: 2 } } }] }
const banks = { institutions: [{ name: 'BB', years: { 2026: { pib: 1.8, usd: 5.4, selic: 0 }, 2027: { pib: 2.2 } } }] }
test('scenario has exactly four metrics and ordered six institutions', () => {
  assert.deepEqual(INDICATORS.map(x => x.id), ['pib', 'ipca', 'selic', 'usd'])
  assert.deepEqual(INSTITUTIONS, ['FOCUS', 'Itaú BBA', 'Bradesco', 'Santander', 'BB', 'BTG'])
})
test('year selection reads each year independently, without substituting missing years', () => {
  assert.equal(scenarioValue('FOCUS', INDICATORS[0], '2026', focus, banks), 2.5)
  assert.equal(scenarioValue('FOCUS', INDICATORS[0], '2027', focus, banks), 2)
  assert.equal(scenarioValue('BB', INDICATORS[0], '2026', focus, banks), 1.8)
  assert.equal(scenarioValue('BB', INDICATORS[0], '2027', focus, banks), 2.2)
  assert.equal(scenarioValue('BB', INDICATORS[3], '2027', focus, banks), null)
})
test('missing and invalid values remain null; real zero remains zero', () => {
  assert.equal(scenarioValue('Santander', INDICATORS[0], '2026', focus, banks), null)
  assert.equal(scenarioValue('FOCUS', INDICATORS[0], '2026', undefined, undefined), null)
  assert.equal(scenarioValue('BB', INDICATORS[2], '2026', focus, banks), 0)
  assert.equal(scenarioValue('BB', INDICATORS[0], '2026', null, { institutions:[{ name:'BB',years:{2026:{pib:NaN}}}] }), null)
})
test('published bank dataset has only supported sources and numeric or absent values', async () => {
  const { readFile } = await import('node:fs/promises')
  const data = JSON.parse(await readFile(new URL('../public/cenarios.json', import.meta.url)))
  assert.deepEqual(data.institutions.map(bank => bank.name), INSTITUTIONS.slice(1))
  for (const bank of data.institutions) {
    if (Object.keys(bank.years).length) {
      assert.match(bank.date, /^\d{4}-\d{2}-\d{2}$/)
      assert.ok(bank.url.startsWith('https://'))
    }
    for (const [year, values] of Object.entries(bank.years)) {
      assert.ok(['2026', '2027'].includes(year))
      for (const [metric, value] of Object.entries(values)) {
        assert.ok(INDICATORS.some(indicator => indicator.id === metric))
        assert.ok(value === null || (typeof value === 'number' && Number.isFinite(value)))
      }
    }
  }
})

import { FOCUS_MARK, compareToFocus } from '../src/scenarios.js'
test('sinalizador contra o Focus: acima, abaixo, igual (2 casas) e ausente', () => {
  assert.equal(compareToFocus(5.3, 5.2), 'up')
  assert.equal(compareToFocus(5.1, 5.2), 'down')
  assert.equal(compareToFocus(5.2, 5.2), 'same')
  assert.equal(compareToFocus(5.2049, 5.2), 'same') // arredonda como a tela mostra
  assert.equal(compareToFocus(5.206, 5.2), 'up')
  assert.equal(compareToFocus(null, 5.2), null)
  assert.equal(compareToFocus(5.2, null), null)
  assert.equal(compareToFocus(undefined, undefined), null)
  assert.deepEqual(Object.keys(FOCUS_MARK), ['up', 'down', 'same'])
})

import { idadeProjecao, textoIdadeProjecao } from '../src/scenarios.js'
test('idade da projeção: dias corridos em Brasília e alerta acima de 14 dias', () => {
  const agora = Date.parse('2026-11-09T15:00:00Z')
  assert.deepEqual(idadeProjecao('2026-09-25', agora), { dias: 45, data: '25/09', antiga: true })
  assert.equal(idadeProjecao('2026-10-26', agora).antiga, false)
  assert.equal(idadeProjecao('2026-10-26', agora).dias, 14)
  assert.equal(idadeProjecao('2026-10-25', agora).antiga, true)
  assert.equal(idadeProjecao('2026-11-09', agora).dias, 0)
  // 01:00 UTC de 10/11 ainda é 09/11 em Brasília
  assert.equal(idadeProjecao('2026-11-09', Date.parse('2026-11-10T01:00:00Z')).dias, 0)
  assert.equal(idadeProjecao(undefined, agora), null)
  assert.equal(idadeProjecao('2026-9-5', agora), null)
  assert.equal(textoIdadeProjecao(idadeProjecao('2026-09-25', agora)), 'projeção de 25/09 (há 45 dias)')
  assert.equal(textoIdadeProjecao(idadeProjecao('2026-11-08', agora)), 'projeção de 08/11 (há 1 dia)')
  assert.equal(textoIdadeProjecao(null), 'fonte pendente')
})

import { textoHaDias } from '../src/scenarios.js'
test('idade da projeção em texto curto, para a linha do banco na tabela', () => {
  const agora = Date.parse('2026-11-09T15:00:00Z')
  assert.equal(textoHaDias(idadeProjecao('2026-09-25', agora)), 'há 45 dias')
  assert.equal(textoHaDias(idadeProjecao('2026-11-08', agora)), 'há 1 dia')
  assert.equal(textoHaDias(idadeProjecao('2026-11-09', agora)), 'hoje')
  assert.equal(textoHaDias(idadeProjecao('2026-11-12', agora)), 'data futura')
  assert.equal(textoHaDias(null), '')
})
