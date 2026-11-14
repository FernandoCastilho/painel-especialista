import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { canonicalNewsUrl } from './sectorNews.js'
import { useDataFile } from './useDataFile.js'
import { useNewsClock } from './useNewsClock.js'
import { buildKnowledgeGraph, getKnowledgeView } from './knowledgeGraph.js'
import { buildSectorKnowledgeGraph } from './sectorKnowledgeGraph.js'
import { createKnowledgeLayout, stepKnowledgeLayout, focusKnowledgeLayout, fitKnowledgeCamera } from './knowledgeLayout.js'
import Help from './Help.jsx'
import './KnowledgeMap.css'

const TYPES = [{ id: 'sector', label: 'Setores' }, { id: 'concept', label: 'Conceitos' }, { id: 'news', label: 'Notícias · 7 dias' }, { id: 'entity', label: 'Associações e players' }]
const nodeKind = node => node.subtype === 'classification' ? 'Classificação' : node.subtype === 'category' ? 'Grupo editorial' : node.type === 'news' ? 'Notícia' : node.type === 'entity' ? node.kindLabel : node.type === 'concept' ? 'Conceito' : node.subtype === 'subsector' ? 'Subsetor' : 'Setor'
const canOpenRoute = route => Boolean(route && ['aprender', 'setores', 'resumo', 'juros', 'cenarios', 'noticias'].includes(route.tab) && typeof route.view === 'string')
const MEMORY = 'painel-knowledge-map-v1'
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const short = (s, n = 28) => s.length > n ? `${s.slice(0, n - 1).trim()}…` : s
const date = t => new Date(t).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
export const knowledgePublicationLabel = node => node.datePrecision === 'day' ? node.publishedAt.split('-').reverse().join('/') : date(node.t)
function savedView(memory = MEMORY, initialId = '') {
  try {
    const v = JSON.parse(sessionStorage.getItem(memory))
    return { query: typeof v?.query === 'string' ? v.query.slice(0, 160) : '', types: Array.isArray(v?.types) ? [...new Set([...v.types.filter(t => TYPES.some(x => x.id === t)), 'entity'])] : TYPES.map(t => t.id), selectedId: typeof v?.selectedId === 'string' ? v.selectedId : initialId, local: v?.local === true }
  } catch { return { query: '', types: TYPES.map(t => t.id), selectedId: initialId, local: false } }
}
function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const update = () => setReduced(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return reduced
}

function useMapFullscreen(containerRef) {
  const [expanded, setExpanded] = useState(false)
  const nativeActive = useRef(false), pending = useRef(false), buttonRef = useRef(null)
  async function toggleFullscreen() {
    if (pending.current) return
    if (expanded) {
      if (document.fullscreenElement === containerRef.current) {
        try { await document.exitFullscreen(); return } catch { return }
      }
      setExpanded(false)
      return
    }
    pending.current = true
    try {
      if (containerRef.current?.requestFullscreen) await containerRef.current.requestFullscreen()
      nativeActive.current = document.fullscreenElement === containerRef.current
      setExpanded(true)
    } catch { setExpanded(true) } // Expanded view also works when the browser denies native fullscreen.
    finally { pending.current = false }
  }
  useEffect(() => {
    const element = containerRef.current
    const sync = () => {
      if (document.fullscreenElement === element && element) { nativeActive.current = true; setExpanded(true) }
      else if (nativeActive.current) { nativeActive.current = false; setExpanded(false) }
    }
    document.addEventListener('fullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      if (element && document.fullscreenElement === element) document.exitFullscreen()?.catch(() => {})
    }
  }, [containerRef])
  useEffect(() => {
    if (!expanded) return
    const overflow = document.body.style.overflow
    const button = buttonRef.current
    document.body.style.overflow = 'hidden'
    button?.focus({ preventScroll: true })
    const keys = e => {
      if (e.defaultPrevented) return
      if (e.key === 'Escape') {
        e.preventDefault()
        if (document.fullscreenElement === containerRef.current) document.exitFullscreen()?.catch(() => {})
        else setExpanded(false)
      }
      if (e.key === 'Tab') {
        const items = [...(containerRef.current?.querySelectorAll('button:not(:disabled), input, summary, [href], [tabindex="0"]') || [])].filter(el => el.getClientRects?.().length !== 0)
        if (!items.length) return
        const first = items[0], last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', keys)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', keys)
      button?.focus({ preventScroll: true })
    }
  }, [expanded, containerRef])
  return { expanded, toggleFullscreen, buttonRef }
}

// One press opens an article; holding opens actions without also following it.
function useNodeLongPress(onMenu) {
  const pending = useRef(null), suppressed = useRef('')
  const cancel = () => { if (pending.current) clearTimeout(pending.current.timer); pending.current = null }
  useEffect(() => cancel, [])
  return {
    start(id, e, trigger) {
      cancel()
      suppressed.current = ''
      if (!['touch', 'pen'].includes(e.pointerType)) return
      const press = { id, x: e.clientX, y: e.clientY, trigger, timer: null }
      press.timer = setTimeout(() => {
        if (pending.current !== press) return
        suppressed.current = id
        pending.current = null
        onMenu?.(id, { clientX: press.x, clientY: press.y, trigger: press.trigger })
      }, 500)
      pending.current = press
    },
    move(e) { const p = pending.current; if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4) cancel() },
    cancel,
    consume(id, clear = true) { if (suppressed.current !== id) return false; if (clear) suppressed.current = ''; return true },
  }
}

function contextPoint(e) {
  const trigger = e.currentTarget, box = trigger.getBoundingClientRect()
  return { clientX: e.clientX || box.left + box.width / 2, clientY: e.clientY || box.top + box.height / 2, trigger }
}

function contextPosition(point, width = 280, height = 160) {
  const vw = (typeof document !== 'undefined' && document.documentElement?.clientWidth) || (typeof window !== 'undefined' && window.innerWidth) || 1200
  const vh = (typeof document !== 'undefined' && document.documentElement?.clientHeight) || (typeof window !== 'undefined' && window.innerHeight) || 800
  const maxWidth = Math.max(0, vw - 16)
  return { x: clamp(point.clientX, 8, Math.max(8, vw - Math.min(width, maxWidth) - 8)), y: clamp(point.clientY, 8, Math.max(8, vh - height - 8)), maxWidth }
}

function NodeContextMenu({ node, point, onClose, onSelect, onOpen, portalTarget }) {
  const menu = useRef(null)
  const [position, setPosition] = useState(() => contextPosition(point))
  const isEntity = node.type === 'entity'
  // Notícias e entidades abrem um site externo; os demais pontos abrem uma página do painel.
  let href = null
  if (node.type === 'news') href = canonicalNewsUrl(node.href)
  else if (isEntity && /^https:\/\//.test(node.href || '')) href = node.href
  const canOpen = node.type === 'news' || isEntity ? Boolean(href) : canOpenRoute(node.route)
  useEffect(() => {
    const el = menu.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPosition(contextPosition(point, rect.width, rect.height))
    el.querySelector('[role="menuitem"]:not([aria-disabled="true"])')?.focus({ preventScroll: true })
    const outside = e => { if (!el.contains(e.target)) onClose() }
    const dismiss = () => onClose()
    document.addEventListener('pointerdown', outside, true)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    window.addEventListener('wheel', dismiss, { capture: true, passive: true })
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('wheel', dismiss, true)
    }
  }, [point, onClose])
  return createPortal(<div ref={menu} className="km-context-menu" role="menu" aria-label="Ações do ponto" style={{ left: position.x, top: position.y, maxWidth: position.maxWidth }} onContextMenu={e => e.preventDefault()} onKeyDown={e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(true) }
    if (e.key === 'Tab') onClose()
    const items = [...menu.current.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')]
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault()
      const at = items.indexOf(document.activeElement)
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (at + (e.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length
      items[next]?.focus({ preventScroll: true })
    }
  }}>
    <p className="km-context-title">{node.label}</p>
    {href ? <a role="menuitem" href={href} target="_blank" rel="noopener noreferrer" onClick={() => onClose()}>{isEntity ? 'Abrir site oficial ↗' : 'Ir para a página ↗'}</a> : <button type="button" role="menuitem" aria-disabled={!canOpen || undefined} disabled={!canOpen} onClick={() => onOpen(node)}>Ir para a página ↗</button>}
    {!canOpen && <p className="km-context-unavailable">{['category', 'classification'].includes(node.subtype) ? 'Este ponto organiza o mapa e não tem página própria.' : isEntity ? 'Sem site indicado. Pesquise pelo nome.' : 'Página ainda não disponível.'}</p>}
    <button type="button" role="menuitem" onClick={() => { onSelect(node.id); onClose(true) }}>Ver conexões</button>
  </div>, portalTarget || document.fullscreenElement || document.body)
}

function GraphSurface({ graph, selectedId, onSelect, onActivate = onSelect, onContextMenu, paused, reduced, restart, cameraReset, labels }) {
  const stage = useRef(null)
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const pinned = useRef(null)
  const cameraRef = useRef({ x: 0, y: 0, k: 1 })
  const cameraMotion = useRef(null), fitted = useRef('')
  const [camera, setCamera] = useState(cameraRef.current)
  const [fitting, setFitting] = useState(false)
  const [size, setSize] = useState({ width: 900, height: 540 })
  const [, draw] = useState(0)
  const [hover, setHover] = useState('')
  const [wake, setWake] = useState(0)
  const hold = useNodeLongPress(onContextMenu)
  useEffect(() => {
    if (!stage.current) return
    const update = () => {
      const r = stage.current?.getBoundingClientRect()
      if (r) setSize(old => old.width === r.width && old.height === r.height ? old : { width: Math.max(240, r.width), height: r.height })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(stage.current)
    return () => observer.disconnect()
  }, [])
  const priorLayout = useRef(null)
  const layout = useMemo(() => {
    const value = createKnowledgeLayout(graph.nodes, graph.links, size.width, size.height)
    const prior = priorLayout.current
    if (selectedId) {
      focusKnowledgeLayout(value, selectedId)
      const previous = new Map(prior?.nodes.map(n => [n.id, n]))
      if (prior?.focusId === selectedId && prior.width === size.width && prior.height === size.height && previous.size === value.nodes.length && value.nodes.every(n => previous.has(n.id))) {
        for (const node of value.nodes) {
          const old = previous.get(node.id)
          for (const key of ['x', 'y', 'vx', 'vy', 'anchorX', 'anchorY']) node[key] = old[key]
        }
      } else for (let n = 0; n < 45; n++) stepKnowledgeLayout(value, { energy: 0.6 })
    } else if (prior?.width === size.width && prior?.height === size.height) {
      const previous = new Map(prior.nodes.map(n => [n.id, n]))
      for (const node of value.nodes) {
        const old = previous.get(node.id)
        if (old) { node.x = old.x; node.y = old.y; node.vx = old.vx; node.vy = old.vy }
      }
    } else {
      for (let n = 0; n < 65; n++) stepKnowledgeLayout(value, { energy: 0.7 })
    }
    priorLayout.current = value
    return value
  }, [graph.nodes, graph.links, size, selectedId])
  const nodeMap = useMemo(() => new Map(layout.nodes.map(n => [n.id, n])), [layout])
  const degrees = useMemo(() => {
    const counts = new Map()
    for (const link of graph.links) for (const id of [link.source, link.target]) counts.set(id, (counts.get(id) || 0) + 1)
    return counts
  }, [graph.links])
  const neighbors = useMemo(() => {
    const id = hover || selectedId
    const ids = new Set(id ? [id] : [])
    for (const link of graph.links) {
      if (link.source === id) ids.add(link.target)
      if (link.target === id) ids.add(link.source)
    }
    return ids
  }, [graph.links, selectedId, hover])
  const fitKey = `${selectedId}|${size.width}|${size.height}|${cameraReset}|${graph.nodes.map(n => n.id).join(',')}`
  const compactFocus = Boolean(selectedId) && size.width <= 600
  const narrowFocus = compactFocus && size.width < 300
  const framing = useMemo(() => ({ padding: { top: 36, right: narrowFocus ? 48 : 64, bottom: 60, left: narrowFocus ? 16 : 24 }, selectedId, labelMaxLength: narrowFocus ? 16 : selectedId && !compactFocus ? 52 : 26, minLabelFontSize: compactFocus ? 11 : 0 }), [selectedId, compactFocus, narrowFocus])
  useEffect(() => () => { stopCamera(false); fitted.current = '' }, [])
  useEffect(() => {
    if (fitted.current === fitKey && !(reduced && cameraMotion.current !== null)) return
    fitted.current = fitKey
    stopCamera()
    const target = fitKnowledgeCamera(layout.nodes, size.width, size.height, framing)
    if (reduced) { changeCamera(target); return }
    setFitting(true)
    const from = cameraRef.current
    let started
    const animate = time => {
      started ??= time
      const t = Math.min(1, (time - started) / 360), ease = 1 - (1 - t) ** 3
      changeCamera({ x: from.x + (target.x - from.x) * ease, y: from.y + (target.y - from.y) * ease, k: from.k + (target.k - from.k) * ease })
      cameraMotion.current = t < 1 ? requestAnimationFrame(animate) : null
      if (t === 1) setFitting(false)
    }
    cameraMotion.current = requestAnimationFrame(animate)
  }, [fitKey, layout, size, framing, reduced])
  useEffect(() => {
    if (paused || reduced) return
    let frame, ticks = 0, last = 0
    const tick = time => {
      if (!document.hidden && time - last >= 30) {
        last = time
        stepKnowledgeLayout(layout, { energy: Math.max(0.035, Math.exp(-ticks / 90)), pinnedId: pinned.current?.id, pinnedPosition: pinned.current })
        ticks++
        draw(n => n + 1)
      }
      if (ticks < 380) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [layout, paused, reduced, restart, wake])
  function changeCamera(value) {
    cameraRef.current = value
    setCamera(value)
  }
  function stopCamera(update = true) { if (cameraMotion.current !== null) cancelAnimationFrame(cameraMotion.current); cameraMotion.current = null; if (update) setFitting(false) }
  function zoom(factor, at) {
    stopCamera()
    const c = cameraRef.current, k = clamp(c.k * factor, 0.15, 4)
    const p = at || { x: size.width / 2, y: size.height / 2 }
    changeCamera({ k, x: p.x - (p.x - c.x) * k / c.k, y: p.y - (p.y - c.y) * k / c.k })
  }
  useEffect(() => {
    const el = stage.current
    const wheel = e => {
      e.preventDefault()
      stopCamera()
      const r = el.getBoundingClientRect(), c = cameraRef.current
      const k = clamp(c.k * Math.exp(-e.deltaY * 0.0015), 0.15, 4)
      const x = e.clientX - r.left, y = e.clientY - r.top
      cameraRef.current = { k, x: x - (x - c.x) * k / c.k, y: y - (y - c.y) * k / c.k }
      setCamera(cameraRef.current)
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])
  function point(e) {
    const r = stage.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  function pointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    stopCamera()
    stage.current.setPointerCapture(e.pointerId)
    const p = point(e)
    pointers.current.set(e.pointerId, p)
    if (pointers.current.size === 2) {
      hold.cancel()
      const [a, b] = [...pointers.current.values()]
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, c = cameraRef.current
      gesture.current = { mode: 'pinch', distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), world: { x: (mid.x - c.x) / c.k, y: (mid.y - c.y) / c.k }, camera: c }
      pinned.current = null
      return
    }
    const id = e.target.closest?.('[data-node-id]')?.getAttribute('data-node-id')
    if (id) { setWake(v => v + 1); hold.start(id, e, e.target.closest('[data-node-id]')) }
    gesture.current = { mode: id ? 'node' : 'pan', id, start: p, camera: cameraRef.current, moved: false }
  }
  function pointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return
    hold.move(e)
    const p = point(e)
    pointers.current.set(e.pointerId, p)
    const g = gesture.current
    if (!g) return
    if (g.mode === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const k = clamp(g.camera.k * Math.hypot(a.x - b.x, a.y - b.y) / g.distance, 0.15, 4)
      changeCamera({ k, x: (a.x + b.x) / 2 - g.world.x * k, y: (a.y + b.y) / 2 - g.world.y * k })
      return
    }
    const dx = p.x - g.start.x, dy = p.y - g.start.y
    if (Math.hypot(dx, dy) > 4) g.moved = true
    if (!g.moved) return
    if (g.mode === 'pan') changeCamera({ ...g.camera, x: g.camera.x + dx, y: g.camera.y + dy })
    if (g.mode === 'node') {
      const n = nodeMap.get(g.id), c = cameraRef.current
      if (n) {
        n.x = clamp((p.x - c.x) / c.k, 20, size.width - 20)
        n.y = clamp((p.y - c.y) / c.k, 20, size.height - 20)
        n.vx = 0; n.vy = 0
        pinned.current = { id: n.id, x: n.x, y: n.y }
        draw(v => v + 1)
      }
    }
  }
  function pointerEnd(e) {
    const g = gesture.current
    hold.cancel()
    pointers.current.delete(e.pointerId)
    const held = g?.id ? hold.consume(g.id, false) : false
    if (e.type !== 'pointercancel' && g?.mode === 'node' && !g.moved && !held) onActivate(g.id)
    if (e.type === 'pointercancel') {
      pointers.current.clear()
      gesture.current = null
    } else if (g?.mode === 'pinch' && pointers.current.size === 1) {
      gesture.current = { mode: 'pan', start: [...pointers.current.values()][0], camera: cameraRef.current, moved: true }
    } else if (pointers.current.size === 0) gesture.current = null
    pinned.current = null
  }
  const labelGeometry = n => {
    const selected = n.id === selectedId
    const r = selected ? 11 : n.type === 'sector' && n.subtype !== 'subsector' ? 8 : n.type === 'news' ? 5 : 6
    const font = selected ? 12 : n.type === 'sector' && n.subtype !== 'subsector' ? 10.5 : 9.5
    const fontSize = Math.max(font * Math.sqrt(camera.k), compactFocus ? 11 : 0) / camera.k
    const text = short(n.label, narrowFocus ? 16 : compactFocus ? 26 : neighbors.has(n.id) ? 52 : 26)
    const width = text.length * fontSize * 0.58, y = n.y + r + 15 / Math.sqrt(camera.k)
    return { fontSize, text, y, box: { x: n.x - width / 2, y: y - fontSize, w: width, h: fontSize * 1.2 } }
  }
  const primary = nodeMap.get(hover || selectedId)
  const labelBoxes = primary ? [labelGeometry(primary).box] : [], nodeLabels = []
  return <div className="km-stage" ref={stage} data-camera-fitting={fitting || undefined} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}>
    <svg className="km-svg" viewBox={`0 0 ${size.width} ${size.height}`} role="group" aria-label="Mapa interativo de setores, conceitos e notícias" onKeyDown={e => {
      if (e.target !== e.currentTarget) return
      if (['+', '='].includes(e.key)) { e.preventDefault(); zoom(1.2) }
      if (e.key === '-') { e.preventDefault(); zoom(1 / 1.2) }
      if (e.key === 'Escape' && !stage.current.closest('.is-fullscreen')) { e.preventDefault(); onSelect('') }
    }} tabIndex={0}>
      <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.k})`}>
        {layout.links.map(link => {
          const a = nodeMap.get(link.source), b = nodeMap.get(link.target)
          const active = (hover || selectedId) && (link.source === (hover || selectedId) || link.target === (hover || selectedId))
          return a && b && <line key={link.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`km-edge${active ? ' is-active' : ''}${a.type === 'news' || b.type === 'news' ? ' is-news' : ''}${neighbors.size && !active ? ' is-dim' : ''}`}><title>{`${link.label}: ${link.reason}`}</title></line>
        })}
        {layout.nodes.map((n, i) => {
          const selected = n.id === selectedId, active = neighbors.has(n.id)
          const label = labelGeometry(n)
          let showLabel = labels || active || camera.k > 1.65 || n.id.startsWith('sector:') && n.subtype === 'sector' || (degrees.get(n.id) || 0) >= 6
          if (showLabel && !labels && !selected && n.id !== hover) {
            const box = label.box
            if (labelBoxes.some(b => box.x < b.x + b.w + 5 && box.x + box.w + 5 > b.x && box.y < b.y + b.h + 3 && box.y + box.h + 3 > b.y)) showLabel = false
            else labelBoxes.push(box)
          }
          const r = selected ? 11 : n.type === 'sector' && n.subtype !== 'subsector' ? 8 : n.type === 'news' ? 5 : 6
          if (showLabel) nodeLabels.push(<text key={n.id} x={n.x} y={label.y} textAnchor="middle" className={`km-label${selected ? ' is-selected' : ''}${neighbors.size && !active ? ' is-dim' : ''}`} style={{ fontSize: `${label.fontSize}px` }}>{label.text}</text>)
          return <g key={n.id} data-node-id={n.id} className={`km-node km-${n.type}${selected ? ' is-selected' : ''}${neighbors.size && !active ? ' is-dim' : ''}`} transform={`translate(${n.x} ${n.y})`} role="button" tabIndex={selected || !selectedId && i === 0 ? 0 : -1} aria-label={`${n.label} · ${n.type === 'news' ? 'Notícia' : n.type === 'concept' ? 'Conceito' : 'Setor'}`} aria-pressed={selected} aria-haspopup="menu" onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(n.id, contextPoint(e)) }} onPointerEnter={e => { if (e.pointerType === 'mouse' && !gesture.current) setHover(n.id) }} onPointerLeave={() => setHover('')} onClick={e => { if (e.detail === 0 && !hold.consume(n.id)) onActivate(n.id) }} onKeyDown={e => {
            if (e.key === 'ContextMenu' || e.key === 'F10' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); onContextMenu?.(n.id, contextPoint(e)); return }
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onActivate(n.id) }
            if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
              e.preventDefault(); e.stopPropagation()
              const next = layout.nodes[(i + (['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 1) + layout.nodes.length) % layout.nodes.length]
              const elements = stage.current.querySelectorAll('[data-node-id]')
              for (const el of elements) if (el.getAttribute('data-node-id') === next.id) { el.focus(); break }
            }
          }}>
            <title>{n.label}</title>
            <circle className="km-hit" r={Math.max(15, 22 / camera.k)} />
            {selected && <circle className="km-halo" r={18} />}
            {n.type === 'news' ? <rect className="km-dot" x={-r} y={-r} width={r * 2} height={r * 2} rx={1.5} transform="rotate(45)" /> : n.type === 'entity' ? <rect className="km-dot" x={-r} y={-r} width={r * 2} height={r * 2} rx={2} /> : <circle className="km-dot" r={r} />}

          </g>
        })}
        <g aria-hidden="true" className="km-label-layer">{nodeLabels}</g>
      </g>
    </svg>
    <div className="km-zoom" aria-label="Zoom do mapa" onPointerDown={e => e.stopPropagation()}>
      <button type="button" aria-label="Aproximar mapa" onClick={() => zoom(1.25)}>+</button>
      <span aria-live="polite">{Math.round(camera.k * 100)}%</span>
      <button type="button" aria-label="Afastar mapa" onClick={() => zoom(0.8)}>−</button>
      <button type="button" aria-label="Centralizar mapa" onClick={() => { stopCamera(); changeCamera(fitKnowledgeCamera(layout.nodes, size.width, size.height, framing)) }}>⌖</button>
    </div>
    <p className="km-hint">Arraste para explorar · notícia: clique para ler · segure ou use botão direito para opções</p>
    {!layout.nodes.length && <div className="km-empty"><strong>Nenhum ponto encontrado</strong><p>Ajuste a busca ou os filtros.</p></div>}
  </div>
}

export default function KnowledgeMap({ goto, sectorContext, compact = false }) {
  const anchorId = sectorContext ? `subsector:${sectorContext.group}:${sectorContext.topicIndex}` : ''
  const memory = sectorContext ? `${MEMORY}:${anchorId}` : MEMORY
  const sectorNews = useDataFile('sector-news.json'), news = useDataFile('news.json'), temas = useDataFile('temas.json'), curadoria = useDataFile('curadoria-noticias.json'), archive = useDataFile('knowledge-news.json')
  const now = useNewsClock(), reduced = useReducedMotion()
  const [view, setView] = useState(() => savedView(memory, anchorId))
  const [paused, setPaused] = useState(false)
  const [restart, setRestart] = useState(0)
  const [cameraReset, setCameraReset] = useState(0)
  // mapa completo no celular (abaixo de 700 px): abre na Lista, mais legível que o grafo cheio numa tela estreita;
  // o Grafo continua a um toque. O recorte de um estudo setorial é pequeno e segue abrindo no grafo.
  const [list, setList] = useState(() => !sectorContext && typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 699px)').matches)
  const [labels, setLabels] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const container = useRef(null)
  const { expanded, toggleFullscreen, buttonRef } = useMapFullscreen(container)
  const detail = useRef(null)
  const [context, setContext] = useState(null)
  const fullGraph = useMemo(() => buildKnowledgeGraph({ sectorNews: sectorNews.data, news: news.data, temas: temas.data, curadoria: curadoria.data, archive: archive.data, now }), [sectorNews.data, news.data, temas.data, curadoria.data, archive.data, now])
  const graph = useMemo(() => sectorContext ? buildSectorKnowledgeGraph(fullGraph, sectorContext) : fullGraph, [fullGraph, sectorContext])
  const filtered = useMemo(() => getKnowledgeView(graph, { ...view, maxNews: list ? Number.MAX_SAFE_INTEGER : 36 }), [graph, view, list])
  const selected = filtered.nodes.find(n => n.id === view.selectedId)
  const relations = selected ? graph.links.filter(l => l.source === selected.id || l.target === selected.id).map(l => ({ ...l, node: graph.nodes.find(n => n.id === (l.source === selected.id ? l.target : l.source)) })).filter(l => l.node) : []
  const sources = [sectorNews, news, temas, curadoria, archive]
  const loading = sources.every(s => s.status === 'loading')
  const unavailable = sources.some(s => s.status === 'error' || s.stale)
  useEffect(() => {
    const timer = setTimeout(() => { try { sessionStorage.setItem(memory, JSON.stringify(view)) } catch { /* this visit still works */ } }, 100)
    return () => clearTimeout(timer)
  }, [view, memory])
  const contextNode = context && graph.nodes.find(node => node.id === context.id)
  function closeContext(restoreFocus = false) {
    const trigger = context?.trigger
    setContext(null)
    if (restoreFocus && trigger?.isConnected !== false) trigger?.focus?.({ preventScroll: true })
  }
  function openContext(id, point) {
    if (graph.nodes.some(node => node.id === id)) setContext({ id, ...point })
  }
  const cardHold = useNodeLongPress(openContext)
  function openPage(node) {
    if (!node) return
    // Save the map before an internal route can unmount it.
    try { sessionStorage.setItem(memory, JSON.stringify(view)) } catch { /* current visit remains usable */ }
    closeContext()
    if (node.type === 'news') {
      const href = canonicalNewsUrl(node.href)
      if (href) window.open(href, '_blank', 'noopener,noreferrer')
    } else if (canOpenRoute(node.route)) goto(node.route.tab, node.route.view)
  }
  function activate(id) {
    const node = graph.nodes.find(item => item.id === id)
    if (node?.type === 'news') openPage(node)
    else select(id)
  }
  function nodeActions(node) {
    return {
      'aria-haspopup': 'menu',
      onClick: () => { if (!cardHold.consume(node.id)) activate(node.id) },
      onContextMenu: e => { e.preventDefault(); openContext(node.id, contextPoint(e)) },
      onPointerDown: e => cardHold.start(node.id, e, e.currentTarget),
      onPointerMove: e => cardHold.move(e),
      onPointerUp: () => cardHold.cancel(),
      onPointerCancel: () => cardHold.cancel(),
      onKeyDown: e => { if (e.key === 'ContextMenu' || e.key === 'F10' && e.shiftKey) { e.preventDefault(); openContext(node.id, contextPoint(e)) } },
    }
  }
  function select(id) {
    setContext(null)
    setDetailOpen(false)
    setView(v => ({ ...v, selectedId: id, local: Boolean(id), query: '', types: TYPES.map(t => t.id) }))
  }
  function reset() {
    setContext(null)
    setView({ query: '', types: TYPES.map(t => t.id), selectedId: anchorId, local: false })
    setRestart(v => v + 1)
    setCameraReset(v => v + 1)
    setPaused(false)
  }
  function toggleType(id) {
    setContext(null)
    setView(v => ({ ...v, types: v.types.includes(id) ? v.types.filter(t => t !== id) : [...v.types, id], selectedId: '', local: false }))
  }
  return <section ref={container} className={`knowledge-map${sectorContext ? ' is-contextual' : ''}${compact ? ' is-compact' : ''}${expanded ? ' is-fullscreen' : ''}`} aria-labelledby="km-title" role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined}>
    <header className="km-heading"><div><p className="km-eyebrow">{sectorContext ? 'ESTUDO SETORIAL · EXPLORAR CONEXÕES' : 'APRENDER · EXPLORAR CONEXÕES'}</p><h2 id="km-title">{sectorContext ? `Conexões · ${sectorContext.study.title}` : 'Mapa do conhecimento'}</h2><p>{sectorContext ? 'Conexões do estudo com conteúdos do painel. Selecione um ponto para ver o vínculo e abrir a página.' : 'Setores, conceitos e as notícias que os conectam.'}</p></div><Help label="Como explorar o mapa" wide portalTarget={expanded ? container.current : undefined}><p>Arraste um ponto para reorganizar a rede. Arraste o fundo para mover o mapa. Use a roda do mouse, a pinça com dois dedos ou os botões de zoom.</p><p>Ao selecionar um ponto, suas conexões se organizam e o enquadramento se ajusta à área disponível. Use Tela cheia para ampliar o mapa e Sair da tela cheia ou Escape para voltar. Centralizar mapa recupera o enquadramento após arrastar ou dar zoom.</p><p>Clique em uma notícia para ler a matéria em outra aba. Nos demais pontos, o clique abre as conexões diretas. Use o botão direito, segure no celular ou pressione Shift+F10 para acessar Ir para a página e Ver conexões. Use {sectorContext ? 'Voltar ao setor para retornar ao recorte deste estudo' : 'Voltar à matriz para retornar à rede completa'}. As linhas indicam relações editoriais ou correspondências temáticas, não comprovam causalidade ou impacto financeiro.</p><p>Notícias válidas sem correspondência temática ficam ligadas a Outras notícias, sem associação setorial presumida. Notícias: publicação original nas últimas 168 horas. Sem horário confirmado, a inclusão é conservadora. A atualização da coleta não renova a publicação. A cobertura é parcial; a ausência de matéria não significa ausência de fatos.</p><p>Use Lista para navegar pelos nomes; no grafo, as setas percorrem os pontos e Enter realiza a mesma ação do clique. O movimento respeita a preferência do dispositivo.</p></Help></header>
    {compact ? <details className="km-controls"><summary>Opções do mapa</summary>
    <div className="km-toolbar"><label className="km-search"><span className="sr-only">Buscar no mapa</span><input aria-label="Buscar no mapa" type="search" placeholder={graph.meta.hasEntities ? 'Buscar setor, associação, player ou notícia…' : 'Buscar setor, conceito ou notícia…'} value={view.query} onChange={e => { setContext(null); setView(v => ({ ...v, query: e.target.value, local: false })) }} /></label><div className="km-switch" aria-label="Visualização"><button type="button" aria-pressed={!list} onClick={() => { setContext(null); setList(false) }}>Grafo</button><button type="button" aria-pressed={list} onClick={() => { setContext(null); setList(true) }}>Lista</button></div><button type="button" className="km-reset" onClick={reset}>{sectorContext ? 'Voltar ao setor' : 'Voltar à matriz'}</button><button ref={buttonRef} type="button" className="km-reset km-fullscreen" aria-label={expanded ? 'Sair da tela cheia' : 'Tela cheia'} aria-pressed={expanded} onClick={() => { setContext(null); toggleFullscreen() }}><span className="km-fullscreen-label">{expanded ? 'Sair da tela cheia' : 'Tela cheia'}</span><span className="km-fullscreen-short" aria-hidden="true">Sair</span></button></div>
    <div className="km-options"><div className="km-types" role="group" aria-label="Mostrar no mapa">{TYPES.filter(type => type.id !== 'entity' || graph.meta.hasEntities).map(type => <button key={type.id} type="button" className={`km-filter km-${type.id}`} aria-pressed={view.types.includes(type.id)} onClick={() => toggleType(type.id)}><i aria-hidden="true" />{type.label}</button>)}</div><div className="km-actions"><button type="button" aria-pressed={labels} onClick={() => setLabels(v => !v)}>Nomes</button><button type="button" aria-pressed={paused || reduced} disabled={reduced} onClick={() => { setPaused(v => !v); setRestart(v => v + 1) }}>{reduced ? 'Movimento reduzido' : paused ? 'Retomar movimento' : 'Pausar movimento'}</button></div></div>
    </details> : null}
    {!compact && <>
    <div className="km-toolbar"><label className="km-search"><span className="sr-only">Buscar no mapa</span><input aria-label="Buscar no mapa" type="search" placeholder={graph.meta.hasEntities ? 'Buscar setor, associação, player ou notícia…' : 'Buscar setor, conceito ou notícia…'} value={view.query} onChange={e => { setContext(null); setView(v => ({ ...v, query: e.target.value, local: false })) }} /></label><div className="km-switch" aria-label="Visualização"><button type="button" aria-pressed={!list} onClick={() => { setContext(null); setList(false) }}>Grafo</button><button type="button" aria-pressed={list} onClick={() => { setContext(null); setList(true) }}>Lista</button></div><button type="button" className="km-reset" onClick={reset}>{sectorContext ? 'Voltar ao setor' : 'Voltar à matriz'}</button><button ref={buttonRef} type="button" className="km-reset km-fullscreen" aria-label={expanded ? 'Sair da tela cheia' : 'Tela cheia'} aria-pressed={expanded} onClick={() => { setContext(null); toggleFullscreen() }}><span className="km-fullscreen-label">{expanded ? 'Sair da tela cheia' : 'Tela cheia'}</span><span className="km-fullscreen-short" aria-hidden="true">Sair</span></button></div>
    <div className="km-options"><div className="km-types" role="group" aria-label="Mostrar no mapa">{TYPES.filter(type => type.id !== 'entity' || graph.meta.hasEntities).map(type => <button key={type.id} type="button" className={`km-filter km-${type.id}`} aria-pressed={view.types.includes(type.id)} onClick={() => toggleType(type.id)}><i aria-hidden="true" />{type.label}</button>)}</div><div className="km-actions"><button type="button" aria-pressed={labels} onClick={() => setLabels(v => !v)}>Nomes</button><button type="button" aria-pressed={paused || reduced} disabled={reduced} onClick={() => { setPaused(v => !v); setRestart(v => v + 1) }}>{reduced ? 'Movimento reduzido' : paused ? 'Retomar movimento' : 'Pausar movimento'}</button></div></div>
    </>}
    <div className="km-workspace">
      <div className="km-visual">{list ? <div className="km-list" aria-label="Pontos do mapa">{filtered.nodes.length ? filtered.nodes.map(n => <button type="button" key={n.id} className={`km-list-item km-${n.type}${selected?.id === n.id ? ' is-selected' : ''}`} aria-pressed={selected?.id === n.id} {...nodeActions(n)}><span className="km-list-type">{nodeKind(n)}</span><strong>{n.label}</strong>{n.type === 'news' && <small>{n.source} · {knowledgePublicationLabel(n)}</small>}</button>) : <p className="km-empty-list">Nenhum ponto encontrado. Ajuste a busca ou os filtros.</p>}</div> : <GraphSurface graph={filtered} selectedId={selected?.id || ''} onSelect={select} onActivate={activate} onContextMenu={openContext} paused={paused || Boolean(contextNode)} reduced={reduced} restart={restart} cameraReset={cameraReset} labels={labels} />}
        <p className="km-count" role="status">{filtered.nodes.length} {filtered.nodes.length === 1 ? 'ponto' : 'pontos'} · {filtered.links.length} {filtered.links.length === 1 ? 'conexão' : 'conexões'} · {filtered.meta.visibleNews} de {graph.meta.newsCount} notícias · 7 dias{filtered.meta.hiddenNews > 0 && ' · use a busca ou Lista para explorar as demais'}</p>
      </div>
      <aside className={`km-detail${detailOpen ? ' is-open' : ''}`} ref={detail} aria-label="Detalhes do ponto selecionado" aria-live="polite">
        {selected && <button type="button" className="km-detail-toggle" aria-expanded={detailOpen} aria-controls="km-detail-content" onClick={() => setDetailOpen(v => !v)}>Detalhes · {short(selected.label, 28)} <span aria-hidden="true">{detailOpen ? '▾' : '▴'}</span></button>}
        <div className="km-detail-content" id="km-detail-content">
        {selected ? <><div className={`km-detail-type km-${selected.type}`}>{selected.type === 'news' ? 'NOTÍCIA · 7 DIAS' : nodeKind(selected).toUpperCase()}<button type="button" onClick={() => select('')} aria-label="Fechar detalhes">×</button></div><h3 aria-label={sectorContext ? `Detalhes: ${selected.label}` : undefined}>{selected.label}</h3><button type="button" className="km-more-options" aria-haspopup="menu" onClick={e => openContext(selected.id, contextPoint(e))}>Mais opções</button>{selected.type === 'news' && <p className="km-publication">{selected.source}<br /><time dateTime={selected.publishedAt}>{knowledgePublicationLabel(selected)}</time>{selected.datePrecision === 'day' && ' · horário não informado'}</p>}<p>{(selected.body || selected.glossaryBody) ? selected.summary.split('\n\n')[0] : selected.summary}</p>
          {canOpenRoute(selected.route) && <button type="button" className="km-open" onClick={() => openPage(selected)}>Abrir {selected.subtype === 'glossary' ? 'área relacionada' : selected.type === 'concept' ? 'conceito' : 'setor'} ↗</button>}
          {(selected.body || selected.glossaryBody) && <details><summary>Ler explicação completa</summary>{(selected.body || selected.glossaryBody).split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}</details>}
          {selected.subtype === 'glossary' && <p className="km-relation-note">{selected.route ? 'O botão abre a área do painel; a explicação completa está disponível aqui.' : 'A explicação está disponível aqui; não há atalho confirmado para uma página específica.'}</p>}
          {selected.href && <a className="km-open" href={selected.href} target="_blank" rel="noopener noreferrer">{selected.type === 'entity' ? 'Abrir site oficial ↗' : 'Ler na fonte ↗'}</a>}
          {selected.type === 'entity' && <p className="km-relation-note">Lista editorial revisada em {selected.reviewedAt.split('-').reverse().join('/')}. {selected.role ? 'O papel é leitura editorial: confirme com a empresa.' : 'Confira no site oficial: nomes e endereços mudam.'}</p>}{selected.type === 'entity' && !selected.href && <p className="km-relation-note">Sem site indicado nesta lista. Pesquise pelo nome para encontrar dados oficiais.</p>}
          {selected.licenseUrl && <a className="km-license" href={selected.licenseUrl} target="_blank" rel="noopener noreferrer">Licença de uso</a>}
          <div className="km-detail-divider"><h4>Conexões <span>{relations.length}</span></h4><span className="km-focus-label">Conexões diretas</span></div>
          {relations.length ? <ul className="km-relations">{relations.map(l => <li key={l.id}><span>{l.label}</span><button type="button" {...nodeActions(l.node)}>{l.node.label} ›</button><p>{l.reason}</p></li>)}</ul> : <p>Ainda não há conexões verificadas para este ponto.</p>}
          <p className="km-relation-note">As conexões indicam relações de conteúdo. Não comprovam causa ou impacto.</p>
        </> : <div className="km-welcome"><svg className="km-welcome-symbol" aria-hidden="true" viewBox="0 0 80 60" width="68" height="52"><path d="M14 38L38 12L66 32L42 50Z M38 12L42 50 M14 38L66 32" fill="none" stroke="currentColor" strokeWidth="1"/>{[[14,38],[38,12],[66,32],[42,50]].map(([x,y])=><circle key={x} cx={x} cy={y} r="4" fill="currentColor"/>)}</svg><h3>Uma rede para entender melhor</h3><p>Clique em uma notícia para ler. Nos demais pontos, explore as conexões. Botão direito ou toque prolongado abre as opções de cada ponto.</p><div className="km-welcome-legend"><span><i className="km-sector" />Setores e subsetores</span><span><i className="km-concept" />Conceitos e explicações</span><span><i className="km-news" />Notícias dos últimos 7 dias</span>{graph.meta.hasEntities && <span><i className="km-entity" />Associações, órgãos e players</span>}</div><p className="km-relation-note">Pontos redondos: conhecimento.<br />Losangos e linhas tracejadas: notícias.{graph.meta.hasEntities && <><br />Quadrados: associações, órgãos e players de referência.</>}</p></div>}
        </div>
      </aside>
    </div>
    <div className="km-news-state" role="status">{!sectorContext && graph.meta.pendingNewsCount > 0 && <span>Parte das notícias ainda não foi ligada a um setor; elas continuam na lista. </span>}{loading ? 'Carregando notícias…' : <>{unavailable ? 'Algumas fontes estão indisponíveis ou atrasadas. ' : 'Cobertura parcial das fontes disponíveis. '}{graph.meta.newsCount ? 'Só entram matérias com publicação válida nos últimos 7 dias.' : 'Nenhuma notícia dos últimos 7 dias disponível nesta seleção.'}</>}</div>
    {contextNode && <NodeContextMenu key={contextNode.id} node={contextNode} point={context} onClose={closeContext} onSelect={select} onOpen={openPage} portalTarget={expanded ? container.current : undefined} />}
    <details className="km-coverage"><summary>Fontes e atualização</summary>{graph.meta.hasEntities && <p>Associações, órgãos e players vêm de uma lista editorial revisada em {graph.meta.entitiesReviewedAt.split('-').reverse().join('/')}. Não é ranking, não mede participação de mercado e pode ficar desatualizada: confirme nos sites oficiais.</p>}<p>Janela de publicação: {date(now - 168 * 3600000)} a {date(now)} (168 horas corridas). O mapa reaproveita as bases de notícias do painel; não representa toda a imprensa.</p>{graph.meta.lastUpdatedAt && <p>Última geração de base disponível: {date(graph.meta.lastUpdatedAt)}. Essa data não confirma uma nova consulta a cada fonte.</p>}<ul>{graph.meta.coverageNotes?.map(note => <li key={note}>{note}</li>)}</ul><p>A retenção do mapa guarda matérias elegíveis por até sete dias. Na primeira execução, dias anteriores ausentes nas bases não são recuperados retroativamente.</p></details>
  </section>
}
