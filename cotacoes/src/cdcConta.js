// Conta do CDC (financiamento de veículo), reconstruída da planilha de CDC enviada por Fernando em 25/11/2026.
// Regras conferidas contra a planilha (caso de referência em test/cdc-conta.test.mjs):
// - Valor financiado = valor liberado + tarifa de cadastro + IOF (tudo financiado, como na planilha).
// - 1ª parcela = liberação + carência em dias; as seguintes no mesmo dia dos meses seguintes, sem ajuste de dia útil.
// - Juros de cada parcela = saldo × ((1 + taxa a.m.)^(dias corridos do período / 30) − 1), em centavos.
// - Parcela fixa (Price em dias corridos): a que zera o saldo na última; a última fecha os centavos.
// - Coeficiente = parcela ÷ (valor liberado + tarifa).
// - IOF adicional = 0,38% do valor financiado com o próprio IOF (decisão de Fernando, 25/11/2026; a planilha usa a base sem o IOF).
// - IOF diário = 0,0082% × dias até o vencimento (limite 365) sobre a amortização de cada parcela, com o IOF financiado
//   (o saldo inclui o próprio IOF; repete até fechar em centavos). Mesmas alíquotas do resolveCreditIof do painel.
//   Regra conferida no Decreto 6.306/2007, art. 7º (I, b; § 1º; § 15; VI), em 25/11/2026: PJ 0,0082% ao dia, limite de
//   365 dias, adicional de 0,38%. Sempre pessoa jurídica geral e IOF sempre financiado (decisões de Fernando, 25/11/2026). A isenção do art. 9º, VI (automóvel até 127 HP) não entra: vale só para os beneficiários do
//   art. 72 da Lei 8.383/1991 (táxi e pessoa com deficiência), não para o CDC de empresa.
//   Ressalva: no caso de referência a planilha mostra IOF diário de R$ 14.341,35 e esta regra dá R$ 97,75 a menos.
import { resolveCreditIof } from './iofRules.js'
import { cgAddDays, cgDate } from './contaGarantida.js'

const fail = error => ({ ok: false, error })
// Mesmo arredondamento em centavos do Capital de Giro (roundReais).
export const cents = v => { const c = Math.abs(v) * 100; return Math.sign(v) * Math.round(c + c * Number.EPSILON) / 100 }
const days = (a, b) => Math.round((cgDate(b) - cgDate(a)) / 86400000)

// Vencimentos mensais no mesmo dia do primeiro (no fim do mês, o último dia).
export function cdcVencimentos(firstDue, n) {
  const first = cgDate(firstDue)
  if (!first) return null
  const out = []
  for (let k = 0; k < n; k++) {
    const abs = first.getUTCFullYear() * 12 + first.getUTCMonth() + k
    const y = Math.floor(abs / 12), m = abs % 12
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    out.push(new Date(Date.UTC(y, m, Math.min(first.getUTCDate(), last))).toISOString().slice(0, 10))
  }
  return out
}

// Cronograma da planilha para um saldo inicial já fechado. i = taxa ao mês em fração (1,55% = 0.0155).
export function cdcCronograma(principal, i, start, dues) {
  const factors = []
  let prev = start
  for (const date of dues) { factors.push(Math.pow(1 + i, days(prev, date) / 30) - 1); prev = date }
  // Parcela que zera o saldo: principal ÷ soma dos descontos acumulados.
  let acc = 1, sum = 0
  for (const f of factors) { acc /= 1 + f; sum += acc }
  const pmt = cents(principal / sum)
  const rows = []
  let balance = principal
  dues.forEach((date, k) => {
    const interest = cents(balance * factors[k])
    const lastRow = k === dues.length - 1
    const amortization = lastRow ? balance : cents(pmt - interest)
    balance = cents(balance - amortization)
    rows.push({ number: k + 1, date, days: days(start, date), amortization, interest, payment: cents(amortization + interest), balance })
  })
  return { pmt, rows }
}

export function cdcConta({ valorBem, valorLiberado, tarifas = 0, taxa, prazo, carenciaDias, inicio }) {
  if (!(valorLiberado > 0)) return fail('Informe o valor liberado.')
  if (!(valorBem >= valorLiberado)) return fail('O valor do bem precisa ser igual ou maior que o valor liberado.')
  if (!(tarifas >= 0)) return fail('Confira a tarifa de cadastro.')
  if (!(Number.isFinite(taxa) && taxa >= 0 && taxa <= 100)) return fail('Informe a taxa entre 0% e 100% ao mês.')
  if (!Number.isInteger(prazo) || prazo < 1 || prazo > 120) return fail('Informe o prazo de 1 a 120 parcelas.')
  if (!Number.isInteger(carenciaDias) || carenciaDias < 1 || carenciaDias > 180) return fail('Informe a carência de 1 a 180 dias.')
  const firstDue = cgAddDays(inicio, carenciaDias)
  if (!firstDue) return fail('Informe a data de liberação.')
  const base = cents(valorLiberado + tarifas)
  const tax = resolveCreditIof({ date: inicio, profile: 'pj', operationValue: base })
  if (!tax.ok) return fail(tax.error)
  const dues = cdcVencimentos(firstDue, prazo)
  const i = taxa / 100
  let principal = base, flow, iofDiario, iofAdicional
  const vistos = []
  for (let step = 0; step < 30; step++) {
    flow = cdcCronograma(principal, i, inicio, dues)
    iofAdicional = cents(principal * tax.additional / 100)
    iofDiario = cents(flow.rows.reduce((s, r) => s + r.amortization * Math.min(r.days, tax.maxDays) * tax.daily / 100, 0))
    const next = cents(base + iofAdicional + iofDiario)
    if (next === principal) break
    // O arredondamento em centavos às vezes alterna entre dois valores sem fechar (cerca de 1% das simulações). Fica o
    // maior (o IOF fica todo coberto) e o centavo de diferença vai no IOF diário, para valer financiado = base + IOF.
    const volta = vistos.indexOf(next)
    if (volta >= 0) {
      principal = Math.max(principal, ...vistos.slice(volta))
      flow = cdcCronograma(principal, i, inicio, dues)
      iofAdicional = cents(principal * tax.additional / 100)
      iofDiario = cents(principal - base - iofAdicional)
      break
    }
    if (step === 29) return fail('Não foi possível fechar o IOF financiado em centavos.')
    vistos.push(principal)
    principal = next
  }
  const { pmt, rows } = flow
  if (rows[0].amortization < 0) return fail('A 1ª parcela não cobre os juros da carência: reduza a carência ou aumente o prazo.')
  const paid = cents(rows.reduce((s, r) => s + r.payment, 0))
  return {
    ok: true, valorBem, valorLiberado, tarifas, base, principal, taxa,
    entrada: cents(valorBem - valorLiberado), pctEntrada: (valorBem - valorLiberado) / valorBem,
    parcela: pmt, coeficiente: pmt / base, primeira: dues[0], ultima: dues.at(-1),
    iofAdicional, iofDiario, iof: cents(iofAdicional + iofDiario), tax,
    rows, paid, juros: cents(rows.reduce((s, r) => s + r.interest, 0)),
  }
}
