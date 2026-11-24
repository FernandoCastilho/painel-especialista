import geography from './recovery-geography.json'
import { maBubbleRadius } from './ma.js'

export default function MaMap({ summary, selected, onSelect }) {
  const counts = new Map(summary.states.map(state => [state.id,state.count]))
  const max = Math.max(1,...counts.values())
  return <section className="ma-card ma-map-card" aria-labelledby="ma-map-title">
    <h3 id="ma-map-title">Transações por estado</h3>
    <p className="ma-caption">Localização da empresa ou do ativo adquirido</p>
    <svg viewBox={geography.viewBox} className="ma-map" role="group" aria-label="Mapa do Brasil com quantidade de transações por estado">
      {geography.states.map(state => <path key={state.uf} d={state.path} className="ma-state" aria-hidden="true"/>)}
      {geography.states.filter(state => counts.has(state.uf)).map(state => {
        const count = counts.get(state.uf)
        const radius = maBubbleRadius(count,max)
        return <g key={state.uf} className="ma-bubble" role="button" tabIndex={0} aria-label={`${state.uf}: ${count} ${count === 1 ? 'transação' : 'transações'}. Ver lista.`} aria-pressed={selected === state.uf}
          onClick={() => onSelect(state.uf)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(state.uf) } }}>
          <title>{state.uf}: {count} {count === 1 ? 'transação' : 'transações'}</title>
          <circle className="ma-bubble-target" cx={state.x} cy={state.y} r={Math.max(24,radius)}/>
          <circle cx={state.x} cy={state.y} r={radius}/><text x={state.x} y={state.y} dy=".35em">{count}</text>
          <text className="ma-uf-label" x={state.x + radius + 6} y={state.y} dy=".35em">{state.uf}</text>
        </g>
      })}
    </svg>
    <p className="ma-caption">Quanto maior a bolha, mais transações. Malha territorial IBGE.</p>
    <button type="button" className="ma-text-button" onClick={() => onSelect('unknown')}>Sem UF confirmada: {summary.unknown}</button>
  </section>
}
