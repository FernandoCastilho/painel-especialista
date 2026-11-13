import { displayDate } from './ratesSnapshot.js'

const DEFINITIONS = [
  ['FED','EUA · Fed (faixa-alvo)','Federal Reserve / FOMC','fedFaixa'],
  ['ECB','Área do euro · BCE (depósito)','Banco Central Europeu','bceDeposito'],
  ['BOJ','Japão · Meta overnight','Bank of Japan','bojMeta'],
]
const n = v => v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
function pointValue(p) {
  if (Number.isFinite(p?.lower) && Number.isFinite(p?.upper) && p.lower <= p.upper) return `${n(p.lower)}%–${n(p.upper)}%`
  if (Number.isFinite(p?.value)) return `${p.approximate ? '≈' : ''}${n(p.value)}%`
  return null
}
export function policyRows(data,periods,{loading=false,error=false,now=Date.now()}={}) {
  return DEFINITIONS.map(([id,label,source,help]) => {
    const series = data?.series?.[id]
    const pending = error || series?.stale || (series?.checkedAt && now - series.checkedAt > 36*3600e3)
    const points = series?.usagePending ? [] : series?.points || []
    return {id,label,help,unit:'Política monetária · % a.a.',cells:Object.fromEntries(periods.map(period => {
      const p = points.filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.date || '') && p.date <= period.date && pointValue(p)!=null)
        .reduce((a,b)=>!a || b.date>a.date ? b : a,null)
      return [period.id,{
        comparisonValue:p ? (Number.isFinite(p.lower) && Number.isFinite(p.upper) ? [p.lower,p.upper] : p.value) : undefined,
        value:p ? pointValue(p) : '-', date:p ? displayDate(p.date) : undefined,
        status:p ? `${pending ? 'Atualização pendente · ' : ''}${series?.provider === 'BIS' ? 'Primeira observação deste nível na série' : 'Vigente desde a data indicada'}${p.approximate ? ' · alvo aproximado' : ''}`
          : series?.usagePending ? 'Uso da fonte aguardando validação' : loading ? 'Carregando fonte oficial…' : 'Sem vigência verificada até esta data',
        source:series?.sourceName || source,sourceUrl:p?.sourceUrl || series?.sourceUrl,
      }]
    }))}
  })
}
