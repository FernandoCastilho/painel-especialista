import { createClassicRpnController } from './rpnClassicController.mjs'

const OPS = Object.freeze({ add: '+', subtract: '−', multiply: '×', divide: '÷', power: '^', percent: '%', pctDiff: 'Δ%', pctTotal: '%T' })
const RESULT_LABELS = Object.freeze({
  n: 'Número de períodos (n)', i: 'Taxa por período (i, %)', pv: 'Valor presente (PV)', pmt: 'Pagamento (PMT)',
  fv: 'Valor futuro (FV)', npv: 'Valor presente líquido (VPL)', irr: 'Taxa interna de retorno (TIR, %)',
  amort: 'Juros da amortização', int: 'Juros simples (base 360)', price: 'Preço do título', ytm: 'Taxa até o vencimento (YTM, %)',
  sl: 'Depreciação linear', soyd: 'Depreciação pela soma dos dígitos', db: 'Depreciação pelo saldo decrescente',
  months: 'Conversão em meses', monthlyRate: 'Taxa mensal (%, divisão por 12)', date: 'Data calculada', days: 'Dias corridos',
  mean: 'Média de X', stdev: 'Desvio-padrão de X', weighted: 'Média ponderada',
  linearX: 'Estimativa de X', linearY: 'Estimativa de Y', factorial: 'Fatorial', sqrt: 'Raiz quadrada',
  exp: 'Exponencial', ln: 'Logaritmo natural', integer: 'Parte inteira', frac: 'Parte fracionária', rnd: 'Arredondamento', reciprocal: 'Inverso',
  programResult: 'Resultado do programa (X)', changeSign: 'Troca de sinal', equivalentRate: 'Taxa equivalente (%)',
})
export const historyValue = value => String(value).replace('.', ',')
const ready = s => s?.indicators?.on === true && !s.program && !s.indicators.running && !s.shift
const isValid = Number.isFinite
const hasOperation = key => Object.hasOwn(OPS, key)
const retainsY = key => ['pctTotal', 'pctDiff', 'percent'].includes(key)

export function parseHistoryValue(raw) {
  if (typeof raw !== 'string') return null
  const text = raw.trim().replace(/^−/, '-').replace(',', '.')
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null
  const value = Number(text)
  // Não aceite número não nulo que perdeu toda a magnitude ao ser convertido.
  const mantissa = text.split(/[eE]/, 1)[0]
  return isValid(value) && (value !== 0 || !/[1-9]/.test(mantissa)) ? value : null
}

export function replayRpnEntry(key, left, right, factory = createClassicRpnController) {
  if (!hasOperation(key) || !isValid(left) || !isValid(right)) return null
  // O histórico usa uma pilha separada e o mesmo motor. Nunca toca o visor atual.
  let calculator
  try {
    calculator = factory()
    if (calculator.setDisplay(left).message || calculator.press('enter').message || calculator.setDisplay(right).message) return null
    const out = calculator.press(key)
    return ready(out) && !out.message && isValid(out.x) ? { key, left, right, result: out.x } : null
  } catch { return null }
  finally { calculator?.dispose() }
}

const AUXILIARY = Object.freeze({
  amort: ['Principal'], int: ['Principal', 'Juros base 365'], price: ['Juros corridos'],
  sl: ['Saldo a depreciar'], soyd: ['Saldo a depreciar'], db: ['Saldo a depreciar'], days: ['Dias na base 30/360'],
  mean: ['Média de Y'], stdev: ['Desvio-padrão de Y'], linearX: ['Correlação'], linearY: ['Correlação'],
})

export function captureReportedRpnResult(after) {
  const op = after?.resultOperation
  if (!Object.hasOwn(RESULT_LABELS, op) || !after.indicators?.on ||
      after.program || after.indicators?.running || after.message || !isValid(after.x)) return null
  return { key: op, label: RESULT_LABELS[op], result: after.x, text: op === 'date' ? after.display : undefined,
    details: (AUXILIARY[op] ?? []).flatMap((label, i) => isValid(after.stack?.[i + 1]) ? [{ label, value: after.stack[i + 1] }] : []) }
}

export function createRpnHistoryCapture() {
  let memory = null, dot = false, arithmetic = false, jump = 0
  return function capture(key, before, after) {
    const pending = Boolean(memory || jump)
    // Alguns modos internos não estão no snapshot; reconhecemos a sequência física, não apenas o visor.
    if (['cancel', 'on'].includes(key) || after?.message || before?.program || !after?.indicators?.on) {
      memory = null; dot = false; arithmetic = false; jump = 0
    } else if (key === 'f' || key === 'g') {
      // A seleção de prefixo não gera uma conta.
    } else if (jump) jump = /^[0-9]$/.test(key) ? jump - 1 : 0
    else if (before?.shift === 'g' && key === 'roll') { jump = 2; memory = null }
    else if (before?.shift) memory = null
    else if (memory) {
      if (!dot && key === 'decimal') dot = true
      else if (memory === 'sto' && !dot && !arithmetic && ['add', 'subtract', 'multiply', 'divide'].includes(key)) arithmetic = true
      else memory = null
    } else if (key === 'sto' || key === 'rcl') { memory = key; dot = false; arithmetic = false }
    const reported = !before?.program && !before?.indicators?.running && captureReportedRpnResult(after)
    if (reported) return reported
    if (pending || !hasOperation(key) || !ready(before) || !ready(after) || after.message ||
        !Array.isArray(before.stack) || !Array.isArray(after.stack)) return null
    const [right, left, z, t] = before.stack
    const item = replayRpnEntry(key, left, right)
    if (!item || !Object.is(item.result, after.x)) return null
    return (retainsY(key) ? [left, z, t] : [z, t, t]).every((v, i) => Object.is(v, after.stack[i + 1])) ? item : null
  }
}

export function formatRpnResult(entry) {
  return isValid(entry?.result) ? (entry.text || historyValue(entry.result)) : ''
}

export function formatRpnEntry(entry) {
  if (entry?.label) return [
    `${entry.label} = ${formatRpnResult(entry)}`,
    ...(entry.details ?? []).map(d => `${d.label} = ${historyValue(d.value)}`),
  ].join(' · ')
  const { key, left, right, result } = entry ?? {}
  if (!hasOperation(key) || ![left, right, result].every(isValid)) return ''
  const f = historyValue
  const expression = key === 'percent' ? `${f(right)}% de ${f(left)}`
    : key === 'pctTotal' ? `${f(right)} como % de ${f(left)}`
      : key === 'pctDiff' ? `Variação de ${f(left)} para ${f(right)} (%)`
        : `${f(left)} ${OPS[key]} ${f(right)}`
  return `${expression} = ${f(result)}`
}
