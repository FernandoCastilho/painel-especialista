import { useCallback, useEffect, useId, useRef, useState } from 'react'
import BndesIcon from './BndesIcon.jsx'
import './ExpandablePanel.css'

let scrollLocks = 0
let originalOverflow = ''

// O conteúdo aparece uma única vez. O dialog nativo isola foco e fundo inclusive
// quando um quadro é expandido dentro de outra comparação já ampliada.
export default function ExpandablePanel({ title, brand, children, className = '', open, onOpenChange }) {
  const [localOpen, setLocalOpen] = useState(false)
  const expanded = open ?? localOpen
  const setOpen = useCallback(value => { if (onOpenChange) onOpenChange(value); else setLocalOpen(value) }, [onOpenChange])
  const dialog = useRef(null), trigger = useRef(null)
  const titleId = useId()
  const restoreFocus = useCallback(() => trigger.current?.focus(), [])
  useEffect(() => {
    if (!expanded) return
    const element = dialog.current
    element.showModal()
    if (scrollLocks++ === 0) {
      originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    const close = () => setOpen(false)
    window.addEventListener('hashchange', close)
    return () => {
      window.removeEventListener('hashchange', close)
      element.close()
      if (--scrollLocks === 0) document.body.style.overflow = originalOverflow
      // React recoloca o botão original antes de restaurar o foco.
      queueMicrotask(restoreFocus)
    }
  }, [expanded, setOpen, restoreFocus])
  const content = <><header className="expandable-heading"><div>{brand}<h3 id={titleId}>{title}</h3></div><button type="button" ref={expanded ? undefined : trigger} className="expandable-toggle" onClick={() => setOpen(!expanded)} aria-label={`${expanded ? 'Recolher' : 'Ampliar'}: ${title}`} title={expanded ? 'Recolher (Esc)' : 'Ampliar na tela'} aria-expanded={expanded}><BndesIcon kind={expanded ? 'collapse' : 'expand'} /></button></header><div className="expandable-content">{children}</div></>
  return <section className={`expandable-panel ${className}`}>
    {!expanded && content}
    <dialog ref={dialog} className={`expandable-dialog ${className}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); setOpen(false) }}>{expanded && content}</dialog>
  </section>
}
