import { CUSTOS, faixaTfb, faixaTfc, simular, vencimentoDia15 } from './finameMateriais.js'
import { creditCet } from './creditComparison.js'
import { parseDecimal } from './emprestimo.js'

// Premissas desta tela do Finame, sem alterar os motores dos outros perfis BNDES.
export const FINAME_PREMISES = Object.freeze({ sistema: 'sac', composicao: 'capitalizada', liberacao: 90 })
export const validFinameQuote = quote => Number.isFinite(quote?.valor) && quote.valor >= 0 && quote.valor <= 100 && typeof quote.codigo === 'string' && quote.codigo.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(quote.data)

export function resolveFinameRate(id, quote, manualText = null) {
  const manual = manualText !== null
  const value = finameFundingAnnualRate(id, { [id]: manual ? parseDecimal(manualText) : quote?.valor })
  return { value, manual, error: value === null ? (manual ? 'Informe uma taxa de 0 a 100% a.a.' : 'Cotação indisponível. Informe a taxa manualmente ou aguarde a referência.') : null }
}

export function finameSimulationParams(params) {
  return { ...params, ...FINAME_PREMISES, iof: { fixed: 0, daily: 0 }, fgi: params.fgi ? { ...params.fgi, incorporar: false } : null }
}

// O catálogo do produto não transforma uma moeda contratual em taxa anual.
// Cada perfil conserva sua unidade e seu modelo de apuração.
export const FINAME_FUNDING_SOURCES = Object.freeze([
  { label: 'BNDES Finame Materiais Industrializados', url: 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/finame-materiais-industrializados' },
  { label: 'BNDES — Selic e Taxa LCD', url: 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/guia/custos-financeiros/selic-taxa-lcd' },
  { label: 'BNDES — Taxa Fixa BNDES em Dólar', url: 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/guia/custos-financeiros/taxa-fixa-bndes-em-dolar' },
])

export const FINAME_FUNDING_OPTIONS = Object.freeze([
  ...CUSTOS.filter(option => option.id !== 'tlp').map(option => Object.freeze({ ...option, mode: 'inline' })),
  // Pós-fixados no mesmo cronograma (pedido de 19/11/2026): taxa do painel + hipótese do índice (Focus ano a ano, editável).
  Object.freeze({
    id: 'tlp', label: 'TLP', mode: 'pos', calculatorId: 'bndes-tlp-exigivel',
    hint: 'TLP exigível: J (parte prefixada da TLP, moeda 777 do BNDES, do mês da contratação) mais IPCA, cobrados com os juros nos vencimentos; o IPCA não corrige o saldo. Juros em dias úteis/252. O IPCA futuro é hipótese: vem do Focus ano a ano e pode ser editado. Carência de até 24 meses. Aceita FGI Tradicional (o regulamento veda só a TLP capitalizada).',
    notice: 'TLP: J do painel e IPCA projetado pelo Focus.',
  }),
  Object.freeze({
    id: 'lcd', label: 'Taxa LCD', mode: 'pos', calculatorId: 'bndes-selic-lcd',
    hint: 'Selic capitalizada no saldo mais a sobretaxa LD1 (moeda LD1 do BNDES, referência trimestral, pode ser negativa), a taxa do BNDES e o spread do agente, cobrados nos vencimentos. Juros em dias úteis/252. A Selic futura é hipótese: média dos fins de ano do Focus (no ano da liberação, a Selic atual), editável. Carência de até 24 meses. Sem FGI Tradicional.',
    notice: 'Taxa LCD: LD1 do painel e Selic projetada pelo Focus.',
  }),
  Object.freeze({
    id: 'tfbd', label: 'TFBD · dólar', mode: 'pos',
    hint: 'Taxa Fixa BNDES em dólar: o saldo em reais acompanha a moeda 604 (dólar) do BNDES e os juros usam a taxa fixa TFBD (TD1 até 24 meses, TD2 acima de 24 até 72, TD3 acima de 72), proporcionais aos dias corridos, base 360. O dólar futuro é hipótese: parte do dólar do dia e segue o Focus de fim de ano, editável. Carência de até 24 meses. Sem FGI Tradicional. Não disponível no Itaú.',
    notice: 'TFBD: taxa fixa do painel e dólar projetado pelo Focus. Não disponível no Itaú.',
    referenceCodes: Object.freeze(['TD1', 'TD2', 'TD3', '604']),
  }),
])

export const finameFundingOption = id => FINAME_FUNDING_OPTIONS.find(option => option.id === id) ?? null
export const isFinamePos = id => finameFundingOption(id)?.mode === 'pos'

// Taxa de referência dos pós-fixados (J da TLP, LD1 ou TFBD): cotação do painel ou taxa manual. A LD1 pode ser negativa.
export const validPosQuote = quote => Number.isFinite(quote?.valor) && quote.valor > -50 && quote.valor <= 100 && typeof quote.codigo === 'string' && quote.codigo.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(quote.data)
export function resolvePosRate(id, quote, manualText = null) {
  const manual = manualText !== null
  const raw = manual ? parseSignedDecimal(manualText) : quote?.valor
  const value = isFinamePos(id) && Number.isFinite(raw) && raw > -50 && raw <= 100 ? raw : null
  return { value, manual, error: value === null ? (manual ? 'Informe uma taxa de −50 a 100% a.a.' : 'Cotação indisponível. Informe a taxa manualmente ou aguarde a referência.') : null }
}
export function parseSignedDecimal(text) {
  const value = String(text ?? '').trim().replace('−', '-'), negative = value.startsWith('-')
  const parsed = parseDecimal(negative ? value.slice(1) : value)
  return parsed === null ? null : negative ? -parsed : parsed
}

// Somente os dois perfis já suportados pelo cronograma mensal podem fornecer
// custoFinanceiro. TLP/LCD/TFBD e códigos isolados nunca herdam a taxa da TLP.
export function finameFundingAnnualRate(id, quotes) {
  if (finameFundingOption(id)?.mode !== 'inline') return null
  const value = quotes?.[id]
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null
}

// Compara só os custos suportados, mantendo entradas e motor financeiro iguais.
// Datas ou faixas diferentes não produzem uma diferença comercial equivalente.
export function compareFinameFunding(params, quotes, manualRates = {}) {
  if (!['tfc', 'tfb'].includes(params.custo)) return { ok: false, error: 'A comparação de parcelas está disponível somente para TFC e TFB.' }
  if (params.liberacao !== 90) return { ok: false, error: 'Para comparar com a TFC, use a TFB com liberação em 90 dias.' }
  if (faixaTfb(params.prazo) !== faixaTfc(params.prazo)) return { ok: false, error: 'Não há par de séries com a mesma faixa de prazo para esta operação. Consulte as referências em Taxas e históricos.' }
  if (!quotes.tfc?.data || !quotes.tfb?.data || quotes.tfc.data !== quotes.tfb.data) return { ok: false, error: 'As referências TFC e TFB precisam ter a mesma data para calcular a diferença. Consulte as datas de cada série em Taxas e históricos.' }
  const alternatives = ['tfc', 'tfb'].map(custo => {
    const rate = resolveFinameRate(custo, quotes[custo], manualRates[custo] ?? null)
    if (rate.value === null) return null
    const result = simular({ ...params, custo, custoFinanceiro: rate.value })
    return result.ok ? { custo, quote: quotes[custo], rate, result } : null
  })
  if (alternatives.some(item => !item)) return { ok: false, error: 'Uma das referências está indisponível ou as condições estão incompletas. Ausência de taxa não significa zero.' }
  return { ok: true, alternatives, totalDifference: alternatives[1].result.total - alternatives[0].result.total }
}

// Comparativo de qualquer par de custos (pedido de 19/11/2026). O par TFC × TFB mantém as travas de mesma faixa,
// mesma data de referência e liberação em 90 dias; os demais pares usam cada um a sua referência, mostrada na tela.
// `simularCusto(id)` devolve { custo, quote, rate, result } ou null quando falta taxa ou a conta não fecha.
export function compareFinamePair(pair, params, quotes, manualRates, simularCusto) {
  if (!Array.isArray(pair) || pair.length !== 2 || pair[0] === pair[1] || !pair.every(id => finameFundingOption(id))) return { ok: false, error: 'Escolha dois custos diferentes para comparar.' }
  if (pair.every(id => ['tfc', 'tfb'].includes(id))) {
    const result = compareFinameFunding({ ...params, custo: pair[0] }, quotes, manualRates)
    if (!result.ok) return result
    const alternatives = pair.map(id => result.alternatives.find(item => item.custo === id))
    return { ok: true, alternatives, totalDifference: alternatives[1].result.total - alternatives[0].result.total }
  }
  const alternatives = pair.map(id => simularCusto(id))
  if (alternatives.some(item => !item)) return { ok: false, error: 'Uma das referências está indisponível ou as condições estão incompletas. Ausência de taxa não significa zero.' }
  return { ok: true, alternatives, totalDifference: alternatives[1].result.total - alternatives[0].result.total }
}

// CET estimado (Resolução CMN 4.881/2020, art. 4º): taxa anual que iguala o valor líquido recebido na liberação
// (valor liberado menos IOF, TAC e ECG do FGI pago à vista, tudo cobrado na liberação) ao valor presente dos pagamentos do cronograma,
// descontados em dias corridos/365 a partir da liberação. Mesmo método do Comparador de Crédito (creditCet).
// Com data de liberação, o motor já traz o CET do calendário real (juros por dias corridos, dia 15 ou próximo dia útil).
// Sem data (uso programático legado), recalcula sobre a projeção em meses iguais nas mesmas datas.
// Sem seguros nem outras tarifas: não é o CET do contrato. Devolve null quando o fluxo não fecha.
export function finameCet(result, releaseDate, holidayCtx = {}, calendarios = ['BR']) {
  // Resultado com calendário real já traz o CET apurado pelo motor (mesmos vencimentos e dias): usa esse valor.
  if (result?.ok && result.calendario === 'datas-reais-act-act') return result.cet ?? null
  if (!result?.ok || Object.prototype.toString.call(releaseDate) !== '[object Date]' || Number.isNaN(+releaseDate) || !Array.isArray(result.parcelas)) return null
  const ecgAVista = result.fgi && !result.fgi.incorporado ? result.fgi.ecg : 0
  const liquido = result.liberado - result.iof - result.tac - ecgAVista // IOF todo na liberação
  const rows = result.parcelas.filter(p => p.parcela > 0).map(p => ({ days: Math.round((vencimentoDia15(releaseDate, p.mes, holidayCtx, calendarios) - releaseDate) / 86400000), payment: p.parcela }))
  const anual = creditCet(liquido, rows)
  if (anual === null) return null
  return { anual: anual * 100, mensal: Math.expm1(Math.log1p(anual) / 12) * 100, liquido }
}
