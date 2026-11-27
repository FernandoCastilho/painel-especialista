// Pregão do dólar à vista na B3: 9h às 18h (Brasília), de segunda a sexta. Amostras fora desse horário
// (por exemplo, o fechamento da véspera que a fonte repete de madrugada) ficam no gráfico,
// mas não contam como máxima ou mínima do dia.
const SP = 'America/Sao_Paulo'
const hm = new Intl.DateTimeFormat('en-GB', { timeZone: SP, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })

export const PREGAO_INICIO = 9 * 60
export const PREGAO_FIM = 18 * 60

// Dias úteis, de segunda a sexta (feriados da B3 não são conferidos aqui).
export function noPregao(t) {
  if (!Number.isFinite(t)) return false
  const partes = Object.fromEntries(hm.formatToParts(new Date(t)).map((p) => [p.type, p.value]))
  if (partes.weekday === 'Sat' || partes.weekday === 'Sun') return false
  const h = Number(partes.hour), m = Number(partes.minute)
  const min = (h % 24) * 60 + m
  return min >= PREGAO_INICIO && min <= PREGAO_FIM
}

// Índices da máxima e da mínima. Na visão intradiária, só entre as amostras do pregão.
export function extremos(points, intradiario) {
  let hi = -1, lo = -1
  points.forEach((p, i) => {
    if (!Number.isFinite(p?.bid) || (intradiario && !noPregao(p.t))) return
    if (hi < 0 || p.bid > points[hi].bid) hi = i
    if (lo < 0 || p.bid < points[lo].bid) lo = i
  })
  if (hi < 0 || points[hi].bid === points[lo].bid) return null
  return { hi, lo }
}
