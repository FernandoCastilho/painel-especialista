import Flag from './Flag.jsx'
import './MarketTable.css'
import './IndicatorTable.css'

// Tabela de indicadores no mesmo formato da tabela de câmbio do Mercado: cada linha abre o gráfico para consulta.
// rows: [{ id, key?, name, sub, cells: [{ text, tone, title }], openLabel }]; columns: títulos das colunas depois do indicador.
// `key` só é preciso quando várias linhas abrem o mesmo gráfico (mesmo id).
// `first`: título da primeira coluna (padrão "Indicador"; nas curvas é "Prazo").
export default function IndicatorTable({ caption, columns, rows, onOpen, ariaLabel, first = 'Indicador' }) {
  return (
    <div className="market-table-wrap ind-table-wrap" role="region" aria-label={ariaLabel ?? caption} tabIndex={0}>
      <table className="market-table ind-table">
        <caption className="market-caption">{caption}</caption>
        <thead><tr><th scope="col">{first}</th>{columns.map((c) => <th key={c.label} scope="col" aria-label={c.aria}>{c.label}{c.small && <> <small>{c.small}</small></>}</th>)}</tr></thead>
        {rows.map((r) => { const off = r.disabled || !onOpen; return ( // sem onOpen (tabela dentro do detalhe), a linha só mostra os números
          <tbody key={r.key ?? r.id} className="market-record" style={{ '--series': 'var(--amber)' }}>
            <tr className="market-values" onClick={off ? undefined : () => onOpen(r.id)} style={off ? { cursor: 'default' } : undefined}>
              <th scope="row"><button type="button" className="market-open" disabled={off} aria-label={off ? r.name : r.openLabel ?? `${r.name}: abrir gráfico`} onClick={(e) => { e.stopPropagation(); if (!off) onOpen(r.id) }}><b>{r.flag && <Flag code={r.flag} width={18} height={12} />}{r.flag && ' '}{r.name} <span aria-hidden="true">›</span></b>{r.sub && <small>{r.sub}</small>}</button></th>
              {r.cells.map((c, i) => <td key={i} className={`${i === 0 ? 'market-price ' : ''}${c.tone ? 'pct ' + c.tone : c.text === '—' ? 'muted' : ''}`} title={c.title}>{c.text}</td>)}
            </tr>
          </tbody>
        ) })}
      </table>
    </div>
  )
}
