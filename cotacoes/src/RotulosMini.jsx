import { picoEVale } from './chartMarcas.js'

// Rótulos de pico e vale sobre um minigráfico esticado (preserveAspectRatio="none"): ficam fora do SVG, em HTML,
// para o texto não deformar. `x` e `y` dão a posição do ponto em % da caixa do gráfico.
export default function RotulosMini({ points, fmt, x, y }) {
  if (!fmt || !points || points.length < 2) return null
  const xs = points.map((_, i) => x(i))
  return picoEVale(points.map((p) => p.bid), xs, 100).map(({ i, vale }) => (
    <span key={i} aria-hidden="true" className={`mini-rotulo${vale ? ' vale' : ''}${borda(xs[i])}`} style={{ left: `${xs[i]}%`, top: `${y(i)}%` }}>{fmt(points[i].bid)}</span>
  ))
}

// Perto das pontas, o rótulo alinha pela borda para não sair da caixa.
function borda(xPct) {
  if (xPct < 15) return ' ini'
  if (xPct > 85) return ' fim'
  return ''
}
