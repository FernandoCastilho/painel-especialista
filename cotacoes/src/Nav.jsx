import { useEffect, useLayoutEffect, useId, useRef, useState } from 'react'
import './Nav.css'
// Navegação por abas: barra inferior fixa no celular e no computador (a posição muda só no CSS).
const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map((p) => <path key={p} d={p} />)}
  </svg>
)

export { APP_SECTIONS as TABS } from './appSections.js'
import { APP_SECTIONS as TABS } from './appSections.js'

import { MOBILE_PRIMARY, DESKTOP_PRIMARY, MORE_GROUPS, shortcutTitle } from './navigationPriority.js'
const DOTS = ['M5 12h.01M12 12h.01M19 12h.01']

// Desktop mostra oito destinos; celular/tablet seis. Mais preserva os demais em grupos.
export default function Nav({ tab, onTab, desktop = false }) {
  const PRIMARY = desktop ? DESKTOP_PRIMARY : MOBILE_PRIMARY
  const [more, setMore] = useState(false)
  const ref = useRef(null), trigger = useRef(null), menu = useRef(null), firstItem = useRef(0)
  const menuId = useId()
  const [mark, setMark] = useState(null)
  useLayoutEffect(() => {
    if (!desktop || !ref.current) return undefined
    const nav = ref.current
    const place = () => {
      const on = nav.querySelector(':scope > button.on, :scope > .more-tab > button.on')
      if (!on || !on.offsetWidth) return setMark(null)
      const a = on.getBoundingClientRect(), b = nav.getBoundingClientRect()
      setMark({ x: a.left - b.left, y: a.bottom - b.top - 2, w: a.width })
    }
    place()
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null
    watch?.observe(nav)
    document.fonts?.ready?.then(place).catch(() => {})
    return () => watch?.disconnect()
  }, [tab, desktop])

  // Configurações fica fora do menu (oculto); abre pelo endereço #config.
  const visiveis = TABS.filter((t) => !t.oculto)
  const groups = MORE_GROUPS.map(g => ({ ...g, items: g.ids.filter(id => !PRIMARY.includes(id)).map(id => visiveis.find(t => t.id === id)) })).filter(g => g.items.length)
  const secondary = groups.flatMap(g => g.items)
  useEffect(() => {
    if (!more) return
    const onDown = (e) => !ref.current?.contains(e.target) && setMore(false)
    const items = [...(menu.current?.querySelectorAll('[role="menuitem"]') || [])]
    items.at(firstItem.current)?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMore(false); trigger.current?.focus() }
    }
    const onFocus = (e) => !ref.current?.contains(e.target) && setMore(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocus)
    }
  }, [more])
  const menuKey = (event) => {
    if (event.key === 'Tab') { setMore(false); trigger.current?.focus(); return }
    const items = [...(menu.current?.querySelectorAll('[role="menuitem"]') || [])]
    if (!items.length) return
    const current = items.indexOf(document.activeElement)
    const next = { ArrowDown: (current + 1) % items.length, ArrowUp: (current - 1 + items.length) % items.length, Home: 0, End: items.length - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault()
    items[next].focus()
  }
  return (
    <nav className={desktop ? "topbar-tabs priority-desktop" : "tabs"} aria-label={desktop ? "Navegação principal" : "Seções"} ref={ref}>
      {PRIMARY.map(id => visiveis.find(t => t.id === id)).map((t) => (
        <button key={t.id} type="button" className={t.id === tab ? 'on' : ''} aria-current={t.id === tab ? 'page' : undefined} aria-label={!desktop && (t.mobileLabel || t.compactLabel) ? (t.terminalLabel || t.label) : undefined} title={shortcutTitle(t.id)} onClick={() => { setMore(false); onTab(t.id) }}>
          {!desktop && <Icon d={t.icon} />}
          <span className={!desktop && t.compactLabel ? 'nav-label-full' : undefined}>{(!desktop && t.mobileLabel) || t.terminalLabel || t.label}</span>
          {!desktop && t.compactLabel && <span className="nav-label-compact" aria-hidden="true">{t.compactLabel}</span>}
        </button>
      ))}
      <div className="more-tab">
        <button type="button" className={secondary.some((t) => t.id === tab) ? 'on' : ''} ref={trigger} id={`${menuId}-trigger`} aria-expanded={more} aria-haspopup="menu" aria-controls={more ? menuId : undefined}
          onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); firstItem.current = event.key === 'ArrowUp' ? -1 : 0; setMore(true) } }}
          onClick={() => { firstItem.current = 0; setMore((m) => !m) }}>
          {!desktop && <Icon d={DOTS} />}
          <span>Mais</span>
        </button>
        {more && (
          <div className="more-sheet" ref={menu} id={menuId} role="menu" aria-labelledby={`${menuId}-trigger`} onKeyDown={menuKey}>
            {groups.map(group => <div key={group.label} role="group" aria-label={group.label}><div className="more-group-title" aria-hidden="true">{group.label}</div>{group.items.map((t) => (
              <button key={t.id} type="button" role="menuitem" title={shortcutTitle(t.id)} tabIndex={-1} aria-current={t.id === tab ? 'page' : undefined} className={t.id === tab ? 'on' : ''} onClick={() => (setMore(false), trigger.current?.focus(), onTab(t.id))}>
                <Icon d={t.icon} />
                <span>{t.label}</span>
              </button>
            ))}</div>)}
          </div>
        )}
      </div>
      {desktop && <span className="topbar-mark" aria-hidden="true" hidden={!mark} style={mark ? { width: mark.w, translate: `${mark.x}px ${mark.y}px` } : undefined} />}
    </nav>
  )
}
