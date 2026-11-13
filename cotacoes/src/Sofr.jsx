import { nextChartIndex } from './chartNavigation.js'
import { marcasRedondas, rotuloData } from './chartEixo.js'
import { focoPorTeclado, limitarBalao, rotuloEixo, saidaDeToque, useLarguraBalao, useTocarFora } from './chartToque.js'
import ChartComparison from './ChartComparison.jsx'
import Flag from './Flag.jsx'
import RefreshButton from './RefreshButton.jsx'
import { Aviso } from './Avisos.jsx'
import { useMemo, useState } from 'react'
import Explain from './Explain.jsx'
import { fmtDate, useWidth } from './HistoryChart.jsx'

const H = 260
const M = { t: 14, r: 16, b: 30, l: 52 }
const DAY = 864e5
const SERIES = [
  { id: 'raw', label: 'SOFR do dia', color: 'var(--chart-gold)', on: true },
  { id: 'm30', label: 'Média 30 d', color: 'var(--chart-teal)', on: false },
  { id: 'm90', label: 'Média 90 d', color: 'var(--chart-purple)', on: false },
  { id: 'm180', label: 'Média 180 d', color: 'var(--chart-pink)', on: false },
  { id: 'band', label: 'Faixa 1º–99º percentil', color: 'var(--chart-gold)', on: false },
]
const pct = (v) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

// SOFR crua (overnight, taxa do dia) com médias de 30/90/180 dias e faixa de percentis, ligáveis pela legenda.
export default function SofrChart({ macro, range }) {
  const [ref, width] = useWidth()
  const [on, setOn] = useState(() => Object.fromEntries(SERIES.map((s) => [s.id, s.on])))
  const [hover, setHover] = useState(null)
  const plotRef = useTocarFora(hover != null, setHover)
  const from = range.start.getTime()
  const to = range.end.getTime() + DAY

  const rows = useMemo(() => {
    const avg = new Map((macro.sofrAvg ?? []).map((r) => [r[0], r]))
    return macro.sofr
      .filter(([t]) => t >= from && t <= to)
      .map(([t, v, p1, p99]) => {
        const a = avg.get(t)
        return { t, raw: v, p1, p99, m30: a?.[1] ?? null, m90: a?.[2] ?? null, m180: a?.[3] ?? null }
      })
  }, [macro, from, to])
  const hasAvg = (macro.sofrAvg?.length ?? 0) > 0
  const avail = (id) => (id === 'raw' ? true : id === 'band' ? rows.some((r) => r.p1 != null) : hasAvg && rows.some((r) => r[id] != null))

  const g = useMemo(() => {
    if (rows.length < 2) return null
    const vals = []
    for (const r of rows) {
      vals.push(r.raw)
      if (on.m30 && r.m30 != null) vals.push(r.m30)
      if (on.m90 && r.m90 != null) vals.push(r.m90)
      if (on.m180 && r.m180 != null) vals.push(r.m180)
      if (on.band && r.p1 != null) vals.push(r.p1, r.p99)
    }
    let lo = Math.min(...vals)
    let hi = Math.max(...vals)
    const pad = (hi - lo || 0.5) * 0.12
    // eixo em números redondos, com o domínio estendido até a marca vizinha
    const eixo = marcasRedondas(lo - pad, hi + pad)
    lo = eixo.lo
    hi = eixo.hi
    const t0 = rows[0].t
    const t1 = rows[rows.length - 1].t
    const iw = width - M.l - M.r
    const ih = H - M.t - M.b
    const X = (t) => M.l + ((t - t0) / (t1 - t0 || 1)) * iw
    const Y = (v) => M.t + (1 - (v - lo) / (hi - lo)) * ih
    const path = (key) => {
      let d = ''
      let pen = false
      for (const r of rows) {
        if (r[key] == null) {
          pen = false
          continue
        }
        d += `${pen ? 'L' : 'M'}${X(r.t).toFixed(1)},${Y(r[key]).toFixed(1)}`
        pen = true
      }
      return d
    }
    const bandRows = rows.filter((r) => r.p1 != null && r.p99 != null)
    const band = bandRows.length > 1 ? bandRows.map((r, i) => `${i ? 'L' : 'M'}${X(r.t).toFixed(1)},${Y(r.p99).toFixed(1)}`).join('') + bandRows.slice().reverse().map((r) => `L${X(r.t).toFixed(1)},${Y(r.p1).toFixed(1)}`).join('') + 'Z' : ''
    const yTicks = eixo.ticks
    const nx = width < 420 ? 3 : 5
    const xTicks = Array.from({ length: nx }, (_, i) => t0 + ((t1 - t0) * i) / (nx - 1))
    return { X, Y, path, band, yTicks, xTicks, t0, t1, casas: eixo.casas }
  }, [rows, on, width])

  const onMove = (e) => {
    if (!g) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * width
    let best = 0
    let bd = Infinity
    rows.forEach((r, i) => {
      const d = Math.abs(g.X(r.t) - px)
      if (d < bd) ((bd = d), (best = i))
    })
    setHover(best)
  }
  const onKey = e => { const next=nextChartIndex(e.key,hover,rows.length); if(next!=null){e.preventDefault();setHover(next)} }
  const hp = g && hover != null ? rows[hover] : null
  const [tipRef, tipW] = useLarguraBalao(hp)
  const last = macro.sofr[macro.sofr.length - 1]
  const first = macro.sofr[0]

  return (
    <article className="chart curve" style={{ '--series': SERIES[0].color }}>
      <header>
        <h3>
          <i className="swatch" /> <Flag code="USD" width={18} height={12} />SOFR
          <small>EUA · overnight, taxa do dia</small>
          <Explain id="sofr" grafico />
        </h3>
        <RefreshButton files={['macro.json']} label="SOFR" />
      </header>
      <div className="curve-legend">
        {SERIES.filter((s) => avail(s.id)).map((s) => (
          <button key={s.id} type="button" className={on[s.id] ? 'series-visible' : 'series-hidden'} style={{ '--series': s.color }} aria-pressed={on[s.id]} disabled={s.id === 'raw'} onClick={() => setOn((o) => ({ ...o, [s.id]: !o[s.id] }))}>
            <i className="swatch" /> {s.label} <small>{s.id === 'raw' ? 'Sempre visível' : on[s.id] ? 'Visível' : 'Oculta'}</small>
          </button>
        ))}
      </div>
      <div ref={ref}>
        {g ? (
          <div ref={plotRef} className="plot" onPointerLeave={(e) => { if (!saidaDeToque(e)) setHover(null) }}>
            <ChartComparison margin={M} rate frequency="day" series={SERIES.filter(s=>s.id!=='band' && on[s.id]).map(s=>({key:s.id,name:s.label,points:rows.filter(r=>r[s.id]!=null).map(r=>({t:r.t,v:r[s.id]}))}))} history={SERIES.filter(s=>s.id!=='band').map(s=>({key:s.id,points:(s.id==='raw' ? macro.sofr.map(r=>({t:r[0],v:r[1]})) : (macro.sofrAvg || []).map(r=>({t:r[0],v:r[{m30:1,m90:2,m180:3}[s.id]]}))).filter(p=>Number.isFinite(p.v))}))}><svg onFocus={(e) => { if (focoPorTeclado(e)) setHover(0) }} onKeyDown={onKey} viewBox={`0 0 ${width} ${H}`} width="100%" height={H} role="img" aria-label={`SOFR de ${fmtDate(g.t0, true)} a ${fmtDate(g.t1, true)}`} onPointerMove={onMove} onPointerDown={onMove}>
              {g.yTicks.map((v) => (
                <g key={v}>
                  <line x1={M.l} x2={width - M.r} y1={g.Y(v)} y2={g.Y(v)} className="gridline" />
                  <text x={M.l - 8} y={g.Y(v)} dy="0.32em" textAnchor="end" className="tick">{rotuloEixo(v, g.casas)}</text>
                </g>
              ))}
              {g.xTicks.map((t, i) => (
                <text key={t} x={g.X(t)} y={H - 8} textAnchor={i === 0 ? 'start' : i === g.xTicks.length - 1 ? 'end' : 'middle'} className="tick">{rotuloData(t, { de: g.t0, ate: g.t1 })}</text>
              ))}
              {on.band && g.band && <path d={g.band} fill={SERIES[4].color} opacity="0.16" />}
              {['m180', 'm90', 'm30'].map((k) => on[k] && <path key={k} d={g.path(k)} fill="none" stroke={SERIES.find((s) => s.id === k).color} strokeWidth="1.6" strokeLinejoin="round" />)}
              <path d={g.path('raw')} fill="none" stroke={SERIES[0].color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {hp && <line x1={g.X(hp.t)} x2={g.X(hp.t)} y1={M.t} y2={H - M.b} className="cross" pointerEvents="none" />}
            </svg></ChartComparison>
            {hp && (
              <div ref={tipRef} className="tip" style={{ left: limitarBalao(g.X(hp.t), tipW, width) }}>
                <strong>{fmtDate(hp.t, true)}</strong>
                <span>SOFR {pct(hp.raw)}</span>
                {on.m30 && hp.m30 != null && <span>Média 30 d {pct(hp.m30)}</span>}
                {on.m90 && hp.m90 != null && <span>Média 90 d {pct(hp.m90)}</span>}
                {on.m180 && hp.m180 != null && <span>Média 180 d {pct(hp.m180)}</span>}
                {on.band && hp.p1 != null && <span>Faixa {pct(hp.p1)} a {pct(hp.p99)}</span>}
              </div>
            )}
          </div>
        ) : (
          <div className="placeholder" style={{ height: H }}>Sem dados no período.</div>
        )}
      </div>
      <p className="chart-access-text" role="status" aria-live="polite">{hp && `${fmtDate(hp.t,true)}: SOFR ${pct(hp.raw)}`}</p>
      <Aviso title="SOFR · EUA"><p className="status">
        {last ? `Último: ${pct(last[1])} em ${fmtDate(last[0], true)} · ` : ''}
        {first ? `Série desde ${fmtDate(first[0], true)} · ` : ''}
        Taxa crua do dia; as médias (compostas) e a faixa de percentis são opcionais na legenda.
      </p></Aviso>
    </article>
  )
}
