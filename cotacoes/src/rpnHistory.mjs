import { createClassicRpnController } from './rpnClassicController.mjs'

const OPS = Object.freeze({ add: '+', subtract: '−', multiply: '×', divide: '÷', power: '^', percent: '%', pctDiff: 'Δ%', pctTotal: '%T' })
export const HISTORY_LIMIT = 100
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
    if (pending || !hasOperation(key) || !ready(before) || !ready(after) || after.message ||
        !Array.isArray(before.stack) || !Array.isArray(after.stack)) return null
    const [right, left, z, t] = before.stack
    const item = replayRpnEntry(key, left, right)
    if (!item || !Object.is(item.result, after.x)) return null
    return (retainsY(key) ? [left, z, t] : [z, t, t]).every((v, i) => Object.is(v, after.stack[i + 1])) ? item : null
  }
}

export function formatRpnEntry(entry) {
  const { key, left, right, result } = entry ?? {}
  if (!hasOperation(key) || ![left, right, result].every(isValid)) return ''
  const f = historyValue
  const expression = key === 'percent' ? `${f(right)}% de ${f(left)}`
    : key === 'pctTotal' ? `${f(right)} como % de ${f(left)}`
      : key === 'pctDiff' ? `Variação de ${f(left)} para ${f(right)} (%)`
        : `${f(left)} ${OPS[key]} ${f(right)}`
  return `${expression} = ${f(result)}`
}
