import { useEffect, useRef } from 'react'
import { conceitoDoDia } from './conceitoDiario.js'
import './AvisoInicial.css'

// Conceito do dia: não abre mais sozinho. Abre pelo botão "Conceito do dia" da faixa "Aprender" no Mercado (InsightAprender.jsx).
export default function ConceitoDiario({ open, onClose, goto }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!open || !el) return undefined
    const origem = document.activeElement
    el.showModal()
    el.querySelector('button')?.focus({ preventScroll: true })
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      el.close()
      document.body.style.overflow = overflow
      // Ao navegar para o conceito completo, a faixa sai da tela e o foco fica com a página de destino.
      if (origem?.isConnected && origem.getClientRects().length) origem.focus({ preventScroll: true })
    }
  }, [open])
  if (!open) return null
  const entrada = conceitoDoDia()
  return (
    <dialog ref={ref} className="conceito-diario" aria-labelledby="conceito-dia-title" aria-describedby="conceito-dia-text" onCancel={(e) => { e.preventDefault(); onClose() }} onKeyDown={(e) => {
      if (e.key !== 'Tab') return
      const buttons = ref.current.querySelectorAll('button')
      const first = buttons[0], last = buttons[buttons.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }}>
      <p className="conceito-dia-tag">Conceito do dia · Aprender</p>
      <h2 id="conceito-dia-title">{entrada.conceito.nome}</h2>
      <p id="conceito-dia-text">{entrada.conceito.frase}</p>
      <div className="conceito-dia-actions">
        <button type="button" className="btn" autoFocus onClick={onClose}>Fechar</button>
        <button type="button" className="btn" onClick={() => { onClose(); goto('aprender', entrada.conceito.id) }}>Abrir conceito completo</button>
      </div>
    </dialog>
  )
}
