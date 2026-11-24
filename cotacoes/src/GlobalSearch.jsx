import { runSearchQueue } from './searchQueue.js'
import { SearchSession } from './searchSession.js'
import { useNewsClock } from './useNewsClock.js'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SEARCH_SOURCES, currentSearchDocument, groupSearchResults, highlightParts, isSearchShortcut, searchDocuments, searchSnippet } from './globalSearch.js'
import { DATA_BASE } from './useQuotes.js'
import { cachedDataFile, DATA_FILE_TTL, loadDataFile } from './useDataFile.js'
import './GlobalSearch.css'

const session = new SearchSession()
const externalFile = file => DATA_BASE && ['quotes.json', 'history.json', 'intraday.json'].includes(file)
const emptyView = { docs: [], sources: [], nextChange: Infinity }
export function SearchHighlight({ text, query }) {
  return highlightParts(String(text || ''),query).map((p,i)=>p.match ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>)
}
const stamp = t => t ? new Date(t).toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo'}) : 'referência não informada'
export default function GlobalSearch({ onNavigate, request }) {
  const [open,setOpen]=useState(false), [query,setQuery]=useState(''), [pending,setPending]=useState(false), [attempt,setAttempt]=useState(0), [limit,setLimit]=useState(60), [staticError,setStaticError]=useState(false)
  const [view, setView] = useState(emptyView)
  const { docs, sources } = view
  const enter = useCallback(() => {
    setView(session.snapshot(Date.now()))
    setAttempt(0)
    setOpen(true)
  }, [])
  const dialog=useRef(null), input=useRef(null), previousFocus=useRef(null)
  const deferred=useDeferredValue(query)
  const [anchor, setAnchor] = useState(null)
  const [bubbleStyle, setBubbleStyle] = useState({})
  const close=()=>setOpen(false)
  useEffect(() => {
    if (!request) return
    if (document.querySelector('dialog:modal, [role="dialog"][aria-modal="true"]:not(dialog)')) return
    previousFocus.current = request.opener
    setAnchor(request.anchor)
    enter()
  }, [request, enter])
  useEffect(() => {
    if (!open || !anchor) return
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      const width = Math.min(640, window.innerWidth - 24)
      const above = Math.max(0, rect.top - 24)
      const below = Math.max(0, window.innerHeight - rect.bottom - 24)
      const useAbove = above >= 240 || above >= below
      const available = useAbove ? above : below
      const height = Math.min(600, Math.max(240, available), window.innerHeight - 32)
      const left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12))
      const top = Math.max(16, Math.min(useAbove ? rect.top - height - 12 : rect.bottom + 12, window.innerHeight - height - 16))
      const visibleAnchor = rect.bottom > 0 && rect.top < window.innerHeight
      setBubbleStyle({ left, top, width, height, '--search-tail-x': `${Math.max(24, Math.min(width - 24, rect.left + rect.width / 2 - left))}px`, '--search-tail-top': useAbove ? '100%' : '-10px', '--search-tail-visibility': visibleAnchor && available >= 240 ? 'visible' : 'hidden' })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, anchor])
  useEffect(()=>{
    const key=e=>{if(isSearchShortcut(e) && (!document.querySelector('dialog:modal, [role="dialog"][aria-modal="true"]:not(dialog)') || dialog.current?.open)){e.preventDefault();if(dialog.current?.open)input.current?.focus();else{previousFocus.current=document.activeElement;setAnchor(null);enter()}}}
    document.addEventListener('keydown',key)
    return()=>document.removeEventListener('keydown',key)
  },[enter])
  useEffect(()=>{
    const el=dialog.current
    if(!open){if(el.open)el.close();return}
    el.showModal();input.current?.focus();const overflow=document.body.style.overflow;document.body.style.overflow='hidden'
    return()=>{if(el.open)el.close();document.body.style.overflow=overflow;const back=previousFocus.current?.isConnected ? previousFocus.current : null;back?.focus({preventScroll:true})}
  },[open])
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const now = Date.now(), retry = attempt > 0
    const due = SEARCH_SOURCES.filter(([file]) => session.needsLoad(file, externalFile(file) ? null : cachedDataFile(file), now, DATA_FILE_TTL, retry))
    if (session.catalog && !due.length) { setPending(false); return }
    setPending(true)
    let frame = null
    const publish = () => {
      cancelAnimationFrame(frame)
      frame = null
      setView(session.snapshot(Date.now()))
    }
    // O catálogo aparece assim que chega. Fontes que terminam no mesmo quadro aparecem juntas.
    const schedule = () => { if (frame === null) frame = requestAnimationFrame(publish) }
    const loadStatic = session.catalog || import('./searchCatalog.js').then(module => {
      if (controller.signal.aborted) return
      session.setCatalog(module.staticSearchDocuments())
      setStaticError(false)
      publish()
    }).catch(() => { if (!controller.signal.aborted) setStaticError(true) })
    const queue = runSearchQueue(due, {
      signal: controller.signal,
      load: async ([file], signal) => {
        if (externalFile(file)) {
          const response = await fetch(`${DATA_BASE}/${file}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), cache: 'no-cache' })
          if (!response.ok) throw new Error('Indisponível')
          return { data: await response.json() }
        }
        const entry = session.entries.get(file)
        const shared = cachedDataFile(file)
        const force = retry || shared?.stale || (entry && (!entry.ok || entry.stale))
        const result = await loadDataFile(file, Date.now(), force)
        if (!result.data) throw new Error('Dados indisponíveis')
        return result
      },
      accept: (source, result) => { session.accept(source, result, Date.now()); schedule() },
      fail: source => { session.fail(source); schedule() },
    })
    Promise.allSettled([loadStatic, queue]).then(() => {
      if (controller.signal.aborted) return
      publish()
      setPending(false)
    })
    return () => { controller.abort(); cancelAnimationFrame(frame) }
  }, [open, attempt])
  useEffect(() => {
    if (!open) return
    const refresh = () => { if (!document.hidden) setView(session.snapshot(Date.now())) }
    const interval = setInterval(refresh, 60000)
    const delay = view.nextChange - Date.now()
    const boundary = Number.isFinite(delay) && delay < 2147483647 ? setTimeout(refresh, Math.max(0, delay)) : null
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(interval)
      clearTimeout(boundary)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [open, view.nextChange])
  useEffect(() => {
    if (!open) return
    const navigate = () => { previousFocus.current = null; setOpen(false) }
    window.addEventListener('hashchange', navigate)
    window.addEventListener('popstate', navigate)
    return () => { window.removeEventListener('hashchange', navigate); window.removeEventListener('popstate', navigate) }
  }, [open])
  const results=useMemo(()=>open ? searchDocuments(docs,deferred) : [],[open,docs,deferred])
  const shown=results.slice(0,limit)
  const groups=groupSearchResults(shown)
  const failed=sources.filter(s=>!s.ok), stale=sources.filter(s=>s.stale), limited=sources.filter(s=>s.limited)
  const choose=d=>{previousFocus.current=null;setOpen(false);onNavigate(d,query)}
  return <>

    {createPortal(<dialog ref={dialog} className={`global-search-dialog${anchor ? ' global-search-bubble' : ''}`} style={anchor ? bubbleStyle : undefined} aria-labelledby="global-search-heading" onKeyDown={e=>{if(e.key==='Escape' && !e.isComposing){e.preventDefault();e.stopPropagation();close()}}} onCancel={e=>{e.preventDefault();close()}} onClose={()=>{if(!dialog.current?.open)setOpen(false)}} onClick={e=>{if(e.target===dialog.current && (e.clientX<e.currentTarget.getBoundingClientRect().left || e.clientX>e.currentTarget.getBoundingClientRect().right || e.clientY<e.currentTarget.getBoundingClientRect().top || e.clientY>e.currentTarget.getBoundingClientRect().bottom))close()}}>
      <div className="global-search-content"><div className="global-search-head"><h2 id="global-search-heading">Buscar no painel</h2><button type="button" className="btn" onClick={close} aria-label="Fechar busca">Fechar</button></div>
      <label className="global-search-field">Palavra ou expressão<input ref={input} type="search" value={query} onChange={e=>{setQuery(e.target.value);setLimit(60)}} autoComplete="off" spellCheck={false} placeholder="Ex.: inadimplência, FIDC, inflação" aria-describedby="global-search-scope" /></label>
      <details className="global-search-scope"><summary>Sobre a cobertura</summary><p id="global-search-scope">Pesquisa no conteúdo e nos dados disponíveis do painel. Não inclui textos integrais de sites externos nem conteúdo pessoal não salvo.</p></details>
      <div className="global-search-status" role="status" aria-live="polite">{query.trim().length<2 ? 'Digite pelo menos 2 caracteres.' : `${results.length} resultado${results.length===1?'':'s'}${shown.length<results.length ? ` · mostrando ${shown.length}` : ''}.`}{pending && ` Carregando dados das áreas (${sources.length}/${SEARCH_SOURCES.length}); resultados parciais.`}</div>
      {(failed.length>0 || staticError || stale.length>0 || limited.length>0) && <details className="search-coverage"><summary>Cobertura da busca: {failed.length+(staticError?1:0)} indisponível(is){stale.length ? ` · ${stale.length} cópia(s) preservada(s)` : ''}{limited.length ? ' · cobertura parcial' : ''}</summary>{staticError && <p>Conteúdo estático indisponível nesta tentativa.</p>}{failed.map(s=><p key={s.label}>{s.label}: não foi possível ler os dados publicados.</p>)}{stale.map(s=><p key={s.label}>{s.label}: última cópia disponível, de {stamp(s.stamp)}.</p>)}{limited.map(s=><p key={s.label}>{s.label}: limite de tamanho do índice atingido; parte dos registros não foi incluída.</p>)}<button type="button" className="btn" disabled={pending} onClick={()=>setAttempt(a=>a+1)}>Tentar novamente</button></details>}
      {!pending && query.trim().length>=2 && !results.length && <p>Nenhum resultado no conteúdo disponível. Tente outra palavra ou confira a cobertura acima.</p>}
      <div className="global-search-results" aria-busy={pending || deferred!==query}>{groups.map(g=><section key={g.section} aria-label={`Resultados em ${g.section}`}><h3>{g.section} <small>{results.filter(d=>d.section===g.section).length}</small></h3><ul>{g.items.map(d=><li key={d.id}><button type="button" className="global-search-result" onClick={()=>choose(d)}><strong><SearchHighlight text={d.title} query={query}/></strong><small>{d.kind}{d.stamp ? ` · referência do arquivo: ${stamp(d.stamp)}` : ''}</small><span><SearchHighlight text={searchSnippet(d.body,query)} query={query}/></span><span className="search-open">Abrir em {g.section}</span></button></li>)}</ul></section>)}</div>
      {shown.length<results.length && <button type="button" className="btn search-more" onClick={()=>setLimit(l=>l+60)}>Mostrar mais resultados</button>}
      </div>
    </dialog>,document.body)}
  </>
}
export function SearchDestination({ selection, onClose }) {
  const ref=useRef(null)
  const now = useNewsClock()
  useEffect(()=>{if(!selection)return;const id=requestAnimationFrame(()=>{ref.current?.focus({preventScroll:true});ref.current?.scrollIntoView({block:'start'})});return()=>cancelAnimationFrame(id)},[selection])
  if(!selection)return null
  const {query}=selection
  const doc = currentSearchDocument(selection.doc, now)
  if (!doc) return <aside ref={ref} tabIndex={-1} className="search-destination" aria-label="Resultado aberto pela busca">
    <div><strong>Resultado de notícias indisponível nesta janela</strong><button type="button" className="btn" onClick={onClose} aria-label="Fechar resultado da busca">Fechar resultado</button></div>
    <p role="status">Nenhuma publicação válida nas últimas 120 horas neste resultado salvo. O conteúdo anterior foi ocultado; consulte a área abaixo ou faça uma nova busca. Isso não significa ausência de notícias sobre o tema.</p>
  </aside>
  return <aside ref={ref} tabIndex={-1} className="search-destination" aria-label="Resultado aberto pela busca">
    <div><strong>Resultado da busca: <SearchHighlight text={doc.title} query={query}/></strong><button type="button" className="btn" onClick={onClose} aria-label="Fechar resultado da busca">Fechar resultado</button></div>
    <p><SearchHighlight text={searchSnippet(doc.body,query,400)} query={query}/></p>
    <small>{doc.kind}{doc.stamp ? ` · cópia do arquivo de ${stamp(doc.stamp)}` : ''}. A área correspondente está aberta abaixo; alguns itens podem exigir os filtros ou a tabela de histórico.</small>
    {doc.kind==='Explicação' && <details open><summary>Explicação completa</summary><p>{doc.body}</p></details>}
  </aside>
}
