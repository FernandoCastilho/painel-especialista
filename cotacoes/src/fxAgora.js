import { useEffect, useState } from 'react'
import { DATA_BASE } from './useQuotes.js'
import { DATA_POLL_MS, startVisiblePolling } from './visiblePolling.js'

// Notícias publicadas perto de um horário (a máxima ou a mínima do dia): de 1 hora antes a 30 minutos depois.
// Mostram o que saiu na imprensa naquele momento; não comprovam a causa do movimento.
export const PERTO_ANTES = 60 * 60000
export const PERTO_DEPOIS = 30 * 60000
export const PERTO_LIMITE = 3

const chave = (n) => String(n.title ?? '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, ' ').trim()

// `listas`: listas de manchetes ({ t, title, link, source, semHora? }). Até `limite`, as mais próximas do horário, em ordem de horário.
export function noticiasPerto(listas, t, { antes = PERTO_ANTES, depois = PERTO_DEPOIS, limite = PERTO_LIMITE } = {}) {
  if (!Number.isFinite(t)) return []
  const vistos = new Set()
  const out = []
  for (const n of listas.flat()) {
    if (!n?.title || !/^https?:\/\//.test(n.link ?? '') || n.semHora || !Number.isFinite(n.t)) continue
    if (n.t < t - antes || n.t > t + depois) continue
    const k = chave(n)
    if (vistos.has(n.link) || vistos.has(k)) continue
    vistos.add(n.link)
    vistos.add(k)
    out.push(n)
  }
  return out.sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t)).slice(0, limite).sort((a, b) => a.t - b.t)
}

// Manchetes do dia coletadas de 15 em 15 minutos junto com as cotações (fx-agora.json, na mesma origem do intraday.json).
export function useFxAgora(ativo) {
  const [estado, setEstado] = useState(null)
  useEffect(() => {
    if (!ativo) return undefined
    let vivo = true
    const carregar = async () => {
      try {
        const r = await fetch(`${DATA_BASE ? `${DATA_BASE}/` : './'}fx-agora.json?t=${Math.floor(Date.now() / 60000)}`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const arq = await r.json()
        if (vivo && Array.isArray(arq?.itens)) setEstado(arq)
      } catch { /* sem o arquivo, o gráfico usa só as manchetes de hora em hora */ }
    }
    const parar = startVisiblePolling(carregar, DATA_POLL_MS)
    return () => { vivo = false; parar() }
  }, [ativo])
  return ativo ? estado : null
}
