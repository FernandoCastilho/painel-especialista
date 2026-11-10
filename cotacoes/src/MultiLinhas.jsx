import { compareWindow } from './chartComparison.js'
import { chartLinePath } from './chartLinePath.js'
import ChartComparison from './ChartComparison.jsx'
import { useMemo, useState } from 'react'
import { nextChartIndex } from './chartNavigation.js'
import { focoPorTeclado } from './chartToque.js'
import { niceTicks, valueAt } from './multiSeries.js'

const H = 260
const M = { t: 12, r: 18, b: 28, l: 56 }
const dmy = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' })

// Várias séries no mesmo gráfico. series: [{ key, name, color, points: [{ t, v }] }] (v já no modo escolhido).
// A legenda mostra o valor de cada série na data sob o cursor; com até 8 séries também há um balão no gráfico.
export default function MultiLinhas({ series: baseSeries, width, fmt, ariaLabel, history = baseSeries, frequency = 'auto', rate = true, compareUnavailable = '', comparisonSeries = baseSeries, comparisonHistory = history }) {
  const [hover, setHover] = useState(null)
  const [selection, setSelection] = useState(null)
  const baseTimes=baseSeries.flatMap(s=>s.points.map(p=>p.t))
  const baseStart=Math.min(...baseTimes), baseEnd=Math.max(...baseTimes)
  const priors=selection ? comparisonHistory.map(s=>compareWindow(s.points,...selection,{frequency,prior:true})).filter(Boolean) : []
  // Só estende o eixo ao soltar o ponteiro; a geometria fica estável durante o arraste.
  const from=selection ? Math.min(baseStart,...selection,...priors.map(p=>p.t0)) : baseStart
  const series=from<baseStart ? baseSeries.map(s=>({...s,points:(history.find(h=>h.key===s.key)?.points || s.points).filter(p=>p.t>=from && p.t<=baseEnd)})) : baseSeries
  const comparisonView=from<baseStart ? comparisonSeries.map(s=>({...s,points:(comparisonHistory.find(h=>h.key===s.key)?.points || s.points).filter(p=>p.t>=from && p.t<=baseEnd)})) : comparisonSeries
  const resetKey=baseSeries.map(s=>`${s.key}:${s.points.length}:${s.points[0]?.t}:${s.points.at(-1)?.t}:${s.points[0]?.v}:${s.points.at(-1)?.v}`).join('|')
  const all = useMemo(() => series.flatMap((s) => s.points), [series])
  const dom = useMemo(() => {
    const ts = all.map((p) => p.t), vs = all.map((p) => p.v)
    const lo = Math.min(...vs), hi = Math.max(...vs), pad = (hi - lo || Math.abs(hi) || 1) * 0.08
    return { t0: Math.min(...ts), t1: Math.max(...ts), ...niceTicks(lo - pad, hi + pad) }
  }, [all])
  if (!all.length || width <= 0) return null
  const { t0, t1, ticks, lo, hi } = dom
  const iw = width - M.l - M.r, ih = H - M.t - M.b
  const x = (t) => M.l + (t1 === t0 ? iw / 2 : ((t - t0) / (t1 - t0)) * iw)
  const y = (v) => M.t + (1 - (v - lo) / (hi - lo)) * ih
  const nx = width < 420 ? 3 : 5
  const xTicks = Array.from({ length: nx }, (_, i) => t0 + ((t1 - t0) * i) / (nx - 1))
  const times = [...new Set(all.map((p) => p.t))].sort((a, b) => a - b)
  const hoverAt = hover == null ? null : times.reduce((b, t) => (Math.abs(t - hover) < Math.abs(b - hover) ? t : b), times[0])
  const at = (s) => (hoverAt == null ? null : valueAt(s.points, hoverAt))
  const onMove = (e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(t0 + ((((e.clientX - r.left) / r.width) * width - M.l) / iw) * (t1 - t0)) }
  const onKey = (e) => {
    const cur = hoverAt == null ? 0 : times.indexOf(hoverAt)
    const next = nextChartIndex(e.key, cur, times.length)
    if (next != null) { e.preventDefault(); setHover(times[next]) }
  }
  const bubble = series.length <= 8 && width >= 520 && hoverAt != null
  const bw = 176, bh = 22 + series.length * 16
  const hx = hoverAt != null ? x(hoverAt) : 0
  const bx = hx + 12 + bw > width - 4 ? hx - 12 - bw : hx + 12
  return (
    <ChartComparison resetKey={resetKey} onRangeChange={setSelection} series={comparisonView} history={comparisonHistory} frequency={frequency} rate={rate} unavailable={compareUnavailable}><div className="ml">
      <svg className="hist-svg ml-svg" viewBox={`0 0 ${width} ${H}`} width="100%" role="img" tabIndex={0} aria-label={ariaLabel} onKeyDown={onKey} onFocus={(e) => { if (focoPorTeclado(e)) setHover(t0) }} onBlur={() => setHover(null)}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} onTouchMove={(e) => onMove(e.touches[0] && { currentTarget: e.currentTarget, clientX: e.touches[0].clientX })}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={width - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={M.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--mut)">{fmt(v, true)}</text>
          </g>
        ))}
        {xTicks.map((t, i) => <text key={i} x={x(t)} y={H - 8} textAnchor={i === 0 ? 'start' : i === nx - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--mut)">{dmy(t)}</text>)}
        {series.map((s) => s.points.length > 0 && <path key={s.key} className="ml-line" data-key={s.key} d={chartLinePath(s.points, x, y, 'v', s.stepped)} fill="none" stroke={s.color} strokeWidth={series.length > 10 ? 1.4 : 2} strokeLinejoin="round" />)}
        {hoverAt != null && (
          <g pointerEvents="none">
            <line x1={hx} x2={hx} y1={M.t} y2={H - M.b} stroke="var(--mut)" />
            {series.map((s) => { const p = at(s); return p ? <circle key={s.key} cx={x(Math.max(p.t, t0))} cy={y(p.v)} r="3" fill={s.color} /> : null })}
            {bubble && (
              <g className="ml-tip">
                <rect x={bx} y={M.t} width={bw} height={bh} rx="8" fill="var(--card, #161b22)" stroke="var(--line)" opacity="0.96" />
                <text x={bx + 10} y={M.t + 15} fontSize="11" fill="var(--mut)">{dmy(hoverAt)}</text>
                {series.map((s, k) => { const p = at(s); return (
                  <text key={s.key} x={bx + 10} y={M.t + 32 + k * 16} fontSize="11.5" fill="var(--fg)">
                    <tspan fill={s.color} fontWeight="700">●</tspan><tspan dx="5">{s.short ?? s.name}</tspan><tspan dx="6" fontWeight="700">{p ? fmt(p.v) : '—'}</tspan>
                  </text>
                ) })}
              </g>
            )}
          </g>
        )}
      </svg>
      <ul className="ml-legend" aria-label="Séries do gráfico e valor na data escolhida">
        {series.map((s) => { const p = at(s); return (
          <li key={s.key} data-key={s.key}><i style={{ background: s.color }} aria-hidden="true" /><span className="ml-name" title={s.name}>{s.name}</span><b className="ml-val">{hoverAt == null ? fmt(s.points.at(-1)?.v ?? NaN) : p ? fmt(p.v) : '—'}</b></li>
        ) })}
      </ul>
      <p className="chart-access-text" role="status" aria-live="polite">{hoverAt != null && `${dmy(hoverAt)} · ${series.map((s) => `${s.name}: ${at(s) ? fmt(at(s).v) : '—'}`).join(' · ')}`}</p>
    </div></ChartComparison>
  )
}
