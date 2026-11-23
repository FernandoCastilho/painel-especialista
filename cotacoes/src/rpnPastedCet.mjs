import { creditCet } from './creditComparison.js'

const DAY = 86400000
const MAX_ROWS = 600
const fail = error => ({ ok: false, error })

function toDay(raw) {
  const s = raw.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (!iso && !br) return null
  const [y, m, d] = (iso ? iso.slice(1) : [br[3], br[2], br[1]]).map(Number)
  if (y < 1900 || y > 9999) return null
  const n = Date.UTC(y, m - 1, d)
  const date = new Date(n)
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? n / DAY : null
}

function toCents(raw) {
  const s = raw.trim().replace(/^R\$\s*/i, '')
  const br = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(s)
  const decimal = /^(\d+)\.(\d{1,2})$/.exec(s)
  const p = br || decimal
  if (!p) return null
  const cents = Number(p[1].replace(/\./g, '')) * 100 + Number((p[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}

export function calculatePastedCet({ releaseDate = '', net = '', costs = '', payments = '' } = {}) {
  const start = toDay(releaseDate)
  const received = toCents(net)
  const charges = costs.trim() ? toCents(costs) : 0
  if (start === null) return fail('Informe uma data de liberação válida.')
  if (received === null || received <= 0) return fail('Informe o valor líquido liberado, maior que zero.')
  if (charges === null || charges >= received) return fail('Outros custos devem ser positivos ou zero e menores que o valor liberado.')
  if (!payments.trim()) return fail('Cole as duas colunas do Excel: vencimento e valor a pagar.')
  const data = []
  let total = 0
  for (const [index, line] of payments.split(/\r\n|\n|\r/).entries()) {
    if (!line.trim()) continue
    const cols = line.split(line.includes('\t') ? '\t' : ';').map(s => s.trim())
    const header = !data.length && cols.length === 2 && /^(?:data(?: de vencimento)?|vencimento)$/i.test(cols[0]) && /^(?:valor(?: (?:da parcela|a pagar))?|parcela|pagamento)$/i.test(cols[1])
    if (header) continue
    if (cols.length !== 2) return fail('Linha ' + (index + 1) + ': use somente vencimento e valor.')
    const day = toDay(cols[0])
    const amount = toCents(cols[1])
    if (day === null || day <= start) return fail('Linha ' + (index + 1) + ': informe vencimento válido após a liberação.')
    if (amount === null || amount <= 0) return fail('Linha ' + (index + 1) + ': informe um valor positivo em reais.')
    if (data.length >= MAX_ROWS) return fail('O limite é de 600 pagamentos por cálculo.')
    total += amount
    if (!Number.isSafeInteger(total)) return fail('Total fora do intervalo aceito.')
    data.push({ days: day - start, payment: amount / 100 })
  }
  const base = received - charges
  if (!data.length) return fail('Cole ao menos um vencimento com valor.')
  if (total < base) return fail('O total a pagar é menor que o valor líquido após custos. Confira se falta algum pagamento.')
  const annualRate = creditCet(base / 100, data)
  if (annualRate === null) return fail('Fluxo fora do intervalo de cálculo do Painel. Confira os valores e os prazos.')
  return { ok: true, annualRate: total === base ? 0 : annualRate, total: total / 100, count: data.length, netAfterCosts: base / 100 }
}
