// Utilitários da coleta de dados macro do Banco Central (sem dependências).
import { sourceNumber } from './source-number.mjs'

// "dd/MM/yyyy" -> ms (meio-dia UTC, para não trocar de dia por fuso)
export const brDate = (s) => {
  const [d, m, y] = s.split('/').map(Number)
  return Date.UTC(y, m - 1, d, 12)
}
export const toBr = (ms) => {
  const d = new Date(ms)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

// SGS: [{data:"dd/MM/yyyy", valor:"13.65"}] -> [[ms, valor]]
export const parseSgs = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .map((r) => [brDate(r.data), sourceNumber(r.valor)])
    .filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v))
    .sort((a, b) => a[0] - b[0])

// Série diária -> só os pontos em que o valor muda, mais o último dia.
export function changePoints(points) {
  const out = []
  for (const p of points) if (!out.length || p[1] !== out[out.length - 1][1]) out.push(p)
  const last = points[points.length - 1]
  if (last && out[out.length - 1][0] !== last[0]) out.push(last)
  return out
}

// Janelas de até 10 anos (limite do SGS para séries diárias).
export function windows(fromYear, to = new Date()) {
  const out = []
  for (let y = fromYear; y <= to.getUTCFullYear(); y += 10) {
    const end = Math.min(y + 9, to.getUTCFullYear())
    out.push([`01/01/${y}`, end === to.getUTCFullYear() ? toBr(to.getTime()) : `31/12/${end}`])
  }
  return out
}

// Focus: linhas do Olinda (mais recentes primeiro) -> { date, years, values: {ano: {median, min, max, n}} }
export function focusFor(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r.Mediana != null)
  if (!list.length) return null
  const date = list.reduce((m, r) => (r.Data > m ? r.Data : m), '')
  const values = {}
  for (const r of list.filter((x) => x.Data === date)) {
    values[r.DataReferencia] = { median: r.Mediana, min: r.Minimo, max: r.Maximo, n: r.numeroRespondentes }
  }
  return { date, values }
}

// PTAX: [{cotacaoCompra, cotacaoVenda, tipoBoletim, dataHoraCotacao}] -> último boletim (Fechamento, se houver)
export function ptaxFrom(rows) {
  const list = Array.isArray(rows) ? rows.filter((r) => r.cotacaoVenda != null) : []
  if (!list.length) return null
  const r = list.find((x) => /fechamento/i.test(x.tipoBoletim ?? '')) ?? list[list.length - 1]
  return { buy: r.cotacaoCompra, sell: r.cotacaoVenda, at: r.dataHoraCotacao, kind: r.tipoBoletim }
}

// O Focus é divulgado às segundas-feiras com as expectativas coletadas até a sexta anterior.
// Devolve a primeira segunda-feira depois da data de coleta ("YYYY-MM-DD").
export function focusRelease(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`)
  do d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCDay() !== 1)
  return d.toISOString().slice(0, 10)
}

const nfNum = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const nfDay = (r) => Date.parse(`${r.effectiveDate}T12:00:00Z`)

// NY Fed SOFR: { refRates: [{ effectiveDate, percentRate, percentPercentile1, percentPercentile99 }] }
// -> [[ms, taxa % a.a., percentil 1, percentil 99]] (overnight, taxa do dia, sem média)
export const parseSofr = (json) =>
  (json?.refRates ?? [])
    .map((r) => [nfDay(r), nfNum(r.percentRate), nfNum(r.percentPercentile1), nfNum(r.percentPercentile99)])
    .filter(([t, v]) => Number.isFinite(t) && v !== null)
    .sort((a, b) => a[0] - b[0])

// NY Fed SOFR Averages (tipo SOFRAI): médias compostas de 30, 90 e 180 dias -> [[ms, m30, m90, m180]]
export const parseSofrAvg = (json) =>
  (json?.refRates ?? [])
    .map((r) => [nfDay(r), nfNum(r.average30day), nfNum(r.average90day), nfNum(r.average180day)])
    .filter(([t, a, b, c]) => Number.isFinite(t) && (a !== null || b !== null || c !== null))
    .sort((a, b) => a[0] - b[0])
