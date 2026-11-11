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
  Object.freeze({
    id: 'tlp', label: 'TLP exigível', mode: 'dedicated', calculatorId: 'bndes-tlp-exigivel',
    hint: 'TLP exigível: IPCA e remunerações compõem juros cobrados nos vencimentos. IPCA positivo não aumenta o principal. Use a projeção própria com J aplicável, hipótese explícita de IPCA e cronograma confirmado.',
    notice: 'TLP exigível utiliza projeção própria. O cronograma mensal com correção capitalizada foi retirado desta opção.',
  }),
  Object.freeze({
    id: 'lcd', label: 'Taxa LCD', mode: 'dedicated', calculatorId: 'bndes-selic-lcd',
    hint: 'Selic acumulada mais sobretaxa LCD. A referência LD1 é somente a sobretaxa das operações indiretas, não o custo financeiro completo. A série 143 é um índice Selic acumulado D-2, não uma taxa anual. Abra a projeção própria, com Selic, LD1, datas e cronograma confirmados; as condições do Finame não são transferidas nem presumidas.',
    notice: 'Taxa LCD utiliza a projeção própria de Selic + LCD.',
  }),
  Object.freeze({
    id: 'tfbd', label: 'TFBD · dólar', mode: 'unavailable',
    hint: 'Modalidade prevista no Finame Materiais. O saldo em reais é atualizado pela variação da unidade monetária 604 do BNDES, além da taxa TFBD fixada e das remunerações aplicáveis. As referências são TD1 até 24 meses, TD2 acima de 24 até 72 e TD3 acima de 72 até 120; no Finame Materiais continua valendo o limite próprio de 84 meses. O cálculo contratual usa juros proporcionais por dias corridos, base 360. A cotação do dólar sozinha não fornece esse custo; a taxa TFBD do dia está em BNDES > Moedas (TD1, TD2 e TD3), mas este modelo ainda não projeta a trajetória cambial contratual.',
    notice: 'TFBD indisponível: faltam a taxa fixada e a trajetória cambial contratual.',
    referenceCodes: Object.freeze(['TD1', 'TD2', 'TD3', '604']),
  }),
])

export const finameFundingOption = id => FINAME_FUNDING_OPTIONS.find(option => option.id === id) ?? null

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
