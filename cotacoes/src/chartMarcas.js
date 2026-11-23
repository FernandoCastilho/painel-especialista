// Pontos que ganham rótulo de valor dentro do gráfico: último, primeiro, máximo, mínimo e os picos e vales mais marcados.
// Se a linha não tiver virada (sobe ou desce sempre), entram pontos do meio, para o leitor ver alguns níveis ao longo dela.
// Rótulos sem encavalar (distância mínima em px) e sem repetir o mesmo valor. Devolve [{ i, vale }], em ordem.
export function marcasValor(vals, xs, { gap = 64, max = 6, min = 4 } = {}) {
  const n = vals.length
  if (!n) return []
  const hi = vals.indexOf(Math.max(...vals))
  const lo = vals.indexOf(Math.min(...vals))
  const viradas = viradasMarcadas(vals)
  const vales = new Set([lo, ...viradas.filter((v) => v.vale).map((v) => v.i)])
  const kept = []
  const cabe = (i) => kept.length < max && !kept.some((k) => Math.abs(xs[k] - xs[i]) < gap || vals[k] === vals[i])
  for (const i of [n - 1, 0, hi, lo, ...viradas.map((v) => v.i)]) if (cabe(i)) kept.push(i)
  // linha sem virada: preencher o maior vão entre rótulos com o ponto do meio, até `min` rótulos
  while (kept.length < min) {
    const ord = [...kept].sort((a, b) => a - b)
    let melhor = null
    for (let k = 1; k < ord.length; k++) {
      const meio = Math.round((ord[k - 1] + ord[k]) / 2)
      if (meio === ord[k - 1] || meio === ord[k] || !cabe(meio)) continue
      const vao = xs[ord[k]] - xs[ord[k - 1]]
      if (!melhor || vao > melhor.vao) melhor = { meio, vao }
    }
    if (!melhor) break
    kept.push(melhor.meio)
  }
  return kept.sort((a, b) => a - b).map((i) => ({ i, vale: vales.has(i) }))
}

// Picos e vales que revertem pelo menos 10% da amplitude da série (ignora o vaivém miúdo), do maior ao menor movimento.
function viradasMarcadas(vals) {
  const amp = Math.max(...vals) - Math.min(...vals)
  if (!(amp > 0)) return []
  const lim = amp * 0.1
  const out = []
  let ext = 0, dir = 0
  for (let i = 1; i < vals.length; i++) {
    const v = vals[i]
    if (dir >= 0 && v > vals[ext]) { if (dir === 0 && v - vals[0] < lim) continue; ext = i; dir = 1; continue }
    if (dir <= 0 && v < vals[ext]) { if (dir === 0 && vals[0] - v < lim) continue; ext = i; dir = -1; continue }
    if (dir === 0) continue
    if (Math.abs(v - vals[ext]) >= lim) {
      out.push({ i: ext, vale: dir < 0, mov: Math.abs(v - vals[ext]) })
      ext = i
      dir = -dir
    }
  }
  return out.filter((v) => v.i > 0 && v.i < vals.length - 1).sort((a, b) => b.mov - a.mov)
}

// Altura do rótulo: vale fica abaixo do ponto; perto da borda, do outro lado, para não sair do gráfico.
export function yRotulo(y, vale, topo, base) {
  const abaixo = vale ? y + 18 <= base : y - 9 < topo + 10
  return abaixo ? y + 16 : y - 9
}

// Alinhamento: primeiro rótulo encostado à esquerda, último à direita, os demais centralizados no ponto.
export function ancoraRotulo(i, n) {
  if (i === 0) return 'start'
  if (i === n - 1) return 'end'
  return 'middle'
}
