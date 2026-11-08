import { useDiagramPresentation } from './useDiagramPresentation.js'
import { createPortal } from 'react-dom'
import './TechnologyIntegrationDiagram.css'

const delivery = ['Diagnóstico', 'Desenho', 'Aquisição e configuração', 'Implantação', 'Operação e suporte (quando contratados)']
const cash = ['Compra de equipamentos e licenças', 'Custos de implantação', 'Entrega e aceite', 'Faturamento', 'Recebimento']

const icons = {
  factory: 'M3 21V10l6-4v5l6-4v6h3V3h3v18H3m4-4h1m4 0h1m4 0h1',
  box: 'm3 7 9-5 9 5v10l-9 5-9-5V7m0 0 9 5 9-5m-9 5v10M7 5l10 6v6',
  users: 'M8 21v-4a4 4 0 0 1 8 0v4M2 20v-3a3 3 0 0 1 4-3m16 6v-3a3 3 0 0 0-4-3M15 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0m16 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  search: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 7 7',
  pencil: 'm4 16 12-12 4 4L8 20l-5 1 1-5m10-10 4 4',
  gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m-2-6h4l1 3 3 1 3 3-2 3 1 3-3 4-3-1-2 3-4-1-1-3-3-1-2-4 2-3-1-3 3-3 3 1 1-3',
  helmet: 'M3 18v-4a9 9 0 0 1 18 0v4M9 5v7m6-7v7M2 18h20v3H2z',
  headset: 'M3 14v-3a9 9 0 0 1 18 0v3M3 11h3v8H3zM18 11h3v8h-3zM19 19c0 3-4 3-7 3',
}
function FlowIcon({ name }) { return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={icons[name]} /></svg> }

// Texto nativo e listas ordenadas: a leitura não depende da imagem ou das setas.
export default function TechnologyIntegrationDiagram() {
  const { paused, setPaused, expanded, setExpanded, scale, figureRef, maximizeRef, dialogRef } = useDiagramPresentation('ticDiagramFullscreen')
  const figure = <figure ref={figureRef} className="tic-flow"  data-paused={paused} style={expanded ? { transform: `translate(-50%, -50%) scale(${scale})` } : undefined} aria-labelledby="tic-flow-title" aria-describedby="tic-flow-note tic-flow-motion-help" tabIndex={0} aria-keyshortcuts="P" onKeyDown={event => {
    if (!expanded && event.key.toLowerCase() === 'p' && !event.ctrlKey && !event.altKey && !event.metaKey) { event.preventDefault(); setPaused(value => !value) }
  }}>
    <h4 id="tic-flow-title">Como funciona a <span>integração de tecnologia</span></h4>
    <div className="tic-flow-controls">
      <p>O destaque percorre a cadeia de entrega e, abaixo, o ciclo de caixa.</p>
      <button ref={maximizeRef} className="tic-flow-maximize" type="button" aria-label="Maximizar diagrama" title="Maximizar diagrama" onClick={() => { setPaused(false); setExpanded(true) }}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></svg></button>
      <span id="tic-flow-motion-help" className="tic-flow-sr-only">Com o diagrama em foco, pressione P para pausar ou retomar a animação.</span>
      <span className="tic-flow-reduced">Animação desativada pela preferência de movimento reduzido.</span>
    </div>
    <div className="tic-flow-chain">
      <div className="tic-flow-party tic-flow-maker tic-flow-stage" style={{ '--flow-step': 0 }}><FlowIcon name="factory" /><strong>Fabricantes e plataformas</strong></div>
      <span className="tic-flow-arrow" aria-hidden="true">→</span>
      <div className="tic-flow-party tic-flow-distributor tic-flow-stage" style={{ '--flow-step': 1 }}><FlowIcon name="box" /><strong>Distribuidores <small>(quando envolvidos)</small></strong></div>
      <span className="tic-flow-arrow" aria-hidden="true">→</span>
      <section className="tic-flow-integrator" aria-labelledby="tic-flow-integrator-title"><h5 id="tic-flow-integrator-title">Integradora de tecnologia</h5><ol>{delivery.map((step, index) => <li key={step} className="tic-flow-stage" style={{ '--flow-step': index + 2 }}><FlowIcon name={['search', 'pencil', 'gear', 'helmet', 'headset'][index]} />{step}</li>)}</ol></section>
      <span className="tic-flow-arrow" aria-hidden="true">→</span>
      <div className="tic-flow-party tic-flow-client tic-flow-stage" style={{ '--flow-step': 7 }}><FlowIcon name="users" /><strong>Clientes</strong></div>
    </div>
    <p className="tic-flow-direct"><span>Fabricantes e plataformas → Clientes</span><strong>Contratação direta</strong></p>
    <section className="tic-flow-cash" aria-labelledby="tic-flow-cash-title"><h5 id="tic-flow-cash-title">Onde o caixa exige atenção</h5><ol>{cash.map((step, index) => <li key={step} className="tic-flow-stage" style={{ '--flow-step': index + 8 }}>{step}</li>)}</ol></section>
    <figcaption id="tic-flow-note">Síntese do subsetor; modelos de negócio podem coexistir. Etapas, sequência, faturamento e recebimento variam conforme o contrato.</figcaption>
  </figure>
  if (!expanded) return figure
  return createPortal(<div ref={dialogRef} tabIndex={-1} data-laser-host="true" className="tic-flow-fullscreen" role="dialog" aria-modal="true" aria-label="Diagrama em tela cheia" aria-describedby="tic-flow-fullscreen-help">
    <p id="tic-flow-fullscreen-help" className="tic-flow-sr-only">Ative o laser padrão para riscar; Ctrl faz retângulos e Shift faz setas. Escape desliga o laser; com ele desligado, Escape sai da tela cheia. Use Voltar do navegador para sair. Pressione P para pausar ou retomar a animação.</p>
    <span className="laser-slot tic-flow-laser-slot" />
    {figure}
  </div>, document.body)
}
