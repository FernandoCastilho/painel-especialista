import catalog from './ma/transactions.json'
import { maRoute, filterMa, maDateLabel, maDate } from './ma.js'
import './Ma.css'

export default function MaSectorLink({ sectorId = '' }) {
  const rows = filterMa(catalog.transactions,{sector:sectorId})
  return <section className="ma-sector-link" aria-label="Fusões e aquisições do setor"><h4>Fusões e aquisições{sectorId ? ' do setor' : ''}</h4><p className="central-note">{rows.length} {rows.length === 1 ? 'operação catalogada' : 'operações catalogadas'} · cobertura parcial</p>
    {sectorId && <ul>{rows.slice(0,3).map(row => <li key={row.id}><a href={`#ma/${maRoute({tab:'transacoes',sector:sectorId,selected:row.id})}`}>{row.buyer} → {row.target}</a><small> · {maDateLabel(maDate(row))}</small></li>)}</ul>}
    <a href={`#ma/${maRoute({tab:'transacoes',sector:sectorId})}`}>Consultar {sectorId ? 'transações do setor' : 'panorama e transações'} →</a>
  </section>
}
