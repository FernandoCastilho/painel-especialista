import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
test('juros: todos os blocos do Brasil precedem o exterior', () => {
  const app = source('Juros.jsx')
  const brasil = app.slice(app.indexOf('<section aria-labelledby="juros-brasil">'), app.indexOf('<section aria-labelledby="juros-exterior">'))
  const exterior = app.slice(app.indexOf('<section aria-labelledby="juros-exterior">'), app.indexOf("{open &&"))
  for (const component of ['RatesSnapshot', 'MacroStatus', 'Curves']) {
    assert.match(brasil, new RegExp(`<${component}[^>]+region="brasil"`))
    assert.match(exterior, new RegExp(`<${component}[^>]+region="exterior"`))
  }
  assert.match(brasil, /<CdiFuturoTable /)
  assert.doesNotMatch(exterior, /<CdiFuturoTable /)
})
test('juros: painel Selic removido, sem quebrar modal e série', () => {
  const macro = source('Macro.jsx')
  assert.doesNotMatch(source('Juros.jsx'), /<SelicChart/)
  assert.match(macro, /export function SelicChart/)
  assert.match(source('RateModal.jsx'), /<SelicChart/)
  assert.match(source('ratesSnapshot.js'), /\['SELIC','Brasil · Selic meta','selic'/)
})
test('juros: snapshot separa SOFR dos indicadores brasileiros', () => {
  assert.match(source('RatesSnapshot.jsx'), /region === 'brasil' \? domestic.filter\(row => row.id !== 'SOFR'\)/)
  assert.match(source('RatesSnapshot.jsx'), /domestic.filter\(row => row.id === 'SOFR'\), ...policyList/)
})

test('juros: separação mantém tabelas interativas e avisos da região', () => {
  const curves = source('Curves.jsx')
  assert.match(curves, /region === 'brasil' \? \['br', 'cc'\]\.includes\(id\)/)
  assert.match(curves, /region === 'exterior' \? \['us', 'eu'\]\.includes\(id\)/)
  assert.match(curves, /filter\(\(\[id\]\) => tables\.includes\(id\)\)/)
  assert.match(source('Macro.jsx'), /region === 'brasil' \? \['cdi', 'selic'\]/)
  assert.match(source('Macro.jsx'), /region === 'exterior' \? \['sofr', 'sofrAvg'\]/)
  assert.match(source('RatesSnapshot.jsx'), /compareRates/)
  assert.match(source('RatesSnapshot.jsx'), /onOpen=\{onOpen\}/)
  assert.match(source('Juros.jsx'), /kind=\{open\}/)
})
