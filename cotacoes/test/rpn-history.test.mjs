import test from 'node:test'
import assert from 'node:assert/strict'
import { createClassicRpnController } from '../src/rpnClassicController.mjs'
import { createRpnHistoryCapture, formatRpnEntry, formatRpnResult, parseHistoryValue, replayRpnEntry } from '../src/rpnHistory.mjs'

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

test('histórico registra resultado científico e financeiro, mas não a gravação de parâmetro', () => {
  const c = createClassicRpnController(), capture = createRpnHistoryCapture()
  const hit = key => {
    const before = c.snapshot()
    return capture(key, before, c.press(key, { captureResult: true }))
  }
  try {
    const steps = ['1','2','n','1','i','1','0','0','0','chs','pv','0','pmt','fv']
    const rows = steps.map(hit).filter(Boolean)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].key, 'fv')
    assert.ok(Math.abs(rows[0].result - 1126.82503013197) < 1e-8)
    assert.match(formatRpnEntry(rows[0]), /^Valor futuro \(FV\) = /)
    assert.equal(formatRpnResult(rows[0]), String(rows[0].result).replace('.', ','))
    assert.equal(hit('g'), null)
    c.setDisplay(9)
    assert.equal(hit('g'), null)
    assert.equal(formatRpnEntry(hit('power')), 'Raiz quadrada = 3')
    c.setDisplay(-1)
    assert.equal(hit('g'), null)
    assert.equal(hit('power'), null, 'erros não entram no histórico')
    assert.equal(hit('rcl'), null)
    assert.equal(hit('fv'), null, 'consulta não entra no histórico')
  } finally { c.dispose() }
})

test('programa com pausa registra só um resultado quando termina', () => {
  let callback
  const c = createClassicRpnController({ schedule: fn => { callback = fn; return 1 }, cancelScheduled() {} })
  const capture = createRpnHistoryCapture()
  const reported = []
  const hit = key => {
    const before = c.snapshot()
    return capture(key, before, c.press(key, { captureResult: true }))
  }
  try {
    c.subscribe(view => { if (view.resultOperation) reported.push(view) })
    for (const key of ['f','runStop','2','enter','3','g','runStop','add','f','runStop'])
      assert.equal(hit(key), null)
    assert.equal(hit('runStop'), null)
    assert.equal(c.snapshot().indicators.paused, true)
    assert.equal(reported.length, 0)
    callback()
    assert.equal(c.snapshot().x, 5)
    assert.equal(reported.length, 1)
    assert.equal(reported[0].resultOperation, 'programResult')
    assert.equal(reported[0].x, 5)
  } finally { c.dispose() }
})


test('programas que só param, pausam ou guardam dados não inventam contas', () => {
  for (const keys of [['runStop'], ['g','runStop'], ['sto','0']]) {
    let resume
    const c = createClassicRpnController({ schedule: fn => { resume = fn; return 1 }, cancelScheduled() {} })
    const reports = []
    c.subscribe(view => reports.push(view))
    for (const key of ['f','runStop',...keys,'f','runStop']) c.press(key)
    c.setDisplay(42)
    assert.equal(c.press('runStop', { captureResult: true }).resultOperation, undefined)
    resume?.()
    assert.ok(reports.every(view => !view.resultOperation))
    c.dispose()
  }
})

test('fita mostra PMT em pt-BR sem arredondar a copia', () => {
  const entry = { key: 'pmt', label: 'Pagamento (PMT)', result: 39232.85259779815 }
  assert.equal(formatRpnEntry(entry, { presentation: true }), 'Pagamento (PMT) = 39.232,85')
  assert.equal(formatRpnResult(entry), '39232,85259779815')
  assert.equal(formatRpnEntry({ ...entry, result: 0 }, { presentation: true }), 'Pagamento (PMT) = 0,00')
  assert.equal(formatRpnEntry({ key: 'divide', left: 1, right: 3, result: 1 / 3 }, { presentation: true }), '1 ÷ 3 = 0,3333333333')
  assert.match(formatRpnEntry({ ...entry, key: 'sqrt', result: 1e-14 }, { presentation: true }), /= 1E-14$/)
  assert.equal(formatRpnEntry({ key: 'date', label: 'Data calculada', result: 3, text: '22.11.2026' }, { presentation: true }), 'Data calculada = 22.11.2026')
})
