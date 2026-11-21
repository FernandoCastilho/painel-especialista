import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './RpnDock.css'

const RpnCalculator = lazy(() => import('./RpnCalculator.jsx'))
const edge = 8

function insideViewport(x, y, panel) {
  return {
    left: Math.max(edge, Math.min(x, window.innerWidth - panel.offsetWidth - edge)),
    top: Math.max(edge, Math.min(y, window.innerHeight - panel.offsetHeight - edge)),
  }
}

export default function RpnDock({ active }) {
  const inline = useRef(null), panel = useRef(null), launcher = useRef(null), move = useRef(null)
  const previousFloating = useRef(false)
  const [host] = useState(() => document.createElement('div'))
  const [started, setStarted] = useState(active)
  const [floating, setFloating] = useState(false)
  const [position, setPosition] = useState(null)

  useLayoutEffect(() => {
    const target = floating ? document.body : inline.current
    if (!target) return
    target.appendChild(host)
    return () => host.remove()
  }, [host, floating])
  useLayoutEffect(() => {
    if (active) setStarted(true)
  }, [active])
  useLayoutEffect(() => {
    if (floating) {
      if (!previousFloating.current && !panel.current?.querySelector('.rpn-workspace')) panel.current?.focus()
      const resize = () => setPosition(pos => pos && panel.current ? insideViewport(pos.left, pos.top, panel.current) : pos)
      window.addEventListener('resize', resize)
      previousFloating.current = true
      return () => window.removeEventListener('resize', resize)
    }
    if (previousFloating.current) {
      previousFloating.current = false
      if (active) host.querySelector('.rpn-float-action')?.focus()
      else launcher.current?.focus()
    }
  }, [active, floating, host])

  const open = () => { setStarted(true); setFloating(true) }
  const close = () => { move.current = null; setFloating(false) }
  const startMove = e => {
    if (e.button !== 0) return
    const rect = panel.current.getBoundingClientRect()
    move.current = { id: e.pointerId, x: e.clientX - rect.left, y: e.clientY - rect.top }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const drag = e => {
    if (move.current?.id !== e.pointerId) return
    setPosition(insideViewport(e.clientX - move.current.x, e.clientY - move.current.y, panel.current))
  }
  return <>
    <div className="rpn-inline" ref={inline} hidden={!active || floating} />
    {!active && !floating && createPortal(
      <button type="button" className="rpn-float-launcher" aria-label="Abrir calculadora flutuante" ref={launcher} onClick={open}>Calculadora RPN</button>, document.body)}
    {(started || active) && createPortal(
      <div ref={panel} className={floating ? 'rpn-float' : undefined} style={floating ? position ?? undefined : undefined}
        role={floating ? 'dialog' : undefined} aria-label={floating ? 'Calculadora RPN flutuante' : undefined}
        tabIndex={floating ? -1 : undefined}
        onKeyDown={e => {
          if (floating && e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); close() }
        }}>
        {floating && <header className="rpn-float-bar">
          <span title="Arraste para mover" onPointerDown={startMove} onPointerMove={drag}
            onLostPointerCapture={() => { move.current = null }}>Calculadora RPN</span>
          <button type="button" onClick={close} aria-label={active ? 'Voltar à calculadora na página' : 'Recolher calculadora'}>×</button>
        </header>}
        <Suspense fallback={<p role="status">Carregando calculadora…</p>}>
          <RpnCalculator floating={floating} onFloat={open} />
        </Suspense>
      </div>, host)}
  </>
}
