import { useEffect, useMemo, useState } from 'react'
import { Plot, useWidth } from './HistoryChart.jsx'
import { flagSvg } from './flags.js'
import { marcosEntre } from './eventosMercado.js'
import { readStorage } from './storage.js'
import { useDataFile } from './useDataFile.js'
import { cdsSerie, cdsView } from './cds.js'

// Gráfico do CDS Brasil 5 anos aberto pela tabela do Mercado: mesmo quadro, filtros e gráfico do dólar,
// com um ponto por dia de fechamento (a fonte não tem cotação intradiária).
const H = 240
const f2 = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pb = (v) => `${f2(v)} pb`
const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + f2(Math.abs(v))
const dia = (d) => d.split('-').reverse().join('/')

export default function CdsChart({ start, end }) {
  const arq = useDataFile('cds.json')
  const [ref, width] = useWidth()
  const [tableOpen, setTableOpen] = useState(() => readStorage('tabelaAberta') === '1')
  useEffect(() => { try { localStorage.setItem('tabelaAberta', tableOpen ? '1' : '0') } catch { /* sem armazenamento */ } }, [tableOpen])
  const valido = arq.status === 'ok' && !!cdsView(arq.data)
  const serie = useMemo(() => (valido ? cdsSerie(arq.data).map((p) => ({ date: p.date, t: Date.parse(`${p.date}T15:00:00Z`), bid: p.value })) : []), [valido, arq.data])
  const de = start ? start.getTime() : -Infinity, ate = end ? end.getTime() + 864e5 : Infinity
  const pts = useMemo(() => serie.filter((p) => p.t >= de && p.t < ate), [serie, de, ate])
  const marcos = useMemo(() => (pts.length ? marcosEntre(pts[0].t, pts.at(-1).t) : undefined), [pts])
  const delta = pts.length > 1 ? pts.at(-1).bid - pts[0].bid : null
  const pct = delta == null ? null : (delta / pts[0].bid) * 100
  const trend = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'

  return (
    <article className="chart cds-chart" style={{ '--series': '#ff6900' }}>
      <header>
        <h3>
          <span className="flag" aria-hidden="true" dangerouslySetInnerHTML={{ __html: flagSvg('BRL', 'width="24" height="16"') }} /> CDS Brasil 5 anos
          <small>Risco-país · pontos-base</small>
        </h3>
        {pct != null && (
          <div className={`pct ${trend}`}>
            {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '■'} {signed(pct)}%
            <small>{signed(delta)} pb no período</small>
          </div>
        )}
      </header>
      <div ref={ref}>
        {arq.status === 'loading' && <div className="placeholder" style={{ height: H }}>Carregando…</div>}
        {arq.status !== 'loading' && !valido && <div className="placeholder err" role="status" style={{ height: 120 }}>Histórico do CDS indisponível no momento.</div>}
        {valido && !pts.length && <div className="placeholder" role="status">Sem fechamentos do CDS no período selecionado. Escolha outro intervalo.</div>}
        {pts.length > 0 && <Plot points={pts} history={serie} width={width} color="#ff6900" code="CDS" intraday={false} fmt={pb} vfmt={f2} labels label="CDS Brasil 5 anos" extremos marcos={marcos} />}
        {marcos?.length > 0 && <p className="fx-legend"><span className="marco-chave" aria-hidden="true">↑</span> eventos de mercado com data oficial, da agenda do painel e de uma lista conferida. Nome sublinhado abre a fonte; no computador, passe o mouse sobre o nome para ver a origem.</p>}
      </div>
      {pts.length === 1 && <p className="status stale" role="status">Um único fechamento no período; escolha um intervalo maior para ver a variação.</p>}
      {pts.length > 0 && <p className="status">Cobertura exibida: {dia(pts[0].date)} a {dia(pts.at(-1).date)} ({pts.length} {pts.length === 1 ? 'fechamento' : 'fechamentos'}). Um ponto por dia de fechamento, sem cotação intradiária; fonte gratuita e não oficial, lida a cada 2 horas em dias úteis.</p>}
      {pts.length > 0 && (
        <details className="table" open={tableOpen} onToggle={(e) => setTableOpen(e.currentTarget.open)}>
          <summary>Ver tabela ({pts.length} dias)</summary>
          <div className="scroll">
            <table>
              <thead><tr><th>Data</th><th>Fech. (pb)</th><th>Δ pb</th></tr></thead>
              <tbody>
                {pts.map((p, i) => ({ ...p, prev: i > 0 ? pts[i - 1].bid : null })).reverse().map((p) => (
                  <tr key={p.t}>
                    <td>{new Date(p.t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' })}</td>
                    <td>{f2(p.bid)}</td>
                    <td className={p.prev == null || p.bid === p.prev ? undefined : p.bid > p.prev ? 'pct up' : 'pct down'}>{p.prev == null ? '—' : signed(p.bid - p.prev)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </article>
  )
}
