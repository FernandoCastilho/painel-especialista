import { useEffect, useId, useRef, useState } from 'react'
import catalog from './ma/transactions.json'
import { MA_STATUSES, MA_UFS, filterMa, maDate, maDateLabel, maRoute, readMaRoute, summarizeMa, validateMa } from './ma.js'
import MaMap from './MaMap.jsx'
import './Ma.css'

validateMa(catalog.transactions)
const records = catalog.transactions
const defaultYear = records.map(row => maDate(row).slice(0,4)).sort().at(-1) || ''
const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const sectorOptions = [...new Map(records.map(row => [row.sectorId,{value:row.sectorId,label:row.sector}])).values()]
const PAGE_SIZE = 10
const statusClass = status => ({'Concluída':'done','Em aprovação':'pending','Cancelada':'cancelled','Anunciada':'announced'})[status]
const valueLabel = row => row.value === null ? 'Não divulgado' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:row.currency,maximumFractionDigits:0}).format(row.value)

// Datalist nativo permite digitar para localizar opções sem criar outro menu de teclado.
function Filter({ label, value, options, all, onChange }) {
  const id = useId()
  const selected = options.find(option => option.value === value)?.label || (value ? value : all)
  const [draft,setDraft] = useState(selected)
  useEffect(() => setDraft(selected),[selected])
  return <label className="ma-filter"><span>{label}</span><input list={id} value={draft} onFocus={event => event.target.select()} onBlur={() => setDraft(selected)}
    onChange={event => { const text = event.target.value; setDraft(text); const match = options.find(option => option.label.toLocaleLowerCase('pt-BR') === text.toLocaleLowerCase('pt-BR')); if (match) onChange(match.value); else if (!text || text === all) onChange('') }}/>
    <datalist id={id}><option value={all}/>{options.map(option => <option value={option.label} key={option.value}/>)}</datalist></label>
}

function Detail({ row, goto }) {
  const title = useRef(null)
  const rowId = row?.id
  useEffect(() => { if (rowId) { title.current?.closest('aside')?.scrollIntoView({block:'start'}); title.current?.focus({preventScroll:true}) } },[rowId])
  if (!row) return <aside className="ma-card ma-detail"><h3>Detalhes da transação</h3><p>Selecione uma operação para consultar as empresas, datas e fontes.</p></aside>
  return <aside className="ma-card ma-detail" aria-label="Detalhes da transação">
    <div className="ma-detail-head"><h3 ref={title} tabIndex={-1}>{row.target}</h3><span className={`ma-status ${statusClass(row.status)}`}>{row.status}</span></div>
    <dl>{[['Comprador',row.buyer],['Empresa ou ativo adquirido',row.target],['Vendedor',row.seller || 'Não informado'],['Setor',row.sector],['Segmento',row.segment],['Valor',valueLabel(row)],['Participação',row.stake || 'Não informada'],['Anúncio',maDateLabel(row.announcementDate)],['Conclusão',maDateLabel(row.completionDate)],['Publicação',maDateLabel(row.publicationDate)],['Localização',row.uf || 'Sem UF confirmada']].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <h4>Resumo da operação</h4><p>{row.summary}</p><p className="ma-caption">{row.locationNote}</p>
    <p className="ma-caption">Situação conforme a notícia de {maDateLabel(row.publicationDate)}. Não equivale a confirmação atual de fechamento.</p>
    <a href={row.sourceUrl} target="_blank" rel="noreferrer">Consultar fonte ↗</a>
    {row.supportingSource && <a href={row.supportingSource} target="_blank" rel="noreferrer">Fonte primária ↗</a>}
    {row.locationSource && <a href={row.locationSource} target="_blank" rel="noreferrer">Fonte da localização ↗</a>}
    <details><summary>Histórico da transação</summary><ol className="ma-timeline">{row.history.map((event,index) => <li key={index}><time dateTime={event.date}>{maDateLabel(event.date)}</time><p>{event.text}</p></li>)}</ol></details>
    <button type="button" className="ma-text-button" onClick={() => goto('setores',row.sectorRoute)}>Ver em Setores → {row.sector}</button>
  </aside>
}

export default function Ma({ view = '', onView, goto }) {
  const state = readMaRoute(view || maRoute({year:defaultYear}))
  const { tab,year,month,sector,uf,status,query,selected } = state
  const surface = useRef(null)
  useEffect(() => { if (!selected) surface.current?.scrollIntoView({block:'start'}) },[tab,selected])
  const results = filterMa(records,state)
  const summary = summarizeMa(results)
  const pages = Math.max(1,Math.ceil(results.length / PAGE_SIZE))
  const page = Math.min(state.page,pages)
  const active = results.find(row => row.id === selected)
  const change = (patch,replace = false) => onView(maRoute({...state,page:1,selected:'',...patch}),replace)
  const years = [...new Set([...records.map(row => maDate(row).slice(0,4)),'2026'])].sort().reverse()
  const list = results.slice((page - 1) * PAGE_SIZE,page * PAGE_SIZE)
  return <div className="ma-module" ref={surface}>
    <header className="ma-intro"><h2>Fusões e Aquisições</h2><p>Panorama das transações no Brasil</p></header>
    <nav className="ma-tabs" aria-label="Visões de M&A"><button type="button" aria-current={tab === 'visao-geral' ? 'page' : undefined} onClick={() => change({tab:'visao-geral'})}>Visão geral</button><button type="button" aria-current={tab === 'transacoes' ? 'page' : undefined} onClick={() => change({tab:'transacoes'})}>Transações</button></nav>
    <div className="ma-filters">
      <Filter label="Ano" value={year} all="Todos os anos" options={years.map(value => ({value,label:value}))} onChange={year => change({year})}/>
      <Filter label="Período" value={month} all="Ano completo" options={months.map((label,index) => ({value:String(index + 1).padStart(2,'0'),label}))} onChange={month => change({month})}/>
      <Filter label="Setor" value={sector} all="Todos os setores" options={sectorOptions} onChange={sector => change({sector})}/>
      <Filter label="Estado" value={uf} all="Todos os estados" options={[...MA_UFS.map(value => ({value,label:value})),{value:'unknown',label:'Sem UF confirmada'}]} onChange={uf => change({uf})}/>
      <Filter label="Situação" value={status} all="Todas as situações" options={MA_STATUSES.map(value => ({value,label:value}))} onChange={status => change({status})}/>
      <label className="ma-search"><span>Buscar empresa ou transação</span><input type="search" placeholder="Comprador, adquirida, vendedor ou segmento" value={query} onChange={event => change({query:event.target.value},true)}/></label>
    </div>
    <div className="ma-selection"><p role="status">{results.length} {results.length === 1 ? 'transação no recorte' : 'transações no recorte'}{uf && ` · ${uf === 'unknown' ? 'Sem UF confirmada' : uf}`}{sector && ` · ${sectorOptions.find(option => option.value === sector)?.label || sector}`}</p><button type="button" className="ma-text-button" onClick={() => onView(maRoute({tab}))}>Limpar filtros</button></div>
    {tab === 'visao-geral' ? <>
      <div className="ma-metrics">{[[summary.total,'Transações'],[summary.states.length,'Estados com operações'],[summary.sectors.length,'Setores representados']].map(([value,label]) => <div className="ma-card ma-metric" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
      <div className="ma-panorama"><MaMap summary={summary} selected={uf} onSelect={uf => change({tab:'transacoes',uf})}/><section className="ma-card ma-sectors" aria-labelledby="ma-sector-title"><h3 id="ma-sector-title">Transações por setor</h3><p className="ma-caption">Selecione um setor para consultar as operações.</p><ol>{summary.sectors.map(group => <li key={group.id}><button type="button" onClick={() => change({tab:'transacoes',sector:group.id})}><span>{group.label}</span><span className="ma-bar-track"><span style={{width:`${100 * group.count / Math.max(1,summary.sectors[0].count)}%`}}/></span><strong>{group.count}</strong></button></li>)}</ol>{!summary.total && <p>Nenhum setor com transações neste recorte.</p>}</section></div>
      <div className="ma-overview-actions"><p className="ma-caption">Selecione uma bolha ou um setor para abrir a lista filtrada.</p><button type="button" className="ma-primary" onClick={() => change({tab:'transacoes'})}>Ver transações do recorte →</button></div>
    </> : <div className="ma-transactions"><section className="ma-card ma-list" aria-labelledby="ma-list-title"><h3 id="ma-list-title">Transações</h3>{list.length ? <><div className="ma-table-scroll"><table><thead><tr><th scope="col">Data de referência</th><th scope="col">Transação</th><th scope="col">Setor</th><th scope="col">Situação na notícia</th></tr></thead><tbody>{list.map(row => <tr key={row.id} className={row.id === selected ? 'ma-selected' : ''}><td><time dateTime={maDate(row)}>{maDateLabel(maDate(row))}</time><small>{row.announcementDate ? 'Anúncio' : 'Publicação'}</small></td><td><button type="button" aria-pressed={row.id === selected} onClick={() => change({selected:row.id,page})}><strong>{row.buyer}</strong><span>→ {row.target}</span></button></td><td>{row.sector}</td><td><span className={`ma-status ${statusClass(row.status)}`}>{row.status}</span></td></tr>)}</tbody></table></div><nav className="ma-pagination" aria-label="Páginas de transações"><button type="button" disabled={page === 1} onClick={() => change({page:page - 1})}>Anterior</button><span>Página {page} de {pages}</span><button type="button" disabled={page === pages} onClick={() => change({page:page + 1})}>Próxima</button></nav></> : <p>Nenhuma transação encontrada. Ajuste os filtros ou limpe a busca.</p>}{selected && !active && <p role="status">A transação selecionada não está neste recorte.</p>}</section><Detail row={active} goto={goto}/></div>}
    {!results.length && year === '2026' && <div className="ma-empty"><h3>Sem transações de 2026 neste acervo</h3><p>O portal informou uma pausa nas atualizações em dezembro de 2025. Datas de atualização de matérias não são novas transações.</p><button type="button" className="ma-text-button" onClick={() => onView(maRoute({year:defaultYear,tab}))}>Consultar acervo de {defaultYear}</button></div>}
    <footer className="ma-coverage"><p>{catalog.coverage}</p><p>Ano e mês usam o anúncio quando confirmado; nos demais casos, a publicação, identificada na lista. Sem localização confirmada, a operação entra no total e fica fora das bolhas. Cada transação é contada uma vez.</p><p><a href={catalog.sourceUrl} target="_blank" rel="noreferrer">Portal Fusões & Aquisições ↗</a> · <a href={catalog.pauseUrl} target="_blank" rel="noreferrer">Comunicado sobre o acervo ↗</a> · Conferência: {maDateLabel(catalog.reviewedAt)}</p></footer>
  </div>
}
