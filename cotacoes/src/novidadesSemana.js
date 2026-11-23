import { marketDate } from './marketReturns.js'

function separarSemana(entries, now) {
  const hoje = Date.parse(marketDate(now) + 'T00:00:00Z')
  const inicio = hoje - 6 * 864e5
  const recentes = [], anteriores = []
  const datadas = entries.map(entrada => {
    const [dia, mes, ano] = entrada.date.split('/').map(Number)
    return { entrada, data: Date.UTC(ano, mes - 1, dia) }
  }).sort((a, b) => b.data - a.data)
  for (const { entrada, data } of datadas) {
    if (data > hoje) continue
    const grupo = data >= inicio ? recentes : anteriores
    grupo.push(entrada)
  }
  return { recentes, anteriores }
}

function agruparPorDia(entradas) {
  const dias = new Map()
  for (const { date, items } of entradas) {
    if (!dias.has(date)) dias.set(date, [])
    dias.get(date).push(...items)
  }
  return Array.from(dias, ([date, items]) => ({ date, items }))
}

export function organizarNovidades(entries, now = Date.now()) {
  const { recentes, anteriores } = separarSemana(entries, now)
  return { recentes: agruparPorDia(recentes), anteriores: agruparPorDia(anteriores) }
}

// O aviso de entrada continua curto. A tela completa inclui todos os itens, inclusive correções.
export function novidadesDaSemana(entries, now = Date.now(), max = 4) {
  return separarSemana(entries, now).recentes.map(e => e.resumo).filter(Boolean).slice(0, max)
}
