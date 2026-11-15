import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const helpText = node => Array.isArray(node) ? node.map(helpText).join(' ') : node && typeof node === 'object' ? helpText(node.props?.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : ''

// Ajuda modal nativa: foco contido pelo navegador, Escape e retorno ao acionador.
// Compartilhada pelas calculadoras, sem alterar a ajuda das demais abas.
export default function FinimpHelp({ title, children }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const button = useRef(null), dialog = useRef(null), id = useId()
  const preview = useRef(null), leaveTimer = useRef(null), restoringFocus = useRef(false)
  const showPreview = hover && !open && !dismissed
  const text = helpText(children).replace(/\s+/g, ' ').trim()
  const excerpt = text.length > 280 ? text.slice(0, 277) + '…' : text
  const enter = () => { clearTimeout(leaveTimer.current); setHover(true) }
  const leave = () => { clearTimeout(leaveTimer.current); leaveTimer.current = setTimeout(() => { setHover(false); setDismissed(false) }, 160) }
  const close = () => { dialog.current?.close(); setOpen(false); setHover(false); setDismissed(true); restoringFocus.current=true; button.current?.focus(); restoringFocus.current=false }
  useEffect(() => () => clearTimeout(leaveTimer.current), [])
  useLayoutEffect(() => {
    if (!showPreview || !preview.current || !button.current) return
    const popup = preview.current, anchor = button.current.getBoundingClientRect()
    const place = () => {
      const box = popup.getBoundingClientRect()
      popup.style.left = Math.max(12, Math.min(anchor.left, window.innerWidth - box.width - 12)) + 'px'
      popup.style.top = (anchor.bottom + box.height + 12 <= window.innerHeight ? anchor.bottom + 8 : Math.max(12, anchor.top - box.height - 8)) + 'px'
    }
    const dismiss = event => { if (!event || event.type !== 'keydown' || event.key === 'Escape') { setHover(false); setDismissed(true) } }
    place()
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    document.addEventListener('keydown', dismiss)
    return () => { window.removeEventListener('scroll', dismiss, true); window.removeEventListener('resize', dismiss); document.removeEventListener('keydown', dismiss) }
  }, [showPreview])
  useLayoutEffect(() => {
    if (!open || !dialog.current) return
    const popup = dialog.current
    popup.showModal()
    const place = () => {
      if (window.innerWidth <= 560) { popup.style.top='auto';popup.style.left='16px';return }
      const anchor = button.current.getBoundingClientRect(), box = popup.getBoundingClientRect()
      popup.style.left=Math.min(Math.max(8,anchor.left),Math.max(8,window.innerWidth-box.width-8))+'px'
      popup.style.top=Math.min(Math.max(8,anchor.bottom+8),Math.max(8,window.innerHeight-box.height-8))+'px'
    }
    place()
    window.addEventListener('resize',place)
    return () => {window.removeEventListener('resize',place);if(popup.open)popup.close()}
  },[open])
  return <span className="fi-help" onPointerEnter={event=>{if(event.pointerType==='mouse')enter()}} onPointerLeave={leave}><button ref={button} type="button" aria-label={'Ajuda: '+title} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined} aria-describedby={showPreview?id+'-preview':undefined} onFocus={()=>{if(restoringFocus.current)return;setDismissed(false);enter()}} onBlur={()=>setHover(false)} onClick={()=>{clearTimeout(leaveTimer.current);setHover(false);setOpen(true)}}>?</button>
    {showPreview && createPortal(<span ref={preview} id={id+'-preview'} role="tooltip" className="cx-help-preview" onPointerEnter={enter} onPointerLeave={leave}><strong>{title}</strong><span>{excerpt}</span><small>Clique ou pressione Enter para abrir a explicação completa.</small></span>,document.body)}
    {open && createPortal(<dialog ref={dialog} id={id} className="fi-help-dialog" aria-labelledby={id+'-title'} aria-describedby={id+'-body'} onCancel={event=>{event.preventDefault();close()}}>
      <h3 id={id+'-title'}>{title}</h3><div id={id+'-body'}>{children}</div><button type="button" className="fi-help-close" onClick={close}>Fechar ajuda</button>
    </dialog>,document.body)}
  </span>
}
