import { useEffect, useRef, useState } from 'react'
import { clampMascot, MASCOT_PREFERENCE_KEY, readMascotPreferences } from './mascotPosition.js'

const NARROW = 1000
// Keep the grab/shrink controls below the sticky header, including saved positions.
// On narrow screens the default spot sits above the bottom navigation.
// Sem posição salva, a coruja grande abre no canto de cima, perto de onde estava a pequena.
const TOP = { y: 0 }
const place = point => clampMascot(point, window.innerWidth, window.innerHeight - (window.innerWidth < NARROW ? 76 : 0), (window.document?.querySelector('.term-head')?.getBoundingClientRect().bottom ?? 88) + 8)
// The small mascot parks as a badge hanging just under the top header (or at the screen edge when there is none).
const parkTop = () => Math.max(0, window.document?.querySelector('.term-head')?.getBoundingClientRect().bottom ?? 0) + 4

export default function MascotDock({ children, icon, onSearch }) {
  const [preferences, setPreferences] = useState(() => readMascotPreferences({ getItem: key => window.localStorage.getItem(key) }))
  const [position, setPosition] = useState(() => place(preferences.desktop ?? TOP))
  const [large, setLarge] = useState(false)
  const [top, setTop] = useState(parkTop)
  const [moving, setMoving] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const tray = useRef(null), dock = useRef(null), handle = useRef(null), mini = useRef(null), drag = useRef(null)
  const previousLarge = useRef(large)
  useEffect(() => {
    try { localStorage.setItem(MASCOT_PREFERENCE_KEY, JSON.stringify(preferences)) } catch { /* Private browsing may disable storage. */ }
  }, [preferences])
  useEffect(() => { setTop(parkTop()) }, [large])
  useEffect(() => {
    if (previousLarge.current !== large) {
      (large ? handle : mini).current?.focus({ preventScroll: true })
      previousLarge.current = large
    }
  }, [large])
  useEffect(() => {
    const resize = () => {
      setPosition(place(preferences.desktop ?? TOP))
      setTop(parkTop())
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [preferences.desktop])
  const move = point => {
    const next = place(point)
    setPosition(next)
    setPreferences(p => ({ ...p, desktop: next }))
  }
  const current = position
  const step = (x, y) => move({ x: current.x + x, y: current.y + y })
  const reset = () => {
    setPosition(place(TOP))
    setPreferences(p => ({ ...p, desktop: null }))
    setAnnouncement('Mascote na posição inicial.')
  }
  const shrink = () => { setMoving(false); setLarge(false) }
  return <aside className={`mascot-tray${large ? ' mascot-tray-large' : ''}`} ref={tray} aria-label="Assistente do painel">
    {!large ? <button ref={mini} type="button" className="mascot-mini" style={{ top }} aria-label="Ampliar mascote" onClick={() => { setPosition(place(preferences.desktop ?? TOP)); setLarge(true) }}><i className="mascot-mini-face" aria-hidden="true" /></button> : <div ref={dock} className="mascot-dock" style={{ left: current.x, top: current.y }}>
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
        <button type="button" aria-label="Reduzir mascote" title="Reduzir (ou clique duas vezes na coruja)" onClick={shrink}>−</button>
      </div>
      <div className="mascot-figure" title="Clique duas vezes para reduzir" onDoubleClick={shrink}>{icon}</div>
      {children}
      <button type="button" className="mascot-search" aria-haspopup="dialog" onClick={event => onSearch({ anchor: dock.current, opener: event.currentTarget, id: Date.now() })}>⌕ Pesquisar</button>
      {moving && <div id="mascot-position-controls" className="mascot-position-controls">
        <p>Arraste ou use as setas.</p>
        <div>{[['←', -20, 0, 'esquerda'], ['↑', 0, -20, 'cima'], ['↓', 0, 20, 'baixo'], ['→', 20, 0, 'direita']].map(([symbol, x, y, label]) => <button type="button" key={label} aria-label={`Mover para ${label}`} onClick={() => step(x, y)}>{symbol}</button>)}</div>
        <button type="button" onClick={reset}>Posição inicial</button>
        <button type="button" onClick={() => { setMoving(false); handle.current?.focus() }}>Concluir</button>
      </div>}
    </div>}
    <span id="mascot-move-help" className="mascot-sr-only">Use as setas do teclado para mover e Home para voltar à posição inicial. Ative este botão para mostrar controles de posição. Ao reduzir, o mascote volta a ser um botão pequeno no topo da tela.</span>
    <span className="mascot-sr-only" role="status">{announcement}</span>
  </aside>
}
