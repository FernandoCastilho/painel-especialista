import Flag from './Flag.jsx'
import RefreshButton from './RefreshButton.jsx'
import DateRangePicker from './DateRangePicker.jsx'
import { Aviso } from './Avisos.jsx'
import { useMemo, useState } from 'react'
import Explain from './Explain.jsx'
import { Plot, useWidth } from './HistoryChart.jsx'
import { busDaysIn } from './holidays.js'
import { forwardBetween, forwardSeries, horizonTable } from './cdiFuturo.js'
import IndicatorTable from './IndicatorTable.jsx'

const pct = (v) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const dm = (iso) => iso.split('-').reverse().join('/')

// CDI futuro: taxa a termo implícita nos futuros de DI (curva DI x pré da B3), em % a.a., por data.
export default function CdiFuturo({ curves, macro, hol }) {
  const [ref, width] = useWidth()
  const br = curves.data?.br
  const today = br?.compare?.find((c) => c.id === 'hoje')
  const pts = today ? br.curves[today.date] : null
  const base = today?.date
  const maxD = pts ? Math.max(...pts.map((p) => p[0])) : 0
  const isoPlus = (days) => new Date(Date.parse(`${base}T12:00:00Z`) + days * 864e5).toISOString().slice(0, 10)
  const maxIso = base ? isoPlus(Math.floor((maxD / 252) * 365)) : ''
  const [light, setLight] = useState(false)
  const [pick, setPick] = useState({ from: '', to: '' })
  const clamp = (v) => (v < base ? base : v > maxIso ? maxIso : v)
  const rawFrom = pick.from || base
  const rawTo = pick.to || (base ? (isoPlus(365) < maxIso ? isoPlus(365) : maxIso) : '')
  // a curva vale a partir da data-base: datas fora do intervalo são ajustadas e o aviso aparece na tela
  const from = base ? clamp(rawFrom) : rawFrom
  const to = base ? clamp(rawTo) : rawTo
  const adjusted = base && (from !== rawFrom || to !== rawTo)
  const d1 = base ? busDaysIn(base, from, ['BR'], hol?.ctx) : 0
  const d2 = base ? busDaysIn(base, to, ['BR'], hol?.ctx) : 0
  const series = useMemo(() => {
    if (!pts || d2 <= d1) return null
    const t0 = Date.parse(`${base}T12:00:00Z`)
    const f = forwardSeries(pts, d1, d2).map((p) => ({ t: t0 + (p.d / 252) * 365 * 864e5, bid: p.rate }))
    return f.length >= 2 ? f : null
  }, [pts, base, d1, d2])
  const term = pts && d2 > d1 ? forwardBetween(pts, d1, d2) : null
  const avgToEnd = pts && d2 > 0 ? forwardBetween(pts, 0, d2) : null
  const rows = useMemo(() => horizonTable(pts), [pts])

  return (
    <section className="macro" aria-labelledby="cdif-h">
      <h2 id="cdif-h">CDI futuro</h2>
      {curves.status === 'loading' && <div className="placeholder">Carregando curva DI…</div>}
      {curves.status !== 'loading' && !pts && <p className="status">CDI futuro indisponível: depende da curva DI x pré, que não veio na última atualização.</p>}
      {pts && (
        <article className="chart">
          <header>
            <h3>
              <Flag code="BRL" width={18} height={12} />CDI a termo implícito
              <Explain id="cdiFuturo" grafico />
              <small>% a.a., taxa a termo do DI no intervalo que você escolher</small>
            </h3>
            <RefreshButton files={['curves.json', 'macro.json']} label="CDI futuro" />
            <button type="button" className="mode-btn" onClick={() => setLight((v) => !v)} aria-pressed={light} aria-label="Gráfico em modo claro" title="Gráfico em modo claro (útil para copiar para apresentações)">
              {light ? '☾' : '☀'}
            </button>
          </header>
          <div className="period">
            <DateRangePicker label="Período do CDI futuro" start={rawFrom} end={rawTo} min={base} max={maxIso} onChange={(from, to) => setPick({ from, to })} />
          </div>
          {adjusted && <p className="status stale">Datas ajustadas: a curva vale de {dm(base)} (data-base) a {dm(maxIso)} (último vértice). Mostrando {dm(from)} a {dm(to)}.</p>}
          {term != null ? (
            <p className="cdif-result">
              CDI a termo de {dm(from)} a {dm(to)}: <b>{pct(term)}</b> a.a.
              {d1 > 0 && avgToEnd != null && <> · CDI médio de hoje até {dm(to)}: <b>{pct(avgToEnd)}</b></>}
              <small className="muted"> ({d2 - d1} dias úteis, feriados nacionais)</small>
            </p>
          ) : (
            <p className="status stale">Escolha um intervalo dentro da curva (até {dm(maxIso)}), com “Até” depois de “De”.</p>
          )}
          <div ref={ref}>{series && <Plot points={series} width={width} color="var(--chart-teal)" code="cdif" fmt={pct} label="CDI a termo" compare={false} compareReason="a curva a termo projeta taxas por horizonte, sem série histórica anual equivalente nesta visão." scales={false} nice labels light={light} />}</div>
          <details className="table" open>
            <summary>Tabela por horizonte</summary>
            <div className="scroll">
            <table>
              <thead>
                <tr><th>Horizonte</th><th>CDI médio até lá</th><th>CDI a termo no trecho</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.d}>
                    <td>{r.label}</td>
                    <td>{pct(r.avg)}</td>
                    <td>{r.fwd != null ? pct(r.fwd) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </details>
          <Aviso title="CDI futuro · método"><p className="status">
            DI x pré de {dm(today.date)}. É o CDI que o mercado precifica, com prêmio de risco embutido, não uma projeção oficial. "CDI médio até lá" é a taxa composta do DI até o vértice; "a termo no trecho" é a taxa implícita entre o horizonte anterior e este. Para a visão de analistas, veja o Boletim Focus (Selic).
          </p></Aviso>
        </article>
      )}
    </section>
  )
}

// Aba Juros: os números do CDI futuro por horizonte; a linha abre o gráfico e a escolha de datas em tela própria.
export function CdiFuturoTable({ curves, onOpen }) {
  const br = curves.data?.br
  const today = br?.compare?.find((c) => c.id === 'hoje')
  const pts = today ? br.curves[today.date] : null
  const rows = useMemo(() => horizonTable(pts), [pts])
  return (
    <section id="juros-cdif" className="macro executive-rates cdif-table juros-tabela" aria-labelledby="cdif-table-h">
      <header className="executive-rates__heading">
        <h2 id="cdif-table-h"><Flag code="BRL" width={18} height={12} />CDI futuro <small>taxa a termo implícita nos futuros de DI</small></h2>
        <Explain id="cdiFuturo" />
      </header>
      {curves.status === 'loading' && <div className="placeholder">Carregando curva DI…</div>}
      {curves.status !== 'loading' && !rows.length && <p className="status">CDI futuro indisponível: depende da curva DI x pré, que não veio na última atualização.</p>}
      {rows.length > 0 && (
        <>
          <div className="executive-rates__scroll">
            <IndicatorTable
              first="Horizonte"
              caption="CDI futuro por horizonte"
              columns={[{ label: 'CDI médio até lá' }, { label: 'CDI a termo no trecho' }]}
              rows={rows.map((r) => ({ id: 'cdif', key: r.d, name: r.label, sub: `${r.vertex} dias úteis`, openLabel: `CDI futuro, ${r.label}: abrir gráfico`, cells: [{ text: pct(r.avg) }, { text: r.fwd != null ? pct(r.fwd) : '—' }] }))}
              onOpen={onOpen}
            />
          </div>
          <p className="ind-note">Taxa que o mercado precifica nos futuros de DI, em % a.a., com base em {dm(today.date)}. Toque em uma linha para abrir o gráfico e escolher as datas.</p>
        </>
      )}
    </section>
  )
}
