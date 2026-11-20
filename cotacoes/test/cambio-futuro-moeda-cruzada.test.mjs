import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateCrossCurrencyHedge as evaluate } from '../src/cambioFuturoMoedaCruzada.mjs'

const maturity = '2028-02-29'
const leg = (rate, overrides = {}) => ({ rate, maturity, contracted: true, ...overrides })
const base = { usdAmount: 1000, maturity, scenarioUsdBrl: 6.1 }
const eur = { ...base, hedgeCurrency: 'EUR', usdToHedge: leg(0.8), hedgeToBrl: leg(7.5) }

test('USD padrão: trava direta com uma perna contratada e cenário digitado independente', () => {
  const result = evaluate({ ...base, hedgeToBrl: leg(5.875) })
  assert.deepEqual(result, { ok: true, unhedgedBrl: 6100, lockedBrl: 5875, hypotheticalBrl: null, lockedEffectiveUsdBrl: 5.875, notionalHedge: 1000, status: 'locked' })
})

test('duas pernas EUR ou CNH contratadas no vencimento geram valor travado bruto', () => {
  for (const [input, expected, notional] of [
    [eur, 6000, 800],
    [{ ...eur, hedgeCurrency: 'CNH', usdToHedge: leg(7.25), hedgeToBrl: leg(0.8) }, 5800, 7250],
  ]) {
    const result = evaluate(input)
    assert.equal(result.status, 'locked')
    assert.equal(result.lockedBrl, expected)
    assert.ok(Math.abs(result.lockedEffectiveUsdBrl - expected / 1000) < 1e-12)
    assert.equal(result.notionalHedge, notional)
    assert.equal(result.unhedgedBrl, 6100)
    assert.equal(result.hypotheticalBrl, null)
  }
})

test('datas diferentes em qualquer perna, inclusive ambas na mesma data errada, nunca travam', () => {
  const wrong = { maturity: '2028-03-01' }
  for (const input of [
    { ...eur, usdToHedge: leg(0.8, wrong) },
    { ...eur, hedgeToBrl: leg(7.5, wrong) },
    { ...eur, usdToHedge: leg(0.8, wrong), hedgeToBrl: leg(7.5, wrong) },
    { ...base, hedgeToBrl: leg(6, wrong) },
  ]) {
    const result = evaluate(input)
    assert.equal(result.status, 'unlocked')
    assert.equal(result.unhedgedBrl, 6100)
    assert.equal(result.lockedBrl, null)
  }
})

test('ausência de confirmação em qualquer perna não dá trava nem hipótese implícita', () => {
  for (const input of [
    { ...eur, usdToHedge: null },
    { ...eur, usdToHedge: leg(0.8, { contracted: false }) },
    { ...eur, hedgeToBrl: leg(7.5, { contracted: false }) },
    { ...eur, usdToHedge: { rate: null, maturity: null, contracted: true } },
  ]) {
    const result = evaluate(input)
    assert.equal(result.status, 'unlocked')
    assert.equal(result.hypotheticalBrl, null)
    assert.equal(result.lockedBrl, null)
    assert.equal(result.lockedEffectiveUsdBrl, null)
  }
})

test('paridade hipotética explícita só gera cenário separado e exige outra taxa no vencimento', () => {
  const input = { ...eur, usdToHedge: null, hypotheticalUsdToHedge: 0.82 }
  const result = evaluate(input)
  assert.equal(result.status, 'hypothetical')
  assert.equal(result.hypotheticalBrl, 6150)
  assert.equal(result.lockedBrl, null)
  assert.equal(result.lockedEffectiveUsdBrl, null)
  assert.equal(result.unhedgedBrl, 6100)
  assert.equal(evaluate({ ...input, hedgeToBrl: leg(7.5, { maturity: '2028-03-01' }) }).status, 'unlocked')
  assert.equal(evaluate({ ...eur, hypotheticalUsdToHedge: 0.82 }).status, 'locked')
  assert.equal(evaluate({ ...eur, hedgeToBrl: leg(7.5, { contracted: false }), hypotheticalUsdToHedge: 0.82 }).hypotheticalBrl, 6150)
})

test('sem USD/BRL digitado não infere cenário, mesmo com trava', () => {
  assert.equal(evaluate({ ...eur, scenarioUsdBrl: null }).unhedgedBrl, null)
  assert.equal(evaluate({ ...eur, scenarioUsdBrl: null }).lockedBrl, 6000)
})

test('rejeita entradas inválidas, confirmação em texto e estouro numérico', () => {
  for (const input of [
    null, { ...eur, usdAmount: 0 }, { ...eur, usdAmount: '1000' }, { ...eur, maturity: '2027-02-29' },
    { ...eur, hedgeCurrency: 'CNY' }, { ...eur, scenarioUsdBrl: -1 },
    { ...eur, usdToHedge: leg(0.8, { contracted: 'true' }) }, { ...eur, hedgeToBrl: leg(Infinity) },
    { ...eur, hypotheticalUsdToHedge: 0 }, { ...eur, usdAmount: 1e308, hedgeToBrl: leg(1e308) },
  ]) assert.equal(evaluate(input).ok, false)
})
