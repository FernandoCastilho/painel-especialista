// CDI futuro implícito na curva DI x pré da B3. Vértices: [dias úteis (base 252), taxa % a.a. composta desde hoje].
// Taxa a termo entre dois vértices: ((1+r2)^(d2/252) / (1+r1)^(d1/252))^(252/(d2-d1)) − 1.
export function forwardCurve(pts) {
  const v = (pts ?? []).filter(([d, r]) => d > 0 && Number.isFinite(r)).sort((a, b) => a[0] - b[0])
  const out = []
  for (let i = 1; i < v.length; i++) {
    const [d1, r1] = v[i - 1]
    const [d2, r2] = v[i]
    if (d2 <= d1) continue
    const growth = (1 + r2 / 100) ** (d2 / 252) / (1 + r1 / 100) ** (d1 / 252)
    out.push({ from: d1, to: d2, mid: (d1 + d2) / 2, rate: (growth ** (252 / (d2 - d1)) - 1) * 100 })
  }
  return out
}

// Vértice mais próximo de cada horizonte (em dias úteis), com tolerância de 20%.
export const HORIZONS = [
  { label: '3 meses', d: 63 },
  { label: '6 meses', d: 126 },
  { label: '1 ano', d: 252 },
  { label: '2 anos', d: 504 },
  { label: '3 anos', d: 756 },
  { label: '5 anos', d: 1260 },
]
export function horizonTable(pts) {
  const v = pts ?? []
  const rows = []
  let prev = null
  for (const h of HORIZONS) {
    const p = v.reduce((b, q) => (b && Math.abs(b[0] - h.d) <= Math.abs(q[0] - h.d) ? b : q), null)
    if (!p || Math.abs(p[0] - h.d) > h.d * 0.2) continue
    let fwd = null
    if (prev) fwd = (((1 + p[1] / 100) ** (p[0] / 252) / (1 + prev[1] / 100) ** (prev[0] / 252)) ** (252 / (p[0] - prev[0])) - 1) * 100
    rows.push({ ...h, vertex: p[0], avg: p[1], fwd })
    prev = p
  }
  return rows
}

// ---- Datas escolhidas pelo usuário ----
// Dias úteis (seg-sex, sem feriados) entre duas datas ISO; a data final entra, a inicial não.
export function busDays(fromIso, toIso) {
  const a = Date.parse(`${fromIso}T12:00:00Z`)
  const b = Date.parse(`${toIso}T12:00:00Z`)
  if (!(b > a)) return 0
  let n = 0
  for (let t = a + 864e5; t <= b; t += 864e5) {
    const w = new Date(t).getUTCDay()
    if (w !== 0 && w !== 6) n++
  }
  return n
}

// Fator de capitalização do DI até d dias úteis, interpolando linearmente o log do fator entre vértices (taxa a termo constante no trecho).
export function growthAt(pts, d) {
  const v = [[0, 0], ...(pts ?? []).filter(([x, r]) => x > 0 && Number.isFinite(r)).sort((a, b) => a[0] - b[0]).map(([x, r]) => [x, (x / 252) * Math.log(1 + r / 100)])]
  if (v.length < 2 || d < 0 || d > v[v.length - 1][0]) return null
  for (let i = 1; i < v.length; i++) {
    if (d <= v[i][0]) {
      const [x0, y0] = v[i - 1]
      const [x1, y1] = v[i]
      return Math.exp(y0 + ((y1 - y0) * (d - x0)) / (x1 - x0))
    }
  }
  return null
}

// Taxa a termo (% a.a.) entre d1 e d2 dias úteis a partir da data-base; d1 = 0 vira o CDI médio até d2.
export function forwardBetween(pts, d1, d2) {
  const g1 = growthAt(pts, d1)
  const g2 = growthAt(pts, d2)
  if (g1 == null || g2 == null || d2 <= d1) return null
  return ((g2 / g1) ** (252 / (d2 - d1)) - 1) * 100
}

// Série do gráfico para o intervalo [d1, d2]: taxa a termo em janelas sucessivas.
export function forwardSeries(pts, d1, d2, windows = 24) {
  const step = Math.max(5, Math.round((d2 - d1) / windows))
  const out = []
  for (let a = d1; a < d2; a += step) {
    const b = Math.min(a + step, d2)
    const r = forwardBetween(pts, a, b)
    if (r != null) out.push({ d: (a + b) / 2, rate: r })
  }
  return out
}

// Horizonte padrão do gráfico de CDI futuro, em dias corridos: o prazo da operação (calculadoras de crédito, regra de
// 23/11/2026) ou 12 meses quando não há prazo.
export const diasDoHorizonte = prazoMeses => Number.isFinite(prazoMeses) && prazoMeses > 0 ? Math.round(prazoMeses * 365 / 12) : 365
