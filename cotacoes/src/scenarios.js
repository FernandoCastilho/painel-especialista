export const INSTITUTIONS = ['FOCUS', 'Itaú BBA', 'Bradesco', 'Santander', 'BB', 'BTG']
export const INDICATORS = [
  { id: 'pib', label: 'PIB', unit: '% no ano', focus: 'PIB' },
  { id: 'ipca', label: 'IPCA', unit: '% no ano', focus: 'IPCA' },
  { id: 'selic', label: 'Selic', unit: '% a.a. · dezembro/fim do ano', focus: 'Selic' },
  { id: 'usd', label: 'USD', unit: 'R$/US$', focus: 'Câmbio' },
]
// Compara a projeção de uma instituição com a mediana do Focus da mesma linha: 'up' (acima), 'down' (abaixo), 'same' (igual
// no que a tela mostra, 2 casas) ou null (algum dos dois ausente: nada a sinalizar).
export function compareToFocus(value, focusValue) {
  if (!Number.isFinite(value) || !Number.isFinite(focusValue)) return null
  const a = Math.round(value * 100), b = Math.round(focusValue * 100)
  return a > b ? 'up' : a < b ? 'down' : 'same'
}
export const FOCUS_MARK = { up: { symbol: '▲', text: 'acima do Focus' }, down: { symbol: '▼', text: 'abaixo do Focus' }, same: { symbol: '=', text: 'igual ao Focus' } }

export function scenarioValue(institution, indicator, year, focus, banks) {
  const value = institution === 'FOCUS'
    ? focus?.rows?.find((row) => row.label === indicator.focus)?.values?.[year]?.median
    : banks?.institutions?.find((bank) => bank.name === institution)?.years?.[year]?.[indicator.id]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

// Idade da projeção de um banco: dias corridos entre a data da projeção (AAAA-MM-DD) e hoje em Brasília.
// `antiga` passa de 14 dias. Data ausente ou inválida devolve null (a tela mostra "fonte pendente").
export const PROJECAO_ANTIGA_DIAS = 14
export function idadeProjecao(iso, agora = Date.now()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (!m) return null
  const hoje = new Date(agora).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const dias = Math.round((Date.parse(hoje) - Date.parse(iso)) / 864e5)
  if (!Number.isFinite(dias)) return null
  return { dias, data: `${m[3]}/${m[2]}`, antiga: dias > PROJECAO_ANTIGA_DIAS }
}
export const textoIdadeProjecao = (idade) => !idade ? 'fonte pendente' : `projeção de ${idade.data} (${idade.dias < 0 ? 'data futura' : idade.dias === 0 ? 'de hoje' : `há ${idade.dias} ${idade.dias === 1 ? 'dia' : 'dias'}`})`
// Só a idade, para a linha do banco na tabela (a data vai ao lado): "há 49 dias", "hoje" ou "data futura".
export const textoHaDias = (idade) => !idade ? '' : idade.dias < 0 ? 'data futura' : idade.dias === 0 ? 'hoje' : `há ${idade.dias} ${idade.dias === 1 ? 'dia' : 'dias'}`
