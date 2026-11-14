import { displayDate, lastAt } from './ratesSnapshot.js'
import { nf } from './format.js'

// €STR (BCE): valida o arquivo coletado e monta a linha do quadro de juros e a série do gráfico.
export function normalizeEstr(data) {
  const s = data?.series
  if (s?.id !== 'estr' || !Array.isArray(s.points) || typeof s.checkedAt !== 'string') throw new Error('Arquivo do €STR inválido')
  const points = s.points.filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p?.date) && Number.isFinite(p?.value)).sort((a, b) => a.date.localeCompare(b.date))
  if (points.length !== s.points.length || new Set(points.map((p) => p.date)).size !== points.length) throw new Error('Histórico do €STR inválido')
  return { ...s, points }
}

// Série [{ t, bid }] do gráfico (meio-dia UTC de cada dia útil do BCE).
export const estrChartPoints = (series) => series.points.map((p) => ({ t: Date.parse(`${p.date}T12:00:00Z`), bid: p.value }))

// Linha do quadro "Juros de referência": valor na data ou na última observação anterior; sem observação não vira zero.
// `state`: { loading, error } do arquivo; `series` pode ser null.
export function estrRow(series, periods, { loading = false, error = false } = {}) {
  const pending = error || series?.stale
  const source = series?.sourceName || 'Banco Central Europeu · €STR'
  return {
    id: 'ESTR', label: 'Área do euro · €STR overnight', help: 'estr', unit: 'Mercado overnight · % a.a.',
    cells: Object.fromEntries(periods.map((period) => {
      const p = series ? lastAt(series.points, period.date) : null
      return [period.id, p
        ? { comparisonValue: p.value, value: `${nf(p.value, 3)}%`, date: displayDate(p.date), source, sourceUrl: series.sourceUrl, status: pending ? 'Atualização pendente; último dado disponível' : undefined }
        : { value: '—', source, sourceUrl: series?.sourceUrl, status: loading ? 'Carregando fonte oficial…' : pending ? 'Fonte pendente' : 'Sem observação disponível até esta data' }]
    })),
  }
}
