import { diRate, DU_PER_MONTH } from './spread.js'

export function bndesDiNoPrazo(br, prazo) {
  const data = br?.sourceDate || br?.compare?.[0]?.date
  const pontos = br?.curves?.[data]
  if (!data || !Array.isArray(pontos) || !Number.isFinite(prazo) || prazo <= 0) return null
  const taxa = diRate(pontos, prazo * DU_PER_MONTH)
  return taxa == null ? null : { data, taxa }
}

export function bndesSerie(id, name, points = [], unit = '% a.a.', stepped = false) {
  const list = points.flatMap(([date, value]) => {
    const period = typeof date === 'string' ? date.slice(0, 10) : Number.isFinite(date) ? new Date(date).toISOString().slice(0, 10) : ''
    const day = /^\d{4}-\d{2}$/.test(period) ? period + '-01' : period
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(value) ? [{ period: day, value }] : []
  })
  return { id, name, short: name.split(' · ')[0], unit, stepped, decimals: 2, list }
}

export function historicoIndexadores(ids, { ipca, selic, dolar }) {
  const ipcaPts = Array.isArray(ipca?.series?.points) ? ipca.series.points : []
  return [
    ...(ids.includes('tlp') ? [bndesSerie('ipca', 'IPCA · acumulado em 12 meses', ipcaPts.map(p => [p.period, p.y12]))] : []),
    ...(ids.includes('lcd') ? [bndesSerie('selic', 'Selic · meta do Copom', selic ?? [], '% a.a.', true)] : []),
    ...(ids.includes('tfbd') ? [bndesSerie('usd', 'Dólar · R$ por US$', dolar ?? [], 'R$')] : []),
  ]
}
