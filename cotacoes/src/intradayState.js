import { marketDate as localDate } from './marketReturns.js'
import { QUOTE_AGE_LIMIT_MS, offHoursReference } from './quoteFreshness.js'

// Availability follows the actual retained samples, never a weekday assumption.
export function intradaySelection(points, selectedDate) {
  const valid = points.filter(p => Number.isFinite(p.t) && Number.isFinite(p.bid) && p.bid > 0).sort((a, b) => a.t - b.t)
  const selected = valid.filter(p => localDate(p.t) === selectedDate)
  const previous = valid.filter(p => localDate(p.t) < selectedDate).at(-1)
  return { points: selected, previousDay: previous ? localDate(previous.t) : null }
}

// The file can be regenerated without a new quote. Judge the actual observation,
// and do not mark an intentionally selected historical day as a live quote.
export function intradayObservationWarning(points, selectedDate, now = Date.now()) {
  const last = points?.at(-1)
  if (!last || selectedDate !== localDate(now)) return ''
  if (last.t > now + 60000) return 'Horário da última amostra está no futuro; confira o relógio e a fonte.'
  // Fora da janela de coleta, a última amostra da janela anterior é o esperado: informa sem tom de alerta.
  if (now - last.t > QUOTE_AGE_LIMIT_MS && offHoursReference({ timestamp: last.t }, now)) return 'Fora do horário de coleta do painel (dias úteis, 9h05 às 18h). O gráfico vai até a última amostra.'
  return now - last.t > QUOTE_AGE_LIMIT_MS
    ? 'Última amostra com mais de 10 minutos. O gráfico não representa a cotação atual.'
    : ''
}
