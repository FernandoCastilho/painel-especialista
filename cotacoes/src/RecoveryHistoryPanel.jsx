import { useMemo, useState } from 'react'
import { useDataFile } from './useDataFile.js'
import RefreshButton from './RefreshButton.jsx'
import { UF_NAMES, UNKNOWN_UF, UNKNOWN_SECTOR, validateRecoveryHistory, recoveryPeriod, filterRecovery, groupRecovery } from './recoveryHistory.js'
import geography from './recovery-geography.json'
import RecoveryMapTooltip, { useRecoveryMapTooltip } from './RecoveryMapTooltip.jsx'
import './RecoveryHistoryPanel.css'

const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const integer = new Intl.NumberFormat('pt-BR')
const percentage = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })
const dateLabel = date => date.split('-').reverse().join('/')
const PAGE_SIZE = 10
const SECTOR_PREVIEW_SIZE = 8
const stateLabel = uf => uf === UNKNOWN_UF ? 'Sem UF empresarial' : `${UF_NAMES[uf]} · ${uf}`
const geographyUrl = 'https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais.html'

function StateMap({ records, selected, onSelect }) {
  const tip = useRecoveryMapTooltip()
  const counts = new Map(groupRecovery(records, 'uf', UNKNOWN_UF).map(({label, count}) => [label, count]))
  const max = Math.max(1, ...Object.keys(UF_NAMES).map(uf => counts.get(uf) ?? 0))
  const state = geography.states.find(item => item.uf === selected)
  const viewBox = state?.viewBox ?? geography.viewBox
  const shownStates = state ? [state] : geography.states
  const tipState = shownStates.find(item => item.uf === tip.active)
  const tipCount = counts.get(tip.active) ?? 0
  return <article className="rj-card" aria-labelledby="rj-map-title">
    <div className="rj-card-head">
      <div><h3 id="rj-map-title">Distribuição por UF</h3><p>{state ? stateLabel(selected) : 'Brasil · área da bolha proporcional às menções'}</p></div>
      {state && <button type="button" className="btn" onClick={() => onSelect('')}>Ver Brasil</button>}
    </div>
    <p className="rj-map-instructions" id="rj-map-help">Passe o cursor, use Tab ou toque para ver os detalhes. Clique ou use Enter para filtrar. Esc fecha a dica.</p>
    <div className="rj-map-wrap" ref={tip.root}>
      <svg className="rj-map" viewBox={viewBox} role="group" aria-describedby="rj-map-help" aria-label={state ? `Mapa ampliado de ${stateLabel(selected)}` : 'Mapa do Brasil por unidade da federação'}>
        {shownStates.map(item => <path key={item.uf} d={item.path} className={selected === item.uf ? 'rj-state active' : 'rj-state'}
          {...tip.trigger(item.uf, () => onSelect(selected === item.uf ? '' : item.uf))}
          aria-label={`${stateLabel(item.uf)}: ${integer.format(counts.get(item.uf) ?? 0)} menções`}
          aria-pressed={selected === item.uf} fillRule="evenodd" />)}
        {shownStates.filter(item => counts.get(item.uf)).map(item => {
          const count = counts.get(item.uf)
          const radius = Math.sqrt(count / max) * 25
          return <g key={item.uf} aria-hidden="true" className={selected === item.uf ? 'rj-pin active' : 'rj-pin'}>
            <circle cx={item.x} cy={item.y} r={radius} />
            {radius >= 13 && <text x={item.x} y={item.y} dy=".34em">{item.uf}</text>}
          </g>
        })}
      </svg>
      <RecoveryMapTooltip tip={tip} label={tipState && stateLabel(tipState.uf)} count={tipCount} share={percentage.format(records.length ? tipCount / records.length : 0)} />
    </div>
    <label className="rj-control">Selecionar UF
      <select value={selected} onChange={event => onSelect(event.target.value)}>
        <option value="">Todas as UFs</option>
        {Object.keys(UF_NAMES).map(uf => <option value={uf} key={uf}>{stateLabel(uf)} ({integer.format(counts.get(uf) ?? 0)})</option>)}
        <option value={UNKNOWN_UF}>Sem UF empresarial ({integer.format(counts.get(UNKNOWN_UF) ?? 0)})</option>
      </select>
    </label>
    <p className="rj-card-note">Sem UF no recorte: {integer.format(counts.get(UNKNOWN_UF) ?? 0)}. <a href={geographyUrl} target="_blank" rel="noreferrer">Malha territorial IBGE</a>.</p>
  </article>
}

function SectorRanking({ records, selected, onSelect }) {
  const [expanded, setExpanded] = useState(false)
  const groups = groupRecovery(records, 'sector', UNKNOWN_SECTOR)
  const visibleGroups = expanded ? groups : groups.slice(0, SECTOR_PREVIEW_SIZE)
  const maxCount = groups[0]?.count

  return <article className="rj-card" aria-labelledby="rj-sector-title">
    <div className="rj-card-head">
      <div><h3 id="rj-sector-title">Distribuição por setor</h3><p>Menções por setor no período e na UF selecionados.</p></div>
    </div>
    <label className="rj-control rj-sector-select">Selecionar setor
      <select value={selected} onChange={event => onSelect(event.target.value)}>
        <option value="">Todos os setores</option>
        {selected && !groups.some(group => group.label === selected) && <option value={selected}>{selected} (0)</option>}
        {groups.map(group => <option value={group.label} key={group.label}>{group.label} ({integer.format(group.count)})</option>)}
      </select>
    </label>
    {groups.length > 0 ? <>
      <p className="rj-map-instructions">Do maior para o menor. Selecione uma barra para filtrar o mapa e a tabela.</p>
      <ol className="rj-sector-ranking" id="rj-sector-ranking" aria-label="Ranking de setores por menções">
        {visibleGroups.map(({ label, count }) => {
          const active = label === selected
          const mentions = count === 1 ? 'menção' : 'menções'
          return <li key={label}>
            <button type="button" className="rj-sector-bar" aria-pressed={active}
              onClick={() => onSelect(active ? '' : label)}>
              <span className="rj-sector-name">{label}</span>
              <span className="rj-sector-metric"><strong>{integer.format(count)} {mentions}</strong>
                <small>{percentage.format(count / records.length)}</small></span>
              <span className="rj-sector-track" aria-hidden="true">
                <span className={label === UNKNOWN_SECTOR ? 'rj-sector-fill unknown' : 'rj-sector-fill'} style={{width:`${count / maxCount * 100}%`}} />
              </span>
            </button>
          </li>
        })}
      </ol>
      {groups.length > SECTOR_PREVIEW_SIZE && <button type="button" className="btn rj-sector-more"
        aria-expanded={expanded} aria-controls="rj-sector-ranking" onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Ver apenas os primeiros setores' : `Ver todos os ${integer.format(groups.length)} setores`}
      </button>}
      {groups.some(group => group.label === UNKNOWN_SECTOR) && <p className="rj-card-note">Sem setor reúne menções sem atividade identificada.</p>}
    </> : <p className="rj-empty">Nenhum setor com menções neste recorte.</p>}
  </article>
}

function HistoryDashboard({ data }) {
  const latest = data.editions.at(-1)
  const years = [...new Set(data.editions.map(date => Number(date.slice(0, 4))))].reverse()
  const [period, setPeriod] = useState(() => ({year:years[0], first:1, last:Math.max(1, Number(latest.slice(5, 7)) - 1)}))
  const [uf, setUf] = useState('')
  const [sector, setSector] = useState('')
  const [page, setPage] = useState(0)
  const lastMonth = Number(data.editions.findLast(date => date.startsWith(String(period.year))).slice(5, 7))
  const result = useMemo(() => recoveryPeriod(data, period.year, period.first, period.last), [data, period])
  const visible = useMemo(() => filterRecovery(result.current, uf, sector).toReversed(), [result, uf, sector])
  const previous = filterRecovery(result.previous, uf, sector).length
  const total = result.current.length
  const coveredUf = result.current.filter(row => row.uf).length
  const share = total ? percentage.format(visible.length / total) : '—'
  const trend = !result.previousEditionCount || !result.editionCount ? 'Sem cobertura comparável' : !previous ? 'Base anterior igual a zero' : percentage.format((visible.length - previous) / previous)
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages - 1)
  const chooseUf = value => { setUf(value); setPage(0) }
  const chooseSector = value => { setSector(value); setPage(0) }
  const changePeriod = next => { setPeriod(next); setPage(0) }
  const dateRange = `${dateLabel(result.start)} a ${dateLabel(result.end)}`

  return <>
    <div className="rj-filters" role="group" aria-label="Período das menções">
      <label className="rj-control">Ano<select aria-label="Ano do recorte" value={period.year} onChange={event => {
        const year = Number(event.target.value)
        const maxMonth = Number(data.editions.findLast(date => date.startsWith(String(year))).slice(5, 7))
        const last = Math.min(period.last, maxMonth)
        changePeriod({year, first:Math.min(period.first, last), last})
      }}>{years.map(year => <option key={year}>{year}</option>)}</select></label>
      <label className="rj-control">De<select aria-label="Mês inicial" value={period.first} onChange={event => {
        const first = Number(event.target.value)
        changePeriod({...period, first, last:Math.max(first, period.last)})
      }}>{months.slice(0, lastMonth).map((month, index) => <option value={index + 1} key={month}>{month}</option>)}</select></label>
      <label className="rj-control">Até<select aria-label="Mês final" value={period.last} onChange={event => changePeriod({...period, last:Number(event.target.value)})}>
        {months.slice(0, lastMonth).map((month, index) => <option value={index + 1} disabled={index + 1 < period.first} key={month}>{month}</option>)}
      </select></label>
      <span className="rj-card-note">{dateRange} · {integer.format(result.editionCount)} edições</span>
    </div>
    <div className="rj-kpis" aria-live="polite">
      <div><span>Menções no recorte</span><strong>{integer.format(visible.length)}</strong><small>De {integer.format(total)} no período</small></div>
      <div><span>Participação na base</span><strong>{share}</strong><small>Inclui menções sem UF no total</small></div>
      <div><span>Cobertura de UF</span><strong>{total ? percentage.format(coveredUf / total) : '—'}</strong><small>{integer.format(total - coveredUf)} sem UF no período</small></div>
      <div><span>Variação anual de menções</span><strong className={trend.includes('%') ? undefined : 'rj-kpi-text'}>{trend}</strong>
        <small>{result.previousEditionCount ? `${integer.format(previous)} menções em ${result.previousEditionCount} edições · ${dateLabel(result.previousStart)} a ${dateLabel(result.previousEnd)}` : 'Ano anterior sem edições no recorte'}</small></div>
    </div>
    <div className="rj-viz-grid">
      <StateMap records={filterRecovery(result.current, '', sector)} selected={uf} onSelect={chooseUf}/>
      <SectorRanking records={filterRecovery(result.current, uf, '')} selected={sector} onSelect={chooseSector}/>
    </div>
    <article className="rj-card rj-records" aria-labelledby="rj-records-title">
      <div className="rj-card-head"><div><h3 id="rj-records-title">Menções empresariais</h3><p>{integer.format(visible.length)} registros encontrados. Uma menção corresponde a um registro de empresa em um pedido.</p></div>
        {(uf || sector) && <button type="button" className="btn" onClick={() => { chooseUf(''); chooseSector('') }}>Limpar seleção</button>}
      </div>
      {(uf || sector) && <div className="rj-chips">
        {uf && <button type="button" onClick={() => chooseUf('')} aria-label={`Remover filtro ${stateLabel(uf)}`}>{stateLabel(uf)} ×</button>}
        {sector && <button type="button" onClick={() => chooseSector('')} aria-label={`Remover filtro ${sector}`}>{sector} ×</button>}
      </div>}
      {visible.length ? <>
        <div className="rj-table"><table>
          <thead><tr><th scope="col">Publicação</th><th scope="col">Empresa</th><th scope="col">UF</th><th scope="col">Setor</th></tr></thead>
          <tbody>{visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map(row =>
            <tr key={row.id}><td>{dateLabel(row.date)}</td><td>{row.name ?? 'Identificação não exibida'}</td><td>{row.uf ?? UNKNOWN_UF}</td><td>{row.sector ?? UNKNOWN_SECTOR}</td></tr>)}</tbody>
        </table></div>
        {pages > 1 && <div className="rj-pagination" aria-label="Paginação">
          <button type="button" className="btn" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0}>Anterior</button>
          <span aria-live="polite">Página {currentPage + 1} de {pages}</span>
          <button type="button" className="btn" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pages - 1}>Próxima</button>
        </div>}
      </> : <p className="rj-empty">Nenhuma menção encontrada para os filtros selecionados.</p>}
    </article>

    <details className="rj-method">
      <summary>Como interpretar a base histórica</summary>
      <p>Cada linha corresponde a uma menção empresarial em uma publicação de pedido de recuperação judicial. Um mesmo processo pode envolver várias empresas. Datas são de publicação, e a contagem de processos protocolados requer dados judiciais específicos.</p>
      <p>A UF é a informada no endereço empresarial da época. O setor é o informado na base. Participações consideram todas as menções do período. A comparação anual usa os mesmos meses e, quando o último mês está incompleto, o mesmo dia de corte. O número de edições disponíveis pode variar.</p>
    </details>
  </>
}

export default function RecoveryHistoryPanel() {
  const resource = useDataFile('recuperacao-historico.json')
  const data = useMemo(() => {
    try { return validateRecoveryHistory(resource.data) } catch { return null }
  }, [resource.data])
  return <section className="rj-history" aria-labelledby="rj-history-heading">
    <div className="history-head"><h2 id="rj-history-heading">Recuperação judicial</h2><RefreshButton files={['recuperacao-historico.json']}/></div>
    <p className="rj-intro">Menções empresariais em pedidos de recuperação judicial · Base histórica do painel</p>
    <p className="rj-card-note">Cobertura parcial das edições analisadas, não um total nacional. Uma mesma ação pode envolver várias empresas; menções não equivalem a processos únicos. Datas indicam publicação, não protocolo.</p>
    {data && <p className="rj-card-note">Última edição na base: {dateLabel(data.editions.at(-1))} · {integer.format(data.editions.length)} edições no histórico.</p>}
    {resource.status === 'loading' && <p role="status">Carregando a base histórica.</p>}
    {resource.status !== 'loading' && !data && <p role="status">Base histórica indisponível. Use Atualizar para tentar novamente.</p>}
    {resource.stale && data && <p role="status">Exibindo a última base disponível.</p>}
    {data && <HistoryDashboard key={data.generatedAt} data={data}/>}
  </section>
}
