import { offHoursReference, quoteAgeState } from './quoteFreshness.js'

const HOUR = 3600000
const DAY = 24 * HOUR
const CODES = ['USD', 'EUR', 'JPY', 'CNH']
export const HEALTH_LABELS = { ok: 'Sem alerta', old: 'Coleta atrasada', retained: 'Último válido', partial: 'Atualização parcial', reserve: 'Reserva diária', missing: 'Indisponível', loading: 'Carregando', offhours: 'Fora do horário de coleta' }
export const healthTime = value => {
  const t = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN
  return Number.isFinite(t) && t > 0 ? t : null
}
const validTime = (value, now) => { const t = healthTime(value); return t != null && t <= now + 60000 ? t : null }

// Relógio da coleta de dias úteis, em Brasília (UTC−3): a pausa não apaga atraso já adquirido.
export function collectionAge(at, now, weekdays) {
  if (!weekdays) return Math.max(0, now - at)
  const weeks = Math.max(0, Math.floor((now - at) / (7 * DAY)))
  let elapsed = weeks * 5 * DAY
  let cursor = at + weeks * 7 * DAY
  while (cursor < now) {
    const midnight = Math.floor((cursor - 3 * HOUR) / DAY) * DAY + 3 * HOUR
    const end = Math.min(now, midnight + DAY)
    const weekday = new Date(midnight).getUTCDay()
    if (weekday !== 0 && weekday !== 6) elapsed += end - cursor
    cursor = end
  }
  return elapsed
}

// Metadados de retenção: não percorre séries/pontos em arrays nem infere atraso pela idade de uma taxa vigente.
const marked = value => value === true || (typeof value === 'string' && value.trim() !== '') || (value && typeof value === 'object' && Object.keys(value).length > 0)
function hasFailure(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false
  if (marked(node.stale) || marked(node.error) || marked(node.errors)) return true
  return Object.entries(node).some(([key, value]) => key !== 'stale' && value && typeof value === 'object' && !Array.isArray(value) && hasFailure(value))
}

export function sourceHealth(resource, maxAge, weekdays = true, now = Date.now()) {
  const data = resource?.data
  const generatedAt = validTime(data?.generatedAt, now)
  const checkedAt = validTime(resource?.checkedAt, now)
  const lastSuccessAt = validTime(resource?.lastSuccessAt, now)
  let state, detail
  if (!data) {
    state = resource?.status === 'loading' ? 'loading' : 'missing'
    detail = state === 'loading' ? 'Aguardando a leitura do arquivo.' : 'Não há arquivo disponível no painel.'
  } else if (resource.stale || data.stale === true || resource.status === 'error') {
    state = 'retained'; detail = resource.stale || resource.status === 'error' ? 'A última leitura no painel falhou; o arquivo anterior foi mantido.' : 'A coleta manteve o último dado válido da fonte.'
  } else if (hasFailure(data)) {
    state = 'partial'; detail = 'Parte dos dados foi mantida ou teve falha na coleta.'
  } else if (!generatedAt) {
    state = 'missing'; detail = 'Horário do arquivo ausente ou inválido.'
  } else if (collectionAge(generatedAt, now, weekdays) > maxAge) {
    state = 'old'; detail = 'A geração do arquivo passou do prazo previsto para esta coleta.'
  } else {
    state = 'ok'; detail = 'Arquivo dentro do prazo, sem falha informada na coleta. A data de referência depende de cada indicador.'
  }
  return { state, label: HEALTH_LABELS[state], detail, generatedAt, checkedAt, lastSuccessAt }
}

// A mesma leitura de saúde é usada no cabeçalho, no Mercado e em Configurações.
export function quoteHealth(quotes, { error, now = Date.now(), checkedAt, lastSuccessAt, collectedAt } = {}) {
  const rows = CODES.map(code => ({ code, quote: quotes?.[code], age: quoteAgeState(quotes?.[code], now) }))
  const present = rows.filter(r => r.quote && r.age !== 'Horário inválido' && validTime(r.quote.timestamp, now) && Number.isFinite(r.quote.bid) && r.quote.bid > 0)
  const stamps = present.map(r => r.quote.timestamp)
  const missing = rows.filter(r => r.age === 'Sem dado' || r.age === 'Horário inválido' || !Number.isFinite(r.quote?.bid) || !(r.quote?.bid > 0))
  const retained = rows.filter(r => r.quote?.stale)
  let state, detail
  if (!quotes && !error) { state = 'loading'; detail = 'Aguardando cotações.' }
  else if (!present.length) { state = 'missing'; detail = 'Nenhuma moeda tem referência válida disponível.' }
  else if (missing.length || (retained.length && retained.length < CODES.length)) { state = 'partial'; detail = 'Uma ou mais moedas estão indisponíveis ou usam a última referência válida.' }
  else if (error || retained.length) { state = 'retained'; detail = 'A última atualização falhou; as referências anteriores foram mantidas.' }
  else if (rows.some(r => r.quote?.fallback)) { state = 'reserve'; detail = 'Uma ou mais moedas usam referência diária de reserva.' }
  else if (rows.some(r => r.age === 'Dado antigo')) { state = 'old'; detail = 'Uma ou mais referências têm mais de dez minutos. Isso não informa se o mercado está aberto ou fechado.' }
  else { state = 'ok'; detail = 'Todas as moedas têm referências recentes e sem retenção.' }
  // Fora da janela de coleta (dias úteis, 9h05 às 18h), referência do fim da última janela é o esperado: tom neutro, sem afirmar nada sobre o mercado.
  if ((state === 'old' || (state === 'partial' && !missing.length)) && present.length === CODES.length && present.every(r => offHoursReference(r.quote, now))) {
    state = 'offhours'; detail = 'Fora do horário de coleta do painel (dias úteis, 9h05 às 18h). As referências são as últimas da janela anterior.'
  }
  return {
    state, label: state === 'old' ? 'Dado antigo' : state === 'ok' ? 'Referência recente' : HEALTH_LABELS[state], detail,
    feed: state === 'loading' ? 'loading' : state === 'missing' ? 'err' : state === 'ok' ? 'ok' : state === 'offhours' ? 'idle' : 'delayed',
    generatedAt: validTime(collectedAt, now), checkedAt: validTime(checkedAt, now), lastSuccessAt: validTime(lastSuccessAt, now),
    observedAt: stamps.length ? Math.min(...stamps) : null,
    latestObservedAt: stamps.length ? Math.max(...stamps) : null,
  }
}
