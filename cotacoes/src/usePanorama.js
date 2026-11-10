import { useCallback, useEffect, useState } from 'react'
import { marketEditionPending, marketMoment, rememberMarketSlot } from './marketPopup.js'

// Panorama do dia sob demanda: nada abre sozinho. `nova` só acende um ponto no botão do Mercado quando existe edição da hora
// ainda não aberta (dias úteis, 9h às 18h); abrir o Panorama marca essa edição como vista.
const memoria = new Set() // vale para a visita quando o navegador bloqueia o armazenamento
const guardado = () => { try { return window.localStorage } catch { return null } }
const pendente = () => marketEditionPending(Date.now(), guardado(), memoria)

export function usePanorama() {
  const [aberto, setAberto] = useState(false)
  const [momento, setMomento] = useState(null)
  const [nova, setNova] = useState(pendente)
  useEffect(() => {
    const conferir = () => setNova(pendente())
    const timer = setInterval(conferir, 30000)
    window.addEventListener('focus', conferir)
    document.addEventListener('visibilitychange', conferir)
    return () => { clearInterval(timer); window.removeEventListener('focus', conferir); document.removeEventListener('visibilitychange', conferir) }
  }, [])
  const abrir = useCallback(() => {
    const atual = marketMoment()
    if (!atual) return
    if (atual.key) rememberMarketSlot(atual, guardado(), memoria)
    setNova(false)
    setMomento(atual)
    setAberto(true)
  }, [])
  const fechar = useCallback(() => setAberto(false), [])
  return { aberto, momento, nova, abrir, fechar }
}
