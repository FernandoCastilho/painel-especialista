// Alíquotas por ano para a calculadora de caixa. Só 2026 é oficial (banco da Receita).
// De 2027 em diante a Receita não publica alíquota: os valores abaixo são pontos de partida
// editáveis, sempre exibidos como "hipótese", com a origem de cada número.
export const ANOS_REFORMA = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

const ORIGEM_CBS_TRANSICAO = 'CBS: referência técnica do TCU (11,3%, out/2026) menos 0,1 ponto (LC 214/2025, art. 347). A alíquota de referência ainda não foi fixada.'
const ORIGEM_CBS = 'CBS: referência técnica do TCU (11,3%, out/2026). Não é alíquota legal.'
const ORIGEM_IBS = 'IBS: número da carga inicial do banco da Receita, retirado em 28/08/2026 por não estar definido em lei. Só ponto de partida.'
// Conferido em 19/11/2026 no texto atualizado da LC 214/2025 (Câmara dos Deputados, CBS_SOURCES.law), arts. 344 e 347.
const ORIGEM_IBS_TRANSICAO = 'IBS: 0,05% estadual + 0,05% municipal previstos na LC 214/2025, art. 344, para 2027 e 2028.'

// IBS 2029+: escada da carga inicial oficial (B0001 linhas 36269–36440), apagada pela V0053. Não é oficial.
const HIPOTESES = {
  2027: { cbs: 11.2, ibsUf: 0.05, ibsMun: 0.05, origem: [ORIGEM_CBS_TRANSICAO, ORIGEM_IBS_TRANSICAO] },
  2028: { cbs: 11.2, ibsUf: 0.05, ibsMun: 0.05, origem: [ORIGEM_CBS_TRANSICAO, ORIGEM_IBS_TRANSICAO] },
  2029: { cbs: 11.3, ibsUf: 1.6, ibsMun: 0.25, origem: [ORIGEM_CBS, ORIGEM_IBS] },
  2030: { cbs: 11.3, ibsUf: 3.2, ibsMun: 0.5, origem: [ORIGEM_CBS, ORIGEM_IBS] },
  2031: { cbs: 11.3, ibsUf: 4.8, ibsMun: 0.75, origem: [ORIGEM_CBS, ORIGEM_IBS] },
  2032: { cbs: 11.3, ibsUf: 6.4, ibsMun: 1, origem: [ORIGEM_CBS, ORIGEM_IBS] },
  2033: { cbs: 11.3, ibsUf: 16, ibsMun: 2.5, origem: [ORIGEM_CBS, ORIGEM_IBS] },
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
