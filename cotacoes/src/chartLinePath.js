// Degraus são apenas geometria: não adicionam observações à série ou ao tooltip.
export function chartLinePath(points, x, y, key = 'v', stepped = false) {
  return points.map((point, i) => {
    const px = x(point.t).toFixed(1), py = y(point[key]).toFixed(1)
    if (!i) return `M${px},${py}`
    return stepped ? `H${px}V${py}` : `L${px},${py}`
  }).join('')
}

// Desenha somente observações reais. Abre outro segmento quando um bloco ficou vazio.
export function caminhoCincoMinutos(points, x, y) {
  const bloco = (t) => Math.floor(t / 300000)
  return points.map((p, i) => {
    const semAmostra = i > 0 && bloco(p.t) - bloco(points[i - 1].t) > 1
    return `${i === 0 || semAmostra ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.bid).toFixed(1)}`
  }).join('')
}
