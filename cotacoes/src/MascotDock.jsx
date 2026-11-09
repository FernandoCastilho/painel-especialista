import { useEffect, useRef, useState } from 'react'
import { clampMascot, MASCOT_PREFERENCE_KEY, readMascotPreferences } from './mascotPosition.js'

// Keep the grab/hide controls below the sticky header, including saved positions.
const desktopPosition = point => clampMascot(point, window.innerWidth, window.innerHeight, (window.document?.querySelector('.term-head')?.getBoundingClientRect().bottom ?? 88) + 8)

export default function MascotDock({ children, onSearch }) {
  const [preferences, setPreferences] = useState(() => readMascotPreferences({ getItem: key => window.localStorage.getItem(key) }))
  const [mobile, setMobile] = useState(() => window.innerWidth < 1000)
  const [position, setPosition] = useState(() => desktopPosition(preferences.desktop))
  const [mobilePosition, setMobilePosition] = useState({ x: 8, y: 8 })
  const [moving, setMoving] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const tray = useRef(null), dock = useRef(null), handle = useRef(null), restore = useRef(null), drag = useRef(null)
  const previousHidden = useRef(preferences.hidden)
  useEffect(() => {
    try { localStorage.setItem(MASCOT_PREFERENCE_KEY, JSON.stringify(preferences)) } catch { /* Private browsing may disable storage. */ }
  }, [preferences])
  useEffect(() => {
    if (previousHidden.current !== preferences.hidden) {
      (preferences.hidden ? restore : handle).current?.focus({ preventScroll: true })
      previousHidden.current = preferences.hidden
    }
  }, [preferences.hidden])
  useEffect(() => {
    const resize = () => {
      setMobile(window.innerWidth < 1000)
      setPosition(p => desktopPosition(p))
      setMobilePosition(p => clampMascot(p, tray.current?.clientWidth || window.innerWidth - 24, 250))
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  const move = point => {
    if (mobile) setMobilePosition(clampMascot(point, tray.current?.clientWidth || window.innerWidth - 24, 250))
    else {
      const next = desktopPosition(point)
      setPosition(next)
      setPreferences(p => ({ ...p, desktop: next }))
    }
  }
  const current = mobile ? mobilePosition : position
  const step = (x, y) => move({ x: current.x + x, y: current.y + y })
  const reset = () => {
    setPosition(desktopPosition(null))
    setMobilePosition({ x: 8, y: 8 })
    setPreferences(p => ({ ...p, desktop: null }))
    setAnnouncement('Mascote na posição inicial.')
  }
  return <aside className={`mascot-tray${preferences.hidden ? ' mascot-tray-hidden' : moving ? ' mascot-is-moving' : ''}`} ref={tray} aria-label="Assistente do painel">
    {preferences.hidden ? <button ref={restore} type="button" className="mascot-restore" onClick={() => setPreferences(p => ({ ...p, hidden: false }))}>Mostrar mascote</button> : <div ref={dock} className="mascot-dock" style={{ left: current.x, top: current.y }}>
      <div className="mascot-tools">
        <button type="button" ref={handle} className="mascot-move" aria-label="Mover mascote" aria-describedby="mascot-move-help" aria-expanded={moving} aria-controls="mascot-position-controls" title="Arraste ou use as setas do teclado" onClick={event => { if (event.detail === 0 || !drag.current?.moved) setMoving(v => !v) }} onKeyDown={event => {
          const offsets = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }
          if (offsets[event.key]) { event.preventDefault(); step(...offsets[event.key]); setAnnouncement('Posição do mascote ajustada.') }
          if (event.key === 'Home') { event.preventDefault(); reset() }
        }} onPointerDown={event => {
          if (event.button !== 0) return
          drag.current = { x: event.clientX, y: event.clientY, origin: current, moved: false }
          event.currentTarget.setPointerCapture(event.pointerId)
        }} onPointerMove={event => {
          if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return
          const dx = event.clientX - drag.current.x, dy = event.clientY - drag.current.y
          if (Math.abs(dx) + Math.abs(dy) > 5) drag.current.moved = true
          if (drag.current.moved) move({ x: drag.current.origin.x + dx, y: drag.current.origin.y + dy })
        }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }} onPointerCancel={() => { drag.current = null }}>✥</button>
        <button type="button" aria-label="Ocultar mascote" onClick={() => setPreferences(p => ({ ...p, hidden: true }))}>×</button>
      </div>
      {children}
      <button type="button" className="mascot-search" aria-haspopup="dialog" onClick={event => onSearch({ anchor: dock.current, opener: event.currentTarget, id: Date.now() })}>⌕ Pesquisar</button>
      {moving && <div id="mascot-position-controls" className="mascot-position-controls" style={mobile ? { left: -current.x + 8, top: 252 - current.y } : undefined}>
        <p>{mobile ? 'Mova nesta área reservada.' : 'Arraste ou use as setas.'}</p>
        <div>{[['←', -20, 0, 'esquerda'], ['↑', 0, -20, 'cima'], ['↓', 0, 20, 'baixo'], ['→', 20, 0, 'direita']].map(([symbol, x, y, label]) => <button type="button" key={label} aria-label={`Mover para ${label}`} onClick={() => step(x, y)}>{symbol}</button>)}</div>
        <button type="button" onClick={reset}>Posição inicial</button>
        <button type="button" onClick={() => { setMoving(false); handle.current?.focus() }}>Concluir</button>
      </div>}
    </div>}
    <span id="mascot-move-help" className="mascot-sr-only">Use as setas do teclado para mover e Home para voltar à posição inicial. Ative este botão para mostrar controles de posição. Em telas pequenas, o movimento fica na área reservada ao mascote.</span>
    <span className="mascot-sr-only" role="status">{announcement}</span>
  </aside>
}
