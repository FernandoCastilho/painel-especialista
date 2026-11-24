import test from 'node:test'
import assert from 'node:assert/strict'
import { convertEquivalentRate as convert } from '../src/rpnRateConversion.mjs'

function value(input) {
  const result = convert(input)
  assert.equal(result.ok, true, result.error)
  return result.value
}

function close(actual, expected, tolerance = 1e-11) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}, got ${actual}`)
}

test('1% efetivo a.m. não é 12% a.a.; percurso inverso sem arredondar', () => {
  const annual = value({ rate: 1, from: 'month', to: 'year' })
  close(annual, 12.68250301319697)
  close(value({ rate: annual, from: 'year', to: 'month' }), 1)
})

for (const dayBasis of [365, 252]) {
  test(`base ${dayBasis}: todos os pares, positivos e negativos, preservam fator anual e retornam à origem`, () => {
    const perYear = { day: dayBasis, month: 12, year: 1 }
    for (const from of Object.keys(perYear)) for (const to of Object.keys(perYear)) {
      for (const rate of [0.015, 1, -0.04, 0]) {
        const converted = value({ rate, from, to, dayBasis })
        close((1 + converted / 100) ** perYear[to], (1 + rate / 100) ** perYear[from], 1e-9)
        close(value({ rate: converted, from: to, to: from, dayBasis }), rate, 1e-8)
      }
    }
  })
}

test('as duas convenções diárias distinguem o mesmo percentual anual', () => {
  const args = { rate: 12, from: 'year', to: 'day' }
  assert.ok(value({ ...args, dayBasis: 252 }) > value({ ...args, dayBasis: 365 }))
})

test('entrada inválida, basis diária sem escolha e resultado não representável retornam erro', () => {
  for (const args of [
    undefined, { rate: 1, from: 'hour', to: 'month' },
    { rate: 1, from: 'day', to: 'year' }, { rate: 1, from: 'day', to: 'day' },
    { rate: 1, from: 'day', to: 'year', dayBasis: 360 },
    { rate: 1, from: 'day', to: 'year', dayBasis: '365' },
    ...[-100, -102, NaN, Infinity, -Infinity, '1', null].map(rate => ({ rate, from: 'month', to: 'year' })),
    { rate: 1e308, from: 'month', to: 'year' },
    { rate: -99, from: 'month', to: 'year' },
    { rate: Number.MIN_VALUE, from: 'year', to: 'day', dayBasis: 365 },
  ]) {
    const result = convert(args)
    assert.equal(result.ok, false)
    assert.equal(typeof result.error, 'string')
    assert.equal('value' in result, false)
  }
})

test('precisão perto de zero e de −100%; identidade e zero são canônicos', () => {
  close(value({ rate: 1e-14, from: 'month', to: 'year' }), 1.2e-13, 1e-26)
  assert.equal(value({ rate: Number.MIN_VALUE, from: 'day', to: 'year', dayBasis: 365 }), Number.MIN_VALUE * 365)
  close(value({ rate: -99.99999999999999, from: 'year', to: 'month' }), -95.22047192917668, 1e-8)
  assert.equal(value({ rate: -0, from: 'month', to: 'year' }), 0)
  assert.equal(value({ rate: -42, from: 'month', to: 'month' }), -42)
})
