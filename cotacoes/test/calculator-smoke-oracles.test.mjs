import { giroOperation } from '../src/creditComparison.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { DISCOUNT_INITIAL_FORM, parseDiscountForm } from '../src/analiseDesconto.js'

// Validate the exact smoke helpers rather than another copy of their implementation.
for (const script of ['smoke-calculadora.cjs', 'smoke-calculator-layout.cjs']) {
  test(`${script}: fixed civil dates and independent recurrence reconcile IOF`, async () => {
    const source = await readFile(new URL(`../scripts/${script}`, import.meta.url), 'utf8')
    const helper = source.match(/const giroOracle = [\s\S]*?\n}\n/)[0]
    const oracle = runInNewContext(`${helper}\ngiroOracle`)
    // Regra de 11/11/2026: vencimentos no próximo dia útil (06/12 dom, Carnaval, 06/03 sáb, 06/06 dom, 06/11/2027 sáb) e juros por dias corridos.
    const expectedDays = [31, 61, 96, 122, 151, 181, 213, 242, 273, 304, 334, 367]
    for (const system of ['price', 'sac']) for (const [value, daily, profile, eligible] of [[100000, 0.0082, 'pj', false], [30000, 0.00274, 'simples', true]]) {
      const result = giroOperation({ value, n: 12, rate: 2, unit: 'am', system, start: '2026-11-06', firstDue: '2026-12-06', profile, eligible, fees: 0 })
      assert.equal(result.ok, true)
      assert.deepEqual(result.rows.map(row => row.days), expectedDays)
      const expected = oracle(system, value, daily)
      assert.ok(Math.abs(result.iof - expected.iof) < 1e-7)
      assert.ok(Math.abs(result.total - expected.total) < 1e-7)
      assert.ok(Math.abs(result.interest - expected.interest) < 1e-7)
    }
    assert.equal(oracle('price').iof.toFixed(2), '2060.41')
    assert.equal(oracle('sac').iof.toFixed(2), '2001.55')
    // Os recálculos antigos (meses iguais) não podem voltar sem aviso.
    assert.notEqual(oracle('price').iof.toFixed(2), '2054.86')
    assert.ok(source.includes(".fill('2026-11-06')"))
    assert.ok(source.includes(".fill('2026-12-06')"))
  })
}

test('discount smoke independently reconciles operation, CET, monthly and annual totals', () => {
  const { operation, result, errors } = parseDiscountForm({ ...DISCOUNT_INITIAL_FORM, titleFeeMode: 'total' })
  assert.deepEqual(errors, {})
  assert.equal(result.ok, true)
  // Regra de 11/11/2026: 05/12/2026 é sábado, o título é pago em 07/12 e juros e IOF contam 32 dias.
  const gross = 225600.43, days = 32
  const operationInterest = gross * 0.0183 * days / 30
  const operationCost = operationInterest + (gross - operationInterest) * (0.0038 + days * 0.000082) + 564 + 260
  const monthlyInterest = gross * 0.0175 * days / 30
  const monthlyCost = 6 * (monthlyInterest + (gross - monthlyInterest) * (0.0038 + days * 0.000082) + 564 + 260)
  assert.ok(Math.abs(operation.cost - operationCost) < 1e-7)
  assert.ok(Math.abs(operation.net - (gross - operationCost)) < 1e-7)
  // CET de um único pagamento: (nominal / líquido)^(365/dias) − 1.
  assert.ok(Math.abs(operation.cet - ((gross / (gross - operationCost)) ** (365 / days) - 1)) < 1e-9)
  // Os valores antigos (30 dias, sem ajuste de dia útil) não podem voltar sem aviso.
  assert.notEqual(operation.cost.toFixed(2), '6338.90')
  assert.ok(Math.abs(result.monthly.cost - monthlyCost) < 1e-7)
  assert.ok(Math.abs(result.annual.cost - monthlyCost * 12) < 1e-7)
})
