import { useEffect, useState } from 'react'
import { DATA_POLL_MS, startVisiblePolling } from './visiblePolling.js'
import { onRefresh } from './refreshBus.js'

// Um snapshot por arquivo: telas diferentes compartilham leitura, data e falhas.
const resources = new Map()
export const DATA_FILE_TTL = 10 * 60000
export const cachedDataFile = file => resources.get(file)?.state
function resource(file) {
  if (!resources.has(file)) {
    resources.set(file, { state: { status: 'loading', checkedAt: null, lastSuccessAt: null }, at: 0, pending: null, listeners: new Set() })
    // botão "atualizar" do painel: relê este arquivo na hora, ignorando o intervalo e o cache
    onRefresh((files) => files.includes(file) ? loadDataFile(file, Date.now(), true).then((s) => { if (s.status === 'error' || s.stale) throw new Error(s.error || 'falha') }) : undefined)
  }
  return resources.get(file)
}
export function loadDataFile(file, now = Date.now(), force = false) {
  const r = resource(file)
  if (r.pending) return r.pending
  if (!force && r.at && now - r.at < DATA_FILE_TTL) return Promise.resolve(r.state)
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 20000)
  const checkedAt = Date.now()
  r.pending = (async () => {
    try {
      const response = await fetch(`./${file}?t=${force ? now : Math.floor(now / DATA_FILE_TTL)}`, { signal: ctrl.signal, ...(force ? { cache: 'no-store' } : {}) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Arquivo de dados inválido')
      if (r.state.data?.generatedAt && data.generatedAt < r.state.data.generatedAt) throw new Error('Resposta anterior à última coleta disponível')
      r.state = { status: 'ok', data, checkedAt, lastSuccessAt: Date.now() }
      r.at = Date.now()
    } catch (error) {
      const message = error.name === 'AbortError' ? 'A fonte demorou a responder. Tentando novamente.' : error.message
      r.state = r.state.data ? { ...r.state, stale: true, error: message, checkedAt } : { status: 'error', error: message, checkedAt, lastSuccessAt: null }
    } finally {
      clearTimeout(timeout)
      r.pending = null
      for (const listener of r.listeners) listener(r.state)
    }
    return r.state
  })()
  return r.pending
}
export function useDataFile(file) {
  const r = resource(file)
  const [state, setState] = useState(r.state)
  useEffect(() => {
    r.listeners.add(setState)
    setState(r.state)
    const stop = startVisiblePolling(() => loadDataFile(file), DATA_POLL_MS)
    return () => { stop(); r.listeners.delete(setState) }
  }, [file, r])
  return state
}

// generatedAt vem como número (ms) ou texto ISO, conforme o coletor.
const stampOf = (v) => (typeof v === 'string' ? Date.parse(v) : Number(v)) || 0

// Hora da coleta mais recente entre os arquivos (ms), ou null.
export const collectedAt = (files) => Math.max(0, ...files.map((f) => stampOf(resources.get(f)?.state?.data?.generatedAt))) || null

// Mesma hora, mas carregando os arquivos (leitura compartilhada com as telas) e atualizando quando uma nova coleta chega.
export function useCollectedAt(files) {
  const key = files.join('|')
  const [at, setAt] = useState(() => collectedAt(files))
  useEffect(() => {
    const list = key ? key.split('|') : []
    const update = () => setAt(collectedAt(list))
    const stops = list.map((file) => {
      const r = resource(file)
      r.listeners.add(update)
      return [r, startVisiblePolling(() => loadDataFile(file), DATA_POLL_MS)]
    })
    update()
    return () => stops.forEach(([r, stop]) => { stop(); r.listeners.delete(update) })
  }, [key])
  return at
}
