import { useDiagramPresentation } from './useDiagramPresentation.js'
import { createPortal } from 'react-dom'
import './TechnologyIntegrationDiagram.css'
import './ResearchedSectorStudy.css'

// Texto nativo e listas ordenadas: a leitura não depende da imagem ou das setas.
export default function SectorValueChain({ diagram, title }) {
  const { paused, setPaused, expanded, setExpanded, scale, figureRef, maximizeRef, dialogRef } = useDiagramPresentation('sectorDiagramFullscreen', true)
  const figure = <figure ref={figureRef} className="tic-flow researched-flow"  data-paused={paused} style={expanded ? { '--sector-flow-transform': `translate(-50%, -50%) scale(${scale})` } : undefined} aria-labelledby="sector-flow-title" aria-describedby="sector-flow-note sector-flow-motion-help" tabIndex={0} aria-keyshortcuts="P" onKeyDown={event => {
    if (!expanded && event.key.toLowerCase() === 'p' && !event.ctrlKey && !event.altKey && !event.metaKey) { event.preventDefault(); setPaused(value => !value) }
  }}>
    <h4 id="sector-flow-title">Como funciona: <span>{title}</span></h4>
    <div className="tic-flow-controls">
      <p>O destaque percorre os participantes da cadeia. As relações estão descritas abaixo.</p>
      <button ref={maximizeRef} className="tic-flow-maximize" type="button" aria-label="Maximizar diagrama" title="Maximizar diagrama" onClick={() => { setPaused(false); setExpanded(true) }}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></svg></button>
      <span id="sector-flow-motion-help" className="tic-flow-sr-only">Com o diagrama em foco, pressione P para pausar ou retomar a animação.</span>
      <span className="tic-flow-reduced">Animação desativada pela preferência de movimento reduzido.</span>
    </div>
    <ol className="sector-chain-nodes" style={{ '--chain-duration': `${diagram.nodes.length * 1.8}s` }}>{diagram.nodes.map((node, index) => <li key={node.id} className="sector-chain-node" style={{ '--chain-step': index }}><span className="sector-chain-number" aria-hidden="true">{index + 1}</span><strong>{node.label}</strong><p>{node.detail}</p></li>)}</ol>
    <ul className="sector-chain-edges" aria-label="Relações da cadeia">{diagram.edges.map((edge, index) => <li key={`${edge.from}-${edge.to}-${index}`}><strong>{diagram.nodes.find(node => node.id === edge.from)?.label}</strong><span aria-hidden="true"> → </span><span className="tic-flow-sr-only"> para </span><strong>{diagram.nodes.find(node => node.id === edge.to)?.label}</strong><span>: {edge.label}</span></li>)}</ul>
    <figcaption id="sector-flow-note">Mapa conceitual do subsetor. As relações representam fluxos de produtos, serviços ou recursos; a ordem dos blocos não estabelece uma sequência obrigatória.</figcaption>
  </figure>
  if (!expanded) return figure
  return createPortal(<div ref={dialogRef} tabIndex={-1} data-laser-host="true" className="tic-flow-fullscreen researched-flow-fullscreen" role="dialog" aria-modal="true" aria-label="Diagrama em tela cheia" aria-describedby="sector-flow-fullscreen-help">
    <p id="sector-flow-fullscreen-help" className="tic-flow-sr-only">Ative o laser padrão para riscar; Ctrl faz retângulos e Shift faz setas. Escape desliga o laser; com ele desligado, Escape sai da tela cheia. Use Voltar do navegador para sair. Pressione P para pausar ou retomar a animação.</p>
    <span className="laser-slot tic-flow-laser-slot" />
    {figure}
  </div>, document.body)
}
