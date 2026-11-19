// Câmbio futuro: compara o mesmo empréstimo cotado pela mesa em dólar, euro e yuan (planilha de Fernando, 19/11/2026).
// Regras (iguais às da planilha):
// - Valor em R$ = valor na moeda × cotação de partida.
// - Amortização constante; juros = saldo × taxa × dias corridos / 360 (linear), pagos em cada vencimento.
// - Cada parcela vira reais pelo câmbio futuro informado para o seu vencimento.
// - TIR ao ano: taxa que zera o fluxo em reais, dias corridos/365 (mesma convenção do custo all-in do 4131 no Painel).
//   A planilha mostrava o retorno do período (sem anualizar); aqui ele aparece separado, como "no período".
// - Atingir meta: câmbio futuro único (o mesmo em todos os vencimentos) que faz a TIR ao ano igual à meta.
import { irr } from './emprestimo4131.js'

const DAY = 864e5
const ms = (iso) => Date.parse(`${iso}T12:00:00Z`)
const validIso = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') && !Number.isNaN(ms(iso)) && new Date(ms(iso)).toISOString().slice(0, 10) === iso
export const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / DAY)
const addDays = (iso, n) => new Date(ms(iso) + n * DAY).toISOString().slice(0, 10)

export const MOEDAS_CF = [
  { id: 'USD', sym: 'US$', nome: 'Dólar' },
  { id: 'EUR', sym: '€', nome: 'Euro' },
  { id: 'CNH', sym: '¥', nome: 'Yuan (CNH)' },
]
export const MAX_PARCELAS = 60

// Vencimentos espaçados por igual (em dias corridos) entre o desembolso e o vencimento final.
export function vencimentos(start, end, n) {
  if (!validIso(start) || !validIso(end) || end <= start) return { ok: false, error: 'O vencimento final precisa ser depois do desembolso.' }
  if (!Number.isInteger(n) || n < 1 || n > MAX_PARCELAS) return { ok: false, error: `Parcelas: número inteiro de 1 a ${MAX_PARCELAS}.` }
  const total = daysBetween(start, end)
  if (total < n) return { ok: false, error: 'Prazo curto demais para esse número de parcelas.' }
  return { ok: true, dates: Array.from({ length: n }, (_, i) => (i === n - 1 ? end : addDays(start, Math.round(total * (i + 1) / n)))) }
}

// Fluxo de uma moeda. `futuros`: R$ por unidade da moeda em cada vencimento (null onde ainda não foi informado).
export function fluxoMoeda({ valor, cotacao, taxa, start, dates, futuros = [] }) {
  if (!(valor > 0)) return { ok: false, error: 'Informe o valor na moeda.' }
  if (!(cotacao > 0)) return { ok: false, error: 'Informe a cotação de partida.' }
  if (!(taxa >= 0) || taxa > 100) return { ok: false, error: 'Taxa all-in: de 0 a 100% ao ano.' }
  const brl = valor * cotacao
  const n = dates.length
  let saldo = valor
  let prev = start
  const linhas = dates.map((date, i) => {
    const dias = daysBetween(prev, date)
    const amort = i === n - 1 ? saldo : valor / n
    const juros = saldo * (taxa / 100) * dias / 360
    const linha = { date, prazo: daysBetween(start, date), dias, saldo, amort, juros, parcela: amort + juros, futuro: futuros[i] > 0 ? futuros[i] : null }
    linha.parcelaBrl = linha.futuro ? linha.parcela * linha.futuro : null
    saldo -= amort
    prev = date
    return linha
  })
  const juros = linhas.reduce((s, l) => s + l.juros, 0)
  const out = { ok: true, valor, cotacao, taxa, brl, linhas, juros, totalMoeda: valor + juros }
  if (linhas.some((l) => !l.futuro)) return { ...out, completo: false }
  const totalBrl = linhas.reduce((s, l) => s + l.parcelaBrl, 0)
  const y = irr([{ v: brl, t: 0 }, ...linhas.map((l) => ({ v: -l.parcelaBrl, t: l.prazo / 365 }))])
  return { ...out, completo: true, totalBrl, periodo: (totalBrl / brl - 1) * 100, tir: y == null ? null : y * 100 }
}

// Câmbio futuro único que leva a TIR ao ano (dias corridos/365) à meta: valor presente das parcelas = valor em R$.
export function cambioMeta(fluxo, metaPct) {
  if (!fluxo?.ok || !(metaPct > -100)) return null
  const m = 1 + metaPct / 100
  const pv = fluxo.linhas.reduce((s, l) => s + l.parcela / m ** (l.prazo / 365), 0)
  return pv > 0 ? fluxo.brl / pv : null
}
