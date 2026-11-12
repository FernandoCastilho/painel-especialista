import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
test('juros: todos os blocos do Brasil precedem o exterior', () => {
  const app = source('App.jsx')
  const brasil = app.slice(app.indexOf('<section aria-labelledby="juros-brasil">'), app.indexOf('<section aria-labelledby="juros-exterior">'))
  const exterior = app.slice(app.indexOf('<section aria-labelledby="juros-exterior">'), app.indexOf("{tab === 'cenarios'"))
  for (const component of ['RatesSnapshot', 'Macro', 'Curves']) {
    assert.match(brasil, new RegExp(`<${component}[^>]+region="brasil"`))
    assert.match(exterior, new RegExp(`<${component}[^>]+region="exterior"`))
  }
  assert.match(brasil, /<CdiFuturo /)
  assert.doesNotMatch(exterior, /<CdiFuturo /)
})
test('juros: painel Selic removido, sem quebrar modal e série', () => {
  const macro = source('Macro.jsx')
  assert.doesNotMatch(macro.slice(macro.indexOf('export default function Macro')), /<SelicChart/)
  assert.match(macro, /export function SelicChart/)
  assert.match(source('RateModal.jsx'), /<SelicChart/)
  assert.match(source('ratesSnapshot.js'), /\['SELIC','Brasil · Selic meta','selic'/)
})
test('juros: snapshot separa SOFR dos indicadores brasileiros', () => {
  assert.match(source('RatesSnapshot.jsx'), /region === 'brasil' \? domestic.filter\(row => row.id !== 'SOFR'\)/)
  assert.match(source('RatesSnapshot.jsx'), /domestic.filter\(row => row.id === 'SOFR'\), ...policyList/)
})
