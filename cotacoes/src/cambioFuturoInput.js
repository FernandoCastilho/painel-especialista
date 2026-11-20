// Adaptador de entradas da tela; não muda o motor financeiro.
import { parseDecimal } from './cdiDolar.js'
import { parseMoneyInput } from './moneyInput.js'
import { MAX_PARCELAS, MOEDAS_CF, fluxoMoeda } from './cambioFuturo.js'

export const dataCfValida = (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return false
  const ms = Date.parse(date + 'T12:00:00Z')
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date
}

export function validarVencimentosCf(start, dates, count) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_PARCELAS) return { ok: false, error: `Informe de 1 a ${MAX_PARCELAS} parcelas.` }
  if (!dataCfValida(start)) return { ok: false, error: 'Informe a data de desembolso.' }
  if (dates.length !== count || dates.some(d => !dataCfValida(d))) return { ok: false, error: 'Preencha cada vencimento com uma data válida.' }
  if (dates.some((d, i) => d <= (i ? dates[i - 1] : start))) return { ok: false, error: 'Os vencimentos devem ser crescentes e posteriores ao desembolso.' }
  return { ok: true }
}

export const contarParcelasCf = texto => /^\d+$/.test(String(texto).trim()) ? Number(texto) : NaN

const positivo = n => Number.isFinite(n) && n > 0
export function principalCf(usd, usdSpot, id, moedaSpot) {
  if (!positivo(usd) || !MOEDAS_CF.some(m => m.id === id)) return null
  if (id === 'USD') return usd
  if (!positivo(usdSpot) || !positivo(moedaSpot)) return null
  const convertido = Math.round(usd * usdSpot / moedaSpot * 100) / 100
  return positivo(convertido) ? convertido : null
}

export function montarFluxoCf(op, id, usdSpot, dados) {
  const count = contarParcelasCf(op.parcelas)
  const dates = Array.from({ length: Number.isInteger(count) && count >= 1 && count <= MAX_PARCELAS ? count : 0 }, (_, i) => dados.dates[i] ?? '')
  const cotacao = parseDecimal(dados.cotacao)
  const usd = parseMoneyInput(op.usd)
  const valor = principalCf(usd.value, usdSpot, id, cotacao)
  const valid = validarVencimentosCf(op.start, dates, count)
  if (!valid.ok) return valid
  const taxa = parseDecimal(op.taxa), tac = parseMoneyInput(dados.tac, { optional: true })
  if (!positivo(cotacao)) return { ok: false, error: 'Informe uma cotação de partida maior que zero.' }
  if (!tac.ok) return { ok: false, error: `TAC: ${tac.error}` }
  if (!usd.ok) return { ok: false, error: `Valor em USD: ${usd.error}` }
  if (!Number.isFinite(taxa)) return { ok: false, error: 'Informe a taxa all-in do empréstimo.' }
  if (!positivo(valor)) return { ok: false, error: 'Informe o valor do empréstimo em USD e as cotações de partida.' }
  return fluxoMoeda({ valor, cotacao, taxa, tac: tac.value, start: op.start, dates,
    futuros: dates.map((_, i) => { const rate = parseDecimal(dados.futuros[i]); return positivo(rate) ? rate : null }) })
}
