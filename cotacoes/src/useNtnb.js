import { useEffect, useState } from 'react'
import { DATA_BASE } from './useQuotes.js'
import { startVisiblePolling } from './visiblePolling.js'

// ntnb.json (taxas da NTN-B) fica na branch `data`, junto das cotações. Uma leitura compartilhada entre os gráficos de Juros.
const POLL_MS = 10 * 60000
let snapshot // undefined: ainda carregando; null: leitura falhou
let at = 0
let pending = null
const listeners = new Set()

function load(base) {
  if (!base) { snapshot = null; listeners.forEach((fn) => fn(null)); return Promise.resolve(null) }
  if (pending) return pending
  if (at && Date.now() - at < POLL_MS) return Promise.resolve(snapshot)
  pending = fetch(`${base}/ntnb.json?t=${Math.floor(Date.now() / POLL_MS)}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((data) => {
      // Falha de leitura: o gráfico mostra "indisponível" (ntnbView confere formato e idade).
      snapshot = data && typeof data === 'object' ? data : null
      at = Date.now()
      pending = null
      listeners.forEach((fn) => fn(snapshot))
      return snapshot
    })
  return pending
}

export function useNtnb(base = DATA_BASE) {
  const [data, setData] = useState(snapshot)
  useEffect(() => {
    listeners.add(setData)
    const stop = startVisiblePolling(() => load(base), POLL_MS)
    return () => { listeners.delete(setData); stop() }
  }, [base])
  return data
}
