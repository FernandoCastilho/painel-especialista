// Product age guard, not a provider SLA or a market-open/closed detector.
export const QUOTE_AGE_LIMIT_MS = 10 * 60000
export function quoteAgeState(quote, now = Date.now()) {
  if (!quote) return 'Sem dado'
  if (quote.stale) return 'Pendente'
  if (quote.fallback) return 'Reserva diária'
  if (!Number.isFinite(quote.timestamp) || quote.timestamp <= 0 || quote.timestamp > now + 60000) return 'Horário inválido'
  return now - quote.timestamp > QUOTE_AGE_LIMIT_MS ? 'Dado antigo' : ''
}

// Janela de coleta intensiva do câmbio no painel: dias úteis, 9h05 às 18h de Brasília (UTC−3). É o relógio da coleta, não do mercado.
const HOUR = 3600000, DAY = 24 * HOUR, OPEN_MIN = 9 * 60 + 5, CLOSE_MIN = 18 * 60
const brasilia = (t) => { const d = new Date(t - 3 * HOUR); return { day: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes(), midnight: Math.floor((t - 3 * HOUR) / DAY) * DAY + 3 * HOUR } }
export function inCollectionWindow(now = Date.now()) {
  const { day, min } = brasilia(now)
  return day >= 1 && day <= 5 && min >= OPEN_MIN && min < CLOSE_MIN
}
// Fim da última janela de coleta já encerrada.
export function lastCollectionEnd(now = Date.now()) {
  let { day, min, midnight } = brasilia(now)
  if (!(day >= 1 && day <= 5 && min >= CLOSE_MIN)) do { midnight -= DAY; day = (day + 6) % 7 } while (day === 0 || day === 6)
  return midnight + CLOSE_MIN * 60000
}
// Referência do fim da última janela, vista fora do horário de coleta: é o esperado, não um atraso.
export function offHoursReference(quote, now = Date.now()) {
  if (!quote || inCollectionWindow(now) || !Number.isFinite(quote.timestamp) || quote.timestamp > now + 60000) return false
  return quote.timestamp >= lastCollectionEnd(now) - HOUR
}
const shortStamp = (t) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t).replace(',', '')
// Só apresentação: a regra de idade (quoteAgeState) não muda. Fora da janela de coleta, mostra o horário da referência em tom neutro.
export function quoteAgeLabel(quote, now = Date.now()) {
  const state = quoteAgeState(quote, now)
  if (state === 'Dado antigo' && offHoursReference(quote, now)) return { text: 'Referência de ' + shortStamp(quote.timestamp).replace(' ', '\u00a0'), tone: 'neutral', state }
  return { text: state, tone: state ? 'alert' : '', state }
}
