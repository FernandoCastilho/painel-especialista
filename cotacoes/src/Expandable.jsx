import { useLayoutEffect, useRef, useState } from 'react'
import { FilterScope } from './ChartFilters.jsx'
import { reduceMotion } from './motion.js'
import ExpandIcon from './ExpandIcon.jsx'

// O mesmo conteúdo permanece montado ao ampliar: filtros e seleções são preservados.
// O diálogo nativo mantém foco e Escape dentro da vista ampliada, inclusive no celular.
export default function Expandable({ children, label, modal = false, onClose }) {
  const [full, setFull] = useState(false)
  const ref = useRef(null)
  const active = modal || full
  useLayoutEffect(() => {
    const el = ref.current
    if (active) {
      el.removeAttribute('open')
      el.showModal()
      const previous = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        el.close()
        document.body.style.overflow = previous
      }
    }
    el.setAttribute('open', '')
  }, [active])
  const restore = () => setFull(false)
  // Detalhe (modal) abre como janela no centro da tela; ao fechar, ela esmaece (0,25 s) antes de sair.
  const [closing, setClosing] = useState(false)
  const close = () => {
    if (!modal || closing) return
    if (reduceMotion()) { onClose?.(); return }
    setClosing(true)
    setTimeout(() => onClose?.(), 240)
  }
  const containFocus = e => {
    if (!active || e.key !== 'Tab') return
    const targets = [...ref.current.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && el.getClientRects().length)
    const first = targets[0], last = targets.at(-1)
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
  }
  return (
    <dialog ref={ref} className={`expandable-panel${active ? ' is-dialog' : ''}${full ? ' is-full' : ''}${modal ? ' is-modal' : ''}${closing ? ' is-closing' : ''}`} aria-label={label}
      onKeyDown={containFocus}
      onCancel={(e) => { e.preventDefault(); full ? restore() : close() }}
      onClick={(e) => {
        if (!modal || e.target !== e.currentTarget) return
        const r = e.currentTarget.getBoundingClientRect() // só fecha no clique fora da janela (no fundo escurecido)
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close()
      }}>
      <div className="expandable-controls">
        {modal
          ? <button type="button" className="btn" onClick={close} aria-label="Fechar detalhes">Fechar ×</button>
          : <button type="button" className={full ? 'btn' : 'btn btn-expand'} aria-label={`${full ? 'Restaurar' : 'Maximizar'} ${label}`} aria-pressed={full} title={full ? undefined : 'Ampliar'} onClick={() => setFull((v) => !v)}>{full ? '↙ Restaurar' : <ExpandIcon />}</button>}
      </div>
      {modal ? <FilterScope><div className="expandable-body">{children}</div></FilterScope> : children}
    </dialog>
  )
}
