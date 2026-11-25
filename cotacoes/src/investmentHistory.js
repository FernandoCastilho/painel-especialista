import { numeroPt } from './investimentos.js'

export const PUBLIC_SERIES = [
  { id: 'cdi', name: 'CDI', code: 12, kind: 'daily-rate' },
  { id: 'ipca', name: 'IPCA', code: 433, kind: 'monthly-rate' },
  { id: 'dolar', name: 'Dólar PTAX venda', code: 1, kind: 'level' },
]
export const PERIODS = [6, 12, 36, 60]
export const CURRENCIES = ['BRL', 'USD', 'EUR']
export const MAX_SERIES = 6
const months = date => date.slice(0, 7)
const usableLevel = value => Number.isFinite(value) && value >= 1e-12 && value <= 1e12
const endOfMonth = month => {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10)
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value
}

export function parseSeriesCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(line => line.trim())
  const delimiter = lines[0]?.includes(';') ? ';' : ','
  if (!/^data[;,]valor$/i.test(lines.shift()?.trim() ?? '') || lines.length > 10000) {
    throw new Error('Use o cabeçalho data;valor e até 10.000 linhas.')
  }
  const rows = new Map()
  for (const line of lines) {
    const [date, raw, extra] = line.split(delimiter).map(cell => cell.trim())
    const value = delimiter === ';' ? numeroPt(raw ?? '') : /^\d+(\.\d+)?$/.test(raw ?? '') ? Number(raw) : NaN
    if (extra !== undefined || !validDate(date) || !usableLevel(value) || rows.has(date)) {
      throw new Error('Confira datas únicas no formato AAAA-MM-DD e valores entre 0,000000000001 e 1 trilhão.')
    }
    rows.set(date, value)
  }
  if (rows.size < 2) throw new Error('O arquivo precisa ter pelo menos duas observações.')
  return [...rows].sort(([a], [b]) => a.localeCompare(b))
}

export function bcbSeries(rows, kind, today) {
  const dates = new Map()
  if (!Array.isArray(rows)) throw new Error('Resposta inválida do Banco Central.')
  for (const row of rows) {
    const [day, month, year] = String(row.data).split('/')
    const date = kind === 'monthly-rate' ? endOfMonthSafe(year, month) : [year, month, day].join('-')
    const value = /^-?\d+(\.\d+)?$/.test(row.valor ?? '') ? Number(row.valor) : NaN
    if (!validDate(date) || !Number.isFinite(value) || dates.has(date) || (kind === 'level' ? value <= 0 : value <= -100)) {
      throw new Error('Série inválida na resposta do Banco Central.')
    }
    dates.set(date, value)
  }
  let level = 1
  return [...dates].filter(([date]) => date <= today).sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => {
    level = kind === 'level' ? value : level * (1 + value / 100)
    if (!usableLevel(level)) throw new Error('Valor da série fora do intervalo aceito.')
    return [date, level]
  })
}

function endOfMonthSafe(year, month) {
  return /^\d{4}$/.test(year ?? '') && /^(0[1-9]|1[0-2])$/.test(month ?? '') ? endOfMonth(year + '-' + month) : ''
}

export async function loadBcb(item, today, signal, fetcher = fetch) {
  const from = (Number(today.slice(0, 4)) - 6) + '-01-01'
  const brDate = date => date.split('-').reverse().join('/')
  const params = new URLSearchParams({ formato: 'json', dataInicial: brDate(from), dataFinal: brDate(today) })
  const response = await fetcher('https://api.bcb.gov.br/dados/serie/bcdata.sgs.' + item.code + '/dados?' + params, { signal })
  if (!response.ok) throw new Error('Série indisponível.')
  const rows = bcbSeries(await response.json(), item.kind, today)
  if (rows.length < 2) throw new Error('Série insuficiente.')
  return rows
}

export function resumoFundo(cotas, cdi = []) {
  const [fim, cotaFinal] = cotas.at(-1)
  const referencia = new Map(cdi)
  const dataFinal = new Date(fim)
  return [1, 3, 6, 12].map(meses => {
    const alvo = new Date(Date.UTC(dataFinal.getUTCFullYear(), dataFinal.getUTCMonth() - meses, 1))
    const ultimoDia = Number(endOfMonth(alvo.toISOString().slice(0, 7)).slice(-2))
    alvo.setUTCDate(Math.min(dataFinal.getUTCDate(), ultimoDia))
    const dataAlvo = alvo.toISOString().slice(0, 10)
    alvo.setUTCDate(alvo.getUTCDate() - 7)
    const limite = alvo.toISOString().slice(0, 10)
    const ponto = cotas.findLast(([dia]) => dia <= dataAlvo && dia >= limite)
    if (!ponto) return { meses, fim, inicio: null, fundo: null, cdi: null }
    const [inicio, cotaInicial] = ponto
    const cdiInicial = referencia.get(inicio)
    const cdiFinal = referencia.get(fim)
    return {
      meses, inicio, fim,
      fundo: cotaFinal / cotaInicial - 1,
      cdi: usableLevel(cdiInicial) && usableLevel(cdiFinal) ? cdiFinal / cdiInicial - 1 : null,
    }
  })
}

function monthValues(rows, currentMonth) {
  const values = new Map()
  for (const row of rows) {
    const [date] = row
    const month = months(date)
    if (month < currentMonth) values.set(month, row)
  }
  return values
}

function monthNumber(month) {
  const [year, number] = month.split('-').map(Number)
  return year * 12 + number
}

const currencyRates = (from, to, fx) => {
  if (from === to) return []
  return [...new Set([from, to].filter(code => code !== 'BRL'))].map(code => fx[code])
}

export function compareHistory(series, period, currency, fx, currentMonth) {
  if (!series.length || series.some(item => !item.rows?.length)) return null
  const selections = series.map(item => ({
    item,
    prices: monthValues(item.rows, currentMonth),
    rates: currencyRates(item.currency, currency, fx).map(rows => monthValues(rows ?? [], currentMonth)),
  }))
  const first = selections[0].prices
  const common = [...first.keys()].filter(month =>
    selections.every(({ prices, rates }) => prices.has(month) && rates.every(rate => rate.has(month))))
  if (common.length < 2) return null
  const last = monthNumber(common.at(-1))
  const timeline = common.filter(month => monthNumber(month) >= last - period)
  const contiguous = timeline.every((month, index) => index === 0 || monthNumber(month) - monthNumber(timeline[index - 1]) === 1)
  if (timeline.length < 2 || !contiguous) return null
  const tracks = selections.map(({ item, prices, rates }) => {
    const levels = timeline.map(month => {
      const price = prices.get(month)[1]
      if (item.currency === currency) return price
      const from = item.currency === 'BRL' ? 1 : rates[0].get(month)[1]
      const to = currency === 'BRL' ? 1 : rates.at(-1).get(month)[1]
      return price * from / to
    })
    return { ...item, start: prices.get(timeline[0])[0], end: prices.get(timeline.at(-1))[0],
      values: levels.map(value => value / levels[0]) }
  })
  const latestClosedMonth = monthNumber(currentMonth) - 1
  return { timeline, tracks, fullPeriod: timeline.length === period + 1, endsEarly: last < latestClosedMonth }
}

export function monthlyReturns(values) {
  return values.slice(1).map((value, index) => value / values[index] - 1)
}

export function metrics(values) {
  const changes = monthlyReturns(values)
  const mean = changes.reduce((total, value) => total + value, 0) / changes.length
  const variance = changes.length > 1
    ? changes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (changes.length - 1)
    : null
  let peak = values[0]
  let drawdown = 0
  for (const value of values) {
    peak = Math.max(peak, value)
    drawdown = Math.min(drawdown, value / peak - 1)
  }
  return { total: values.at(-1) / values[0] - 1, volatility: variance === null ? null : Math.sqrt(variance * 12), drawdown }
}

export function simulateHistory(tracks, allocations) {
  if (!tracks.length || tracks.length !== allocations.length || allocations.some(value => value !== 0 && !usableLevel(value))) return null
  const principal = allocations.reduce((sum, value) => sum + value, 0)
  if (!Number.isFinite(principal) || principal <= 0) return null
  return tracks[0].values.map((_, index) =>
    tracks.reduce((sum, track, asset) => sum + allocations[asset] * track.values[index], 0) / principal)
}

export function comparisonCsv(comparison, currency) {
  const safeCell = value => {
    const cell = String(value)
    return '"' + ( /^[=+\-@]/.test(cell.trimStart()) || /^[\t\r\n]/.test(cell) ? "'" + cell : cell ).replaceAll('"', '""') + '"'
  }
  return [
    ['Mês', 'Moeda', ...comparison.tracks.map(track => track.name + ' (%)')],
    ...comparison.timeline.map((month, index) => [month, currency, ...comparison.tracks.map(track =>
      ((track.values[index] - 1) * 100).toFixed(6).replace('.', ','))]),
  ].map(([month, currencyCode, ...cells], index) =>
    [safeCell(month), safeCell(currencyCode), ...cells.map(value => index === 0 ? safeCell(value) : value)].join(';')).join('\r\n')
}
