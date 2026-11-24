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

// O que é estruturante na entrega. Registros antigos só têm o resumo.
const destaquesDe = e => e.destaques ?? (e.resumo ? [e.resumo] : [])

function agruparPorDia(entradas) {
  const dias = new Map()
  for (const e of entradas) {
    if (!dias.has(e.date)) dias.set(e.date, { date: e.date, destaques: [], items: [] })
    const dia = dias.get(e.date)
    dia.destaques.push(...destaquesDe(e))
    dia.items.push(...(e.items ?? []))
  }
  return [...dias.values()]
}

export function organizarNovidades(entries, now = Date.now()) {
  const { recentes, anteriores } = separarSemana(entries, now)
  return { recentes: agruparPorDia(recentes), anteriores: agruparPorDia(anteriores) }
}

// O aviso de entrada lista todos os destaques dos últimos sete dias, o mais recente primeiro.
export function novidadesDaSemana(entries, now = Date.now()) {
  return separarSemana(entries, now).recentes.flatMap(destaquesDe)
}
