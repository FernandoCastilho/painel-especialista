// Escala do gráfico: agrupa os pontos por 5, 15 ou 30 minutos, hora, dia, mês ou ano (valor = último ponto do período; máxima/mínima do período).
// Só agrupa para escalas mais grossas que o dado original: hora a hora não existe em série diária.
import { marketDate } from './marketReturns.js'

const SP = 'America/Sao_Paulo'
const hourOf = (t) => new Intl.DateTimeFormat('en-GB', { timeZone: SP, hour: '2-digit', hour12: false }).format(new Date(t)).slice(0, 2)
const MIN = 60e3
// O fuso de São Paulo é de horas inteiras: o minuto local é o mesmo do UTC.
const minuteOf = (t) => new Date(t).getUTCMinutes()
const day = (t) => marketDate(t).split('-').reverse().slice(0, 2).join('/')
// Blocos de n minutos: rótulo com o início do bloco (ex.: 27/11 10h15).
const minutos = (n) => ({
  key: (t) => `${marketDate(t)}T${hourOf(t)}:${Math.floor(minuteOf(t) / n)}`,
  name: (t) => `${day(t)} ${hourOf(t)}h${String(Math.floor(minuteOf(t) / n) * n).padStart(2, '0')}`,
})
const DAY = 864e5

// maxStep: o espaçamento típico do dado tem de ser menor que isso para a escala fazer sentido.
// intradiario: a escala mostra horas no eixo, como a visão do dia.
export const SCALES = [
  // 5 min: a coleta é de cerca de 5 em 5 minutos; aqui os pontos ficam alinhados ao relógio (10h00, 10h05...).
  { id: '5min', label: '5 min', title: 'Um ponto a cada 5 minutos', maxStep: 6 * MIN, intradiario: true, ...minutos(5) },
  { id: '15min', label: '15 min', title: 'Um ponto a cada 15 minutos', maxStep: 14 * MIN, intradiario: true, ...minutos(15) },
  { id: '30min', label: '30 min', title: 'Um ponto a cada 30 minutos', maxStep: 28 * MIN, intradiario: true, ...minutos(30) },
  { id: 'hora', label: 'Hora', title: 'Um ponto por hora', maxStep: 55 * MIN, intradiario: true, key: (t) => `${marketDate(t)}T${hourOf(t)}`, name: (t) => `${day(t)} ${hourOf(t)}h` },
  { id: 'dia', label: 'Dia', title: 'Um ponto por dia', maxStep: 1.5 * DAY, key: (t) => marketDate(t) },
  { id: 'mes', label: 'Mês', title: 'Um ponto por mês (último dia com dado)', maxStep: 20 * DAY, key: (t) => marketDate(t).slice(0, 7), name: (t) => new Date(t).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: SP }).replace('.', '') },
  { id: 'ano', label: 'Ano', title: 'Um ponto por ano (último dia com dado)', maxStep: 300 * DAY, key: (t) => marketDate(t).slice(0, 4), name: (t) => String(new Date(t).toLocaleDateString('pt-BR', { year: 'numeric', timeZone: SP })) },
]

// Espaçamento típico (mediana) entre pontos consecutivos.
export function nativeStep(points) {
  const d = []
  for (let i = 1; i < points.length; i++) { const s = points[i].t - points[i - 1].t; if (s > 0) d.push(s) }
  if (!d.length) return Infinity
  d.sort((a, b) => a - b)
  return d[d.length >> 1]
}

export function resample(points, id) {
  const scale = SCALES.find((s) => s.id === id)
  if (!scale || !Array.isArray(points)) return points
  const buckets = new Map()
  for (const p of points) {
    const k = scale.key(p.t), b = buckets.get(k)
    const hi = p.high ?? p.bid, lo = p.low ?? p.bid
    if (!b) buckets.set(k, { ...p, high: hi, low: lo })
    else buckets.set(k, { ...p, high: Math.max(b.high, hi), low: Math.min(b.low, lo) })
  }
  return [...buckets.values()].sort((a, b) => a.t - b.t)
}

// Escalas oferecidas para estes pontos, com o motivo quando não cabem.
export function scaleOptions(points) {
  const step = Array.isArray(points) && points.length > 1 ? nativeStep(points) : Infinity
  return SCALES.map((s) => {
    if (!(step < s.maxStep)) return { ...s, enabled: false, reason: step === Infinity ? 'Poucos pontos' : `Os dados não têm detalhe de ${s.label.toLowerCase()}` }
    const n = resample(points, s.id).length
    return n >= 2 ? { ...s, enabled: true, count: n } : { ...s, enabled: false, reason: 'Período curto: só um ponto nessa escala' }
  })
}
