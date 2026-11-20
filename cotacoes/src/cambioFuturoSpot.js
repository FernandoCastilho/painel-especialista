// Referência informativa do Câmbio Futuro. Nenhum valor é enviado ao simulador.
import { b3ClosedDay, FX_FECHAMENTO, fxSessionOpen, saoPauloParts } from '../scripts/data-schedules.mjs'
import { marketDate } from './marketReturns.js'
import { QUOTE_AGE_LIMIT_MS } from './quoteFreshness.js'
import { cnhQuoteError } from './quoteSafety.js'

const DAY = 864e5
const codes = new Set(['USD', 'EUR', 'CNH'])
const goodValue = value => Number.isFinite(value) && value > 0
const validTime = (t, now) => goodValue(t) && t <= now && Number.isFinite(new Date(t).getTime())

export function spotDayPlan(now) {
  const { date, hour, minute } = saoPauloParts(now)
  // Janela da coleta do Painel, não certificação de abertura/fechamento da praça negociadora.
  const open = fxSessionOpen(now)
  const afterSession = b3ClosedDay(now) !== true && Number(hour) * 60 + Number(minute) > FX_FECHAMENTO
  const noon = Date.parse(date + 'T12:00:00-03:00')
  let previous = null
  for (let i = 1; i <= 7; i++) {
    const day = noon - i * DAY
    if (b3ClosedDay(day) !== true) {
      previous = marketDate(day)
      break
    }
  }
  return { now, today: date, day: open || afterSession ? date : previous, previous, open }
}

export function mesaSpotRange(code, quote, plan) {
  if (!codes.has(code) || quote?.source !== code || quote.fallback || quote.stale ||
      !goodValue(quote.bid) || !goodValue(quote.ask) || quote.ask < quote.bid || !validTime(quote.timestamp, plan.now)) return null
  const date = marketDate(quote.timestamp)
  const priorAllowed = !plan.open && date === plan.previous
  if (date !== plan.day && !priorAllowed) return null
  if (plan.open && plan.now - quote.timestamp > QUOTE_AGE_LIMIT_MS) return null
  if (code === 'CNH') {
    const a = quote.legTimestamps?.USDBRL, b = quote.legTimestamps?.USDCNH
    if (!validTime(a, plan.now) || !validTime(b, plan.now) || marketDate(a) !== date || marketDate(b) !== date ||
        cnhQuoteError(quote, plan.now)) return null
  }
  return { date, time: quote.timestamp, bid: quote.bid, ask: quote.ask, today: date === plan.today }
}

function lastPoint(points, plan) {
  if (plan.open || !Array.isArray(points)) return null
  let latest = null
  for (const p of points) {
    if (!validTime(p?.t, plan.now) || !goodValue(p?.bid)) continue
    const date = marketDate(p.t)
    if ((date !== plan.day && date !== plan.previous) || p.t <= (latest?.t ?? 0)) continue
    latest = { date, t: p.t, value: p.bid }
  }
  return latest
}

export function mesaDailyEur(file, plan) {
  if (file?.source !== 'AwesomeAPI' || file.series?.EUR?.source !== 'EUR' || !validTime(file.generatedAt, plan.now)) return null
  // Série diária não comprova horário ou lado de venda. Só use uma sessão já encerrada.
  return lastPoint(file.series.EUR.points, { ...plan, day: plan.previous })
}

export function mesaIntradayCnh(data, plan) {
  if (data?.source !== 'CNH' || data?.feed !== 'AwesomeAPI (coleta central a cada 5 min)' || !validTime(data.generatedAt, plan.now)) return null
  // Intraday contém apenas observações aceitas pelo coletor, não a reserva CNY nem cruzamentos diários.
  return lastPoint(data.points, plan)
}

const precisaoExibida = value => Number(value.toFixed(4))

export function explicacaoPonto(offer, reference) {
  if (!goodValue(offer) || !goodValue(reference?.value)) return ''
  const price = precisaoExibida(offer), indicative = precisaoExibida(reference.value)
  const direction = price < indicative ? 'abaixo do' : price > indicative ? 'acima do' : 'igual ao'
  return `Partida ${direction} valor indicativo exibido.`
}

export function explicacaoFaixa(offer, reference) {
  if (!goodValue(offer)) return ''
  // Compare na precisão exibida para não rotular como fora dois valores que parecem iguais.
  const price = precisaoExibida(offer), bid = precisaoExibida(reference.bid), ask = precisaoExibida(reference.ask)
  return price < bid ? 'Partida abaixo da faixa.' : price > ask ? 'Partida acima da faixa.' : 'Partida dentro da faixa.'
}
