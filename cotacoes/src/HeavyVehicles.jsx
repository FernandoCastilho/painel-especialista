import { useMemo } from 'react'
import { useDataFile } from './useDataFile.js'
import { HEAVY_SEGMENTS, HEAVY_METRICS, normalizeHeavy } from './heavyVehicles.js'
import { dataTimestamp } from './dataTimestamp.js'
import './HeavyVehicles.css'
const count=n=>(n.rounding?'≈ ':'')+n.value.toLocaleString('pt-BR')
const pct=n=>(n>0?'+':'')+n.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%'
export default function HeavyVehicles(){
 const file=useDataFile('heavy-vehicles.json')
 const data=useMemo(()=>{try{return normalizeHeavy(file.data)}catch{return null}},[file.data])
 const period=data ? new Date(data.period+'-01T12:00:00Z').toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}) : ''
 return <section className="heavy-vehicles" aria-label="Indicadores de veículos pesados">
  <h3>Veículos pesados · ANFAVEA</h3>
  {!data ? <p role="status">{file.status==='loading'?'Carregando indicadores mensais…':'Indicadores indisponíveis. Consulte a publicação oficial.'}</p> : <>
   <p className="muted">Referência: <strong>{period}</strong> · publicação mensal · Carta {data.editionLabel}, edição {data.edition}</p>
   {(file.stale||data.stale) && <p role="status">Não foi possível atualizar. Mantida a última referência validada, com a data original.</p>}
   {Date.now()-Date.parse(data.period+'-01T12:00:00Z')>100*86400000 && <p role="status">Referência antiga: confira a disponibilidade de nova publicação na fonte.</p>}
   <div className="heavy-segments">{Object.entries(HEAVY_SEGMENTS).map(([id,label])=><section key={id} aria-label={'Indicadores de '+label}><h4>{label}</h4><div className="heavy-cards">{data.indicators.filter(i=>i.segment===id).map(i=><article key={i.metric}><h5>{HEAVY_METRICS[i.metric]}</h5><strong className="heavy-value">{count(i.current)} <small>unidades</small></strong><dl><div><dt>No mês</dt><dd>{pct(i.monthPct)}</dd></div><div><dt>Mesmo mês do ano anterior</dt><dd>{pct(i.yearPct)}</dd></div><div><dt>Janeiro até a referência</dt><dd>{count(i.yearToDate)}</dd></div><div><dt>Acumulado contra o ano anterior</dt><dd>{pct(i.ytdPct)}</dd></div></dl></article>)}</div></section>)}</div>
   <p className="muted">≈ indica contagens arredondadas publicadas em milhares. As variações são as da ANFAVEA, calculadas sobre os valores não arredondados, e não sobre os cartões.</p>
   <small>Última extração válida: {dataTimestamp(data.generatedAt)} · última conferência: {dataTimestamp(data.checkedAt)}</small>
   <p><a href="#config">Ver referência e condições da fonte em Base de dados</a></p>
  </>}
  {!data && <a href="#config">Consultar Carta da ANFAVEA em Base de dados</a>}
  <details><summary>Escopo e metodologia</summary><p>O setor reúne caminhões (incluindo semileves, leves, médios, semipesados e pesados) e ônibus. A subcategoria de caminhões pesados é apenas parte deste conjunto. Não inclui comerciais leves, máquinas agrícolas ou implementos rodoviários.</p><p>Emplacamento é registro de veículo novo, não produção nem faturamento de concessionárias. A ANFAVEA cita Renavam/Senatran como fonte do emplacamento. Produção e exportações em unidades: ANFAVEA. Dados sujeitos a revisão. A Central de Dados informa que, a partir de 2026, a produção inclui estimativas de empresas não associadas.</p><p>Consulta automática diária nos dias úteis; a fonte muda mensalmente. Falha ou mudança de formato preserva os últimos dados validados. Conferir o endereço não altera o mês de referência.</p></details>
 </section>
}
