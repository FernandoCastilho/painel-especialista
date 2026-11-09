import { intradaySelection, intradayObservationWarning } from './intradayState.js'
import { useEffect, useState } from 'react'
import { validHistoryPoints, historyQuality } from './historyQuality.js'
import { DATA_BASE, friendlyError } from './useQuotes.js'
import { DATA_POLL_MS, startVisiblePolling } from './visiblePolling.js'

export const MAX_DAYS = 360 // limite do endpoint diário da AwesomeAPI
const cache = new Map()

export const toYmd = (d) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
export const toInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const fromInput = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(NaN)
  const [y, m, d] = s.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  // Date normaliza silenciosamente 31/02 para março; não aceite uma data diferente da selecionada.
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : new Date(NaN)
}

export function historyRangeError(start, end) {
  if (!Number.isFinite(start?.getTime()) || !Number.isFinite(end?.getTime())) return 'Selecione datas válidas.'
  if (start > end) return 'A data inicial deve ser anterior ou igual à data final.'
  return ''
}

// Histórico diário (360 dias) coletado pelo robô do GitHub (history.json, branch `data`): a chave da API não sai de lá.
let centralPromise = null
let centralAt = 0
function loadCentralHistory() {
  if (!DATA_BASE) return Promise.reject(new Error('coleta central não configurada'))
  if (!centralPromise || Date.now() - centralAt > 600000) {
    centralAt = Date.now()
    centralPromise = fetch(`${DATA_BASE}/history.json?t=${Math.floor(Date.now() / 600000)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .catch((e) => {
        centralPromise = null
        throw e
      })
  }
  return centralPromise
}

// Shares the existing history request/cache; never substitutes BCE/CNY for these returns.
export function useCentralDaily() {
  const [state, setState] = useState({ status: 'loading', data: null })
  useEffect(() => {
    let alive = true
    loadCentralHistory().then(data => { if (alive) setState({ status: 'ok', data }) })
      .catch(() => { if (alive) setState({ status: 'error', data: null }) })
    return () => { alive = false }
  }, [])
  return state
}

// Série diária completa do arquivo central (mais de um ano) da mesma fonte: serve para comparar um trecho com o ano anterior.
export function centralFull(file, code, source) {
  const s = file?.series?.[code]
  if (!s || (source && s.source !== source)) return undefined
  const valid = validHistoryPoints(s.points)
  return valid.length > 1 ? valid : undefined
}

// Recorte do arquivo central; só vale se ele cobre o início do período pedido.
export function pickCentral(file, code, start, end) {
  const s = file?.series?.[code]
  const valid = validHistoryPoints(s?.points)
  if (!valid.length) throw new Error(`${code}: histórico central sem dados válidos`)
  if (valid[0].t > start.getTime() + 5 * 864e5) throw new Error(`${code}: período maior que o histórico central`)
  const points = sliceRange(valid, start, end)
  if (!points.length) throw new Error(`${code}: sem dados no período`)
  return { source: s.source, points, generatedAt: file.generatedAt }
}

// Reserva: referências diárias do BCE (Frankfurter), sem máxima/mínima. { rates: { 'AAAA-MM-DD': { BRL: n } } } -> pontos.
export function parseEcbSeries(json) {
  return Object.entries(json?.rates ?? {})
    .map(([d, r]) => ({ t: Date.parse(`${d}T15:00:00Z`), bid: Number(r?.BRL) }))
    .filter((p) => Number.isFinite(p.t) && p.bid > 0)
    .map((p) => ({ ...p, high: p.bid, low: p.bid }))
    .sort((a, b) => a.t - b.t)
}

async function fetchEcbHistory(code, start, end, signal) {
  const from = code === 'CNH' ? 'CNY' : code
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const res = await fetch(`https://api.frankfurter.dev/v1/${iso(start)}..${iso(end)}?base=${from}&symbols=BRL`, { signal })
  if (!res.ok) throw new Error(`BCE ${from}: HTTP ${res.status}`)
  const points = parseEcbSeries(await res.json())
  if (!points.length) throw new Error(`BCE ${from}: sem dados no período`)
  return { source: from, points, feed: 'BCE (referência diária)' }
}

async function fetchHistory(currency, start, end, signal) {
  const errors = []
  try {
    return pickCentral(await loadCentralHistory(), currency.code, start, end)
  } catch (e) {
    errors.push(e.message)
  }
  try {
    return await fetchEcbHistory(currency.code, start, end, signal) // reserva e períodos longos: referência diária do BCE
  } catch (e) {
    if (e.name === 'AbortError') throw e
    errors.push(e.message)
  }
  throw new Error(errors.map(friendlyError).filter((m, i, a) => a.indexOf(m) === i).join(' · '))
}

// Uma única janela de 360 dias por moeda atende os gráficos, as variações dos cards e a paridade: as demais
// consultas viram recortes dessa janela (e ela fica guardada no navegador por 6 h), poupando a cota da API.
const FULL_DAYS = 359
const dayStart = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
export const fullWindow = (now = new Date()) => {
  const end = dayStart(now)
  const start = new Date(end)
  start.setDate(start.getDate() - FULL_DAYS)
  return { start, end }
}
export const sliceRange = (points, start, end) => {
  if (historyRangeError(start, end)) return []
  const first = dayStart(start)
  const after = dayStart(end)
  after.setDate(after.getDate() + 1) // dia civil inclusivo, inclusive nas mudanças de horário de verão
  return points.filter((p) => p.t >= first.getTime() && p.t < after.getTime())
}

const STORE = 'cotacoes-hist-v1'
const STORE_TTL = 6 * 3600e3
const readStore = (fkey) => {
  try {
    const e = JSON.parse(localStorage.getItem(STORE) ?? '{}')[fkey]
    return e && Date.now() - e.at < STORE_TTL ? e : null
  } catch {
    return null
  }
}
const writeStore = (fkey, entry) => {
  try {
    const all = JSON.parse(localStorage.getItem(STORE) ?? '{}')
    const day = fkey.split('|')[2]
    for (const k of Object.keys(all)) if (k.split('|')[2] !== day) delete all[k] // descarta dias anteriores
    all[fkey] = entry
    localStorage.setItem(STORE, JSON.stringify(all))
  } catch {
    /* sem armazenamento (modo privado) ou cheio: segue só com a memória */
  }
}
const inflight = new Map()

export function useHistory(code, start, end, skip = false) {
  const startYmd = toInput(start)
  const endYmd = toInput(end)
  const key = `${code}|${startYmd}|${endYmd}`
  const [state, setState] = useState({ key: null, status: 'loading' })

  useEffect(() => {
    if (skip) return
    // Os cards criam novos objetos Date a cada render. Dependa do dia, não da identidade
    // desses objetos, para que um acerto de cache não provoque um loop de renderização.
    const rangeStart = fromInput(startYmd)
    const rangeEnd = fromInput(endYmd)
    const error = historyRangeError(rangeStart, rangeEnd)
    if (error) {
      setState({ key, status: 'error', error })
      return
    }
    let alive = true
    const view = (data) => {
      // Recorta também respostas diretas/reservas: a fonte pode incluir uma referência anterior.
      const points = sliceRange(data.points, rangeStart, rangeEnd)
      if (!points.length) throw new Error('Sem cotações no período selecionado. Escolha outro intervalo.')
      const warning = historyQuality({ points, generatedAt: data.generatedAt, end: rangeEnd.getTime(), reference: !!data.feed })
      return { key, status: 'ok', refreshing: false, warning, data: { ...data, points } }
    }
    const load = async () => {
      const win = fullWindow()
      const full = rangeStart >= win.start && rangeEnd <= win.end
      const fkey = full ? `${code}|full|${toYmd(win.end)}` : key
      let hit = cache.get(fkey)
      if (!hit || Date.now() - hit.at >= STORE_TTL) hit = full ? readStore(fkey) : null
      try {
        if (hit) {
          cache.set(fkey, hit) // preserva a idade original, inclusive ao ler o armazenamento
          setState(view(hit.data))
          return
        }
        setState((s) => s.key === key && s.data ? { ...s, refreshing: true } : { key, status: 'loading' })
        let p = inflight.get(fkey)
        if (!p) {
          p = fetchHistory({ code }, full ? win.start : rangeStart, full ? win.end : rangeEnd, undefined)
            .then((data) => {
              const entry = { at: Date.now(), data }
              cache.set(fkey, entry)
              if (full) writeStore(fkey, entry)
              return data
            })
            .finally(() => inflight.delete(fkey))
          inflight.set(fkey, p)
        }
        const data = await p
        if (alive) setState(view(data))
      } catch (e) {
        if (!alive) return
        setState((s) => s.key === key && s.data
          ? { ...s, refreshing: false, stale: true, error: e.message }
          : { key, status: 'error', error: e.message })
      }
    }
    const stop = startVisiblePolling(load, DATA_POLL_MS)
    return () => {
      alive = false
      stop()
    }
  }, [key, code, startYmd, endYmd, skip])

  return state.key === key ? state : { key, status: 'loading' }
}

// ---- Intraday: amostras observadas pelo coletor (intraday.json), últimos 5 dias corridos ----
// Re-read the existing public snapshot each minute; no provider call or extra collector.
const INTRADAY_REFRESH_MS = DATA_POLL_MS
let intradayPromise = null
let intradayFile = null
let intradayAt = 0

function loadIntraday() {
  // Uma carga compartilhada pelos cards e gráficos; expira após um minuto, sem renovar a idade ao remontar.
  if (intradayPromise) return intradayPromise
  if (intradayFile && Date.now() - intradayAt < INTRADAY_REFRESH_MS) return Promise.resolve(intradayFile)
  // Só lê o arquivo central já coletado; não consulta a API de cotações.
  intradayPromise = fetch(`${DATA_BASE ? `${DATA_BASE}/` : './'}intraday.json?t=${Math.floor(Date.now() / 60000)}`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    })
    .then((file) => {
      if (!file?.series) throw new Error('arquivo intraday inválido')
      if (intradayFile?.generatedAt && file.generatedAt < intradayFile.generatedAt) throw new Error('a coleta recebida é anterior à última disponível')
      intradayFile = file
      intradayAt = Date.now()
      return file
    })
    .finally(() => { intradayPromise = null })
  return intradayPromise
}

export function useIntraday(code, day, skip = false) {
  const dayYmd = toInput(day)
  const key = `${code}|${dayYmd}`
  const [state, setState] = useState({ key: null, status: 'loading' })

  useEffect(() => {
    if (skip) return
    if (!Number.isFinite(fromInput(dayYmd).getTime())) {
      setState({ key, status: 'error', error: 'Selecione uma data válida.' })
      return
    }
    let alive = true
    const load = async () => {
      setState((s) => s.key === key && s.data ? { ...s, refreshing: true } : { key, status: 'loading' })
      try {
        const file = await loadIntraday()
        if (!alive) return
        const serie = file.series?.[code]
        if (!Array.isArray(serie?.points)) throw new Error(`série ${code} ausente ou inválida no arquivo intraday`)
        const valid = validHistoryPoints(serie.points.filter(p => Array.isArray(p)).map(([t, v]) => ({ t, bid: v })))
        if (serie.points.length && !valid.length) throw new Error(`série ${code} sem amostras válidas no arquivo intraday`)
        const selection = intradaySelection(valid, dayYmd)
        const { points, previousDay } = selection
        if (!points.length) {
          setState({ key, status: 'empty', previousDay, retainedPoints: valid, generatedAt: file.generatedAt, refreshing: false })
          return
        }
        const warning = [historyQuality({ points, generatedAt: file.generatedAt, intraday: true }), intradayObservationWarning(points, dayYmd)].filter(Boolean).join(' ')
        setState({ key, status: 'ok', previousDay, retainedPoints: valid, refreshing: false, warning, data: { source: code, points, generatedAt: file.generatedAt, feed: file.source, resolution: file.resolution } })
      } catch (e) {
        if (!alive) return
        const error = `intraday indisponível (${e.message})`
        // Uma falha transitória não apaga os pontos reais nem altera a data da última coleta.
        setState((s) => s.key === key && s.data
          ? { ...s, refreshing: false, stale: true, error }
          : { key, status: 'error', error })
      }
    }
    const stop = startVisiblePolling(load, DATA_POLL_MS)
    return () => {
      alive = false
      stop()
    }
  }, [key, skip, code, dayYmd])

  return state.key === key ? state : { key, status: 'loading' }
}
