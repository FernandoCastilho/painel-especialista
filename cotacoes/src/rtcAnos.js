// Alíquotas por ano para a calculadora de caixa. Só 2026 é oficial (banco da Receita).
// De 2027 em diante a Receita não publica alíquota: os valores abaixo são pontos de partida
// editáveis, sempre exibidos como "hipótese", com a origem de cada número.
export const ANOS_REFORMA = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

// Escada da Receita: números da carga inicial do banco oficial (B0001 linhas 36269–36440), apagados em
// 28/08/2026 pela V0053 por não estarem definidos em lei. Decisão de Fernando (19/11/2026): usar como ponto de partida.
const ORIGEM_CBS_TRANSICAO = 'CBS: número da carga inicial do banco da Receita, retirado em 28/08/2026. Segue o art. 347 da LC 214/2025 (alíquota de referência menos 0,1 ponto); a referência ainda não foi fixada (art. 349).'
const ORIGEM_ESCADA = 'CBS e IBS: números da carga inicial do banco da Receita, retirados em 28/08/2026 por não estarem definidos em lei. Só ponto de partida.'
// Conferido em 19/11/2026 no texto atualizado da LC 214/2025 (Câmara dos Deputados, CBS_SOURCES.law), arts. 344 e 347.
const ORIGEM_IBS_TRANSICAO = 'IBS: 0,05% estadual + 0,05% municipal previstos na LC 214/2025, art. 344, para 2027 e 2028.'

const HIPOTESES = {
  2027: { cbs: 8.4, ibsUf: 0.05, ibsMun: 0.05, origem: [ORIGEM_CBS_TRANSICAO, ORIGEM_IBS_TRANSICAO] },
  2028: { cbs: 8.4, ibsUf: 0.05, ibsMun: 0.05, origem: [ORIGEM_CBS_TRANSICAO, ORIGEM_IBS_TRANSICAO] },
  2029: { cbs: 8.5, ibsUf: 1.6, ibsMun: 0.25, origem: [ORIGEM_ESCADA] },
  2030: { cbs: 8.5, ibsUf: 3.2, ibsMun: 0.5, origem: [ORIGEM_ESCADA] },
  2031: { cbs: 8.5, ibsUf: 4.8, ibsMun: 0.75, origem: [ORIGEM_ESCADA] },
  2032: { cbs: 8.5, ibsUf: 6.4, ibsMun: 1, origem: [ORIGEM_ESCADA] },
  2033: { cbs: 8.5, ibsUf: 16, ibsMun: 2.5, origem: [ORIGEM_ESCADA] },
}

/** Alíquotas iniciais do ano. `oficial` só é verdadeiro quando vêm do banco da Receita. */
export function aliquotasDoAno(ano, oficial) {
  const ref = oficial.aliquotasReferencia.find(a => a.ano === ano)
  if (ref) return { cbs: ref.cbs, ibsUf: ref.ibsUf, ibsMun: ref.ibsMun, oficial: true,
    origem: [`Banco oficial da Receita, base ${oficial.fonte.versaoBaseDados} (${ref.inicio} a ${ref.fim}).`] }
  const h = HIPOTESES[ano]
  if (!h) return null
  return { cbs: h.cbs, ibsUf: h.ibsUf, ibsMun: h.ibsMun, oficial: false, origem: h.origem }
}
