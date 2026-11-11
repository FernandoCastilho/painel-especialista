// Apresentação e impressão do empréstimo externo (4131): cópia congelada do que a tela calculou.
// Nunca recalcula nem busca taxa nova; se faltar número, não gera a cópia.
import { unhedged4131 } from './emprestimo4131.js'

const freeze = (value) => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

export const E4_SLIDES = Object.freeze([
  { id: 'operation', label: 'Dados da operação' },
  { id: 'cost', label: 'Custo em dólar' },
  { id: 'results', label: 'Três caminhos em reais', required: true },
  { id: 'scenarios', label: 'Sem proteção: cenários de câmbio' },
  { id: 'flow', label: 'Pagamentos' },
  { id: 'premises', label: 'Premissas e limites', required: true },
])
export const E4_TITLE = 'Empréstimo externo · 4131'
export const E4_NOTICE = 'Estimativa para comparar propostas, com um DI e um cupom cambial para todos os prazos. Não inclui IR nem PIS/Cofins sobre ganho do derivativo. A cotação da mesa do banco e o contrato prevalecem.'
export const E4_PRINT_NOTICE = 'Simulação indicativa, sujeita à análise e aprovação da instituição financeira. Não constitui proposta, oferta, garantia de aprovação ou compromisso de crédito. Os custos com swap e NDF são teóricos; a cotação da mesa do banco e o contrato prevalecem.'
export const E4_FX_SCENARIOS = Object.freeze([-10, 0, 5, 10, 20])
export const E4_SOURCES = Object.freeze([
  { label: 'Resolução BCB 278/2022 · crédito externo', url: 'https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20BCB&numero=278' },
  { label: 'Decreto 6.306/2007 · IOF', url: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/d6306compilado.htm' },
  { label: 'Decreto 9.580/2018 · IR na fonte', url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/d9580.htm' },
  { label: 'B3 · Termo de moeda (NDF)', url: 'https://www.b3.com.br/pt_br/produtos-e-servicos/registro/derivativos-de-balcao/contrato-a-termo-de-moeda.htm' },
])

const finite = (object, keys) => keys.every((key) => Number.isFinite(object?.[key]))

// `labels`: textos já escolhidos na tela (frequência dos juros, quem arca com o IR).
export function captureE4({ loan, hedge, labels = {} }, capturedAt = Date.now()) {
  if (!loan?.ok || !hedge?.ok || !Number.isFinite(capturedAt)) return null
  if (!finite(loan, ['principal', 'rate', 'spot', 'months', 'irrf', 'flat', 'guarantee', 'avgTermDays', 'iofRate', 'flatUsd', 'iofUsd', 'netUsd', 'netBrl', 'grossedRate', 'allIn'])) return null
  if (!finite(loan.totals, ['interest', 'irrf', 'guarantee', 'principal', 'usd'])) return null
  if (!finite(hedge, ['di', 'cupom', 'swapSpread', 'ndfMarkup']) || !finite(hedge.swap, ['pre', 'spread', 'pctCdi']) || !finite(hedge.ndf, ['pre', 'cost365', 'spread', 'pctCdi', 'totalBrl', 'breakeven'])) return null
  if (!Array.isArray(loan.flows) || !loan.flows.length || hedge.flows?.length !== loan.flows.length) return null
  if (!hedge.flows.every((flow) => finite(flow, ['days', 'dc', 'interest', 'irrf', 'guarantee', 'principal', 'usd', 'ndfRate', 'brl']))) return null
  const scenarios = E4_FX_SCENARIOS.map((change) => unhedged4131(loan, change))
  if (!scenarios.every((item) => item.ok && finite(item, ['fxEnd', 'totalBrl', 'cost']))) return null
  return freeze(structuredClone({
    capturedAt,
    loan,
    hedge: { di: hedge.di, cupom: hedge.cupom, swapSpread: hedge.swapSpread, ndfMarkup: hedge.ndfMarkup, swap: hedge.swap, ndf: hedge.ndf, flows: hedge.flows },
    scenarios: scenarios.map(({ fxChange, fxEnd, totalBrl, cost }) => ({ fxChange, fxEnd, totalBrl, cost })),
    labels: { freq: String(labels.freq ?? ''), irPayer: String(labels.irPayer ?? '') },
    notice: E4_NOTICE,
    printNotice: E4_PRINT_NOTICE,
    sources: E4_SOURCES,
  }))
}

export function buildE4Slides(snapshot, { title = '', sections = E4_SLIDES.map((item) => item.id), textSize = 'normal' } = {}) {
  if (!snapshot) return null
  const slides = E4_SLIDES.filter((item) => item.required || sections.includes(item.id)).map((item) => item.id)
  return freeze({ title: String(title).trim().slice(0, 100) || E4_TITLE, textSize: ['normal', 'large', 'xl'].includes(textSize) ? textSize : 'normal', slides })
}
