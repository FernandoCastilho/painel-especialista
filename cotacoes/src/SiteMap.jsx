import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CALCS } from './Calculadora.jsx'
import { ATALHOS } from './Juros.jsx'
import { ALIASES, PROFILES } from './BndesWorkspace.jsx'
import { buildSiteMap, flattenSiteMap, siteMapHref } from './siteMap.js'
import owl from './assets/mascot-owl.webp'
import owlWing from './assets/mascot-owl-wing.webp'
import './SiteMap.css'

// Mapa do site em forma de mapa mental: a coruja no centro e os quatro ramos em volta, até o último item.
// Layout fixo (sem arrastar nem zoom). No computador, curvas ligam a coruja a cada ramo e a coruja acompanha a
// rolagem no meio da tela; no celular, os ramos ficam um embaixo do outro, presos a uma linha vertical.
// Abre recolhido nos quatro ramos (pedido do Fernando, 28/11/2026): cada ramo e cada item com filhos abre num
// clique, e há botões para expandir e recolher tudo. Os itens fechados ficam na página, só escondidos.

const destinos = n => flattenSiteMap(n).length - 1
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
export const idsExpansiveis = tree => flattenSiteMap(tree).filter(n => n.children?.length).map(n => n.id)

// Botão que abre e fecha um ramo ou item; a seta gira quando aberto.
function Toggle({ n, aberto, onToggle, listaId }) {
  return <button type="button" className="sm-toggle" aria-expanded={aberto} aria-controls={listaId}
    aria-label={`${aberto ? 'Recolher' : 'Abrir'} ${n.label}`} title={aberto ? 'Recolher' : 'Abrir'} onClick={() => onToggle(n.id)}>
    <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2.5 7.5 6 4 9.5" /></svg>
  </button>
}

// Quadros sem endereço próprio: abre a aba e rola até o quadro quando ele aparecer na tela.
function rolarAte(id, tentativas = 30) {
  const el = document.getElementById(id)
  if (el) { el.scrollIntoView({ block: 'start' }); return }
  if (tentativas > 0) setTimeout(() => rolarAte(id, tentativas - 1), 100)
}

function Link({ n, goto, className }) {
  const open = e => {
    if (!goto || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    const [tab, ...rest] = n.route.split('/')
    goto(tab, rest.join('/'))
    if (n.anchor) rolarAte(n.anchor)
  }
  return <a className={className} href={siteMapHref(n.route)} onClick={open}>{n.label}</a>
}

// Itens com filhos viram linhas da árvore; itens sem filhos seguidos viram um grupo de etiquetas.
function Ramos({ itens, goto, nivel, abertos, onToggle, id, hidden }) {
  const linhas = []
  for (const item of itens) {
    const folha = !item.children?.length
    const ultima = linhas.at(-1)
    if (folha && nivel > 0 && ultima?.folhas) ultima.folhas.push(item)
    else linhas.push(folha && nivel > 0 ? { id: item.id, folhas: [item] } : { id: item.id, item })
  }
  return <ul className="sm-tree" id={id} hidden={hidden}>
    {linhas.map(l => {
      if (l.folhas) return <li key={l.id} className="sm-leaves"><ul className="sm-chips">{l.folhas.map(f => <li key={f.id}><Link n={f} goto={goto} className="sm-chip" /></li>)}</ul></li>
      const filhos = l.item.children?.length > 0, aberto = abertos.has(l.item.id), lista = `sm-lista-${l.item.id}`
      return <li key={l.id}>
        <span className="sm-row">
          <Link n={l.item} goto={goto} className={`sm-node sm-level-${Math.min(nivel, 2)}`} />
          {filhos && <Toggle n={l.item} aberto={aberto} onToggle={onToggle} listaId={lista} />}
        </span>
        {filhos && <Ramos itens={l.item.children} goto={goto} nivel={nivel + 1} abertos={abertos} onToggle={onToggle} id={lista} hidden={!aberto} />}
      </li>
    })}
  </ul>
}

function Ramo({ ramo, goto, cardRef, abertos, onToggle }) {
  const aberto = abertos.has(ramo.id), lista = `sm-lista-${ramo.id}`
  return <section className={`sm-card sm-${ramo.id}${aberto ? ' is-open' : ''}`} ref={cardRef} aria-labelledby={`sm-${ramo.id}-title`}>
    <header className="sm-card-head">
      <i aria-hidden="true" />
      <h3 id={`sm-${ramo.id}-title`}>{ramo.route ? <Link n={ramo} goto={goto} /> : ramo.label}</h3>
      <small>{plural(destinos(ramo), 'destino', 'destinos')}</small>
      <Toggle n={ramo} aberto={aberto} onToggle={onToggle} listaId={lista} />
    </header>
    <Ramos itens={ramo.children} goto={goto} nivel={0} abertos={abertos} onToggle={onToggle} id={lista} hidden={!aberto} />
  </section>
}

// Curvas da coruja até o título de cada ramo, medidas na tela (acompanham qualquer largura).
function useCurvas(board, centro, cards) {
  const [desenho, setDesenho] = useState({ w: 0, h: 0, paths: [] })
  useLayoutEffect(() => {
    const el = board.current
    if (!el) return undefined
    const draw = () => {
      const b = el.getBoundingClientRect(), o = centro.current?.getBoundingClientRect()
      if (!o) return
      const oy = o.top + o.height / 2 - b.top
      const paths = []
      for (const [id, card] of Object.entries(cards.current)) {
        const head = card?.querySelector('.sm-card-head')
        if (!head) continue
        const r = head.getBoundingClientRect()
        const cy = r.top + r.height / 2 - b.top
        let x0, x1
        if (r.left >= o.right - 1) { x0 = o.right - b.left; x1 = r.left - b.left }
        else if (r.right <= o.left + 1) { x0 = o.left - b.left; x1 = r.right - b.left }
        else continue // ramos empilhados (celular): a linha vertical do CSS faz a ligação
        const mx = (x0 + x1) / 2
        paths.push({ id, d: `M${x0.toFixed(1)} ${oy.toFixed(1)} C${mx.toFixed(1)} ${oy.toFixed(1)} ${mx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${cy.toFixed(1)}` })
      }
      const next = { w: Math.round(b.width), h: Math.round(b.height), paths }
      setDesenho(atual => JSON.stringify(atual) === JSON.stringify(next) ? atual : next)
    }
    let quadro = 0
    const agendar = () => { if (!quadro) quadro = requestAnimationFrame(() => { quadro = 0; draw() }) }
    draw()
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(agendar) : null
    watch?.observe(el)
    for (const card of Object.values(cards.current)) if (card) watch?.observe(card)
    window.addEventListener('scroll', agendar, { passive: true }) // a coruja acompanha a rolagem; as curvas vão junto
    document.fonts?.ready?.then(draw).catch(() => {})
    return () => { watch?.disconnect(); window.removeEventListener('scroll', agendar); cancelAnimationFrame(quadro) }
  }, [board, centro, cards])
  return desenho
}

export default function SiteMap({ goto }) {
  const mapa = useMemo(() => buildSiteMap({ calcs: CALCS, jurosAtalhos: ATALHOS, bndesProfiles: PROFILES, bndesAliases: ALIASES }), [])
  const [mercado, calculadoras, empresas, conteudo] = mapa.children
  const board = useRef(null), centro = useRef(null), cards = useRef({})
  const curvas = useCurvas(board, centro, cards)
  const ref = id => el => { cards.current[id] = el }
  const total = destinos(mapa)
  const todos = useMemo(() => idsExpansiveis(mapa).filter(id => id !== mapa.id), [mapa])
  const [abertos, setAbertos] = useState(() => new Set())
  const onToggle = useCallback(id => setAbertos(atual => {
    const prox = new Set(atual)
    if (!prox.delete(id)) prox.add(id)
    return prox
  }), [])
  const ramo = n => <Ramo ramo={n} goto={goto} cardRef={ref(n.id)} abertos={abertos} onToggle={onToggle} />
  return <section className="site-map sm-azul" aria-labelledby="sm-title">
    <div className="sm-heading">
      <div>
        <span className="sm-eyebrow">MAPA DO SITE</span>
        <h2 id="sm-title">Tudo o que tem no Painel</h2>
        <p>{plural(total, 'destino', 'destinos')} em quatro ramos. Abra um ramo pela seta e clique em qualquer item para ir direto a ele.</p>
      </div>
      <div className="sm-actions">
        <button type="button" className="sm-action" aria-controls={mapa.children.map(n => `sm-lista-${n.id}`).join(' ')}
          disabled={abertos.size === todos.length} onClick={() => setAbertos(new Set(todos))}>Expandir tudo</button>
        <button type="button" className="sm-action" aria-controls={mapa.children.map(n => `sm-lista-${n.id}`).join(' ')}
          disabled={abertos.size === 0} onClick={() => setAbertos(new Set())}>Recolher tudo</button>
      </div>
    </div>
    <div className="sm-board" ref={board}>
      <svg className="sm-curves" aria-hidden="true" width={curvas.w} height={curvas.h} viewBox={`0 0 ${curvas.w || 1} ${curvas.h || 1}`}>
        {curvas.paths.map(p => <path key={p.id} className={`sm-curve sm-${p.id}`} d={p.d} />)}
      </svg>
      <div className="sm-center-col">
      <div className="sm-center" ref={centro}>
        <span className="sm-owl" aria-hidden="true">
          <img src={owl} alt="" width="384" height="408" draggable="false" />
          <img src={owlWing} alt="" width="384" height="408" draggable="false" />
        </span>
        <div className="sm-center-text">
          <strong><abbr title="Painel Especializado no Mercado">PME</abbr></strong>
          <span>Painel Especializado no Mercado</span>
          <small>{plural(total, 'destino', 'destinos')}</small>
        </div>
      </div>
      </div>
      <div className="sm-side sm-left">
        {ramo(mercado)}
        {ramo(empresas)}
      </div>
      <div className="sm-side sm-right">
        {ramo(calculadoras)}
        {ramo(conteudo)}
      </div>
    </div>
  </section>
}
