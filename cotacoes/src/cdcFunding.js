// Tabela de funding do CDC (foto enviada por Fernando em 25/11/2026; valores de exemplo). Taxas ao ano por prazo em meses.
// Para trocar a tabela: acrescentar uma vigência no início da lista (a primeira é a padrão da tela).
export const FUNDING = Object.freeze([
  { id: '2026-11-19', fim: '2026-11-25', label: '19/11 até 25/11', taxas: { 6: 13.80, 9: 14.12, 12: 14.37, 18: 14.77, 24: 15.04, 36: 15.35, 42: 15.44, 48: 15.58, 60: 15.73, 72: 15.84 } },
  { id: '2026-11-11', fim: '2026-11-18', label: '11/11 até 18/11', taxas: { 6: 13.68, 9: 13.96, 12: 14.20, 18: 14.58, 24: 14.85, 36: 15.19, 42: 15.28, 48: 15.44, 60: 15.60, 72: 15.72 } },
])

// Funding ao ano para o prazo: o do prazo exato; entre dois prazos da tabela, reta entre eles; fora da tabela, o da ponta.
export function fundingDoPrazo(vigenciaId, prazo) {
  const vig = FUNDING.find(v => v.id === vigenciaId) ?? FUNDING[0]
  const prazos = Object.keys(vig.taxas).map(Number).sort((a, b) => a - b)
  if (prazo <= prazos[0]) return { taxa: vig.taxas[prazos[0]], nota: prazo < prazos[0] ? `prazo abaixo da tabela: usado o de ${prazos[0]} meses` : null }
  if (prazo >= prazos.at(-1)) return { taxa: vig.taxas[prazos.at(-1)], nota: prazo > prazos.at(-1) ? `prazo acima da tabela: usado o de ${prazos.at(-1)} meses` : null }
  const hi = prazos.findIndex(p => p >= prazo), b = prazos[hi], a = prazos[hi - 1]
  if (b === prazo) return { taxa: vig.taxas[b], nota: null }
  return { taxa: vig.taxas[a] + (vig.taxas[b] - vig.taxas[a]) * (prazo - a) / (b - a), nota: `interpolado entre ${a} e ${b} meses` }
}

// Spread composto: (1 + taxa do cliente ao ano) = (1 + funding ao ano) × (1 + spread ao ano). taxaAm em % ao mês.
export function spreadDaOperacao({ taxaAm, prazo, vigenciaId }) {
  const f = fundingDoPrazo(vigenciaId, prazo)
  const taxaAa = Math.pow(1 + taxaAm / 100, 12) - 1
  const spreadAa = (1 + taxaAa) / (1 + f.taxa / 100) - 1
  return { taxaAa, fundingAa: f.taxa / 100, fundingAm: Math.pow(1 + f.taxa / 100, 1 / 12) - 1, spreadAa,
    spreadAm: Math.pow(1 + spreadAa, 1 / 12) - 1, nota: f.nota }
}
