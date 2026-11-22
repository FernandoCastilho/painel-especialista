// Candidato isolado: operação em USD, valores brutos, sem alterar o motor existente.
// Taxas são unidades da moeda de destino por 1 unidade da origem.
// As confirmações descrevem contratos para o nocional inteiro e mesmo vencimento.
const currencies = new Set(['USD', 'EUR', 'CNH'])
const positive = x => Number.isFinite(x) && x > 0
const validDate = x => {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x) || x.startsWith('0000')) return false
  const d = new Date(x + 'T00:00:00.000Z')
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === x
}
const failure = error => ({ ok: false, error })
const checkLeg = leg => leg == null || (typeof leg === 'object' && !Array.isArray(leg) &&
  (leg.rate == null || positive(leg.rate)) && (leg.maturity == null || validDate(leg.maturity)) &&
  (leg.contracted == null || typeof leg.contracted === 'boolean'))

export function evaluateCrossCurrencyHedge(input) {
  const { usdAmount, maturity, hedgeCurrency = 'USD', scenarioUsdBrl, usdToHedge, hedgeToBrl, hypotheticalUsdToHedge } = input ?? {}
  if (!positive(usdAmount)) return failure('Informe um valor em USD maior que zero.')
  if (!validDate(maturity)) return failure('Informe uma data de vencimento válida.')
  if (!currencies.has(hedgeCurrency)) return failure('A moeda da trava deve ser USD, EUR ou CNH.')
  if (scenarioUsdBrl != null && !positive(scenarioUsdBrl)) return failure('Informe um USD/BRL positivo para o cenário sem trava.')
  if (!checkLeg(hedgeToBrl) || (hedgeCurrency !== 'USD' && !checkLeg(usdToHedge))) {
    return failure('Confira a taxa, o vencimento e a confirmação das pernas da trava.')
  }
  if (hedgeCurrency !== 'USD' && hypotheticalUsdToHedge != null && !positive(hypotheticalUsdToHedge)) {
    return failure('Informe uma paridade hipotética positiva.')
  }

  const unhedgedBrl = scenarioUsdBrl == null ? null : usdAmount * scenarioUsdBrl
  const output = { ok: true, unhedgedBrl, lockedBrl: null, hypotheticalBrl: null, lockedEffectiveUsdBrl: null, notionalHedge: null, status: 'unlocked' }
  const ready = leg => positive(leg?.rate) && leg.maturity === maturity
  const confirmed = leg => ready(leg) && leg.contracted === true

  if (hedgeCurrency === 'USD' && confirmed(hedgeToBrl)) {
    Object.assign(output, { status: 'locked', notionalHedge: usdAmount, lockedBrl: usdAmount * hedgeToBrl.rate, lockedEffectiveUsdBrl: hedgeToBrl.rate })
  } else if (hedgeCurrency !== 'USD' && confirmed(usdToHedge) && confirmed(hedgeToBrl)) {
    const notionalHedge = usdAmount * usdToHedge.rate
    const lockedBrl = notionalHedge * hedgeToBrl.rate
    Object.assign(output, { status: 'locked', notionalHedge, lockedBrl, lockedEffectiveUsdBrl: usdToHedge.rate * hedgeToBrl.rate })
  } else if (hedgeCurrency !== 'USD' && positive(hypotheticalUsdToHedge) && ready(hedgeToBrl)) {
    const notionalHedge = usdAmount * hypotheticalUsdToHedge
    Object.assign(output, { status: 'hypothetical', notionalHedge, hypotheticalBrl: notionalHedge * hedgeToBrl.rate })
  }

  for (const key of ['unhedgedBrl', 'lockedBrl', 'lockedEffectiveUsdBrl', 'hypotheticalBrl', 'notionalHedge']) {
    if (output[key] != null && !positive(output[key])) return failure('Resultado fora do intervalo numérico suportado.')
  }
  return output
}
