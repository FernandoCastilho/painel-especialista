// Apresentação e impressão do empréstimo externo (4131): cópia congelada do que a tela calculou.
// Nunca recalcula nem busca taxa nova; se faltar número, não gera a cópia.
import { moedaOf, unhedged4131 } from './emprestimo4131.js'

const freeze = (value) => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

export const E4_SLIDES = Object.freeze([
  { id: 'operation', label: 'Dados da operação' },
  { id: 'cost', label: 'Custo na moeda' },
  { id: 'results', label: 'Três caminhos em reais', required: true },
  { id: 'scenarios', label: 'Sem proteção: cenários de câmbio' },
  { id: 'flow', label: 'Pagamentos' },
  { id: 'premises', label: 'Premissas e limites', required: true },
])
export const E4_TITLE = 'Empréstimo externo · 4131'
export const E4_NOTICE = 'Estimativa para comparar propostas, com câmbio a termo teórico. Não inclui IR nem PIS/Cofins sobre ganho do derivativo. A cotação da mesa do banco e o contrato prevalecem.'
// Quando as taxas futuras foram coladas da cotação da mesa, o NDF deixa de ser teórico. A coluna do swap usa as mesmas
// taxas: é o fluxo do NDF lido em CDI, não uma cotação de swap. Sem proteção segue estimado por cenário.
export const E4_NOTICE_MESA = 'Simulação com as taxas futuras informadas da cotação da mesa. Não inclui IR nem PIS/Cofins sobre ganho do derivativo. A cotação confirmada pelo banco e o contrato prevalecem.'
export const E4_PRINT_NOTICE_MESA = 'Simulação indicativa, sujeita à análise e aprovação da instituição financeira. Não constitui proposta, oferta, garantia de aprovação ou compromisso de crédito. O custo com NDF usa as taxas futuras informadas; a cotação confirmada pela mesa do banco e o contrato prevalecem.'
// Leitura no formato das cotações de banco (4131 com NDF), igual na tela, na apresentação e no PDF.
export const E4_QUOTE_NOTE = 'Custo efetivo: taxa que iguala o valor líquido em reais às parcelas travadas no NDF, por dias corridos; ao mês é a taxa de 30 dias e ao ano são 12 meses de 30 dias (exp/360). Economia de IOF: o que um capital de giro em reais pagaria de IOF no mesmo cronograma (0,38% + 0,0082% ao dia por parcela, até 365 dias). Equivalente em giro: a taxa de giro que leva ao mesmo custo final.'
export const E4_PRINT_NOTICE = 'Simulação indicativa, sujeita à análise e aprovação da instituição financeira. Não constitui proposta, oferta, garantia de aprovação ou compromisso de crédito. Os custos com swap e NDF são teóricos; a cotação da mesa do banco e o contrato prevalecem.'
export const E4_FX_SCENARIOS = Object.freeze([-10, 0, 5, 10, 20])
export const E4_SOURCES = Object.freeze([
  { label: 'Resolução BCB 278/2022 · crédito externo', url: 'https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20BCB&numero=278' },
  { label: 'Decreto 6.306/2007 · IOF', url: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/d6306compilado.htm' },
  { label: 'Decreto 9.580/2018 · IR na fonte', url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/d9580.htm' },
  { label: 'B3 · Termo de moeda (NDF)', url: 'https://www.b3.com.br/pt_br/produtos-e-servicos/registro/derivativos-de-balcao/contrato-a-termo-de-moeda.htm' },
])

const finite = (object, keys) => keys.every((key) => Number.isFinite(object?.[key]))

// `labels`: textos já escolhidos na tela (frequência dos juros, quem arca com o IR, principal e regra das datas).
export function captureE4({ loan, hedge, labels = {} }, capturedAt = Date.now()) {
  if (!loan?.ok || !hedge?.ok || !Number.isFinite(capturedAt)) return null
  if (!finite(loan, ['principal', 'rate', 'spot', 'months', 'irrf', 'flat', 'guarantee', 'avgTermDays', 'iofRate', 'flatUsd', 'iofUsd', 'flatIrUsd', 'netUsd', 'netBrl', 'grossedRate', 'allIn'])) return null
  if (!finite(loan.totals, ['interest', 'irrf', 'guarantee', 'principal', 'usd'])) return null
  if (!finite(hedge, ['di', 'cupom', 'swapSpread', 'ndfMarkup']) || !finite(hedge.swap, ['pre', 'spread', 'pctCdi', 'runPre', 'runSpread', 'runPctCdi']) || !finite(hedge.ndf, ['pre', 'cost365', 'spread', 'pctCdi', 'totalBrl', 'breakeven', 'cetMes', 'cetAno', 'iofGiro', 'giroMes', 'giroAno'])) return null
  if (!Array.isArray(loan.flows) || !loan.flows.length || hedge.flows?.length !== loan.flows.length) return null
  if (!hedge.flows.every((flow) => finite(flow, ['days', 'dc', 'balance', 'interest', 'irrf', 'guarantee', 'principal', 'usd', 'ndfRate', 'brl']))) return null
  const scenarios = E4_FX_SCENARIOS.map((change) => unhedged4131(loan, change))
  if (!scenarios.every((item) => item.ok && finite(item, ['fxEnd', 'totalBrl', 'cost']))) return null
  return freeze(structuredClone({
    capturedAt,
    loan,
    hedge: { source: hedge.source, di: hedge.di, cupom: hedge.cupom, swapSpread: hedge.swapSpread, ndfMarkup: hedge.ndfMarkup, swap: hedge.swap, ndf: hedge.ndf, flows: hedge.flows },
    scenarios: scenarios.map(({ fxChange, fxEnd, totalBrl, cost }) => ({ fxChange, fxEnd, totalBrl, cost })),
    labels: { freq: String(labels.freq ?? ''), irPayer: String(labels.irPayer ?? ''), curve: String(labels.curve ?? ''), fees: String(labels.fees ?? ''), amort: String(labels.amort ?? ''), dates: String(labels.dates ?? '') },
    notice: hedge.source === 'mesa' ? E4_NOTICE_MESA : E4_NOTICE,
    printNotice: hedge.source === 'mesa' ? E4_PRINT_NOTICE_MESA : E4_PRINT_NOTICE,
    sources: E4_SOURCES,
  }))
}

export function buildE4Slides(snapshot, { title = '', sections = E4_SLIDES.map((item) => item.id), textSize = 'normal' } = {}) {
  if (!snapshot) return null
  const slides = E4_SLIDES.filter((item) => item.required || sections.includes(item.id)).map((item) => item.id)
  return freeze({ title: String(title).trim().slice(0, 100) || E4_TITLE, textSize: ['normal', 'large', 'xl'].includes(textSize) ? textSize : 'normal', slides })
}

const num = (value, digits = 2) => value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const pctText = (value) => `${num(Math.abs(value) < 0.005 ? 0 : value)}%`
const dia = (iso) => iso.split('-').reverse().join('/')
const FREQ_NOME = { 1: 'Mensal', 3: 'Trimestral', 6: 'Semestral', 12: 'Anual', 0: 'No vencimento' }

// Condições da operação, na ordem das cotações de banco de 4131 com NDF: [rótulo, valor]. Sem tomador, CNPJ, credor
// e garantias: são dados do cliente e não passam pela calculadora. Custos que entram no custo efetivo (IR somado,
// fiança, IR sobre comissões, acréscimo no NDF) só aparecem quando existem.
const taxaText = (value) => `${value.toLocaleString('pt-BR', Number.isInteger(Math.round(value * 1e6) / 1e4) ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%`
export function condicoesE4(loan, hedge = null) {
  if (!loan?.ok) return []
  const cur = moedaOf(loan.currency)
  const parcelas = loan.flows.filter((flow) => flow.principal > 0).length
  const comIr = loan.grossUp && loan.irrf > 0
  return [
    ['Data da cotação', dia(loan.start)],
    ['Produto', '4131 com NDF'],
    ['Valor de principal', `R$ ${num(loan.principal * loan.spot)}`],
    ['Moeda', `${cur.Nome} · ${cur.sym} ${num(loan.principal)}`],
    ['Cotação de partida', num(loan.spot, 4)],
    ['Taxa', `${cur.Nome} + ${taxaText(loan.rate)} a.a.${comIr ? ` + IR de ${num(loan.irrf, 0)}% por conta do tomador (${taxaText(loan.grossedRate)} a.a. com o IR)` : ''}`],
    ['Prazo', `${loan.months} ${loan.months === 1 ? 'mês' : 'meses'}`],
    ['Principal', loan.amort === 'parcelas' && parcelas > 1 ? `${FREQ_NOME[loan.freq]} · ${parcelas} parcelas` : 'No vencimento'],
    ['Juros', FREQ_NOME[loan.freq]],
    ['Prazo médio (DC)', String(loan.avgTermDays)],
    ['Carência do principal', loan.amort !== 'parcelas' ? 'Não se aplica' : loan.grace ? `${loan.grace} ${loan.grace === 1 ? 'pagamento' : 'pagamentos'}` : 'Sem carência'],
    ['Tarifa de contratação', `R$ ${num(loan.flatUsd * loan.spot)}`],
    ['IOF-câmbio na entrada', `${pctText(loan.iofRate)} · R$ ${num(loan.iofUsd * loan.spot)}`],
    ...(loan.guarantee > 0 ? [['Fiança ou SBLC', `${pctText(loan.guarantee)} a.a. sobre o saldo`]] : []),
    ...(comIr && loan.feesAbroad && (loan.flat > 0 || loan.guarantee > 0) ? [['IR sobre comissões', `${num(loan.irrf, 0)}% · comissões pagas ao exterior`]] : []),
    ...(hedge?.source === 'mesa' ? [['Taxa futura', 'Informada, da cotação da mesa']] : []),
    ...(hedge?.ndfMarkup > 0 ? [['Acréscimo do banco no NDF', pctText(hedge.ndfMarkup)]] : []),
  ]
}

// Texto no formato dos e-mails de cotação: condições, custo efetivo, economia de IOF e equivalente em giro.
export function resumoE4({ loan, hedge }) {
  if (!loan?.ok || !hedge?.ok) return ''
  // Sinal decidido depois de arredondar: spread que arredonda para zero sai como "+ 0,00%".
  const spread = Math.round(hedge.ndf.spread * 100) / 100
  const menos = (text) => text.replace(/^-/, '−')
  return [
    '4131 com NDF · Condições da operação',
    ...condicoesE4(loan, hedge).map(([rotulo, valor]) => `${rotulo}: ${valor}`),
    '',
    `Custo efetivo total: taxa de juros prefixada em reais de ${menos(pctText(hedge.ndf.cetMes))} a.m. / ${menos(pctText(hedge.ndf.cetAno))} a.a. (exp/360), equivalente a CDI ${spread < 0 ? '−' : '+'} ${pctText(Math.abs(spread))} (com DI de ${pctText(hedge.di)} a.a.)`,
    `Economia de IOF (R$): ${num(hedge.ndf.iofGiro)}${loan.iofRate > 0 ? ` (IOF que um capital de giro pagaria; não desconta o IOF-câmbio de R$ ${num(loan.iofUsd * loan.spot)} desta operação)` : ''}`,
    `Taxa equivalente em capital de giro: ${menos(pctText(hedge.ndf.giroMes))} a.m. / ${menos(pctText(hedge.ndf.giroAno))} a.a. (exp/360)`,
    '',
    `Simulação indicativa, com ${hedge.source === 'mesa' ? 'as taxas futuras informadas da cotação' : 'taxa futura teórica'}. Não inclui IR nem PIS/Cofins sobre ganho do derivativo. Sujeita a confirmação da cotação pela mesa do banco, a limite de crédito e a cadastro atualizado. Não constitui proposta nem compromisso de crédito.`,
  ].join('\n')
}
