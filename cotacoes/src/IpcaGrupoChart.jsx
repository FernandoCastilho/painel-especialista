import CaptureButton from './CaptureButton.jsx'
import ChartComparison from './ChartComparison.jsx'
import { useState } from 'react'
import { cascade } from './motion.js'
import { useWidth } from './HistoryChart.jsx'
import { compound } from './inflacao.js'
import { niceTicks } from './multiSeries.js'
import { nf } from './format.js'

const H = 230
const M = { t: 22, r: 12, b: 34, l: 44 }
const mes = (p) => new Date(`${p}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '')
const mesAno = (p) => new Date(`${p}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace('.', '').replace(' de ', '/')
const sg = (v, d = 2) => (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), d)

// Variação mensal de um grupo do IPCA nos últimos 12 meses (barras), com os valores ao passar o mouse ou nas setas e a tabela abaixo.
export default function IpcaGrupoChart({ name, months, onClose }) {
  const [ref, width] = useWidth()
  const [sel, setSel] = useState(null)
  const last12 = months.slice(-12)
  const have = last12.filter((m) => m.mom != null)
  if (!have.length) return <p className="status" role="status">Sem dados mensais deste grupo no período.</p>
  const vals = have.map((m) => m.mom)
  const { ticks, lo, hi } = niceTicks(Math.min(0, ...vals) - 0.05, Math.max(0, ...vals) + 0.1)
  const iw = Math.max(0, width - M.l - M.r), ih = H - M.t - M.b
  const slot = iw / last12.length, bw = Math.max(6, Math.min(34, slot * 0.62))
  const y = (v) => M.t + (1 - (v - lo) / (hi - lo)) * ih
  const cur = sel != null && last12[sel] ? last12[sel] : null
  const acc = compound(last12.map((m) => m.mom))
  const total = last12.at(-1)
  const onKey = (e) => {
    const n = last12.length, i = sel ?? n - 1
    if (e.key === 'ArrowRight') { e.preventDefault(); setSel(Math.min(n - 1, i + 1)) } else if (e.key === 'ArrowLeft') { e.preventDefault(); setSel(Math.max(0, i - 1)) }
    else if (e.key === 'Home') { e.preventDefault(); setSel(0) } else if (e.key === 'End') { e.preventDefault(); setSel(n - 1) } else if (e.key === 'Escape') setSel(null)
  }
  return (
    <section data-capture-surface className="infl-chart" aria-label={`${name}: variação mensal do IPCA nos últimos 12 meses`}>
      <div className="infl-chart-head">
        <h4>{name} · variação mensal, últimos 12 meses</h4><CaptureButton label={`${name}: variação mensal do IPCA`} />
        <button type="button" className="infl-close" onClick={onClose} aria-label="Fechar o gráfico do grupo">Fechar ×</button>
      </div>
      <p className="muted infl-chart-sum">
        {mesAno(last12[0].period)} a {mesAno(last12.at(-1).period)} · acumulado composto em 12 meses {acc == null ? '—' : `${sg(acc)}%`}
        {total?.y12 != null && <> · divulgado em 12 meses {nf(total.y12)}%</>}
        {total?.weight != null && <> · peso no índice {nf(total.weight)}%</>}
      </p>
      <div ref={ref}>
        {width > 0 && (
          <ChartComparison series={[{ key: name, name, points: last12.map(m=>({t:Date.parse(m.period+'-15T12:00:00Z'),v:m.mom})) }]} history={[{ key:name, points: months.map(m=>({t:Date.parse(m.period+'-15T12:00:00Z'),v:m.mom})) }]} frequency="month" rate compound margin={M} categorical><svg className="hist-svg" viewBox={`0 0 ${width} ${H}`} width="100%" role="img" tabIndex={0} aria-label={`Barras da variação mensal de ${name}. Use as setas para percorrer os meses.`} onKeyDown={onKey} onFocus={() => setSel((s) => s ?? 0)} onBlur={() => setSel(null)} onMouseLeave={() => setSel(null)}>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={M.l} x2={width - M.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? 'var(--mut)' : 'var(--line)'} strokeDasharray={v === 0 ? '4 3' : undefined} />
                <text x={M.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--mut)">{nf(v)}</text>
              </g>
            ))}
            {last12.map((m, i) => {
              const cx = M.l + slot * (i + 0.5)
              const on = sel === i
              return (
                <g key={m.period} onMouseEnter={() => setSel(i)} data-period={m.period}>
                  <rect x={M.l + slot * i} y={M.t} width={slot} height={ih} fill="transparent" />
                  {m.mom != null && <rect className={`infl-bar bar-grow-y${m.mom < 0 ? ' neg' : ''}`} style={cascade(i, 40)} x={cx - bw / 2} y={Math.min(y(m.mom), y(0))} width={bw} height={Math.max(1, Math.abs(y(m.mom) - y(0)))} rx="2" fill={m.mom >= 0 ? 'var(--chart-oil)' : 'var(--chart-teal)'} opacity={sel == null || on ? 1 : 0.55} />}
                  {m.mom != null && (slot >= 44 || on) && <text x={cx} y={m.mom >= 0 ? y(m.mom) - 5 : y(m.mom) + 13} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--fg)">{sg(m.mom)}</text>}
                  <text x={cx} y={H - 12} textAnchor="middle" fontSize="11" fill={on ? 'var(--fg)' : 'var(--mut)'}>{mes(m.period)}</text>
                </g>
              )
            })}
          </svg></ChartComparison>
        )}
      </div>
      <p className="chart-access-text" role="status" aria-live="polite">{cur && `${mesAno(cur.period)}: ${cur.mom == null ? 'sem dado' : `${sg(cur.mom)}% no mês`}${cur.contribution != null ? `, contribuição ${sg(cur.contribution)} p.p.` : ''}`}</p>
      <p className="infl-pick muted" aria-hidden="true">{cur ? `${mesAno(cur.period)}: ${cur.mom == null ? 'sem dado' : `${sg(cur.mom)}% no mês`}${cur.contribution != null ? ` · contribuição ${sg(cur.contribution)} p.p.` : ''}` : 'Passe o mouse ou use as setas para ver o mês.'}</p>
      <details className="infl-values">
        <summary>Valores mês a mês</summary>
        <div className="infl-wrap">
          <table className="infl-table"><caption>{name} · variação mensal do IPCA</caption>
            <thead><tr><th scope="col">Mês</th><th scope="col">Variação %</th><th scope="col">Peso %</th><th scope="col">Contribuição p.p.</th><th scope="col">12 meses %</th></tr></thead>
            <tbody>{[...last12].reverse().map((m) => <tr key={m.period}><th scope="row">{mesAno(m.period)}</th><td>{m.mom == null ? '—' : sg(m.mom)}</td><td>{m.weight == null ? '—' : nf(m.weight)}</td><td>{m.contribution == null ? '—' : sg(m.contribution)}</td><td>{m.y12 == null ? '—' : nf(m.y12)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </section>
  )
}
