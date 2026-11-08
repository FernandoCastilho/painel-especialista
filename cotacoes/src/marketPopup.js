import { isBusinessDay } from './holidays.js'
import { quoteAgeState } from './quoteFreshness.js'
import { brentReturns } from './oilReference.js'

export const MARKET_POPUP_KEY = 'painel-panorama-hora'
const zone = 'America/Sao_Paulo'
const dayFormatter = new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'})
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export function marketSlot(now = Date.now()) {
  const date = new Date(now)
  if (!Number.isFinite(date.getTime())) return null
  const p = Object.fromEntries(fmt.formatToParts(date).map(v => [v.type, v.value]))
  const day = `${p.year}-${p.month}-${p.day}`, hour = Number(p.hour), minute = Number(p.minute)
  // A última edição é às 18h, não uma janela que continua até 18h59.
  if (hour < 9 || hour > 18 || (hour === 18 && minute > 0) || !isBusinessDay(day, 'CIVBR')) return null
  return { key: `${day}T${p.hour}`, day, hour }
}
export function seenMarketSlot(slot, storage, memory = new Set()) {
  if (!slot) return true
  if (memory.has(slot.key)) return true
  try { return storage?.getItem(MARKET_POPUP_KEY) === slot.key } catch { return false }
}
export function rememberMarketSlot(slot, storage, memory) {
  memory.add(slot.key)
  try { storage?.setItem(MARKET_POPUP_KEY, slot.key) } catch { /* sessão sem armazenamento */ }
}
const number = (v, digits = 2) => Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—'
export const signedMarketChange = (v, unit = '%') => !Number.isFinite(v) ? 'Indisponível' : `${Math.abs(v) < .005 ? '' : v > 0 ? '+' : '−'}${number(Math.abs(v))}${unit}`
export const marketTone = v => !Number.isFinite(v) || Math.abs(v) < .005 ? 'flat' : v > 0 ? 'up' : 'down'
const stamp = t => !Number.isFinite(t) ? 'Sem data' : new Date(t).toLocaleString('pt-BR', { timeZone: zone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
export function validMarketPoints(points, now = Date.now()) {
  return (Array.isArray(points) ? points : []).filter(p => Number.isFinite(p?.t) && p.t <= now && Number.isFinite(p.bid) && p.bid > 0).sort((a,b) => a.t-b.t)
}
// Só calcula a hora contra uma amostra próxima de t−60 min, do mesmo dia e com a cotação atual fresca.
export function hourMarketChange(quote, points, now = Date.now()) {
  if (quoteAgeState(quote, now) || !Number.isFinite(quote?.bid) || quote.bid <= 0) return null
  const target = quote.timestamp - 3600000
  const dayAt = t => new Intl.DateTimeFormat('en-CA', { timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date(t))
  const candidates = validMarketPoints(points, quote.timestamp).filter(p => Math.abs(p.t-target) <= 5*60000 && dayAt(p.t) === dayAt(quote.timestamp))
  const base = candidates.reduce((b,p) => !b || Math.abs(p.t-target)<Math.abs(b.t-target) ? p : b,null)
  return base ? (quote.bid/base.bid-1)*100 : null
}
export function marketFx(code, quote, points, now = Date.now()) {
  const valid = quote && Number.isFinite(quote.bid) && quote.bid > 0 && Number.isFinite(quote.timestamp) && quote.timestamp <= now+60000
  const state = quoteAgeState(quote, now)
  const usable = valid && state !== 'Horário inválido'
  const day = usable && !quote.fallback && Number.isFinite(quote.pct) ? quote.pct : null
  return { key:code, title:code==='USD'?'DÓLAR/REAL':code==='EUR'?'EURO/REAL':'CONTEXTO: YUAN',
    symbol:code==='USD'?'⇄':code==='EUR'?'€':'¥', value:usable ? 'R$ '+number(quote.bid,4) : '—',
    change:day, summaryEligible:!!usable && !state && dayFormatter.format(new Date(quote.timestamp)) === dayFormatter.format(new Date(now)), stamp:usable ? stamp(quote.timestamp):'Sem dado válido',
    note:!usable?'Cotação indisponível':quote.fallback?'Reserva diária · BCE':state ? state+' · AwesomeAPI':'AwesomeAPI · cotação indicativa',
    hour:hourMarketChange(usable?quote:null,points,now), points:validMarketPoints(points, now),
    detail:code==='CNH'?(quote?.source === 'CNY' ? 'CNY/BRL · referência onshore' : 'CNH/BRL · yuan offshore por cruzamento'):(state?'Variação na data da cotação':'Variação do dia'), color:'#174cff' }
}
const nearest = (points, target) => (points||[]).filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])).reduce((b,p)=>!b||Math.abs(p[0]-target)<Math.abs(b[0]-target)?p:b,null)
export function marketDi(curves, now=Date.now()) {
  const br=curves?.br, today=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now))
  const date=br?.compare?.find(x=>x.id==='hoje')?.date, prev=br?.compare?.find(x=>x.id==='d1')?.date
  const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d||'') && d<=today
  const curve=validDate(date)?br?.curves?.[date]:null, previous=validDate(prev)&&prev<date?br?.curves?.[prev]:null
  const rows=[2,5].map(years=>{
    const point=nearest(curve,252*years), earlier=point && nearest(previous,point[0])
    const valid=point && Math.abs(point[0]-252*years)<=63
    return {years, value:valid?number(point[1])+'%':'—', change:valid&&earlier&&Math.abs(earlier[0]-point[0])<=20?point[1]-earlier[1]:null}
  })
  return { rows, date:curve?date:null, points:curve?(curve.filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])).map(p=>({t:p[0],bid:p[1]}))):[] }
}
export function marketBrent(oil, now=Date.now()) {
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now))
  const r=brentReturns(oil,today)
  return { key:'BRENT', title:'BRENT', symbol:'▤', value:r.last?'US$ '+number(r.last.value):'—', change:r.day,
    stamp:r.last?r.last.date:'Sem dado', note:'EIA · spot diário · US$/barril', detail:'Variação entre observações diárias', color:'#ff6900',
    points:(r.last?oil.points:[]).filter(p=>p.date<=today&&Number.isFinite(p.value)&&p.value>0).slice(-30).map(p=>({t:Date.parse(p.date+'T12:00:00Z'),bid:p.value})) }
}
export function marketSummary(fx, brent) {
  const parts=fx.filter(x=>x.summaryEligible && Number.isFinite(x.change)).map(x=>`${x.key==='USD'?'Dólar':x.key==='EUR'?'Euro':'Yuan offshore'}: ${signedMarketChange(x.change)} frente ao real no dia`)
  if (Number.isFinite(brent.change)) parts.push(`Brent spot (${brent.stamp}): ${signedMarketChange(brent.change)} entre as últimas observações diárias`)
  return parts.length?parts.join('. ')+'.':'Sem variações válidas para resumir. Confira as datas e as fontes dos cartões.'
}
