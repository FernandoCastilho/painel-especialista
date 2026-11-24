import ChartComparison from './ChartComparison.jsx'
import { useId } from 'react'
import { periodChange } from './stats.js'
import RotulosMini from './RotulosMini.jsx'

// Minigráfico de linha. A cor vem de `tone` (a mesma variação mostrada no quadro): verde se subiu, vermelho se caiu, cinza se estável.
// Sem `tone`, usa a variação do próprio período. Com `fmt`, mostra o valor do pico e do vale (com folga em cima e embaixo para o texto).
export default function Sparkline({ points, tone, height = 44, rate = false, label = 'Minigráfico', fmt }) {
  const gid = useId().replace(/:/g, '')
  const W = 120
  if (!points || points.length < 2) return <svg viewBox={`0 0 ${W} ${height}`} className="spark" aria-hidden="true" />
  const vals = points.map((p) => p.bid)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const start = points[0].t, end = points.at(-1).t
  const timed = Number.isFinite(start) && Number.isFinite(end) && end > start
  const x = (i) => timed ? (points[i].t - start) / (end - start) * W : (i / (points.length - 1)) * W
  const pad = fmt ? 12 : 3
  const y = (v) => hi === lo ? height / 2 : pad + (1 - (v - lo) / (hi - lo)) * (height - 2 * pad)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.bid).toFixed(1)}`).join('')
  const t = tone ?? (periodChange(points) >= 0 ? 'up' : 'down')
  const color = t === 'up' ? 'var(--up)' : t === 'down' ? 'var(--down)' : 'var(--mut)'
  const grafico = (
    <ChartComparison compact rate={rate} margin={{l:0,r:0,t:3,b:3}} series={[{key:'preview',name:label,points}]}><svg viewBox={`0 0 ${W} ${height}`} className="spark" preserveAspectRatio="none" role="img" aria-label="Minigráfico: arraste para comparar um trecho; o ano anterior depende da cobertura carregada">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L${W},${height}L0,${height}Z`} fill={`url(#${gid})`} />
      <path className="line" style={{ color }} d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg></ChartComparison>
  )
  if (!fmt) return grafico
  return <span className="mini-box spark-box">{grafico}<RotulosMini points={points} fmt={fmt} x={(i) => x(i) / W * 100} y={(i) => y(points[i].bid) / height * 100} /></span>
}
