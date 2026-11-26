import { useId } from 'react'

// Degradê sob a linha, o mesmo do gráfico do dólar (Plot em HistoryChart.jsx): cor da série a 18% no topo, sumindo até a base.
// pontos: [[x, y], ...] já em coordenadas do SVG; base: y do pé da área. Pedido do Fernando em 25/11/2026.
// linha: { d, x0, x1 } usa o traçado pronto da série (serve para linhas em degraus), do x0 ao x1.
export default function AreaDegrade({ pontos, base, cor, linha }) {
  const id = `area-${useId().replace(/:/g, '')}`
  let d
  if (linha?.d) d = `${linha.d}L${linha.x1},${base}L${linha.x0},${base}Z`
  else if (pontos && pontos.length >= 2) d = pontos.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('') + `L${pontos.at(-1)[0]},${base}L${pontos[0][0]},${base}Z`
  else return null
  return <>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={cor} stopOpacity="0.18" /><stop offset="1" stopColor={cor} stopOpacity="0" /></linearGradient></defs>
    <path d={d} fill={`url(#${id})`} pointerEvents="none" />
  </>
}
