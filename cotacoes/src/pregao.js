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

// Maior movimento da linha no dia: a maior queda (de uma cotação até a mínima que veio depois) ou a maior alta
// (de uma cotação até a máxima que veio depois), a que for maior em %. Conta todas as amostras, também a da madrugada,
// que costuma ser o fechamento da véspera: a queda ou a alta contra ela é justamente o movimento do dia.
export function maiorMovimento(points) {
  let melhor = null
  let iMin = -1, iMax = -1
  points.forEach((p, j) => {
    if (!Number.isFinite(p?.bid)) return
    if (iMin >= 0) {
      const alta = (p.bid / points[iMin].bid - 1) * 100
      if (alta > 0 && (!melhor || alta > Math.abs(melhor.pct))) melhor = { de: iMin, ate: j, pct: alta, dir: 'alta' }
    }
    if (iMax >= 0) {
      const queda = (p.bid / points[iMax].bid - 1) * 100
      if (queda < 0 && (!melhor || -queda > Math.abs(melhor.pct))) melhor = { de: iMax, ate: j, pct: queda, dir: 'queda' }
    }
    if (iMin < 0 || p.bid < points[iMin].bid) iMin = j
    if (iMax < 0 || p.bid > points[iMax].bid) iMax = j
  })
  return melhor
}
