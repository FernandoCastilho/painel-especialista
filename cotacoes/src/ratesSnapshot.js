// Valores pontuais, nunca retornos acumulados nem médias de períodos.
export const brDay = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t))
export const displayDate = (s) => s?.split('-').reverse().join('/') || '—'
const iso = (d) => d.toISOString().slice(0, 10)
export function snapshotPeriods(now = Date.now()) {
  const today = brDay(now), d = new Date(`${today}T12:00:00Z`)
  const month = new Date(d); month.setUTCDate(1); month.setUTCMonth(month.getUTCMonth() - 1)
  const last = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth()+1, 0)).getUTCDate()
  month.setUTCDate(Math.min(d.getUTCDate(), last))
  const half = new Date(d); half.setUTCDate(half.getUTCDate()-180)
  const year = new Date(d); year.setUTCFullYear(year.getUTCFullYear()-1, year.getUTCMonth(), 1)
  const lastYearMonth = new Date(Date.UTC(year.getUTCFullYear(), year.getUTCMonth()+1, 0)).getUTCDate()
  year.setUTCDate(Math.min(d.getUTCDate(), lastYearMonth))
  return [ ['day','Última disponível',today], ['month','Há 1 mês',iso(month)], ['halfYear','Há 180 dias',iso(half)], ['year','Há 1 ano',iso(year)] ].map(([id,label,date])=>({id,label,date}))
}
export function lastAt(points, target) {
  return (points || []).filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.date <= target && Number.isFinite(p.value)).reduce((best,p)=>!best || p.date > best.date ? p : best,null)
}
const number = (n,digits=2) => n.toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits})
export function snapshotRows({macro, periods, errors={}}) {
  const rows=[]
  const add=(id,label,unit,points,source,fmt,status)=>{
    rows.push({id,label,unit,cells:Object.fromEntries(periods.map(period=>{
      const p=lastAt(points,period.date)
      return [period.id,p ? {comparisonValue:p.value,value:fmt(p.value),date:displayDate(p.date),source:p.source || source,status:status || p.status} : {value:'—',status:status || 'Sem observação disponível até esta data',source}]
    }))})
  }
  for(const [id,label,key,source] of [['SELIC','Brasil · Selic meta','selic','BCB · SGS 432'],['CDI','Brasil · CDI overnight','cdi','B3 / BCB · SGS 4389'],['SOFR','EUA · SOFR overnight','sofr','Federal Reserve de Nova York']]) {
    const sorted=[...(macro?.[key]||[])].sort((a,b)=>a[0]-b[0])
    const series=key==='selic'?sorted.filter((p,i)=>i===0 || p[1]!==sorted[i-1][1]):sorted
    const points=series.map(([t,value])=>({date:iso(new Date(t)),value,status:key==='selic'?'Vigente desde a data indicada':undefined}))
    add(id,label,key==='selic'?'Política monetária · % a.a.':'Mercado overnight · % a.a.',points,source,v=>`${number(v)}%`,errors.macro || (macro?.stale?.[key] ? 'Última série disponível; fonte pendente' : undefined))
  }
  const HELP = { SELIC: 'selic', CDI: 'cdi', SOFR: 'sofr' }
  return rows.map((r) => ({ ...r, help: HELP[r.id] }))
}
