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

// Linha do DI no gráfico (pedido do Fernando, 25/11/2026): só a última curva DI x pré publicada pela B3, sem os dias
// anteriores. É a taxa da curva no prazo da operação, desenhada reta nos 12 meses do gráfico, até a data da curva.
export function serieDiPre(di, prazo) {
  if (!di) return bndesSerie('di', 'DI x pré', [])
  const inicio = new Date(`${di.data}T12:00:00Z`)
  inicio.setUTCMonth(inicio.getUTCMonth() - 12)
  const dataBr = di.data.split('-').reverse().join('/')
  // semMedia: é uma curva só, então a média dos 12 meses não se aplica (nem na tela nem no PDF).
  return { ...bndesSerie('di', `DI x pré em ${prazo} meses · curva B3 de ${dataBr}`, [[inicio.toISOString().slice(0, 10), di.taxa], [di.data, di.taxa]]), semMedia: true }
}

// O mesmo recorte do gráfico da tela, pronto para o PDF: [data, valor] de cada série no período.
export function historicoParaPdf(items, range) {
  if (!range) return null
  return { inicio: range.start, fim: range.end, series: items.map(item => ({ nome: item.name, ...(item.semMedia && { semMedia: true }), pontos: item.list.filter(p => p.period >= range.start && p.period <= range.end).map(p => [p.period, p.value]) })) }
}
