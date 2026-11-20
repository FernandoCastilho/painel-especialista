// Motor próprio. Taxas entram e saem em % por período; preserva a precisão interna.
const fields = ['n', 'i', 'pv', 'pmt', 'fv']
const maxPeriods = 10_000
const maxInputDigits = 14
const normal = new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 12 })
const scientific = new Intl.NumberFormat('pt-BR', { notation: 'scientific', maximumSignificantDigits: 10 })
const error = message => { throw new Error(message) }
const finite = value => Number.isFinite(value) ? (Object.is(value, -0) ? 0 : value) : error('O resultado excede o limite numérico.')
const zeroed = () => Object.fromEntries(fields.map(key => [key, null]))
const formatted = value => Math.abs(value) >= 1e12 || (value !== 0 && Math.abs(value) < 1e-7) ? scientific.format(value) : normal.format(value)
const outputMessage = 'Informe os demais valores antes de calcular.'
const periodic = i => {
  if (!Number.isFinite(i) || i <= -100) error('A taxa por período precisa ser maior que −100%.')
  return i / 100
}
const periodCount = n => {
  if (!Number.isInteger(n) || n < 1 || n > maxPeriods) error('Informe de 1 a 10.000 períodos inteiros.')
  return n
}
const sumCompensated = values => {
  let sum = 0, correction = 0
  for (const value of values) {
    const next = sum + value
    correction += Math.abs(sum) >= Math.abs(value) ? (sum - next) + value : (value - next) + sum
    sum = next
  }
  return sum + correction
}
const discount = (n, r) => Math.exp(-n * Math.log1p(r))
const annuity = (n, r, begin) => r === 0 ? n : -Math.expm1(-n * Math.log1p(r)) / r * (begin ? 1 + r : 1)

// Encontra o resíduo decimal antes de multiplicá-lo por um fator exponencial.
// Com pagamentos exatamente iguais aos juros, um erro de subtração não pode virar saldo.
const decimalParts = number => {
  const [value, exp = '0'] = number.toString().split('e')
  const decimal = value.split('.')[1]?.length ?? 0
  return [BigInt(value.replace('.', '')), decimal - Number(exp)]
}
function carryingBalance(value, payment, percent, begin, valueSign = 1n) {
  const [a, ad] = decimalParts(value)
  const [p, pd] = decimalParts(payment)
  const [i, id] = decimalParts(percent)
  const precision = Math.max(ad + id, pd, pd + id)
  const exact = valueSign * a * i * 10n ** BigInt(precision - ad - id)
    + 100n * p * 10n ** BigInt(precision - pd)
    + (begin ? p * i * 10n ** BigInt(precision - pd - id) : 0n)
  return finite(Number(exact + 'e' + (-precision - 2)))
}
function applyGrowth(principal, balance, r, exponent) {
  if (balance === 0) return finite(-principal)
  const accrued = balance * (Math.expm1(exponent) / r)
  return finite(sumCompensated([-principal, accrued]))
}

function rateFor(flows) {
  const scale = Math.max(...flows.map(Math.abs))
  if (!Number.isFinite(scale) || scale === 0) error('Sem TIR: é preciso haver entrada e saída de caixa.')
  const first = flows.findIndex(x => x !== 0)
  const last = flows.findLastIndex(x => x !== 0)
  const sequence = flows.slice(first, last + 1).map(x => x / scale)
  let changes = 0, prior = 0
  for (const entry of sequence) {
    if (entry === 0) continue
    const sign = Math.sign(entry)
    if (prior && sign !== prior) changes++
    prior = sign
  }
  if (changes === 0) error('Sem TIR: é preciso haver entrada e saída de caixa.')
  if (changes !== 1) error('O fluxo pode ter múltiplas taxas. Não há TIR única validada.')
  const length = sequence.length - 1
  const valueAt = y => sumCompensated(sequence.map((x,t) => x * Math.exp(y >= 0 ? -t * y : (length - t) * y)))
  // Resolve no logaritmo do fator para evitar somar fluxos com expoentes gigantes.
  let low = -30, high = 30, before = valueAt(low), after = valueAt(high)
  if (before === 0 || after === 0 || Math.sign(before) === Math.sign(after)) error('Não foi possível validar uma taxa neste intervalo.')
  for (let j = 0; j < 100; j++) {
    const half = (low + high) / 2, value = valueAt(half)
    if (value === 0 || half === low || half === high || high - low <= 2e-15) {
      const result = finite(100 * Math.expm1(half))
      if (result <= -100 || Math.abs(value) > 1e-9 * sequence.length) error('Não foi possível validar o resultado da taxa.')
      return result
    }
    if (Math.sign(value) === Math.sign(before)) { low = half; before = value }
    else high = half
  }
  error('Não foi possível validar uma taxa neste intervalo.')
}
const buildTvmFlows = (n, pv, pmt, fv, begin) => {
  const flows = Array(n + 1).fill(0)
  flows[0] = pv
  flows[n] = fv
  for (let j = 0; j < n; j++) flows[j + (begin ? 0 : 1)] += pmt
  return flows
}

export function solveTvm(field, values, timing = 'end') {
  if (!fields.includes(field)) error('Registrador financeiro inválido.')
  if (!['end', 'begin'].includes(timing)) error('Modo de pagamento inválido: use início ou fim.')
  if (fields.some(key => key !== field && !Number.isFinite(values[key]))) error(outputMessage)
  const { n, i, pv, pmt, fv } = values, begin = timing === 'begin'
  if (field === 'i') return rateFor(buildTvmFlows(periodCount(n), pv, pmt, fv, begin))
  const r = periodic(i)
  if (field === 'n') {
    // Política explícita: o aplicativo trabalha com períodos inteiros, sem arredondar solução fracionária.
    let value
    if (r === 0) value = pmt === 0 ? NaN : -(pv + fv) / pmt
    else {
      const amount = carryingBalance(pv, pmt, i, begin)
      const endBalance = carryingBalance(fv, pmt, i, begin, -1n)
      const ratio = amount / endBalance
      const delta = sumCompensated([pv, fv]) * r / endBalance
      const logRatio = Math.abs(delta) < 0.5 ? Math.log1p(delta) : Math.log(ratio)
      value = -logRatio / Math.log1p(r)
    }
    if (!Number.isFinite(value) || value < 1 - 1e-8 || value > maxPeriods + 1e-8) error('Não há solução de prazo no intervalo aceito.')
    const integer = Math.round(value)
    if (Math.abs(value - integer) > 1e-7) error('O prazo calculado é fracionário. Ajuste os dados para períodos inteiros.')
    return periodCount(integer)
  }
  periodCount(n)
  // Descontar para PV é estável com taxa positiva; capitalizar para FV quando a taxa é negativa.
  const forward = r < 0
  const factor = forward ? Math.exp(n * Math.log1p(r)) : discount(n, r)
  const payment = forward ? -Math.expm1(n * Math.log1p(r)) / (-r) * (begin ? 1 + r : 1) : annuity(n,r,begin)
  if (field === 'pv') {
    if (r < 0) return applyGrowth(fv, carryingBalance(fv, pmt, i, begin, -1n), r, -n * Math.log1p(r))
    return finite(-sumCompensated([pmt * payment, fv * factor]))
  }
  if (field === 'fv') {
    if (r > 0) return applyGrowth(pv, -carryingBalance(pv, pmt, i, begin), r, n * Math.log1p(r))
    return finite(-sumCompensated([pv * factor, pmt * payment]))
  }
  return finite(forward ? -(pv * factor + fv) / payment : -(pv + fv * factor) / payment)
}

export function calcNpv(flows, percent) {
  if (flows.length < 2) error('Informe CF₀ e pelo menos um fluxo posterior.')
  const rate = periodic(percent)
  const log = Math.log1p(rate)
  return finite(sumCompensated(flows.map((amount,t) => amount === 0 ? 0 : amount * Math.exp(-t * log))))
}
export function calcIrr(flows) {
  if (flows.length < 2) error('Informe CF₀ e pelo menos um fluxo posterior.')
  return rateFor(flows)
}

export function createRpnEngine() {
  let stack = [0,0,0,0], buffer = null, lift = false, lastX = 0, message = ''
  let timing = 'end', finance = zeroed(), cashFlows = [], entries = []

  const push = value => { stack = [value, stack[0], stack[1], stack[2]] }
  const finalize = () => { buffer = null }
  const beginEntry = () => {
    if (buffer !== null) return
    if (lift) push(0)
    else stack[0] = 0
    buffer = ''
  }
  const updateEntry = () => { stack[0] = Number(buffer) || 0 }
  const output = value => {
    finalize()
    if (lift) push(finite(value))
    else stack[0] = finite(value)
    lift = true
  }
  const binary = operation => {
    const [x,y,z,t] = stack
    const result = finite(operation(y,x))
    finalize(); lastX = x; stack = [result,z,t,t]; lift = true
  }
  const cashAdd = () => {
    if (cashFlows.length >= 241) error('O fluxo aceita até 241 valores, incluindo CF₀.')
    finalize(); cashFlows.push(stack[0]); entries.push(1); lift = false
  }
  const suggestFinance = key => {
    const x = stack[0]
    if (key === 'n') periodCount(x)
    if (key === 'i') periodic(x)
    finalize(); finance[key] = x; lift = false
  }
  const snapshot = () => ({ display: buffer === null || buffer === '' ? formatted(stack[0]) : buffer.replace('.', ','), message,
    stack: [...stack], settings: { paymentTiming: timing }, finance: { ...finance }, cashFlows: [...cashFlows] })
  function press(key) {
    message = ''
    try {
      if (/^[0-9]$/.test(key)) {
        beginEntry()
        if (buffer.replace(/[-.]/g,'').length >= maxInputDigits) error('Limite de 14 algarismos na entrada.')
        if (buffer === '0' || buffer === '-0') buffer = buffer[0] === '-' ? '-' + key : key
        else buffer += key
        updateEntry()
      } else if (key === 'decimal') {
        beginEntry()
        if (!buffer.includes('.')) buffer = (buffer || '0') + '.'
        updateEntry()
      } else if (key === 'enter') { finalize(); push(stack[0]); lift = false }
      else if (key === 'add') binary((y,x) => y+x)
      else if (key === 'subtract') binary((y,x) => y-x)
      else if (key === 'multiply') binary((y,x) => y*x)
      else if (key === 'power') binary((y,x) => y < 0 && !Number.isInteger(x) ? error('Expoente fracionário com base negativa.') : y ** x)
      else if (key === 'sqrt') {
        const x = stack[0]
        if (x < 0) error('Não há raiz real de número negativo.')
        finalize(); lastX = x; stack[0] = Math.sqrt(x); lift = true
      }
      else if (key === 'divide') binary((y,x) => x === 0 ? error('Não é possível dividir por zero.') : y/x)
      else if (key === 'swap') { finalize(); [stack[0],stack[1]] = [stack[1],stack[0]]; lift = true }
      else if (key === 'drop') { finalize(); stack = [stack[1],stack[2],stack[3],stack[0]]; lift = true }
      else if (key === 'lastX') { output(lastX) }
      else if (key === 'changeSign') {
        if (buffer !== null) { buffer = buffer.startsWith('-') ? buffer.slice(1) : '-' + (buffer || '0'); updateEntry() }
        else stack[0] = finite(-stack[0])
      } else if (key === 'percent') {
        const [x,y] = stack, value = finite(y * (x/100))
        finalize(); lastX = x; stack[0] = value; lift = true
      } else if (key === 'backspace') {
        if (buffer !== null) { buffer = buffer.slice(0,-1); if (buffer === '-') buffer = ''; updateEntry() }
        else { stack[0] = 0; lift = false }
      } else if (key === 'clearEntry') { finalize(); stack[0] = 0; lift = false }
      else if (key === 'clearAll') { finalize(); stack = [0,0,0,0]; lift = false; lastX = 0 }
      else if (key === 'clearFinance') { finance = zeroed(); timing = 'end'; message = 'Registros financeiros limpos.' }
      else if (key === 'timing:begin' || key === 'timing:end') { timing = key.split(':')[1] }
      else if (key.startsWith('store:') && fields.includes(key.slice(6))) { suggestFinance(key.slice(6)) }
      else if (key.startsWith('solve:') && fields.includes(key.slice(6))) {
        const field = key.slice(6)
        const result = solveTvm(field,finance,timing)
        output(result); finance[field] = result
        if (field === 'i') message = 'Taxa em % por período.'
      } else if (key === 'cash:add') cashAdd()
      else if (key === 'cash:clear') { cashFlows = []; entries = []; message = 'Fluxos apagados.' }
      else if (key === 'cash:repeat') {
        const count = stack[0]
        if (entries.length < 2) error('Registre um fluxo posterior ao CF₀ antes de repetir.')
        const previous = entries.at(-1)
        if (!Number.isInteger(count) || count < 1 || cashFlows.length - previous + count > 241) error('Informe uma quantidade inteira dentro do limite de 241 fluxos.')
        const amount = cashFlows.at(-1)
        cashFlows = cashFlows.slice(0, -previous).concat(Array(count).fill(amount))
        entries[entries.length-1] = count
        finalize(); lift = false
      } else if (key === 'cash:npv') {
        if (finance.i === null) error('Guarde a taxa i (% por período) antes de calcular o VPL.')
        output(calcNpv(cashFlows,finance.i)); message = 'Valor presente líquido.'
      } else if (key === 'cash:irr') {
        output(calcIrr(cashFlows)); message = 'TIR em % por período.'
      }
    } catch (e) { message = e.message }
    return snapshot()
  }
  return { press, snapshot }
}
