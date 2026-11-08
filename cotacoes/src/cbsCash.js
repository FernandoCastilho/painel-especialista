// Indicative timing model, not fiscal assessment or a cash-flow forecast.
// Receipts and purchase amounts are tax-inclusive; total selling prices stay fixed.
export function simulateCbsCash(input) {
  const { revenue, spendingRatio, eligibleShare, cbsRate, currentNetRate, splitShare,
    receiveDays, payDays, stockDays, currentDueDays, futureDueDays, creditDelayDays } = input
  const all = [revenue, spendingRatio, eligibleShare, cbsRate, currentNetRate, splitShare,
    receiveDays, payDays, stockDays, currentDueDays, futureDueDays, creditDelayDays]
  if (all.some(v => typeof v !== 'number' || !Number.isFinite(v)) || revenue <= 0 || revenue > 1e13 || spendingRatio < 0 || spendingRatio > 5)
    return { ok: false, error: 'Informe faturamento positivo e premissas numéricas válidas.' }
  if ([eligibleShare, cbsRate, currentNetRate, splitShare].some(v => v < 0 || v > 100))
    return { ok: false, error: 'Percentuais devem estar entre 0 e 100.' }
  if ([receiveDays, payDays, stockDays, currentDueDays, futureDueDays, creditDelayDays].some(v => !Number.isInteger(v) || v < 0 || v > 365))
    return { ok: false, error: 'Prazos devem ser dias inteiros entre 0 e 365.' }
  const spending = revenue * spendingRatio
  const outputTax = revenue * cbsRate / (100 + cbsRate)
  const credits = spending * cbsRate / (100 + cbsRate) * eligibleShare / 100
  const creditsUsable = Math.min(outputTax, credits)
  const excessCredits = Math.max(0, credits - outputTax)
  const netTax = outputTax - creditsUsable
  const currentTax = revenue * currentNetRate / 100
  // Split never postpones the legal due date. Already settled tax is not withheld twice.
  const splitNet = receiveDays <= futureDueDays ? netTax * splitShare / 100 : 0
  const splitGross = outputTax * splitShare / 100
  // Signed float: positive means tax money temporarily finances operations;
  // negative means tax is financed before receipt. Days are averages since sale.
  const currentFloat = currentTax * (currentDueDays - receiveDays) / 30
  const settlementDays = Math.min(receiveDays, futureDueDays) * splitShare / 100 + futureDueDays * (1 - splitShare / 100)
  const futureFloat = netTax * (settlementDays - receiveDays) / 30
  const timingDelta = currentFloat - futureFloat
  // Alternative stress scenario: usable credits take extra days to become available.
  // This is not added again to gross withholding or to a full operating NCG.
  const creditAvailableDays = payDays - stockDays + creditDelayDays
  const creditGapDays = Math.max(0, creditAvailableDays - settlementDays)
  const creditExposure = creditsUsable * creditGapDays / 30
  return { ok: true, spending, outputTax, credits, creditsUsable, excessCredits, netTax,
    currentTax, splitGross, splitNet, receiptsAfterNetSplit: revenue - splitNet,
    currentFloat, futureFloat, timingDelta, creditExposure, creditGapDays, settlementDays,
    reserveImmediate: Math.max(0, timingDelta),
    reserveDelayed: Math.max(0, timingDelta + creditExposure),
    monthlyTaxDelta: netTax - currentTax,
    cycleDays: receiveDays + stockDays - payDays }
}
