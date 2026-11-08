import { useEffect, useId, useRef, useState } from 'react'
import './Nav.css'
// Navegação por abas: barra inferior fixa no celular e no computador (a posição muda só no CSS).
const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map((p) => <path key={p} d={p} />)}
  </svg>
)

export { APP_SECTIONS as TABS } from './appSections.js'
import { APP_SECTIONS as TABS } from './appSections.js'

const PRIMARY = ['resumo', 'juros', 'cenarios', 'noticias']
const DOTS = ['M5 12h.01M12 12h.01M19 12h.01']

// Ordem: Mercado hoje, Juros, Cenários e as demais. No celular, as 4 primeiras ficam na barra e as demais entram em "Mais"; no computador aparecem todas.
export default function Nav({ tab, onTab }) {
  const [more, setMore] = useState(false)
  const ref = useRef(null), trigger = useRef(null), menu = useRef(null), firstItem = useRef(0)
  const menuId = useId()
  // Configurações fica fora do menu (oculto); abre pelo endereço #config.
  const visiveis = TABS.filter((t) => !t.oculto)
  const secondary = visiveis.filter((t) => !PRIMARY.includes(t.id))
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
    <nav className="tabs" aria-label="Seções" ref={ref}>
      {visiveis.map((t) => (
        <button key={t.id} type="button" className={`${t.id === tab ? 'on' : ''}${PRIMARY.includes(t.id) ? '' : ' sec'}`} aria-current={t.id === tab ? 'page' : undefined} onClick={() => onTab(t.id)}>
          <Icon d={t.icon} />
          <span>{t.label}</span>
        </button>
      ))}
      <div className="more-tab">
        <button type="button" className={secondary.some((t) => t.id === tab) ? 'on' : ''} ref={trigger} id={`${menuId}-trigger`} aria-expanded={more} aria-haspopup="menu" aria-controls={more ? menuId : undefined}
          onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); firstItem.current = event.key === 'ArrowUp' ? -1 : 0; setMore(true) } }}
          onClick={() => { firstItem.current = 0; setMore((m) => !m) }}>
          <Icon d={DOTS} />
          <span>Mais</span>
        </button>
        {more && (
          <div className="more-sheet" ref={menu} id={menuId} role="menu" aria-labelledby={`${menuId}-trigger`} onKeyDown={menuKey}>
            {secondary.map((t) => (
              <button key={t.id} type="button" role="menuitem" tabIndex={-1} aria-current={t.id === tab ? 'page' : undefined} className={t.id === tab ? 'on' : ''} onClick={() => (setMore(false), trigger.current?.focus(), onTab(t.id))}>
                <Icon d={t.icon} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
