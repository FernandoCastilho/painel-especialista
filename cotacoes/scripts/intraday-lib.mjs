// Intraday por barras de 5 minutos (Yahoo Finance), coletado no GitHub porque o Yahoo não libera acesso direto do navegador.
export const SYMBOLS = { USD: 'USDBRL=X', EUR: 'EURBRL=X', JPY: 'JPYBRL=X', CNH: 'CNHBRL=X' }

export const yahooUrl = (symbol) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=5d`

// Resposta do Yahoo -> [[ms, fechamento]], ordenado, sem barras vazias.
export function parseYahoo(json) {
  const r = json?.chart?.result?.[0]
  const ts = r?.timestamp
  const close = r?.indicators?.quote?.[0]?.close
  if (!Array.isArray(ts) || !Array.isArray(close)) return []
  return ts
    .map((t, i) => [t * 1000, close[i]])
    .filter(([t, c]) => Number.isFinite(t) && Number.isFinite(c) && c > 0)
    .map(([t, c]) => [t, Number(c.toPrecision(6))])
    .sort((a, b) => a[0] - b[0])
}

// Última barra diária do Yahoo com máxima e mínima: { t, high, low, close, marketTime? }, ou null.
// Só vale a barra coerente (mínima ≤ fechamento ≤ máxima); nada é estimado. `marketTime`: horário do último negócio (meta.regularMarketTime).
export function parseYahooLastBar(json) {
  const r = json?.chart?.result?.[0]
  const ts = r?.timestamp, q = r?.indicators?.quote?.[0]
  if (!Array.isArray(ts) || !q) return null
  const ok = (v) => Number.isFinite(v) && v > 0
  for (let i = ts.length - 1; i >= 0; i--) {
    const t = ts[i] * 1000, high = q.high?.[i], low = q.low?.[i], close = q.close?.[i]
    if (!Number.isFinite(t) || !ok(close)) continue
    if (!ok(high) || !ok(low) || low > close || close > high) return null
    const mt = Number(r.meta?.regularMarketTime) * 1000
    return { t, high, low, close, ...(Number.isFinite(mt) && mt >= t ? { marketTime: mt } : {}) }
  }
  return null
}

// Quando o Yahoo bloqueia (429), o intraday vira uma amostra por hora: acrescenta a cotação atual de cada moeda
// ao histórico já publicado, mantendo só os últimos `keepMs`. snaps = { USD: [ms, bid], ... }.
export function mergeSnapshots(prev, snaps, keepMs = 5 * 864e5, now = Date.now()) {
  const out = {}
  const codes = new Set([...Object.keys(prev ?? {}), ...Object.keys(snaps ?? {})])
  for (const code of codes) {
    const old = (prev?.[code]?.points ?? []).filter(([t]) => now - t <= keepMs)
    const snap = snaps?.[code]
    const points = snap && Number.isFinite(snap[0]) && snap[1] > 0 && (!old.length || snap[0] > old[old.length - 1][0]) ? [...old, snap] : old
    if (points.length) out[code] = { ...(prev?.[code] ?? {}), points }
  }
  return out
}
