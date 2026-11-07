import { useEffect, useMemo, useRef, useState } from 'react'
import { useDataFile } from './useDataFile.js'
import { useNewsClock } from './useNewsClock.js'
import { buildKnowledgeGraph, getKnowledgeView } from './knowledgeGraph.js'
import { createKnowledgeLayout, stepKnowledgeLayout } from './knowledgeLayout.js'
import Help from './Help.jsx'
import './KnowledgeMap.css'

const TYPES = [{ id: 'sector', label: 'Setores' }, { id: 'concept', label: 'Conceitos' }, { id: 'news', label: 'Notícias · 7 dias' }]
const MEMORY = 'painel-knowledge-map-v1'
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const short = (s, n = 28) => s.length > n ? `${s.slice(0, n - 1).trim()}…` : s
const date = t => new Date(t).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
export const knowledgePublicationLabel = node => node.datePrecision === 'day' ? node.publishedAt.split('-').reverse().join('/') : date(node.t)
function savedView() {
  try {
    const v = JSON.parse(sessionStorage.getItem(MEMORY))
    return { query: typeof v?.query === 'string' ? v.query.slice(0, 160) : '', types: Array.isArray(v?.types) ? v.types.filter(t => TYPES.some(x => x.id === t)) : TYPES.map(t => t.id), selectedId: typeof v?.selectedId === 'string' ? v.selectedId : '', local: v?.local === true }
  } catch { return { query: '', types: TYPES.map(t => t.id), selectedId: '', local: false } }
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

function GraphSurface({ graph, selectedId, onSelect, paused, reduced, restart, cameraReset, labels }) {
  const stage = useRef(null)
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const pinned = useRef(null)
  const cameraRef = useRef({ x: 0, y: 0, k: 1 })
  const [camera, setCamera] = useState(cameraRef.current)
  const [size, setSize] = useState({ width: 900, height: 540 })
  const [, draw] = useState(0)
  const [hover, setHover] = useState('')
  const [wake, setWake] = useState(0)
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
    if (prior?.width === size.width && prior?.height === size.height) {
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
  }, [graph.nodes, graph.links, size])
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
  useEffect(() => {
    cameraRef.current = { x: 0, y: 0, k: 1 }
    setCamera(cameraRef.current)
  }, [cameraReset, size])
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
  function zoom(factor, at) {
    const c = cameraRef.current, k = clamp(c.k * factor, 0.45, 4)
    const p = at || { x: size.width / 2, y: size.height / 2 }
    changeCamera({ k, x: p.x - (p.x - c.x) * k / c.k, y: p.y - (p.y - c.y) * k / c.k })
  }
  useEffect(() => {
    const el = stage.current
    const wheel = e => {
      e.preventDefault()
      const r = el.getBoundingClientRect(), c = cameraRef.current
      const k = clamp(c.k * Math.exp(-e.deltaY * 0.0015), 0.45, 4)
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
    stage.current.setPointerCapture(e.pointerId)
    const p = point(e)
    pointers.current.set(e.pointerId, p)
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, c = cameraRef.current
      gesture.current = { mode: 'pinch', distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), world: { x: (mid.x - c.x) / c.k, y: (mid.y - c.y) / c.k }, camera: c }
      pinned.current = null
      return
    }
    const id = e.target.closest?.('[data-node-id]')?.getAttribute('data-node-id')
    if (id) setWake(v => v + 1)
    gesture.current = { mode: id ? 'node' : 'pan', id, start: p, camera: cameraRef.current, moved: false }
  }
  function pointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return
    const p = point(e)
    pointers.current.set(e.pointerId, p)
    const g = gesture.current
    if (!g) return
    if (g.mode === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const k = clamp(g.camera.k * Math.hypot(a.x - b.x, a.y - b.y) / g.distance, 0.45, 4)
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
    pointers.current.delete(e.pointerId)
    if (e.type !== 'pointercancel' && g?.mode === 'node' && !g.moved) onSelect(g.id)
    if (e.type === 'pointercancel') {
      pointers.current.clear()
      gesture.current = null
    } else if (g?.mode === 'pinch' && pointers.current.size === 1) {
      gesture.current = { mode: 'pan', start: [...pointers.current.values()][0], camera: cameraRef.current, moved: true }
    } else if (pointers.current.size === 0) gesture.current = null
    pinned.current = null
  }
  const labelBoxes = [], nodeLabels = []
  return <div className="km-stage" ref={stage} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}>
    <svg className="km-svg" viewBox={`0 0 ${size.width} ${size.height}`} role="group" aria-label="Mapa interativo de setores, conceitos e notícias" onKeyDown={e => {
      if (e.target !== e.currentTarget) return
      if (['+', '='].includes(e.key)) { e.preventDefault(); zoom(1.2) }
      if (e.key === '-') { e.preventDefault(); zoom(1 / 1.2) }
      if (e.key === 'Escape') { e.preventDefault(); onSelect('') }
    }} tabIndex={0}>
      <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.k})`}>
        {layout.links.map(link => {
          const a = nodeMap.get(link.source), b = nodeMap.get(link.target)
          const active = (hover || selectedId) && (link.source === (hover || selectedId) || link.target === (hover || selectedId))
          return a && b && <line key={link.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`km-edge${active ? ' is-active' : ''}${a.type === 'news' || b.type === 'news' ? ' is-news' : ''}${neighbors.size && !active ? ' is-dim' : ''}`}><title>{`${link.label}: ${link.reason}`}</title></line>
        })}
        {layout.nodes.map((n, i) => {
          const selected = n.id === selectedId, active = neighbors.has(n.id)
          let showLabel = labels || active || camera.k > 1.65 || n.id.startsWith('sector:') && n.subtype === 'sector' || (degrees.get(n.id) || 0) >= 6
          if (showLabel && !labels && !active && camera.k <= 1.65) {
            const width = Math.min(26, n.label.length) * 5.6, box = { x: n.x - width / 2, y: n.y + 18, w: width, h: 14 }
            if (labelBoxes.some(b => box.x < b.x + b.w + 5 && box.x + box.w + 5 > b.x && box.y < b.y + b.h + 3 && box.y + box.h + 3 > b.y)) showLabel = false
            else labelBoxes.push(box)
          }
          const r = selected ? 11 : n.type === 'sector' && n.subtype !== 'subsector' ? 8 : n.type === 'news' ? 5 : 6
          if (showLabel) nodeLabels.push(<text key={n.id} x={n.x} y={n.y + r + 15 / Math.sqrt(camera.k)} textAnchor="middle" className={`km-label${selected ? ' is-selected' : ''}${neighbors.size && !active ? ' is-dim' : ''}`} style={{ fontSize: `${(selected ? 12 : n.type === 'sector' && n.subtype !== 'subsector' ? 10.5 : 9.5) / Math.sqrt(camera.k)}px` }}>{short(n.label, active ? 52 : 26)}</text>)
          return <g key={n.id} data-node-id={n.id} className={`km-node km-${n.type}${selected ? ' is-selected' : ''}${neighbors.size && !active ? ' is-dim' : ''}`} transform={`translate(${n.x} ${n.y})`} role="button" tabIndex={selected || !selectedId && i === 0 ? 0 : -1} aria-label={`${n.label} · ${n.type === 'news' ? 'Notícia' : n.type === 'concept' ? 'Conceito' : 'Setor'}`} aria-pressed={selected} onPointerEnter={e => { if (e.pointerType === 'mouse' && !gesture.current) setHover(n.id) }} onPointerLeave={() => setHover('')} onClick={e => { if (e.detail === 0) onSelect(n.id) }} onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelect(n.id) }
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
            {n.type === 'news' ? <rect className="km-dot" x={-r} y={-r} width={r * 2} height={r * 2} rx={1.5} transform="rotate(45)" /> : <circle className="km-dot" r={r} />}

          </g>
        })}
        <g aria-hidden="true" className="km-label-layer">{nodeLabels}</g>
      </g>
    </svg>
    <div className="km-zoom" aria-label="Zoom do mapa" onPointerDown={e => e.stopPropagation()}>
      <button type="button" aria-label="Aproximar mapa" onClick={() => zoom(1.25)}>+</button>
      <span aria-live="polite">{Math.round(camera.k * 100)}%</span>
      <button type="button" aria-label="Afastar mapa" onClick={() => zoom(0.8)}>−</button>
      <button type="button" aria-label="Centralizar mapa" onClick={() => changeCamera({ x: 0, y: 0, k: 1 })}>⌖</button>
    </div>
    <p className="km-hint">Arraste os pontos ou o fundo · aproxime para explorar</p>
    {!layout.nodes.length && <div className="km-empty"><strong>Nenhum ponto encontrado</strong><p>Ajuste a busca ou os filtros.</p></div>}
  </div>
}

export default function KnowledgeMap({ goto }) {
  const sectorNews = useDataFile('sector-news.json'), news = useDataFile('news.json'), temas = useDataFile('temas.json'), curadoria = useDataFile('curadoria-noticias.json'), archive = useDataFile('knowledge-news.json')
  const now = useNewsClock(), reduced = useReducedMotion()
  const [view, setView] = useState(savedView)
  const [paused, setPaused] = useState(false)
  const [restart, setRestart] = useState(0)
  const [cameraReset, setCameraReset] = useState(0)
  const [list, setList] = useState(false)
  const [labels, setLabels] = useState(false)
  const detail = useRef(null)
  const graph = useMemo(() => buildKnowledgeGraph({ sectorNews: sectorNews.data, news: news.data, temas: temas.data, curadoria: curadoria.data, archive: archive.data, now }), [sectorNews.data, news.data, temas.data, curadoria.data, archive.data, now])
  const filtered = useMemo(() => getKnowledgeView(graph, { ...view, maxNews: list ? Number.MAX_SAFE_INTEGER : 36 }), [graph, view, list])
  const selected = filtered.nodes.find(n => n.id === view.selectedId)
  const relations = selected ? graph.links.filter(l => l.source === selected.id || l.target === selected.id).map(l => ({ ...l, node: graph.nodes.find(n => n.id === (l.source === selected.id ? l.target : l.source)) })).filter(l => l.node) : []
  const sources = [sectorNews, news, temas, curadoria, archive]
  const loading = sources.every(s => s.status === 'loading')
  const unavailable = sources.some(s => s.status === 'error' || s.stale)
  useEffect(() => {
    const timer = setTimeout(() => { try { sessionStorage.setItem(MEMORY, JSON.stringify(view)) } catch { /* this visit still works */ } }, 100)
    return () => clearTimeout(timer)
  }, [view])
  function select(id) {
    setView(v => ({ ...v, selectedId: id, local: Boolean(id), query: '', types: TYPES.map(t => t.id) }))
    if (id) setPaused(true)
  }
  function reset() {
    setView({ query: '', types: TYPES.map(t => t.id), selectedId: '', local: false })
    setRestart(v => v + 1)
    setCameraReset(v => v + 1)
    setPaused(false)
  }
  function toggleType(id) {
    setView(v => ({ ...v, types: v.types.includes(id) ? v.types.filter(t => t !== id) : [...v.types, id], selectedId: '', local: false }))
  }
  return <section className="knowledge-map" aria-labelledby="km-title">
    <header className="km-heading"><div><p className="km-eyebrow">APRENDER · EXPLORAR CONEXÕES</p><h2 id="km-title">Mapa do conhecimento</h2><p>Setores, conceitos e as notícias que os conectam.</p></div><Help label="Como explorar o mapa" wide><p>Arraste um ponto para reorganizar a rede. Arraste o fundo para mover o mapa. Use a roda do mouse, a pinça com dois dedos ou os botões de zoom.</p><p>Selecione um ponto para abrir somente ele e suas conexões diretas. Use Voltar à matriz para retornar à rede completa. As linhas indicam relações editoriais ou correspondências temáticas, não comprovam causalidade ou impacto financeiro.</p><p>Notícias: publicação original nas últimas 168 horas. Sem horário confirmado, a inclusão é conservadora. A atualização da coleta não renova a publicação. A cobertura é parcial; a ausência de matéria não significa ausência de fatos.</p><p>Use Lista para navegar pelos nomes; no grafo, as setas percorrem os pontos e Enter seleciona. O movimento respeita a preferência do dispositivo.</p></Help></header>
    <div className="km-toolbar"><label className="km-search"><span className="sr-only">Buscar no mapa</span><input aria-label="Buscar no mapa" type="search" placeholder="Buscar setor, conceito ou notícia…" value={view.query} onChange={e => setView(v => ({ ...v, query: e.target.value, local: false }))} /></label><div className="km-switch" aria-label="Visualização"><button type="button" aria-pressed={!list} onClick={() => setList(false)}>Grafo</button><button type="button" aria-pressed={list} onClick={() => setList(true)}>Lista</button></div><button type="button" className="km-reset" onClick={reset}>Voltar à matriz</button></div>
    <div className="km-options"><div className="km-types" role="group" aria-label="Mostrar no mapa">{TYPES.map(type => <button key={type.id} type="button" className={`km-filter km-${type.id}`} aria-pressed={view.types.includes(type.id)} onClick={() => toggleType(type.id)}><i aria-hidden="true" />{type.label}</button>)}</div><div className="km-actions"><button type="button" aria-pressed={labels} onClick={() => setLabels(v => !v)}>Nomes</button><button type="button" aria-pressed={paused || reduced} disabled={reduced} onClick={() => { setPaused(v => !v); setRestart(v => v + 1) }}>{reduced ? 'Movimento reduzido' : paused ? 'Retomar movimento' : 'Pausar movimento'}</button></div></div>
    <div className="km-workspace">
      <div className="km-visual">{list ? <div className="km-list" aria-label="Pontos do mapa">{filtered.nodes.length ? filtered.nodes.map(n => <button type="button" key={n.id} className={`km-list-item km-${n.type}${selected?.id === n.id ? ' is-selected' : ''}`} aria-pressed={selected?.id === n.id} onClick={() => select(n.id)}><span className="km-list-type">{n.type === 'news' ? 'Notícia' : n.type === 'concept' ? 'Conceito' : n.subtype === 'subsector' ? 'Subsetor' : 'Setor'}</span><strong>{n.label}</strong>{n.type === 'news' && <small>{n.source} · {knowledgePublicationLabel(n)}</small>}</button>) : <p className="km-empty-list">Nenhum ponto encontrado. Ajuste a busca ou os filtros.</p>}</div> : <GraphSurface graph={filtered} selectedId={selected?.id || ''} onSelect={select} paused={paused} reduced={reduced} restart={restart} cameraReset={cameraReset} labels={labels} />}
        <p className="km-count" role="status">{filtered.nodes.length} {filtered.nodes.length === 1 ? 'ponto' : 'pontos'} · {filtered.links.length} {filtered.links.length === 1 ? 'conexão' : 'conexões'} · {filtered.meta.visibleNews} de {graph.meta.newsCount} notícias · 7 dias{filtered.meta.hiddenNews > 0 && ' · use a busca ou Lista para explorar as demais'}</p>
      </div>
      <aside className="km-detail" ref={detail} aria-label="Detalhes do ponto selecionado" aria-live="polite">
        {selected ? <><div className={`km-detail-type km-${selected.type}`}>{selected.type === 'news' ? 'NOTÍCIA · 7 DIAS' : selected.type === 'concept' ? 'CONCEITO' : selected.subtype === 'subsector' ? 'SUBSETOR' : 'SETOR'}<button type="button" onClick={() => select('')} aria-label="Fechar detalhes">×</button></div><h3>{selected.label}</h3>{selected.type === 'news' && <p className="km-publication">{selected.source}<br /><time dateTime={selected.publishedAt}>{knowledgePublicationLabel(selected)}</time>{selected.datePrecision === 'day' && ' · horário não informado'}</p>}<p>{selected.summary}</p>
          {selected.route && <button type="button" className="km-open" onClick={() => goto(selected.route.tab, selected.route.view)}>Abrir {selected.type === 'concept' ? 'conceito' : 'setor'} ↗</button>}
          {selected.href && <a className="km-open" href={selected.href} target="_blank" rel="noopener noreferrer">Ler na fonte ↗</a>}
          {selected.licenseUrl && <a className="km-license" href={selected.licenseUrl} target="_blank" rel="noopener noreferrer">Licença de uso</a>}
          <div className="km-detail-divider"><h4>Conexões <span>{relations.length}</span></h4><span className="km-focus-label">Conexões diretas</span></div>
          {relations.length ? <ul className="km-relations">{relations.map(l => <li key={l.id}><span>{l.label}</span><button type="button" onClick={() => select(l.node.id)}>{l.node.label} ›</button><p>{l.reason}</p></li>)}</ul> : <p>Ainda não há conexões verificadas para este ponto.</p>}
          <p className="km-relation-note">As conexões indicam relações de conteúdo. Não comprovam causa ou impacto.</p>
        </> : <div className="km-welcome"><svg className="km-welcome-symbol" aria-hidden="true" viewBox="0 0 80 60" width="68" height="52"><path d="M14 38L38 12L66 32L42 50Z M38 12L42 50 M14 38L66 32" fill="none" stroke="currentColor" strokeWidth="1"/>{[[14,38],[38,12],[66,32],[42,50]].map(([x,y])=><circle key={x} cx={x} cy={y} r="4" fill="currentColor"/>)}</svg><h3>Uma rede para entender melhor</h3><p>Selecione um ponto para explorar somente ele e suas conexões. Voltar à matriz abre novamente a rede completa.</p><div className="km-welcome-legend"><span><i className="km-sector" />Setores e subsetores</span><span><i className="km-concept" />Conceitos de Aprender</span><span><i className="km-news" />Notícias dos últimos 7 dias</span></div><p className="km-relation-note">Pontos redondos: conhecimento.<br />Losangos e linhas tracejadas: notícias.</p></div>}
      </aside>
    </div>
    <div className="km-news-state" role="status">{loading ? 'Carregando notícias…' : <>{unavailable ? 'Algumas fontes estão indisponíveis ou atrasadas. ' : 'Cobertura parcial das fontes disponíveis. '}{graph.meta.newsCount ? 'Só entram matérias com publicação válida nos últimos 7 dias.' : 'Nenhuma notícia dos últimos 7 dias disponível nesta seleção.'}</>}</div>
    <details className="km-coverage"><summary>Fontes e atualização</summary><p>Janela de publicação: {date(now - 168 * 3600000)} a {date(now)} (168 horas corridas). O mapa reaproveita as bases de notícias do painel; não representa toda a imprensa.</p>{graph.meta.lastUpdatedAt && <p>Última geração de base disponível: {date(graph.meta.lastUpdatedAt)}. Essa data não confirma uma nova consulta a cada fonte.</p>}<ul>{graph.meta.coverageNotes?.map(note => <li key={note}>{note}</li>)}</ul><p>A retenção do mapa guarda matérias elegíveis por até sete dias. Na primeira execução, dias anteriores ausentes nas bases não são recuperados retroativamente.</p></details>
  </section>
}
