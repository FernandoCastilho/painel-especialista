// A apresentação é uma cópia em memória: nunca consulta taxas nem recalcula.
import { validFinameQuote } from './finameFunding.js'
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }
export const BNDES_SLIDES = Object.freeze([
  { id: 'operation', label: 'Dados da operação' },
  { id: 'rates', label: 'Condições e referências' },
  { id: 'results', label: 'Resultado e comparação', required: true },
  { id: 'flow', label: 'Fluxo ilustrativo' },
  { id: 'premises', label: 'Premissas e limites', required: true },
])
export const BNDES_PRESENTATION_NOTICE = 'Estimativa que inclui a TAC e o ECG do FGI quando informados, sem outras tarifas ou seguros · não é CET.'
const SOURCES = [
  { label: 'Produto e condições BNDES', url: 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/finame-materiais-industrializados' },
  { label: 'Moedas contratuais · TFC', url: 'https://www.bndes.gov.br/moedas' },
  { label: 'Taxa Fixa do BNDES · TFB', url: 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/guia/custos-financeiros/tfb-taxa-fixa-bndes' },
]

export function captureBndesPresentation({ result, comparison, conditions }, capturedAt = Date.now()) {
  if (!result?.ok || conditions?.finameEligible !== true || !['tfc', 'tfb'].includes(conditions?.custo)) return null
  const valid = item => item?.ok && ['financiado', 'primeiraParcela', 'juros', 'iof', 'total', 'taxa'].every(key => Number.isFinite(item[key]))
  const validQuote = validFinameQuote
  const validRate = rate => Number.isFinite(rate?.value) && rate.value >= 0 && rate.value <= 100
  if (!valid(result) || !validRate(conditions.rate) || (!validQuote(conditions.quote) && !conditions.rate.manual) || !Number.isFinite(capturedAt)) return null
  const compared = comparison?.ok && comparison.alternatives?.length === 2 && ['tfc', 'tfb'].every(custo => comparison.alternatives.some(item => item.custo === custo && valid(item.result) && validQuote(item.quote) && validRate(item.rate))) && Number.isFinite(comparison.totalDifference)
  return freeze(structuredClone({
    capturedAt,
    conditions: { ...conditions, quote: validQuote(conditions.quote) ? conditions.quote : null },
    result,
    alternatives: compared ? comparison.alternatives : [],
    difference: compared && Number.isFinite(comparison.totalDifference) ? comparison.totalDifference : null,
    notice: BNDES_PRESENTATION_NOTICE,
    sources: SOURCES,
  }))
}

export function buildBndesSlides(snapshot, { title = '', mode = 'simple', sections = BNDES_SLIDES.map(item => item.id), textSize = 'normal' } = {}) {
  if (!snapshot || (mode === 'compare' && snapshot.alternatives.length !== 2)) return null
  const slides = BNDES_SLIDES.filter(item => item.required || sections.includes(item.id)).map(item => item.id)
  return freeze({ snapshot, title: String(title).trim().slice(0, 100) || 'BNDES · Finame Materiais', mode: mode === 'compare' ? 'compare' : 'simple', textSize: ['normal', 'large', 'xl'].includes(textSize) ? textSize : 'normal', slides })
}

export function presentationStep(current, command, count) {
  const next = { ArrowRight: current + 1, PageDown: current + 1, ' ': current + 1, ArrowLeft: current - 1, PageUp: current - 1, Home: 0, End: count - 1 }[command]
  return next === undefined ? current : Math.max(0, Math.min(count - 1, next))
}
