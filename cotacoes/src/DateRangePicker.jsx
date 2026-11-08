import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import './DateRangePicker.css'
import { clamp, long, monthCells, monthName, monthShort, outside, pair, parts, preview, shift, shiftMonth, short, valid, monthKey, parseTyped, maskTyped, typedText, navigateCalendarView } from './dateRange.js'

const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

// Período em uma linha só: "dd/mm/aa → dd/mm/aa". Abre um calendário; clica no início, depois no fim, ou digita as duas datas.
// mode="month" escolhe meses (séries mensais). Valores e limites em texto ISO.
export default function DateRangePicker({ start, end, min, max, mode = 'day', label = 'Período', onChange }) {
  const id = useId()
  const month = mode === 'month'
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState(null)
  const [hover, setHover] = useState(null)
  const [view, setView] = useState(start)
  const [focusKey, setFocusKey] = useState(null)
  const [pos, setPos] = useState(null)
  const [panels, setPanels] = useState(1)
  const [typed, setTyped] = useState({ a: '', b: '', erro: '' })
  const trigger = useRef(null), pop = useRef(null)
  const focusGrid = useRef(false)
  const ok = valid(start, mode) && valid(end, mode)

  const close = (focus = true) => { setOpen(false); setAnchor(null); setHover(null); setFocusKey(null); if (focus) trigger.current?.focus() }
  const show = () => {
    const base = ok ? start : max ?? min
    focusGrid.current = true
    setView(base); setAnchor(null); setHover(null); setFocusKey(base); setTyped({ a: ok ? typedText(start, mode) : '', b: ok ? typedText(end, mode) : '', erro: '' }); setPanels(!month && window.innerWidth >= 640 ? 2 : 1); setOpen(true)
  }

  useLayoutEffect(() => {
    if (!open || !pop.current || !trigger.current) return
    const place = () => {
      const r = trigger.current.getBoundingClientRect(), w = pop.current.offsetWidth, h = pop.current.offsetHeight
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
      const below = r.bottom + 6, top = below + h > window.innerHeight - 8 && r.top - h - 6 > 8 ? r.top - h - 6 : below
      setPos({ left, top })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, view, panels])

  useEffect(() => {
    if (!open) return
    const away = (e) => { if (!pop.current?.contains(e.target) && !trigger.current?.contains(e.target)) close(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  // Foco no dia/mês atual do teclado.
  useEffect(() => {
    if (open && focusKey && focusGrid.current) {
      pop.current?.querySelector(`[data-k="${focusKey}"]`)?.focus({ preventScroll: true })
      focusGrid.current = false
    }
  }, [open, focusKey, view])

  const pick = (v) => {
    if (outside(v, min, max)) return
    if (!anchor) { setAnchor(v); setHover(v); return }
    const [s, e] = pair(anchor, v)
    onChange?.(s, e)
    close()
  }

  // datas digitadas: aplica com Enter ou no botão; fora do limite ou inválida mostra o motivo
  const fmt = month ? 'mm/aaaa' : 'dd/mm/aaaa'
  const applyTyped = (e) => {
    e?.preventDefault()
    const a = parseTyped(typed.a, mode), b = parseTyped(typed.b, mode)
    if (!a || !b) return setTyped((t) => ({ ...t, erro: `Data inválida. Use ${fmt}.` }))
    const [s, f] = pair(a, b)
    if (outside(s, min, max) || outside(f, min, max)) return setTyped((t) => ({ ...t, erro: `Fora do período disponível${min ? `: de ${short(min, mode)}` : ''}${max ? ` até ${short(max, mode)}` : ''}.` }))
    onChange?.(s, f)
    close()
  }
  const typeField = (k) => (e) => setTyped((t) => ({ ...t, [k]: maskTyped(e.target.value, mode), erro: '' }))

  const move = (v) => {
    const c = clamp(v, min, max)
    focusGrid.current = true
    setFocusKey(c)
    if (anchor) setHover(c)
    const f = parts(c), left = parts(view)
    const idx = (f.y - left.y) * 12 + (f.m - left.m)
    if (month) { if (f.y !== left.y) setView(c) } else if (idx < 0 || idx >= panels) setView(idx < 0 ? c : shiftMonth(c, mode, -(panels - 1)))
  }

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); anchor ? (setAnchor(null), setHover(null)) : close(); return }
    if (!focusKey || !e.target.dataset.k) return
    const step = month ? { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 } : { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (step[e.key]) { e.preventDefault(); move(shift(focusKey, mode, step[e.key])) }
    else if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); move(shiftMonth(focusKey, mode, (e.key === 'PageUp' ? -1 : 1) * (month ? 1 : 1))) }
    else if (e.key === 'Home' && !month) { e.preventDefault(); move(shift(focusKey, mode, -new Date(parts(focusKey).y, parts(focusKey).m, parts(focusKey).d).getDay())) }
    else if (e.key === 'End' && !month) { e.preventDefault(); move(shift(focusKey, mode, 6 - new Date(parts(focusKey).y, parts(focusKey).m, parts(focusKey).d).getDay())) }
  }

  const [lo, hi] = preview({ anchor, hover, start, end })
  const cell = (v, text, label) => {
    const dis = outside(v, min, max), edge = v === lo || v === hi, inside = v > lo && v < hi
    return (
      <button key={v} type="button" data-k={v} disabled={dis} aria-label={label} aria-pressed={edge}
        tabIndex={v === focusKey ? 0 : -1}
        className={`drp-cell${edge ? ' is-edge' : ''}${inside ? ' is-in' : ''}${v === lo ? ' is-lo' : ''}${v === hi ? ' is-hi' : ''}`}
        onClick={() => pick(v)} onMouseEnter={() => anchor && !dis && setHover(v)} onFocus={() => { setFocusKey(v); if (anchor && !dis) setHover(v) }}>{text}</button>
    )
  }

  const viewParts = parts(view)
  const stepView = (n) => {
    const next = navigateCalendarView(view, focusKey, mode, n, min, max)
    focusGrid.current = false
    setView(next.view)
    setFocusKey(next.focus)
    if (anchor) setHover(next.focus)
  }
  const years = month ? [viewParts.y] : null
  const monthsShown = month ? [] : Array.from({ length: panels }, (_, i) => { const t = viewParts.y * 12 + viewParts.m + i; return { y: Math.floor(t / 12), m: t % 12 } })
  const hint = anchor ? `Início ${short(anchor, mode)}. Escolha a data final.` : 'Escolha a data inicial (ou digite as datas acima).'
  const title = month ? String(viewParts.y) : monthsShown.map(({ y, m }) => `${monthName(m)} de ${y}`).join(' · ')

  return (
    <span className="drp">
      <button ref={trigger} type="button" className="drp-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
        aria-label={`${label}: ${ok ? `de ${long(start, mode)} a ${long(end, mode)}` : 'sem intervalo'}. Abrir calendário`} onClick={() => (open ? close() : show())}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
        <span className="drp-range">{ok ? <>{short(start, mode)}<span aria-hidden="true"> → </span>{short(end, mode)}</> : 'Escolher período'}</span>
      </button>
      {open && (
        <div ref={pop} id={id} className="drp-pop" role="dialog" aria-label={`${label}: calendário`} style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }} onKeyDown={onKey}>
          <form className="drp-type" onSubmit={applyTyped} noValidate>
            <label>Início<input type="text" inputMode="numeric" autoComplete="off" placeholder={fmt} value={typed.a} onChange={typeField('a')} aria-describedby={`${id}-err`} /></label>
            <label>Fim<input type="text" inputMode="numeric" autoComplete="off" placeholder={fmt} value={typed.b} onChange={typeField('b')} aria-describedby={`${id}-err`} /></label>
            <button type="submit" className="drp-apply">Aplicar</button>
            <p id={`${id}-err`} className="drp-err" role="alert">{typed.erro}</p>
          </form>
          <div className="drp-head">
            <button type="button" className="drp-nav" aria-label={month ? 'Ano anterior' : 'Mês anterior'} onClick={() => stepView(-1)}>‹</button>
            <strong className="drp-title" aria-live="polite">{title}</strong>
            <button type="button" className="drp-nav" aria-label={month ? 'Próximo ano' : 'Próximo mês'} onClick={() => stepView(1)}>›</button>
          </div>
          <div className="drp-months">
            {month ? (
              <div className="drp-grid drp-grid-months" role="group" aria-label={String(years[0])}>
                {Array.from({ length: 12 }, (_, m) => cell(monthKey(years[0], m), monthShort(m), `${monthName(m)} de ${years[0]}`))}
              </div>
            ) : monthsShown.map(({ y, m }) => (
              <div key={`${y}-${m}`} className="drp-month">
                {panels > 1 && <div className="drp-mname">{monthName(m)} de {y}</div>}
                <div className="drp-grid" role="group" aria-label={`${monthName(m)} de ${y}`}>
                  {WEEK.map((w, i) => <span key={i} className="drp-wd" aria-hidden="true">{w}</span>)}
                  {monthCells(y, m).map((v, i) => (v ? cell(v, String(parts(v).d), long(v, mode)) : <span key={`b${i}`} />))}
                </div>
              </div>
            ))}
          </div>
          <p className="drp-hint" role="status">{hint}</p>
        </div>
      )}
    </span>
  )
}
