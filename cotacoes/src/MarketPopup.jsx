import { useEffect, useRef } from 'react'
import { fromInput, useIntraday } from './useHistory.js'
import { marketFx, marketDi, marketBrent, marketSummary, signedMarketChange, marketTone } from './marketPopup.js'
import './MarketPopup.css'

function MiniLine({ points, color, label }) {
  const id = useRef('market-spark-' + Math.random().toString(36).slice(2)).current
  if (points.length < 2) return <p className="mp-no-chart">Série indisponível</p>
  const min=Math.min(...points.map(p=>p.bid)), max=Math.max(...points.map(p=>p.bid)), start=points[0].t, span=points.at(-1).t-start
  const line=points.map((p,i)=>`${i?'L':'M'}${span?8+(p.t-start)/span*384:8+i/(points.length-1)*384},${max===min?38:68-(p.bid-min)/(max-min)*56}`).join(' ')
  return <svg viewBox="0 0 400 76" preserveAspectRatio="none" role="img" aria-label={label}>
    <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".18"/><stop offset="1" stopColor={color} stopOpacity=".02"/></linearGradient></defs>
    <path d={line+' L392,76 L8,76 Z'} fill={`url(#${id})`} /><path d={line} stroke={color} strokeWidth="2.5" fill="none" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
  </svg>
}
function Change({ value, unit='%', rate=false }) {
  return <span className={'mp-change '+marketTone(value)+(rate?' mp-rate-change':'')}>{signedMarketChange(value,unit)}{Number.isFinite(value)&&Math.abs(value)>=.005&&<span aria-hidden="true"> {value>0?'▲':'▼'}</span>}</span>
}
function QuoteCard({ item, daily=false }) {
  return <article className={'mp-card mp-'+item.key.toLowerCase()}>
    <div className="mp-card-head"><span className="mp-symbol" aria-hidden="true">{item.symbol}</span><h3>{item.title}</h3></div>
    <p className="mp-data-stamp">{item.stamp} · {item.note}</p>
    <div className="mp-values"><strong>{item.value}</strong><Change value={item.change}/></div>
    <p className="mp-detail">{item.detail}</p>
    {!daily&&<p className="mp-hour">Última hora: {signedMarketChange(item.hour)}</p>}
    {daily&&<p className="mp-hour">Referência diária, não intradiária</p>}
    <MiniLine points={item.points} color={item.color} label={daily?'Histórico diário do Brent, até 30 observações':'Amostras intradiárias '+item.key+'/BRL'}/>
  </article>
}
function MarketHeading({ slot }) {
  return <div className="mp-title-row"><span className="mp-chart-icon" aria-hidden="true"><i/><i/><i/></span><div><h2 id="market-popup-title">Panorama do dia</h2><p>Leitura rápida para decisões de crédito e câmbio</p></div><p className="mp-edition">{slot && <>{new Date(slot.day+'T12:00:00Z').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'})}<br/>{slot.hour!=null?<>Edição das {slot.hour}h · Brasília</>:'Fora do horário das edições · últimos dados'}</>}</p></div>
}
function Panorama({ slot, quotes, curves, oil }) {
  const day=fromInput(slot.day)
  const usd=useIntraday('USD',day), eur=useIntraday('EUR',day), cnh=useIntraday('CNH',day)
  const now=Date.now()
  const fx=[marketFx('USD',quotes?.USD,usd.data?.points,now),marketFx('EUR',quotes?.EUR,eur.data?.points,now),marketFx('CNH',quotes?.CNH,cnh.data?.points,now)]
  const di=marketDi(curves,now), brent=marketBrent(oil,now)
  return <>

    <div className="mp-grid">
      <QuoteCard item={fx[0]}/>
      <article className="mp-card mp-di"><div className="mp-card-head"><span className="mp-symbol" aria-hidden="true">%</span><h3>JUROS FUTUROS</h3></div><p className="mp-data-stamp">B3 · curva diária · {di.date||'Sem data válida'}</p>
        {di.rows.map(row=><div className="mp-di-row" key={row.years}><span>DI ≈ {row.years} anos</span><strong>{row.value}</strong><Change value={row.change} unit=" p.p." rate/></div>)}
        <p className="mp-detail">Taxas a.a. · variação contra curva anterior</p><p className="mp-hour">Curva por prazo, não movimento intradiário</p>
        <MiniLine points={di.points} color="#ff6900" label="Curva DI diária: taxa por prazo em dias úteis"/>
      </article>
      <QuoteCard item={fx[1]}/>
      <QuoteCard item={brent} daily/>
      <QuoteCard item={fx[2]}/>
    </div>
    <div className="mp-summary"><h3><span aria-hidden="true">▤</span> O que mudou</h3><p>{marketSummary(fx,brent)}</p></div>

  </>
}
// O Panorama nunca abre sozinho: quem abre é o botão "Panorama do dia" do Mercado (usePanorama.js guarda o estado no App).
export default function MarketPopup({ open, slot, onClose, quotes, curves, oil }) {
  const dialog=useRef(null)
  useEffect(()=>{
    const el=dialog.current
    if(!open||!el)return undefined
    const origem=document.activeElement, overflow=document.body.style.overflow
    el.showModal()
    document.body.style.overflow='hidden'
    el.querySelector('button')?.focus({preventScroll:true})
    return ()=>{
      if(el.open)el.close()
      document.body.style.overflow=overflow
      if(origem?.isConnected&&origem!==document.body&&origem.getClientRects().length)origem.focus({preventScroll:true})
    }
  },[open])
  const close=onClose
  return <dialog ref={dialog} className="market-popup" aria-labelledby="market-popup-title" aria-describedby="market-popup-note" onCancel={e=>{e.preventDefault();close()}} onKeyDown={e=>{if(e.key==='Tab'){e.preventDefault();dialog.current.querySelector('button')?.focus()}}}>
    <div className="mp-ribbon"><span>PEME · Panorama de mercado</span><button type="button" aria-label="Fechar panorama" autoFocus onClick={close}>×</button></div>
    <div className="mp-content"><MarketHeading slot={slot}/>{open&&slot&&<Panorama slot={slot} quotes={quotes} curves={curves} oil={oil}/>}<p id="market-popup-note" className="mp-footnote">Cada cartão mantém a data e a natureza da fonte. Valores indicativos; fontes diárias não são cotações em tempo real. Edições de hora em hora em dias úteis nacionais, das 9h às 18h. O Panorama só abre quando você pede, pelo botão no Mercado.</p></div>
  </dialog>
}
