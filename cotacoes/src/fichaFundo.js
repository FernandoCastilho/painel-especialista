// Formatação da lâmina e da ficha cadastral da CVM.
const MESES = 'jan fev mar abr mai jun jul ago set out nov dez'.split(' ')
const numeroBr = (valor, casas) => valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
const vazio = valor => valor === null || valor === undefined || Number.isNaN(valor)

export function pct(valor, casas = 2) {
  return vazio(valor) ? '—' : numeroBr(valor, casas) + '%'
}

export function reais(valor, { minimo = false } = {}) {
  if (vazio(valor)) return '—'
  if (minimo && valor === 0) return 'Sem mínimo'
  if (Math.abs(valor) >= 1e9) return 'R$ ' + numeroBr(valor / 1e9, 2) + ' bi'
  if (Math.abs(valor) >= 1e6) return 'R$ ' + numeroBr(valor / 1e6, 2) + ' mi'
  return 'R$ ' + numeroBr(valor, 2)
}

export function prazo(dias, tipo) {
  if (vazio(dias)) return '—'
  return `D+${dias}` + (tipo ? ' ' + tipo.toLocaleLowerCase('pt-BR') : '')
}

export const simNao = valor => valor === true ? 'Sim' : valor === false ? 'Não' : '—'

export function dataBr(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') ? iso.split('-').reverse().join('/') : '—'
}

export function competencia(iso) {
  return /^\d{4}-\d{2}/.test(iso ?? '') ? MESES[Number(iso.slice(5, 7)) - 1] + '/' + iso.slice(0, 4) : '—'
}

export const mesCurto = iso => MESES[Number(iso.slice(5, 7)) - 1]

// Barras do gráfico mensal: altura relativa ao maior módulo, sem sumir quando o mês é perto de zero.
export function alturas(valores) {
  const maior = Math.max(...valores.map(valor => Math.abs(valor ?? 0)), 0)
  return valores.map(valor => maior ? Math.max(2, Math.round(Math.abs(valor ?? 0) / maior * 100)) : 2)
}
