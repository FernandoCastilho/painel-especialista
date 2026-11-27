import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CALCS } from './Calculadora.jsx'
import { ATALHOS } from './Juros.jsx'
import { ALIASES, PROFILES } from './BndesWorkspace.jsx'
import { buildSiteMap, flattenSiteMap, siteMapHref } from './siteMap.js'
import owl from './assets/mascot-owl.webp'
import owlWing from './assets/mascot-owl-wing.webp'
import './SiteMap.css'

// Mapa do site em forma de mapa mental: a coruja no centro e os quatro ramos em volta, até o último item.
// Layout fixo (sem arrastar nem zoom). No computador, curvas ligam a coruja a cada ramo; no celular, os ramos
// ficam um embaixo do outro, presos a uma linha vertical.

const destinos = n => flattenSiteMap(n).length - 1
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

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
function Ramos({ itens, goto, nivel }) {
  const linhas = []
  for (const item of itens) {
    const folha = !item.children?.length
    const ultima = linhas.at(-1)
    if (folha && nivel > 0 && ultima?.folhas) ultima.folhas.push(item)
    else linhas.push(folha && nivel > 0 ? { id: item.id, folhas: [item] } : { id: item.id, item })
  }
  return <ul className="sm-tree">
    {linhas.map(l => l.folhas
      ? <li key={l.id} className="sm-leaves"><ul className="sm-chips">{l.folhas.map(f => <li key={f.id}><Link n={f} goto={goto} className="sm-chip" /></li>)}</ul></li>
      : <li key={l.id}>
        <Link n={l.item} goto={goto} className={`sm-node sm-level-${Math.min(nivel, 2)}`} />
        {l.item.children?.length > 0 && <Ramos itens={l.item.children} goto={goto} nivel={nivel + 1} />}
      </li>)}
  </ul>
}

function Ramo({ ramo, goto, cardRef }) {
  return <section className={`sm-card sm-${ramo.id}`} ref={cardRef} aria-labelledby={`sm-${ramo.id}-title`}>
    <header className="sm-card-head">
      <i aria-hidden="true" />
      <h3 id={`sm-${ramo.id}-title`}>{ramo.route ? <Link n={ramo} goto={goto} /> : ramo.label}</h3>
      <small>{plural(destinos(ramo), 'destino', 'destinos')}</small>
    </header>
    <Ramos itens={ramo.children} goto={goto} nivel={0} />
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
    draw()
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(draw) : null
    watch?.observe(el)
    document.fonts?.ready?.then(draw).catch(() => {})
    return () => watch?.disconnect()
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
  return <section className="site-map" aria-labelledby="sm-title">
    <div className="sm-heading">
      <div>
        <span className="sm-eyebrow">MAPA DO SITE</span>
        <h2 id="sm-title">Tudo o que tem no Painel</h2>
        <p>{plural(total, 'destino', 'destinos')} em quatro ramos. Clique em qualquer item para ir direto a ele.</p>
      </div>
    </div>
    <div className="sm-board" ref={board}>
      <svg className="sm-curves" aria-hidden="true" width={curvas.w} height={curvas.h} viewBox={`0 0 ${curvas.w || 1} ${curvas.h || 1}`}>
        {curvas.paths.map(p => <path key={p.id} className={`sm-curve sm-${p.id}`} d={p.d} />)}
      </svg>
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
      <div className="sm-side sm-left">
        <Ramo ramo={mercado} goto={goto} cardRef={ref(mercado.id)} />
        <Ramo ramo={empresas} goto={goto} cardRef={ref(empresas.id)} />
      </div>
      <div className="sm-side sm-right">
        <Ramo ramo={calculadoras} goto={goto} cardRef={ref(calculadoras.id)} />
        <Ramo ramo={conteudo} goto={goto} cardRef={ref(conteudo.id)} />
      </div>
    </div>
  </section>
}
