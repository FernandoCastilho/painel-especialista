import { useEffect, useId, useRef, useState } from 'react'
import { INSUMOS } from './insumos.js'
import SetoresLegado from './SetoresLegado.jsx'
import SectorStudy from './SectorStudy.jsx'
import SectorStudyLoader from './SectorStudyLoader.jsx'
import { CATALOGO_SETORIAL, ESTUDOS_RELACIONADOS_AS_PAUTAS, PAUTAS_SETORIAIS, normalizeSector, rotaPautaSetorial } from './centralSetorial.js'
import { readCentralHistory, withCentralHistory } from './centralHistory.js'
import './CentralSetorial.css'

// Each local atlas has a 3 x 3 grid: group cover, then topics in catalog order.
function SectorImage({ groupId, index = 0 }) {
  const column = index % 3
  const row = Math.floor(index / 3)
  return <span className="central-card-photo" aria-hidden="true"><img src={`./sector-images/${groupId}.jpg`} alt="" width="1536" height="1024" loading="lazy" decoding="async" style={{ left: `-${column * 100}%`, transform: `translateY(-${(row + .5) / 3 * 100}%)` }} onError={event => { event.currentTarget.hidden = true }} /></span>
}

function EstudoRelacionado({ study, navigate }) {
  const [groupId, index] = study
  const group = CATALOGO_SETORIAL.find(item => item.id === groupId)
  const route = index === null ? `pasta/${groupId}` : `topico/${groupId}/${index}`
  const title = index === null ? group.label : group.topics[index]
  return <li><button type="button" className="central-action" onClick={() => navigate(route)}>{title}</button></li>
}

function PautasSetoriais({ groups, navigate, showRelated }) {
  return <section className="central-research" aria-labelledby="central-research-title">
    <div className="central-section-heading"><h3 id="central-research-title">Pautas para pesquisa setorial</h3><p>Pesquisa pendente</p></div>
    {groups.map(group => <section key={group.label} className="central-result-group">
      <h4>{group.label}</h4>
      <ul className="central-topics">{group.topics.map(topic => <li key={topic.id}>
        <button type="button" id={`central-research-${topic.id}`} className="central-topic" onClick={() => navigate(rotaPautaSetorial(topic))}>
          <span className="central-document-icon" aria-hidden="true"/><span>{topic.title}</span><span className="central-topic-arrow" aria-hidden="true">→</span>
        </button>
      </li>)}</ul>
    </section>)}
    {showRelated && <section className="central-result-group">
      <h4>Estudos disponíveis</h4>
      <ul className="central-topics">{ESTUDOS_RELACIONADOS_AS_PAUTAS.map(study => <EstudoRelacionado key={study.join(':')} study={study} navigate={navigate}/>)}</ul>
    </section>}
  </section>
}

export default function Setores({ view = '', onView = () => {}, quotes, goto }) {
  const [query, setQuery] = useState(() => typeof window === 'undefined' ? '' : readCentralHistory(window.history.state, view)?.query || '')
  const searchId = useId()
  const surfaceRef = useRef(null)
  const routeMemory = useRef(new Map())
  const scrollIntent = useRef(null)
  const focusIntent = useRef(null)
  const parts = view.split('/')
  const routeGroup = ['pasta', 'topico'].includes(parts[0]) ? CATALOGO_SETORIAL.find(group => group.id === parts[1]) : null
  const topicIndex = parts[0] === 'topico' && /^\d+$/.test(parts[2] || '') ? Number(parts[2]) : -1
  const routeTopic = routeGroup?.topics[topicIndex]
  const folder = parts[0] === 'pasta' ? routeGroup : null
  const isResearch = parts[0] === 'pesquisa'
  const researchTopic = PAUTAS_SETORIAIS.flatMap(group => group.topics).find(topic => rotaPautaSetorial(topic) === view)
  const showContent = Boolean(view && view !== 'central' && !isResearch && !researchTopic && !['pasta', 'topico', 'b3'].includes(parts[0]))
  const hasDetail = Boolean(routeTopic || showContent || researchTopic)
  const invalidRoute = isResearch ? !researchTopic
    : ['pasta', 'topico'].includes(parts[0]) && (!routeGroup || (parts[0] === 'topico' && !routeTopic))
  const term = normalizeSector(query.trim())
  const groups = CATALOGO_SETORIAL.map(group => ({ ...group, matches: group.topics.filter(topic => !term || normalizeSector(`${group.label} ${topic}`).includes(term)) })).filter(group => group.matches.length)
  const researchGroups = PAUTAS_SETORIAIS.map(group => ({
    ...group,
    topics: group.topics.filter(topic => !term || normalizeSector(`${topic.title} ${group.label}`).includes(term)),
  })).filter(group => group.topics.length)
  const resultCount = groups.reduce((count, group) => count + group.matches.length, 0)
  const researchCount = researchGroups.reduce((count, group) => count + group.topics.length, 0)
  const showCatalog = !hasDetail || Boolean(term)
  function remember(context) {
    routeMemory.current.set(context.view, context)
    try { window.history.replaceState(withCentralHistory(window.history.state, context), '') } catch { /* history unavailable */ }
  }
  function changeQuery(next) {
    focusIntent.current = null
    setQuery(next)
    remember({ view, query: next, scroll: window.scrollY, focusId: document.activeElement?.id || '' })
  }
  function clearQuery() {
    document.getElementById(searchId)?.focus({ preventScroll: true })
    changeQuery('')
  }
  function navigate(next, restore = false) {
    if (next === view) {
      surfaceRef.current?.focus({ preventScroll: true })
      surfaceRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
      changeQuery('')
      return
    }
    remember({ view, query, scroll: window.scrollY, focusId: document.activeElement?.id || '' })
    const previous = restore ? routeMemory.current.get(next) || (next === 'central' ? routeMemory.current.get('') : null) : null
    const context = previous ? { ...previous, view: next } : { view: next, query: '', scroll: null, focusId: '' }
    scrollIntent.current = context
    onView(next)
    // App creates the new entry synchronously. Give that entry its own context.
    remember(context)
    setQuery(context.query)
  }
  useEffect(() => {
    const remembered = readCentralHistory(window.history.state, view)
    const scrolling = scrollIntent.current?.view === view ? scrollIntent.current : null
    scrollIntent.current = null
    focusIntent.current = { view, query: remembered?.query || '', remembered, scrolling }
    setQuery(remembered?.query || '')
  }, [view, hasDetail, folder])
  useEffect(() => {
    const intent = focusIntent.current
    // Restoring history can need another render. Never focus a result before
    // the remembered query has committed and made that result available.
    if (!intent || intent.view !== view || intent.query !== query) return
    const { remembered, scrolling } = intent
    const frame = window.requestAnimationFrame(() => {
      if (focusIntent.current !== intent) return
      focusIntent.current = null
      const surface = surfaceRef.current
      if (!surface) return
      const target = remembered?.focusId ? document.getElementById(remembered.focusId) : surface
      ;(target || surface).focus({ preventScroll: true })
      // Browser Back/Forward owns its native scroll restoration. Only our explicit
      // links restore a saved position or bring a newly opened study into view.
      if (scrolling?.scroll !== null && scrolling?.scroll !== undefined) window.scrollTo({ top: scrolling.scroll, behavior: 'instant' })
      else if ((scrolling || !remembered) && (hasDetail || folder)) surface.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [view, query, hasDetail, folder])
  const openTopic = (group, index) => navigate(`topico/${group.id}/${index}`)
  const topicButton = (group, topic, withImage = false) => <button type="button" id={`central-topic-${group.id}-${group.topics.indexOf(topic)}`} className={`central-topic${withImage ? ' central-subsector' : ''}`} aria-current={routeTopic === topic && routeGroup?.id === group.id ? 'page' : undefined} onClick={() => openTopic(group, group.topics.indexOf(topic))}>{withImage ? <><SectorImage groupId={group.id} index={group.topics.indexOf(topic) + 1} /><span className="central-card-caption"><strong>{topic}</strong><span className="central-topic-arrow" aria-hidden="true">→</span></span></> : <><span className="central-document-icon" aria-hidden="true"/><span>{topic}</span><span className="central-topic-arrow" aria-hidden="true">→</span></>}</button>

  return <div className={`central-setorial${hasDetail ? ' central-reading' : ''}`}>
    <header className="central-intro"><div><p className="central-kicker">CONHECIMENTO SETORIAL</p><h2>Explore por setor</h2><p>Explore setores, entenda negócios e encontre oportunidades.</p></div><span className="central-library-count">{CATALOGO_SETORIAL.length} setores <span aria-hidden="true">·</span> {CATALOGO_SETORIAL.reduce((count, group) => count + group.topics.length, 0)} subsetores</span></header>
    <div className="central-toolbar">
      <div className="central-search"><label htmlFor={searchId}>Buscar setor ou subsetor</label><div className="central-search-field"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id={searchId} type="search" value={query} onChange={event => changeQuery(event.target.value)} placeholder="Ex.: compensados, autopeças ou logística"/>{query && <button type="button" onClick={clearQuery} aria-label="Limpar busca">×</button>}</div></div>
      {hasDetail && !researchTopic && <label className="central-switcher">Trocar subsetor<select aria-label="Trocar subsetor" value={routeTopic ? view : ''} onChange={event => navigate(event.target.value)}><option value="" disabled>Escolha um subsetor</option>{CATALOGO_SETORIAL.map(group => <optgroup key={group.id} label={group.label}>{group.topics.map((topic, index) => <option key={topic} value={`topico/${group.id}/${index}`}>{topic}</option>)}</optgroup>)}</select></label>}
    </div>
    {(view === 'b3' || view.startsWith('b3/')) && <p role="status" className="central-note">A antiga classificação B3 foi substituída pelo catálogo unificado. Escolha o setor correspondente abaixo; não há conversão automática entre classificações.</p>}
    {invalidRoute && <p role="status" className="central-note">Este setor ou subsetor não foi encontrado. Escolha um setor ou use a busca.</p>}
    <div ref={surfaceRef} tabIndex={-1} className="central-surface" aria-label={routeTopic || researchTopic?.title || folder?.label || 'Catálogo de setores'}>
      {(folder || hasDetail) && <nav className="central-breadcrumb" aria-label="Caminho do setor"><button type="button" onClick={() => navigate('central', true)}>Todos os setores</button><span aria-hidden="true">/</span>{routeTopic ? <><button type="button" onClick={() => navigate(`pasta/${routeGroup.id}`, true)}>{routeGroup.label}</button><span aria-hidden="true">/</span><span aria-current="page">{routeTopic}</span></> : <span aria-current="page">{researchTopic?.title || folder?.label || INSUMOS.find(item => item.id === view)?.label || 'Insumos e indicadores'}</span>}</nav>}
      {showCatalog && <div className="central-catalog">
        {term ? <section className="central-results" aria-labelledby="central-results-title"><div className="central-section-heading"><h3 id="central-results-title">Resultados da busca</h3><p role="status">{resultCount} {resultCount === 1 ? 'subsetor encontrado' : 'subsetores encontrados'}{researchCount > 0 && ` · ${researchCount} ${researchCount === 1 ? 'pauta' : 'pautas'}`}</p></div>{groups.length ? groups.map(group => <section key={group.id} className="central-result-group"><h4>{group.label}</h4><ul className="central-topics">{group.matches.map(topic => <li key={topic}>{topicButton(group, topic)}</li>)}</ul></section>) : !researchCount && <div className="central-empty"><p>Nenhum tópico encontrado. Tente outro termo.</p><button type="button" className="central-action" onClick={clearQuery}>Limpar busca</button></div>}</section>
        : folder ? <section className="central-open-folder" aria-labelledby="central-folder-title"><div className="central-section-heading"><div><p className="central-kicker">SETOR</p><h3 id="central-folder-title">{folder.label}</h3></div><p>{folder.topics.length} subsetores</p></div><p className="central-note">Escolha um subsetor para abrir o estudo e seu mapa de negócios.</p><ul className="central-topics central-subsectors">{folder.topics.map(topic => <li key={topic}>{topicButton(folder, topic, true)}</li>)}</ul></section>
        : <section aria-labelledby="central-sectors-title"><div className="central-section-heading"><h3 id="central-sectors-title">Setores e subsetores</h3><p>Escolha um setor para explorar</p></div><ul className="central-folders">{CATALOGO_SETORIAL.map(group => <li key={group.id}><button type="button" id={`central-folder-${group.id}`} className="central-folder" onClick={() => navigate(`pasta/${group.id}`)} aria-label={`Explorar ${group.label}, ${group.topics.length} subsetores`}><SectorImage groupId={group.id} /><span className="central-folder-content"><span className="central-folder-arrow" aria-hidden="true">→</span><strong>{group.label}</strong><span className="central-folder-count">{group.topics.length} subsetores</span></span></button></li>)}</ul></section>}
        {(!folder || term) && researchGroups.length > 0 && <PautasSetoriais groups={researchGroups} navigate={navigate} showRelated={!term}/>}
        {!term && !folder && <section className="central-inputs" aria-labelledby="central-inputs-title"><div><h3 id="central-inputs-title">Insumos e Indicadores</h3><p className="central-note">Referências para complementar sua análise</p></div><ul>{INSUMOS.map(item => <li key={item.id}><button type="button" onClick={() => navigate(item.id)}>{item.label}<span aria-hidden="true">→</span></button></li>)}</ul></section>}
      </div>}
      {researchTopic && !term && <section className="central-detail" aria-labelledby="central-research-topic-title">
        <h3 id="central-research-topic-title">{researchTopic.title}</h3>
        <p className="central-note">Pesquisa pendente</p>
        <h4>O que pesquisar</h4>
        <p>{researchTopic.scope}</p>
        {researchTopic.related && <><h4>Estudos relacionados</h4><ul className="central-topics">{researchTopic.related.map(study => <EstudoRelacionado key={study.join(':')} study={study} navigate={navigate}/>)}</ul></>}
      </section>}
      {researchTopic?.existingRoute && !term && <div className="central-detail central-detail-content">
        <SetoresLegado key={view} view={view} quotes={quotes}/>
      </div>}
      {hasDetail && !researchTopic && !term && <div className={`central-detail central-detail-selected${showContent ? ' central-detail-content' : ''}`}>{showContent ? <SetoresLegado key={view} view={view} quotes={quotes}/> : routeGroup.id === 'tic' && routeTopic === 'Integração de TI e infraestrutura digital' ? <SectorStudy goto={goto} /> : <SectorStudyLoader goto={goto} key={`${routeGroup.id}-${topicIndex}`} group={routeGroup} topicIndex={topicIndex} />}</div>}
    </div>
  </div>
}
