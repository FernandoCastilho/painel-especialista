import { useId } from 'react'

// Degradê sob a linha, o mesmo do gráfico do dólar (Plot em HistoryChart.jsx): cor da série a 18% no topo, sumindo até a base.
// pontos: [[x, y], ...] já em coordenadas do SVG; base: y do pé da área. Pedido do Fernando em 25/11/2026.
export default function AreaDegrade({ pontos, base, cor }) {
  const id = `area-${useId().replace(/:/g, '')}`
  if (!pontos || pontos.length < 2) return null
  const d = pontos.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('') + `L${pontos.at(-1)[0]},${base}L${pontos[0][0]},${base}Z`
  return <>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={cor} stopOpacity="0.18" /><stop offset="1" stopColor={cor} stopOpacity="0" /></linearGradient></defs>
    <path d={d} fill={`url(#${id})`} pointerEvents="none" />
  </>
}
