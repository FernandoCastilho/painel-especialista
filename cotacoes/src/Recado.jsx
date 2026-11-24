import { useEffect, useRef, useState } from 'react'
import { DATA_POLL_MS, startVisiblePolling } from './visiblePolling.js'
import { jaVisto, marcarVisto, recadoAtivo } from './recado.js'
import './AvisoInicial.css'

// Pop-up com o recado da administração (public/recado.json). Chega a quem está com o app aberto em poucos minutos
// e a quem abrir depois; cada pessoa vê cada recado uma vez. Espera outro diálogo aberto (ex.: o aviso inicial) fechar.
// Navegador automatizado (testes) não recebe, para um recado ligado não cobrir a tela dos smokes; o smoke próprio desliga essa exceção.
export default function Recado({ aguardarAviso }) {
  const [recado, setRecado] = useState(null)
  const [aberto, setAberto] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.webdriver) return undefined
    const carregar = async () => {
      const r = await fetch(`./recado.json?t=${Math.floor(Date.now() / 60000)}`)
      if (!r.ok) return
      const atual = recadoAtivo(await r.json())
      if (atual && !jaVisto(atual.id)) setRecado((antes) => (antes?.id === atual.id ? antes : atual))
    }
    return startVisiblePolling(() => carregar().catch(() => {}), DATA_POLL_MS)
  }, [])

  // abre quando não houver outro diálogo modal na frente
  useEffect(() => {
    if (!recado || aberto || aguardarAviso) return undefined
    const modalAberto = () => { try { return !!document.querySelector('dialog:modal') } catch { return !!document.querySelector('dialog.aviso-inicial[open]') } } // painéis não modais (ex.: expandir gráfico) não contam
    const tentar = () => { if (!modalAberto()) setAberto(true) }
    tentar()
    const t = setInterval(tentar, 1000)
    return () => clearInterval(t)
  }, [recado, aberto, aguardarAviso])

  useEffect(() => {
    const el = ref.current
    if (!aberto || !el) return undefined
    if (aguardarAviso || document.querySelector('dialog:modal')) { setAberto(false); return undefined }
    if (!el.open) el.showModal()
    return () => { if (el.open) el.close() }
  }, [aberto, recado, aguardarAviso])

  if (!recado || !aberto) return null
  const fechar = () => { marcarVisto(recado.id); setAberto(false); setRecado(null) }
  return (
    <dialog ref={ref} className={`aviso-inicial recado recado-${recado.nivel}`} aria-labelledby="recado-title" aria-describedby="recado-text" onCancel={(e) => { e.preventDefault(); fechar() }}>
      <p className="recado-tag">{recado.nivel === 'urgente' ? 'Recado urgente da administração' : 'Recado da administração'}</p>
      <h2 id="recado-title">{recado.titulo}</h2>
      <p id="recado-text">{recado.texto}</p>
      <button type="button" className="btn" autoFocus onClick={fechar}>Entendi</button>
    </dialog>
  )
}
