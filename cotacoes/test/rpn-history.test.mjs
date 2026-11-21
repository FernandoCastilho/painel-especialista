import test from 'node:test'
import assert from 'node:assert/strict'
import { createClassicRpnController } from '../src/rpnClassicController.mjs'
import { createRpnHistoryCapture, formatRpnEntry, parseHistoryValue, replayRpnEntry } from '../src/rpnHistory.mjs'

test('captura operações concluídas reproduzíveis e não digitação', () => {
  const calculator = createClassicRpnController(), capture = createRpnHistoryCapture()
  try {
    const keys = ['2', 'enter', '3', 'add']
    const recorded = keys.map(key => {
      const before = calculator.snapshot()
      return capture(key, before, calculator.press(key))
    }).filter(Boolean)
    assert.deepEqual(recorded, [{ key: 'add', left: 2, right: 3, result: 5 }])
    assert.equal(formatRpnEntry(recorded[0]), '2 + 3 = 5')
  } finally { calculator.dispose() }
})

test('cópia parcial de visores e alterações de memória não são operações', () => {
  const c = createClassicRpnController(), capture = createRpnHistoryCapture()
  try {
    const steps = ['4', 'sto', '1', '2', 'sto', 'add', '1', 'g', 'roll', '0', '5',
      'f', '5', '3', 'enter', '0', 'divide', 'on', 'on']
    for (const key of steps) {
      const before = c.snapshot()
      const after = c.press(key)
      assert.equal(capture(key, before, after), null, key)
    }
  } finally { c.dispose() }
})

test('editar reutiliza convenções RPN em pilha separada e rejeita divisão por zero', () => {
  const main = createClassicRpnController()
  try {
    main.setDisplay(42)
    const math = new Map([
      ['add', [2, 3, 5]], ['subtract', [2, 3, -1]], ['multiply', [2, 3, 6]],
      ['divide', [10, 4, 2.5]], ['power', [2, 3, 8]], ['percent', [50, 10, 5]],
      ['pctDiff', [20, 30, 50]], ['pctTotal', [10, 4, 40]],
    ])
    for (const [key, [left, right, result]] of math) {
      assert.deepEqual(replayRpnEntry(key, left, right), { key, left, right, result })
    }
    assert.equal(replayRpnEntry('divide', 1, 0), null)
    assert.equal(replayRpnEntry('runStop', 1, 0), null)
    assert.equal(replayRpnEntry('add', Infinity, 1), null)
    assert.equal(main.snapshot().x, 42)
    const decimal = replayRpnEntry('add', 0.1, 0.2)
    assert.equal(parseHistoryValue(formatRpnEntry(decimal).split(' = ')[1]), decimal.result)
    const large = replayRpnEntry('add', 1000000000000, 1)
    assert.equal(formatRpnEntry(large), '1000000000000 + 1 = 1000000000001')
  } finally { main.dispose() }
})

test('edição aceita vírgula, ponto, zero, negativo e expoente sem interpretar expressões', () => {
  for (const [raw, expected] of [[' 0 ', 0], ['−1,25', -1.25], ['0.56', 0.56], ['-2e-7', -2e-7]]) assert.equal(parseHistoryValue(raw), expected)
  for (const bad of [null, '', '1.234,56', '1+2', 'NaN', '1e999', 'Infinity'])
    assert.equal(parseHistoryValue(bad), null)
})


test('edição recusa uma mantissa não nula que viraria zero silenciosamente', () => {
  for (const raw of ['1e-999', '−1e-999', ',05e-999', '0,001e-999']) assert.equal(parseHistoryValue(raw), null)
  assert.equal(parseHistoryValue('0e-999'), 0)
  assert.equal(parseHistoryValue('0,00'), 0)
  assert.equal(parseHistoryValue('1e-100'), 1e-100)
})
