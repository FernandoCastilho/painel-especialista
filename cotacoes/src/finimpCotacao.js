// FINIMP no formato da cotação de banco (planilha "Referência para empréstimo e swaps" com NDF de compra).
// Regras reproduzidas da planilha (conferidas linha a linha com uma cotação real, ver docs/finimp-cotacao.md):
// - Valor em reais = valor na moeda × cotação de partida.
// - Juros lineares sobre o saldo devedor: saldo × taxa × dias corridos do período ÷ 360, arredondados ao centavo.
// - A taxa all-in se divide em comissão externa, IR sobre os juros remetidos (gross-up: externa × IR ÷ (1 − IR)) e
//   comissão local (o que sobra da all-in). Juros total = soma das três = saldo × all-in × dias ÷ 360.
// - Parcela na moeda = amortização + juros total. Parcela em reais = parcela na moeda × taxa futura fechada (NDF).
// - Empréstimo (1) = parcela na moeda × PTAX de venda do dia anterior ao vencimento (cenário digitado).
// - Ajuste bruto da NDF de compra (2) = (PTAX − taxa futura) × parcela na moeda. Positivo: o cliente recebe.
// - Total em reais (3) = empréstimo − ajuste = parcela na moeda × taxa futura (o custo fica travado).
// - Ajuste líquido de IR: só o ajuste positivo paga IR na fonte (tabela regressiva de 22,5% a 15% pelo prazo).
//   O total (3) usa o ajuste bruto, como na planilha.
// - TIR efetiva: taxa que iguala o valor em reais (menos a TAC) às parcelas em reais, dias corridos/365, lida ao mês
//   como taxa de 30 dias (mesma leitura do 4131).
// - Economia de IOF: IOF de crédito de um capital de giro em reais no mesmo cronograma (0,38% + 0,0082% ao dia sobre
//   cada parcela de principal, até 365 dias). Equivalente em giro: a mesma TIR com esse IOF somado ao valor recebido.
import { IOF_PJ } from './emprestimo.js'
import { irr, taxa360 } from './emprestimo4131.js'

const DAY = 864e5
const ms = (iso) => Date.parse(`${iso}T12:00:00Z`)
const addDaysIso = (iso, n) => new Date(ms(iso) + n * DAY).toISOString().slice(0, 10)
const round2 = (v) => Math.round((v + Math.sign(v) * Number.EPSILON * Math.abs(v)) * 100) / 100
const validDate = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') && !Number.isNaN(ms(iso)) && new Date(ms(iso)).toISOString().slice(0, 10) === iso && iso >= '2000-01-01' && iso <= '2100-12-31'
const fail = (error) => ({ ok: false, error })

export const FI_IR_OPTIONS = [
  { id: '25', rate: 25, label: '25% · como na planilha' },
  { id: '15', rate: 15, label: '15% · regra geral' },
  { id: '0', rate: 0, label: '0% · isenção ou tratado' },
]
export const FI_MAX_PARCELAS = 24
export const FI_MAX_DIAS = 3650

// Tabela regressiva do IR na fonte sobre ganho em derivativos (swap e termo), pelo prazo em dias corridos.
export const irAjusteNdf = (dias) => (dias <= 180 ? 22.5 : dias <= 360 ? 20 : dias <= 720 ? 17.5 : 15)

// Prazos das parcelas: o informado na cotação ou, sem ele, divisão igual do prazo total.
export function prazosIguais(prazoTotal, parcelas) {
  return Array.from({ length: parcelas }, (_, i) => Math.round((prazoTotal * (i + 1)) / parcelas))
}

// Taxas em % (8,7093 = 8,7093% a.a.). `forwards` e `ptax`: uma por parcela; faltando, repete a última informada.
export function finimpCotacao({ valor, spot, start, prazos, allIn, externa, irrf = 25, tac = 0, forwards, ptax }) {
  if (!(valor > 0) || valor > 1e12) return fail('Informe o valor na moeda, maior que zero.')
  if (!(spot > 0) || spot > 1000) return fail('Informe a cotação de partida, maior que zero.')
  if (!validDate(start)) return fail('Informe uma data de desembolso válida.')
  if (!Array.isArray(prazos) || !prazos.length || prazos.length > FI_MAX_PARCELAS) return fail(`Informe de 1 a ${FI_MAX_PARCELAS} parcelas.`)
  if (prazos.some((d, i) => !Number.isInteger(d) || d <= (prazos[i - 1] ?? 0) || d > FI_MAX_DIAS)) return fail('Os prazos precisam ser dias inteiros e crescentes, a partir de 1.')
  if (!(allIn >= 0) || allIn > 100) return fail('Informe a taxa all-in em % ao ano, de 0 a 100.')
  if (!(externa >= 0) || externa > 100) return fail('Informe a comissão externa em % ao ano, de 0 a 100.')
  if (!(irrf >= 0) || irrf >= 100) return fail('Escolha a alíquota do IR.')
  if (!(tac >= 0)) return fail('Informe a TAC em reais, zero ou mais.')
  const pick = (list, i) => (list?.length ? list[Math.min(i, list.length - 1)] : null)
  if (!forwards?.length || forwards.some((f) => !(f > 0))) return fail('Informe a taxa futura fechada (NDF) de cada parcela.')
  if (!ptax?.length || ptax.some((p) => !(p > 0))) return fail('Informe a PTAX do vencimento (cenário).')

  const irRate = (externa * irrf) / (100 - irrf)
  const localRate = allIn - externa - irRate
  const valorBrl = valor * spot
  const n = prazos.length
  const amortBase = round2(valor / n)
  let saldo = valor
  const rows = prazos.map((dias, i) => {
    const periodo = dias - (prazos[i - 1] ?? 0)
    const amort = i === n - 1 ? round2(saldo) : amortBase
    const base = (saldo * periodo) / 360
    const extU = (base * externa) / 100
    const irU = (extU * irrf) / (100 - irrf)
    const comExt = round2(extU)
    const ir = round2(irU)
    const juros = round2((base * allIn) / 100)
    const comLocal = round2(juros - comExt - ir)
    const parcela = round2(amort + juros)
    const fwd = pick(forwards, i)
    const pt = pick(ptax, i)
    const emprestimo = parcela * pt
    const ajuste = (pt - fwd) * parcela
    const aliq = irAjusteNdf(dias)
    const row = {
      n: i + 1, dias, periodo, vencimento: addDaysIso(start, dias), amort, saldo: round2(saldo),
      comExt, ir, comLocal, juros, parcela, fwd, ptax: pt,
      parcelaBrl: parcela * fwd, emprestimo, ajuste, ajusteLiq: ajuste > 0 ? ajuste * (1 - aliq / 100) : ajuste,
      aliqAjuste: aliq, total: emprestimo - ajuste,
    }
    saldo = round2(saldo - amort)
    return row
  })
  const pago = valorBrl - tac
  if (!(pago > 0)) return fail('A TAC não pode ser maior que o valor em reais.')
  const flows = (t0) => [{ v: t0, t: 0 }, ...rows.map((r) => ({ v: -r.total, t: r.dias / 365 }))]
  const y = irr(flows(pago))
  if (y === null) return fail('Não foi possível calcular a TIR com estes valores.')
  const iofGiro = valorBrl * IOF_PJ.fixed / 100 + rows.reduce((s, r) => s + r.amort * spot * (IOF_PJ.daily / 100) * Math.min(r.dias, IOF_PJ.maxDays), 0)
  const yGiro = irr(flows(pago + iofGiro))
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0)
  return {
    ok: true, valor, spot, valorBrl, start, allIn, externa, irRate, localRate, irrf, tac, rows,
    totals: { comExt: sum('comExt'), ir: sum('ir'), comLocal: sum('comLocal'), juros: sum('juros'), parcela: sum('parcela'), parcelaBrl: sum('parcelaBrl'), emprestimo: sum('emprestimo'), ajuste: sum('ajuste'), ajusteLiq: sum('ajusteLiq'), total: sum('total') },
    tir: taxa360(y), tirAno: y, iofGiro, giro: yGiro === null ? null : taxa360(yGiro),
    avisoLocal: localRate < 0 ? 'A comissão externa com o IR passa da taxa all-in: a comissão local ficou negativa.' : null,
  }
}

// Atingir meta: taxa all-in (% a.a., quatro casas) que leva a TIR efetiva ao mês (ou o equivalente em giro) à meta,
// com o resto igual. A TIR cresce com a taxa, então a busca é por bisseção entre 0% e 100% a.a.
export const FI_METAS = [
  { id: 'tir', label: 'TIR efetiva', unit: '% a.m.' },
  { id: 'giro', label: 'Equivalente em giro', unit: '% a.m.' },
]
export function metaAllIn(params, kind, target) {
  if (!FI_METAS.some((m) => m.id === kind)) return fail('Escolha a meta.')
  if (!Number.isFinite(target)) return fail('Informe a meta em % ao mês.')
  const at = (allIn) => {
    const r = finimpCotacao({ ...params, allIn })
    if (!r.ok) return r
    const v = kind === 'tir' ? r.tir.mes : r.giro?.mes
    return Number.isFinite(v) ? { ok: true, value: v } : fail('Meta fora do alcance desta operação.')
  }
  const dec4 = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  const low = at(0)
  if (!low.ok) return low
  const high = at(100)
  if (!high.ok) return high
  if (target < low.value) return fail(`Meta abaixo do mínimo: com taxa zero, o resultado já é ${dec4(low.value)}% a.m.`)
  if (target > high.value) return fail('Meta acima do que uma taxa de 100% ao ano alcança.')
  let lo = 0
  let hi = 100
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    if (at(mid).value < target) lo = mid
    else hi = mid
  }
  const allIn = Math.round(((lo + hi) / 2) * 1e4) / 1e4
  const check = at(allIn)
  return check.ok ? { ok: true, allIn, value: check.value } : check
}
