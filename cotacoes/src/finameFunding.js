import { CUSTOS, faixaTfb, faixaTfc, simular } from './finameMateriais.js'

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
export function compareFinameFunding(params, quotes) {
  if (!['tfc', 'tfb'].includes(params.custo)) return { ok: false, error: 'A comparação de parcelas está disponível somente para TFC e TFB.' }
  if (params.liberacao !== 90) return { ok: false, error: 'Para comparar com a TFC, use a TFB com liberação em 90 dias.' }
  if (faixaTfb(params.prazo) !== faixaTfc(params.prazo)) return { ok: false, error: 'Não há par de séries com a mesma faixa de prazo para esta operação. Consulte as referências em Taxas e históricos.' }
  if (!quotes.tfc?.data || !quotes.tfb?.data || quotes.tfc.data !== quotes.tfb.data) return { ok: false, error: 'As referências TFC e TFB precisam ter a mesma data para calcular a diferença. Consulte as datas de cada série em Taxas e históricos.' }
  const alternatives = ['tfc', 'tfb'].map(custo => {
    const custoFinanceiro = finameFundingAnnualRate(custo, { [custo]: quotes[custo]?.valor })
    if (custoFinanceiro === null) return null
    const result = simular({ ...params, custo, custoFinanceiro })
    return result.ok ? { custo, quote: quotes[custo], result } : null
  })
  if (alternatives.some(item => !item)) return { ok: false, error: 'Uma das referências está indisponível ou as condições estão incompletas. Ausência de taxa não significa zero.' }
  return { ok: true, alternatives, totalDifference: alternatives[1].result.total - alternatives[0].result.total }
}
