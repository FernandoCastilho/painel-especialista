import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './ChartFullscreen.css'

// O host do portal permanece o mesmo ao mudar de lugar. Não remonta o gráfico,
// preservando filtros, seleções e tooltips. O dialog nativo isola foco e fundo.
export default function ChartFullscreen({ children, disabled = false }) {
  const [expanded, setExpanded] = useState(false)
  const [host] = useState(() => typeof document === 'undefined' ? null : document.createElement('div'))
  const inline = useRef(null), dialog = useRef(null), button = useRef(null)
  useLayoutEffect(() => {
    if (disabled || !host) return
    const origin = inline.current, modal = dialog.current, trigger = button.current
    const overflow = document.body.style.overflow
    if (expanded) {
      modal.appendChild(host)
      modal.showModal()
      document.body.style.overflow = 'hidden'
    } else origin.appendChild(host)
    const close = () => setExpanded(false)
    window.addEventListener('hashchange', close)
    return () => {
      window.removeEventListener('hashchange', close)
      if (expanded) {
        modal.close()
        origin.appendChild(host)
        document.body.style.overflow = overflow
        queueMicrotask(() => trigger?.focus())
      }
    }
  }, [expanded, disabled, host])
  if (disabled || !host) return children
  const keepEscapeInside = event => { if (expanded && event.key === 'Escape') event.stopPropagation() }
  const content = <>
    <div className="chart-fullscreen-toolbar" onKeyDown={keepEscapeInside}><button ref={button} type="button" aria-expanded={expanded} onClick={event => { event.stopPropagation(); setExpanded(value => !value) }}>{expanded ? 'Restaurar gráfico (Esc)' : 'Maximizar gráfico'}</button></div>
    <div className="chart-fullscreen-content" onKeyDown={keepEscapeInside}>{children}</div>
  </>
  return <>
    <div ref={inline} className="chart-fullscreen" />
    <dialog ref={dialog} className="chart-fullscreen is-expanded" aria-label="Gráfico maximizado" onCancel={event => { event.preventDefault(); event.stopPropagation(); setExpanded(false) }} onKeyDown={event => {
      // O alvo trata primeiro Escape (por exemplo, limpa a seleção). Não o
      // cancelamos aqui: sem seleção, o navegador dispara cancel no dialog.
      if (event.key === 'Escape') event.stopPropagation()
    }} />
    {createPortal(content, host)}
  </>
}
