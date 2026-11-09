import { useDiagramPresentation } from './useDiagramPresentation.js'
import { createPortal } from 'react-dom'
import './TechnologyIntegrationDiagram.css'
import './ResearchedSectorStudy.css'

// Cadeia em desenhos: só quando todos os blocos trazem emoji e cada elo traz produto e dinheiro. Senão, cai na versão em texto.
export function richChain(diagram) {
  const { nodes, edges } = diagram
  if (!Array.isArray(nodes) || nodes.length < 2 || nodes.length > 4 || !nodes.every(node => node.emoji)) return null
  const links = nodes.slice(0, -1).map((node, index) => edges.find(edge => edge.from === node.id && edge.to === nodes[index + 1].id))
  return links.every(edge => edge?.product?.emoji && edge?.cash?.emoji) ? links : null
}

// Texto nativo e listas ordenadas: a leitura não depende da imagem ou das setas.
export default function SectorValueChain({ diagram, title }) {
  const links = richChain(diagram)
  const { paused, setPaused, expanded, setExpanded, scale, figureRef, maximizeRef, dialogRef } = useDiagramPresentation('sectorDiagramFullscreen', true)
  const figure = <figure ref={figureRef} className="tic-flow researched-flow"  data-paused={paused} style={expanded ? { '--sector-flow-transform': `translate(-50%, -50%) scale(${scale})` } : undefined} aria-labelledby="sector-flow-title" aria-describedby="sector-flow-note sector-flow-motion-help" tabIndex={0} aria-keyshortcuts="P" onKeyDown={event => {
    if (!expanded && event.key.toLowerCase() === 'p' && !event.ctrlKey && !event.altKey && !event.metaKey) { event.preventDefault(); setPaused(value => !value) }
  }}>
    <h4 id="sector-flow-title">Como funciona: <span>{title}</span></h4>
    <div className="tic-flow-controls">
      <p>{links ? 'Em azul, o produto segue da origem ao cliente. Em laranja, o dinheiro volta. Cada elo está descrito em texto.' : 'O destaque percorre os participantes da cadeia. As relações estão descritas abaixo.'}</p>
      <button ref={maximizeRef} className="tic-flow-maximize" type="button" aria-label="Maximizar diagrama" title="Maximizar diagrama" onClick={() => { setPaused(false); setExpanded(true) }}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></svg></button>
      <span id="sector-flow-motion-help" className="tic-flow-sr-only">Com o diagrama em foco, pressione P para pausar ou retomar a animação.</span>
      <span className="tic-flow-reduced">Animação desativada pela preferência de movimento reduzido.</span>
    </div>
    {links ? <RichChain nodes={diagram.nodes} links={links} cycle={diagram.cycle} /> : <>
    <ol className="sector-chain-nodes" style={{ '--chain-duration': `${diagram.nodes.length * 1.8}s` }}>{diagram.nodes.map((node, index) => <li key={node.id} className="sector-chain-node" style={{ '--chain-step': index }}><span className="sector-chain-number" aria-hidden="true">{index + 1}</span><strong>{node.label}</strong><p>{node.detail}</p></li>)}</ol>
    <ul className="sector-chain-edges" aria-label="Relações da cadeia">{diagram.edges.map((edge, index) => <li key={`${edge.from}-${edge.to}-${index}`}><strong>{diagram.nodes.find(node => node.id === edge.from)?.label}</strong><span aria-hidden="true"> → </span><span className="tic-flow-sr-only"> para </span><strong>{diagram.nodes.find(node => node.id === edge.to)?.label}</strong><span>: {edge.label}</span></li>)}</ul></>}
    <figcaption id="sector-flow-note">Mapa conceitual do subsetor. As relações representam fluxos de produtos, serviços ou recursos; a ordem dos blocos não estabelece uma sequência obrigatória.</figcaption>
  </figure>
  if (!expanded) return figure
  return createPortal(<div ref={dialogRef} tabIndex={-1} data-laser-host="true" className="tic-flow-fullscreen researched-flow-fullscreen" role="dialog" aria-modal="true" aria-label="Diagrama em tela cheia" aria-describedby="sector-flow-fullscreen-help">
    <p id="sector-flow-fullscreen-help" className="tic-flow-sr-only">Ative o laser padrão para riscar; Ctrl faz retângulos e Shift faz setas. Escape desliga o laser; com ele desligado, Escape sai da tela cheia. Use Voltar do navegador para sair. Pressione P para pausar ou retomar a animação.</p>
    <span className="laser-slot tic-flow-laser-slot" />
    {figure}
  </div>, document.body)
}

function RichChain({ nodes, links, cycle }) {
  return <div className="rich-chain">
    <div className="rich-chain-row" role="list">{nodes.flatMap((node, index) => {
      const stage = <div key={node.id} role="listitem" className="rich-stage" style={{ '--stage-delay': `${index === 0 ? 0 : (index * 2.2 - 1.1).toFixed(1)}s` }}>
        <span className="rich-emoji" aria-hidden="true">{node.emoji}</span><strong>{node.label}</strong><p>{node.detail}</p>
        {node.bank && <p className="rich-bank"><span aria-hidden="true">🏦 </span><span className="tic-flow-sr-only">Onde o banco entra: </span>{node.bank}</p>}
      </div>
      const edge = links[index]
      if (!edge) return [stage]
      const lane = (kind, label, item, delay) => <div className={`rich-lane ${kind}`}><div className="rich-track" aria-hidden="true"><i className="rich-line" /><span className="rich-packet" style={{ '--packet-delay': `${delay}s` }}>{item.emoji}</span></div><small><b>{label}</b> {item.label}</small></div>
      return [stage, <div key={`${node.id}-link`} role="listitem" className="rich-link" aria-label={edge.label}>{lane('prod', 'Produto:', edge.product, (index * 2.2).toFixed(1))}{lane('cash', 'Dinheiro:', edge.cash, (index * 2.2 + 1.1).toFixed(1))}</div>]
    })}</div>
    {cycle?.steps?.length === 3 && <div className="rich-cycle"><h5><span aria-hidden="true">⏳ </span>{cycle.title}</h5><div className="rich-cycle-steps">{cycle.steps.map((step, index) => <p key={step} data-gap={index === 1 || undefined}>{step}</p>)}</div>{cycle.text && <p>{cycle.text}</p>}</div>}
  </div>
}
