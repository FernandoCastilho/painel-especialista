import { calcularRegular, calcularSimples, TIPOS_RECEITA_SIMPLES } from './rtcCalc.js'

// Indicative timing model, not fiscal assessment or a cash-flow forecast.
// Revenue and purchases are values WITHOUT consumption taxes (base "por fora", as in the official
// Receita calculator). CBS, IBS and IS are added on top and collected from the customer.
const pct = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100

function newTaxes(revenue, taxes) {
  if (taxes?.regime === 'simples') {
    if (!pct(taxes.pCbs) || !pct(taxes.pIbs) || !TIPOS_RECEITA_SIMPLES[taxes.tipoReceita]) return null
    const s = calcularSimples({ receita: revenue, pCbs: taxes.pCbs, pIbs: taxes.pIbs, tipoReceita: taxes.tipoReceita })
    // Simples in the DAS does not appropriate IBS/CBS credits on its purchases.
    return { cbs: s.cbs, ibsUf: s.ibs, ibsMun: 0, ibs: s.ibs, is: 0, base: s.baseCalculo, creditRate: 0, pending: s.cbsPendente + s.ibsPendente }
  }
  const a = taxes?.aliquotas ?? {}, red = taxes?.reducao ?? {}
  if (![a.cbs, a.ibsUf, a.ibsMun, red.cbs ?? 0, red.ibsUf ?? 0, red.ibsMun ?? 0, taxes?.isRate ?? 0].every(pct)) return null
  const r = calcularRegular({ baseCalculo: revenue, aliquotas: a, reducao: red,
    impostoSeletivo: taxes.isRate > 0 ? { base: revenue, adValorem: taxes.isRate, impostoInformado: 0 } : null })
  // Same effective rate assumed for eligible purchases (homogeneous scenario, conservative).
  return { cbs: r.cbs.valor, ibsUf: r.ibsUf.valor, ibsMun: r.ibsMun.valor, ibs: r.ibs, is: r.impostoSeletivo, base: r.baseCalculo,
    creditRate: r.cbs.aliquotaEfetiva + r.ibsUf.aliquotaEfetiva + r.ibsMun.aliquotaEfetiva, pending: 0 }
}

export function simulateCbsCash(input) {
  const { revenue, spendingRatio, eligibleShare, taxes, currentNetRate, splitShare,
    receiveDays, payDays, stockDays, currentDueDays, futureDueDays, creditDelayDays } = input
  const all = [revenue, spendingRatio, eligibleShare, currentNetRate, splitShare,
    receiveDays, payDays, stockDays, currentDueDays, futureDueDays, creditDelayDays]
  if (all.some(v => typeof v !== 'number' || !Number.isFinite(v)) || revenue <= 0 || revenue > 1e13 || spendingRatio < 0 || spendingRatio > 5)
    return { ok: false, error: 'Informe faturamento positivo e premissas numéricas válidas.' }
  if (![eligibleShare, currentNetRate, splitShare].every(pct))
    return { ok: false, error: 'Percentuais devem estar entre 0 e 100.' }
  if ([receiveDays, payDays, stockDays, currentDueDays, futureDueDays, creditDelayDays].some(v => !Number.isInteger(v) || v < 0 || v > 365))
    return { ok: false, error: 'Prazos devem ser dias inteiros entre 0 e 365.' }
  const t = newTaxes(revenue, taxes)
  if (!t) return { ok: false, error: 'Alíquotas e reduções devem estar entre 0 e 100.' }
  const spending = revenue * spendingRatio
  const outputTax = t.cbs + t.ibs
  const isTax = t.is
  const credits = spending * t.creditRate / 100 * eligibleShare / 100
  const creditsUsable = Math.min(outputTax, credits)
  const excessCredits = Math.max(0, credits - outputTax)
  const netTax = outputTax - creditsUsable
  const currentTax = revenue * currentNetRate / 100
  // Split never postpones the legal due date. Already settled tax is not withheld twice.
  // Split covers CBS and IBS; the Imposto Seletivo is paid on the due date.
  const splitNet = receiveDays <= futureDueDays ? netTax * splitShare / 100 : 0
  const splitGross = outputTax * splitShare / 100
  // Signed float: positive means tax money temporarily finances operations;
  // negative means tax is financed before receipt. Days are averages since sale.
  const currentFloat = currentTax * (currentDueDays - receiveDays) / 30
  const settlementDays = Math.min(receiveDays, futureDueDays) * splitShare / 100 + futureDueDays * (1 - splitShare / 100)
  const futureFloat = netTax * (settlementDays - receiveDays) / 30 + isTax * (futureDueDays - receiveDays) / 30
  const timingDelta = currentFloat - futureFloat
  // Alternative stress scenario: usable credits take extra days to become available.
  // This is not added again to gross withholding or to a full operating NCG.
  const creditAvailableDays = payDays - stockDays + creditDelayDays
  // Evaluate each positive wait before weighting: the later due date must not
  // cancel unavailable credits on the portion collected early by split.
  const creditGapDays = splitShare / 100 * Math.max(0, creditAvailableDays - Math.min(receiveDays, futureDueDays)) +
    (1 - splitShare / 100) * Math.max(0, creditAvailableDays - futureDueDays)
  const creditExposure = creditsUsable * creditGapDays / 30
  const grossReceipts = revenue + outputTax + isTax
  return { ok: true, spending, taxBase: t.base, cbs: t.cbs, ibsUf: t.ibsUf, ibsMun: t.ibsMun, ibs: t.ibs, isTax, pendingTax: t.pending,
    creditRate: t.creditRate, outputTax, credits, creditsUsable, excessCredits, netTax,
    currentTax, splitGross, splitNet, grossReceipts, receiptsAfterNetSplit: grossReceipts - splitNet,
    currentFloat, futureFloat, timingDelta, creditExposure, creditGapDays, settlementDays,
    reserveImmediate: Math.max(0, timingDelta),
    reserveDelayed: Math.max(0, timingDelta + creditExposure),
    monthlyTaxDelta: netTax + isTax - currentTax,
    cycleDays: receiveDays + stockDays - payDays }
}
