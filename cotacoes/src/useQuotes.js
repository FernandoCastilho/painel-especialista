import { useCallback, useEffect, useRef, useState } from 'react'
import { DATA_POLL_MS, startVisiblePolling } from './visiblePolling.js'
import { rawQuoteError, cnhCross, cnhQuoteError, withCnhVariation, cnhTimingError } from './quoteSafety.js'

export const CURRENCIES = [
  { code: 'USD', name: 'Dólar americano', flag: '🇺🇸', sources: ['USD'] },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺', sources: ['EUR'] },
  { code: 'JPY', name: 'Iene japonês', flag: '🇯🇵', sources: ['JPY'] },
  // Yuan offshore (CNH): calculado pelo cruzamento USD/BRL ÷ USD/CNH. O CNY onshore não é mais usado.
  { code: 'CNH', name: 'Yuan', flag: '🇨🇳', sources: ['CNH'] },
]

// Nome conforme a série realmente usada: o yuan é sempre o offshore (CNH); o histórico antigo pode vir do CNY.
export const seriesName = (currency, source) => (currency.code === 'CNH' ? (source === 'CNY' ? 'Yuan (CNY, histórico)' : 'Yuan offshore (CNH)') : currency.name)

const BASE = 'https://economia.awesomeapi.com.br/json/last'

// Mensagens técnicas da API/rede -> texto que o usuário entende.
export function friendlyError(msg) {
  const m = String(msg)
  if (/HTTP 429/.test(m)) return 'cota de consultas da fonte atingida; usando a reserva e tentando de novo em instantes'
  if (/HTTP 5\d\d/.test(m)) return 'a fonte de cotações está instável'
  if (/HTTP 404/.test(m)) return 'a fonte não tem esta cotação agora'
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return 'sem conexão com a fonte de cotações'
  if (/sem cotação|sem dados/.test(m)) return 'a fonte não devolveu cotação'
  return m
}

// A chave da AwesomeAPI fica só no robô do GitHub (coleta central); o navegador não a usa, e a consulta direta (botão Atualizar) usa a cota anônima.

// Uma única consulta traz as quatro moedas; o yuan (CNH) sai do cruzamento USD/BRL ÷ USD/CNH.
const PAIRS = { USD: 'USDBRL', EUR: 'EURBRL', JPY: 'JPYBRL', CNH: 'USDCNH', EURUSD: 'EURUSD' }
const ALL = 'USD-BRL,EUR-BRL,JPY-BRL,USD-CNH'

// Se a fonte devolveu 429 (cota), não insiste por 60 s: as reservas atendem enquanto isso.
let blockedUntil = 0
let blockedMsg = ''

async function getJson(url, label, signal, meta) {
  if (Date.now() < blockedUntil) throw new Error(blockedMsg)
  if (meta) meta.checkedAt = Date.now()
  const res = await fetch(url, { signal })
  if (!res.ok) {
    const err = new Error(`${label}: HTTP ${res.status}`)
    if (res.status === 429) {
      blockedUntil = Date.now() + 60000
      blockedMsg = err.message
    }
    throw err
  }
  try {
    const data = await res.json()
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch (e) {
    // HTTP 200 com JSON malformado é uma resposta inválida, não uma autorização para trocar o spot pelo BCE.
    if (e.name === 'SyntaxError') return {}
    throw e
  }
}

export const toQuote = (q, source) => {
  if (rawQuoteError(q, PAIRS[source])) return null
  return ({
  source,
  bid: Number(q.bid),
  ask: Number(q.ask),
  high: Number(q.high),
  low: Number(q.low),
  pct: Number(q.pctChange),
  // Apenas o campo absoluto fornecido pela fonte: ausência nunca vira zero.
  delta: ['string', 'number'].includes(typeof q.varBid) && String(q.varBid).trim() !== '' && Number.isFinite(Number(q.varBid)) ? Number(q.varBid) : null,
  timestamp: Number(q.timestamp) * 1000,
  ...(q.stale ? { stale: true, error: friendlyError(q.error || 'cotação retida; aguardando um novo valor válido') } : {}),
  })
}

// Reserva quando a fonte principal falha (ex.: limite de requisições): referência diária do BCE, sem compra/venda separadas.
// Guardada por 30 min: o BCE só atualiza uma vez por dia.
const ecbCache = new Map()
async function fetchEcb(code, signal, meta) {
  const hit = ecbCache.get(code)
  if (hit && Date.now() - hit.at < 30 * 60000) return hit.quote
  const from = code === 'CNH' ? 'CNY' : code
  if (meta) meta.checkedAt = Date.now()
  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=BRL`, { signal })
  if (!res.ok) throw new Error(`BCE ${from}: HTTP ${res.status}`)
  const j = await res.json()
  const rate = Number(j?.rates?.BRL)
  if (!(rate > 0) || !j.date) throw new Error(`BCE ${from}: resposta sem cotação`)
  const timestamp = Date.parse(`${j.date}T15:00:00Z`)
  const invalid = rawQuoteError({ bid: rate, ask: rate, high: rate, low: rate, pctChange: 0, timestamp: timestamp / 1000 }, code === 'CNH' ? 'CNHBRL' : PAIRS[code])
  if (invalid) throw new Error(`BCE ${from}: ${invalid}`)
  const quote = { source: from, fallback: true, bid: rate, ask: rate, high: NaN, low: NaN, pct: 0, timestamp }
  if (meta) meta.successfulAt = Date.now()
  ecbCache.set(code, { at: Date.now(), quote })
  return quote
}

async function complete(code, batch, batchError, signal, { cnh, rejected = {} } = {}, meta) {
  const errors = batchError ? [batchError] : []
  let quote = null
  if (batch) {
    if (code === 'CNH') {
      const sourceError = rejected.USDBRL || rejected.USDCNH || rawQuoteError(batch.USDBRL, 'USDBRL') || rawQuoteError(batch.USDCNH, 'USDCNH') || cnhTimingError(batch.USDBRL,batch.USDCNH)
      const retainedLeg = batch.USDBRL?.stale || batch.USDCNH?.stale
      if (cnh) {
        const invalid = cnhQuoteError(cnh) || (!cnh.legTimestamps && cnhTimingError(batch.USDBRL,batch.USDCNH))
        if (invalid) errors.push(invalid)
        else {
          quote = withCnhVariation(cnh)
          if (!Object.hasOwn(cnh, 'previousBid') && !cnh.stale && !retainedLeg && !sourceError) {
            // Recalcula o legado apenas quando as duas pontas correspondem à cotação publicada.
            const updated = cnhCross(batch.USDBRL, batch.USDCNH)
            if (updated?.timestamp === cnh.timestamp && updated.bid === cnh.bid && updated.ask === cnh.ask) quote = updated
          }
          if (quote.stale || retainedLeg || sourceError) {
            quote.stale = true
            quote.error = friendlyError(sourceError || quote.error || 'CNH: uma cotação de origem foi retida; aguardando um novo valor válido')
          }
        }
      } else if (!retainedLeg && !sourceError) {
        // Compatibilidade com arquivos anteriores ao CNH separado: só usa duas pontas válidas.
        quote = cnhCross(batch.USDBRL, batch.USDCNH)
        if (!quote) errors.push(rawQuoteError(batch.USDBRL, 'USDBRL') || rawQuoteError(batch.USDCNH, 'USDCNH') || 'CNH: resposta sem cotação válida')
      } else {
        errors.push(sourceError || 'CNH: uma cotação de origem foi retida; aguardando um novo valor válido')
      }
    } else {
      const pair = PAIRS[code]
      const raw = batch[pair]
      const invalid = rawQuoteError(raw, pair)
      quote = invalid ? null : toQuote(raw, code)
      if (!quote) errors.push(rejected[pair] || invalid)
      else if (quote.stale || rejected[pair]) {
        quote.stale = true
        quote.error = friendlyError(rejected[pair] || quote.error || 'cotação retida; aguardando um novo valor válido')
      }
    }
  } else {
    // A reserva cobre falha de acesso à fonte. Uma resposta inválida deve preservar o último spot.
    try {
      quote = await fetchEcb(code, signal, meta)
    } catch (e) {
      if (e.name === 'AbortError') throw e
      errors.push(e.message)
    }
  }
  return quote ? { quote } : { error: [...new Set(errors.map(friendlyError))].join(' · ') }
}

// Coleta central: um robô do GitHub consulta a API a cada 5 min e publica quotes.json na branch `data`.
// Todos os usuários leem esse arquivo (sem gastar a cota da API). VITE_DATA_BASE é definido no build.
export const DATA_BASE = import.meta.env?.VITE_DATA_BASE
// A coleta é de 5 min no expediente, horária fora dele e pausa no fim de semana.
// Não interpretar uma pausa prevista como pane e multiplicar consultas por navegador.
export function centralMaxAge(now = Date.now()) {
  const br = new Date(now - 3 * 3600000)
  const weekday = br.getUTCDay()
  if (weekday === 0 || weekday === 6) {
    const friday = new Date(br)
    friday.setUTCDate(friday.getUTCDate() - (weekday === 6 ? 1 : 2))
    friday.setUTCHours(23, 7, 0, 0)
    return now - (friday.getTime() + 3 * 3600000) + 75 * 60000
  }
  const minute = br.getUTCHours() * 60 + br.getUTCMinutes()
  return (minute >= 545 && minute <= 1080 ? 45 : 75) * 60000
}

export async function fetchCentral(signal, base = DATA_BASE, meta) {
  if (!base) throw new Error('coleta central não configurada')
  if (meta) meta.checkedAt = Date.now()
  const res = await fetch(`${base}/quotes.json?t=${Math.floor(Date.now() / 60000)}`, { signal })
  if (!res.ok) throw new Error(`coleta central: HTTP ${res.status}`)
  const j = await res.json()
  if (!j?.quotes || !j.generatedAt) throw new Error('coleta central: arquivo inválido')
  return j
}

let lastDirectAt = 0
let lastDirectSnapshot = null
let directRequestSeq = 0

// direct=true (botão "Atualizar agora"): consulta a API na hora. Automático: lê a coleta central e só consulta
// a API direto, no máximo a cada 5 min, se a coleta central estiver ausente ou velha.
export async function fetchQuotes(signal, { direct = false, base } = {}) {
  const meta = {}
  let batch = null
  let batchError = null
  let centralSnapshot = null
  let via = 'direto'
  let collectedAt = Date.now()
  if (!direct) {
    try {
      const c = await fetchCentral(signal, base, meta)
      if (Number.isFinite(c.generatedAt) && c.generatedAt <= Date.now() + 60000 && Date.now() - c.generatedAt <= centralMaxAge()) {
        batch = c.quotes
        meta.successfulAt = Date.now()
        centralSnapshot = c
        via = 'central'
        collectedAt = c.generatedAt
      } else batchError = 'coleta central desatualizada'
    } catch (e) {
      if (e.name === 'AbortError') throw e
      batchError = e.message
    }
  }
  if (!batch && (direct || Date.now() - lastDirectAt >= 300000)) {
    lastDirectAt = Date.now()
    const requestId = ++directRequestSeq
    try {
      batch = await getJson(`${BASE}/${ALL}`, 'cotações', signal, meta)
      batchError = null
      meta.successfulAt = Date.now()
      collectedAt = Date.now()
      if (!lastDirectSnapshot || requestId > lastDirectSnapshot.requestId) lastDirectSnapshot = { batch, collectedAt, requestId }
    } catch (e) {
      if (e.name === 'AbortError') throw e
      batchError = e.message
    }
  }
  // Durante o limite da consulta direta, reutiliza a resposta real, sem cair no BCE
  // só porque a próxima leitura automática aconteceu antes dos cinco minutos.
  // A data da coleta original é preservada; esse reuso não simula atualização.
  if (!direct && !batch && lastDirectSnapshot && Date.now() - lastDirectSnapshot.collectedAt < 300000) {
    batch = lastDirectSnapshot.batch
    collectedAt = lastDirectSnapshot.collectedAt
    via = 'direto'
  }
  const results = await Promise.all(CURRENCIES.map((c) => complete(c.code, batch, batchError, signal, centralSnapshot ?? {}, meta)))
  // EUR/USD direto vem só da coleta central (a consulta direta do navegador mantém as 4 moedas); sem ele, a paridade é cruzada.
  const par = batch?.EURUSD && !rawQuoteError(batch.EURUSD, 'EURUSD') ? toQuote(batch.EURUSD, 'EURUSD') : null
  return { results: { ...Object.fromEntries(CURRENCIES.map((c, i) => [c.code, results[i]])), ...(par ? { EURUSD: { quote: par } } : {}) }, via: batch ? via : 'reserva', collectedAt, checkedAt: meta.checkedAt ?? null, successfulAt: meta.successfulAt ?? null }
}

// Limite do botão "Atualizar agora", por navegador: 1 por minuto e 30 por dia (protege a cota da API de todos).
const REFRESH_KEY = 'cotacoes-refresh-log'
export const AUTO_REFRESH_MS = 10 * 60000
export const REFRESH_COOLDOWN_S = 60
export const REFRESH_DAILY_MAX = 30
const readLog = () => {
  try {
    return JSON.parse(localStorage.getItem(REFRESH_KEY) ?? '[]').filter((t) => Date.now() - t < 864e5)
  } catch {
    return []
  }
}
const writeLog = (log) => {
  try {
    localStorage.setItem(REFRESH_KEY, JSON.stringify(log))
  } catch {
    /* sem armazenamento: o limite vale só na sessão */
  }
}
export function refreshLimits(now = Date.now()) {
  const log = readLog()
  const wait = log.length ? Math.max(0, Math.ceil((log[log.length - 1] + REFRESH_COOLDOWN_S * 1000 - now) / 1000)) : 0
  return { wait, left: Math.max(0, REFRESH_DAILY_MAX - log.length) }
}

export function useQuotes(intervalMs = DATA_POLL_MS) {
  const [quotes, setQuotes] = useState(null)
  const [direction, setDirection] = useState({})
  const [error, setError] = useState(null)
  const [errors, setErrors] = useState({})
  const [updatedAt, setUpdatedAt] = useState(null)
  const [checkedAt, setCheckedAt] = useState(null)
  const [lastSuccessAt, setLastSuccessAt] = useState(null)
  const [via, setVia] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [limits, setLimits] = useState(() => refreshLimits())
  const prev = useRef({})
  const ctrl = useRef(null)

  const load = useCallback(async (direct = false) => {
    // O automático não interrompe uma carga pendente, especialmente a atualização manual.
    if (!direct && ctrl.current) return
    ctrl.current?.abort()
    const request = new AbortController()
    ctrl.current = request
    try {
      const { results, via: v, collectedAt, checkedAt: checked, successfulAt } = await fetchQuotes(request.signal, { direct })
      if (request.signal.aborted || ctrl.current !== request) return
      if (checked) setCheckedAt(checked)
      const next = {}
      const errs = {}
      const dir = {}
      let fresh = 0
      for (const [code, r] of Object.entries(results)) {
        const old = prev.current[code]
        if (r.quote) {
          // nunca troca uma cotação mais nova (ex.: do botão) por outra mais velha (ex.: da coleta central)
          const keep = old && !old.fallback && !r.quote.fallback && old.timestamp > r.quote.timestamp
          next[code] = keep ? old : r.quote
          if (r.quote.stale) {
            const message = r.quote.error || r.error || 'cotação retida; aguardando um novo valor válido'
            next[code] = { ...next[code], stale: true, error: message }
            errs[code] = message
          } else if (keep) {
            // Uma resposta anterior não comprova recuperação da observação local retida.
            if (old.stale) errs[code] = old.error
          } else {
            fresh += 1
            next[code] = { ...next[code], stale: false, error: undefined }
          }
          if (old && next[code].bid !== old.bid) dir[code] = next[code].bid > old.bid ? 'up' : 'down'
        } else {
          // mantém a última cotação válida enquanto a moeda falha
          if (old) next[code] = { ...old, stale: true, error: r.error }
          errs[code] = r.error
        }
      }
      prev.current = next
      setDirection(dir)
      setQuotes(next)
      setErrors(errs)
      if (fresh) {
        if (successfulAt) setLastSuccessAt(successfulAt)
        setUpdatedAt(new Date(collectedAt))
        setVia(v)
      }
      // todas falharam (ex.: limite da API): não afirmar que está atualizado
      setError(fresh ? null : Object.values(errs)[0] ?? (Object.keys(next).length ? null : 'sem resposta da fonte'))
      return fresh > 0
    } catch (e) {
      if (e.name !== 'AbortError' && !request.signal.aborted && ctrl.current === request) setError(friendlyError(e.message))
      return false
    } finally {
      if (ctrl.current === request) ctrl.current = null
    }
  }, [])

  // Botão "Atualizar agora": consulta a API direto, respeitando o limite por navegador.
  const refresh = useCallback(async () => {
    const lim = refreshLimits()
    if (lim.wait > 0 || lim.left <= 0) return setLimits(lim)
    writeLog([...readLog(), Date.now()])
    try { window.dispatchEvent(new Event('quotes-refresh')) } catch { /* fora do navegador */ } // troca o insight do Aprender
    setRefreshing(true)
    const ok = await load(true)
    setRefreshing(false)
    setLimits(refreshLimits())
    return ok
  }, [load])

  // contagem regressiva do intervalo mínimo entre atualizações manuais
  useEffect(() => {
    if (limits.wait <= 0) return
    const id = setInterval(() => setLimits(refreshLimits()), 1000)
    return () => clearInterval(id)
  }, [limits.wait])

  useEffect(() => {
    // A função intermediária evita passar o evento de foco como argumento direct=true.
    const stop = startVisiblePolling(() => load(false), intervalMs)
    return () => {
      stop()
      ctrl.current?.abort()
      ctrl.current = null
    }
  }, [load, intervalMs])

  // Quadros online: a cada 10 min, com a aba visível, consulta a API direto (não gasta o limite do botão).
  // Em segundo plano o timer fica desarmado; ao voltar, a leitura automática de 1 min já renova pela coleta central.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    let id = null
    const tick = () => { if (!document.hidden) load(true) }
    const sync = () => {
      if (document.hidden) {
        clearInterval(id)
        id = null
      } else if (id === null) id = setInterval(tick, AUTO_REFRESH_MS)
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [load])

  return { quotes, direction, error, errors, updatedAt, checkedAt, lastSuccessAt, via, reload: () => load(false), refresh, refreshing, limits }
}
