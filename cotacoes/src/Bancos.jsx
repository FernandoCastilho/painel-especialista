import { useState } from 'react'
import { useDataFile } from './useDataFile.js'
import RefreshButton from './RefreshButton.jsx'
import Expandable from './Expandable.jsx'
import { BANK_SOURCE_PAGE, BANK_METRICS, bankNumber, quarterLabel, latestBankPoint, bankComparison, metricChange, bankSummary } from './bancos.js'
import './Bancos.css'

function Value({ point, previous, metric }) {
  const raw = point?.metrics?.[metric], item = Number.isFinite(raw?.value) ? raw : null, change = metricChange(point, previous, metric)
  return <><span title={item?.note || item?.basis}>{item ? bankNumber(item.value, BANK_METRICS[metric][1]) : 'Não disponível'}</span>{change && <small className={`bank-change bank-change--${change.assessment}`}>{change.direction}{change.direction !== 'estável' && ` ${bankNumber(Math.abs(change.value), '%').replace('%', '')} ${change.unit}`}</small>}</>
}
function BankDetails({ bank, point, previous, expanded = false }) {
  return <details className="bank-details" open={expanded || undefined}><summary>Detalhes e fontes — {bank.name}</summary>
    <p>{point?.scope || 'Sem dados disponíveis'} · {quarterLabel(point?.period)}. {point?.note}</p>
    <div className="bank-detail-table" role="region" aria-label={`Indicadores e fontes de ${bank.name}`} tabIndex={0}><table><caption>Valores monetários em R$ bilhões. Variações versus {quarterLabel(previous?.period)}.</caption><thead><tr><th scope="col">Indicador</th><th scope="col">Valor e evolução</th><th scope="col">Critério e origem</th></tr></thead><tbody>{Object.entries(BANK_METRICS).map(([key, [label]]) => {
      const item = point?.metrics?.[key]
      return <tr key={key}><th scope="row">{label}</th><td><Value point={point} previous={previous} metric={key} /></td><td>{item ? <>{item.note || item.basis} · <a href={item.source} target="_blank" rel="noreferrer">Documento de origem{item.page ? ` · p. ${item.page}` : ''}</a></> : 'Abertura não disponível nesta base. Não foi estimada.'}</td></tr>
    })}</tbody></table></div>
    <h3>Carteira PJ por porte</h3>
    {point?.porte?.length ? <ul>{point.porte.map(p => <li key={p.name}>{p.name === 'Indisponível' ? 'Porte não informado' : p.name}: R$ {bankNumber(p.value)} bi · <a href={p.source} target="_blank" rel="noreferrer">Fonte</a></li>)}</ul> : <p>Abertura por porte não disponível nesta divulgação.</p>}
    {point?.origin === 'ri' && <details><summary>Consultar também a base padronizada do Banco Central</summary>{bank.observations?.length ? <p>{quarterLabel(latestBankPoint(bank, 'bc')?.period)} · Ativos: R$ {bankNumber(latestBankPoint(bank, 'bc')?.metrics?.assets?.value)} bi. Selecione “Banco Central” acima para comparar essa base.</p> : <p>Fonte indisponível.</p>}</details>}
    <a href={bank.ri} target="_blank" rel="noreferrer">Central de resultados de {bank.name}</a>
  </details>
}
export default function Bancos() {
  const file = useDataFile('bancos.json')
  const [mode, setMode] = useState('latest'), [segment, setSegment] = useState('Total'), [comparison, setComparison] = useState(-1), [query, setQuery] = useState(''), [details, setDetails] = useState(null)
  const banks = (file.data?.banks || []).filter(b => b.name.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')))
  const selectedBank = file.data?.banks?.find(bank => bank.id === details)
  const selectedPoint = latestBankPoint(selectedBank, mode)
  const columns = ['basel', 'assets', 'creditPJ', 'creditPF', 'creditTotal', `provision${segment}`, `provisionRatio${segment}`, `npl${segment}`, 'profit', 'roe']
  return <section className="banks-panel" aria-labelledby="banks-title">
    <div className="banks-heading"><div><h2 id="banks-title">Bancos · capital, crédito e resultado</h2><p className="muted">Última divulgação disponível por banco · valores em R$ bilhões · índices em %</p></div><RefreshButton files={['bancos.json']} label="bancos" /></div>
    <div className="banks-controls">
      <label>Base de comparação<select aria-label="Base de comparação" value={mode} onChange={e => setMode(e.target.value)}><option value="latest">Último resultado por banco</option><option value="bc">Banco Central · base padronizada</option></select></label>
      <label>Provisões e inadimplência<select aria-label="Provisões e inadimplência" value={segment} onChange={e => setSegment(e.target.value)}><option value="Total">Total</option><option value="PJ">Pessoa jurídica</option><option value="PF">Pessoa física</option></select></label>
      <label>Evolução versus<select aria-label="Evolução versus" value={comparison} onChange={e => setComparison(Number(e.target.value))}><option value={-1}>Trimestre anterior</option><option value={-4}>Mesmo trimestre do ano anterior</option></select></label>
      <label>Buscar banco<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nome do banco" /></label>
    </div>
    <details className="banks-cautions"><summary>Cuidados na comparação · períodos e critérios podem diferir</summary><p className="banks-note">Confira o trimestre e o critério de cada linha: carteiras ampliadas, SCR e perímetros contábeis podem diferir. Crescimento da carteira e aumento de provisão não significam melhora automática. Basileia maior indica mais capital relativo aos riscos; sua queda isolada não comprova deterioração.</p></details>
    {file.status === 'loading' && <p role="status">Carregando balanços dos bancos…</p>}
    {file.status === 'error' && <p role="alert">Não foi possível carregar os balanços. Use “Atualizar bancos” para tentar novamente.</p>}
    {(file.stale || file.data?.stale) && <p role="alert">Falha parcial na consulta. Os últimos dados disponíveis foram preservados; confira as datas e as fontes.</p>}
    {file.status === 'ok' && !banks.length && <p role="status">Nenhum banco encontrado.</p>}
    {banks.length > 0 && <><p className="muted banks-scroll-hint">Abra “Detalhes e fontes” para consultar os critérios e o porte PJ. No computador, deslize a tabela para ver todas as colunas.</p>
      <div className="banks-mobile">{banks.map(bank => {
        const point = latestBankPoint(bank, mode), previous = bankComparison(bank, point, comparison)
        return <article key={bank.id} data-bank={bank.id} className="bank-mobile-card"><header><h3>{bank.name}</h3><span>{quarterLabel(point?.period)} · {point?.sourceLabel || (point?.origin === 'ri' ? 'Resultado do banco' : 'Banco Central')}</span></header>
          <dl>{columns.map(key => <div key={key}><dt>{BANK_METRICS[key][0]} {BANK_METRICS[key][1] === 'BRL' && <small>(R$ bi)</small>}</dt><dd><Value point={point} previous={previous} metric={key} /></dd></div>)}</dl>
          <div className="bank-mobile-reading"><p className="banks-summary-text">{bankSummary(bank, point, comparison, segment)}</p><small>{previous ? `Referência: ${quarterLabel(previous.period)}.` : 'Sem comparação equivalente.'} {point?.scope}</small></div>
          <BankDetails bank={bank} point={point} previous={previous} />
        </article>
      })}</div>
      <div className="banks-table-scroll" role="region" aria-label="Comparação dos balanços dos bancos" tabIndex={0}><table className="banks-table"><caption>{banks.length} bancos · variações em % para valores e em pontos percentuais para índices · {comparison === -1 ? 'comparação trimestral' : 'comparação anual'}</caption>
        <thead><tr><th scope="col">Banco / trimestre</th>{columns.map(key => <th scope="col" key={key}>{BANK_METRICS[key][0]}<small>{BANK_METRICS[key][1] === 'BRL' ? 'R$ bi' : '%'}</small></th>)}<th scope="col">Evolução dos indicadores</th></tr></thead>
        <tbody>{banks.map(bank => {
          const point = latestBankPoint(bank, mode), previous = bankComparison(bank, point, comparison)
          return <tr key={bank.id}><th scope="row"><strong>{bank.name}</strong><span>{quarterLabel(point?.period)}</span><small>{point?.sourceLabel || (point?.origin === 'ri' ? 'Resultado do banco' : 'Banco Central')}</small></th>{columns.map(key => <td key={key}><Value point={point} previous={previous} metric={key} /></td>)}<td className="banks-summary"><p className="banks-summary-text">{bankSummary(bank, point, comparison, segment)}</p><small>{previous ? `Referência: ${quarterLabel(previous.period)}.` : 'Sem comparação equivalente.'} {point?.scope}</small><button type="button" className="bank-details-button" onClick={() => setDetails(bank.id)}>Detalhes e fontes — {bank.name}</button></td></tr>
        })}</tbody></table></div></>}
    <details className="banks-method"><summary>Como interpretar e comparar os dados</summary>
      <ul><li>Basileia mede capital em relação aos ativos ponderados pelo risco. CET1 fica nos detalhes, quando divulgado.</li><li>Provisão é saldo para perdas esperadas; despesa de PDD é fluxo do período. Não são intercambiáveis. Uma provisão maior pode refletir risco maior ou reforço de cobertura.</li><li>Inadimplência gerencial acima de 90 dias e carteira inadimplida arrastada do SCR têm critérios próprios, identificados nas fontes.</li><li>O lucro exibido é trimestral e contábil. ROE/ROAE pode ser recorrente, excluir ágio ou usar janelas diferentes (trimestre, semestre ou período informado pelo banco): consulte o critério, sem tratar metodologias diferentes como equivalentes.</li><li>As variações só aparecem entre períodos exatos da mesma fonte e critério. Valores indisponíveis não viram zero e dados antigos não preenchem lacunas de um trimestre novo.</li><li>PJ e PF podem não somar a carteira total quando há exterior, financeira, garantias ou outros perímetros. Aberturas por porte preservam a classificação original.</li></ul>
      <p><a href={BANK_SOURCE_PAGE} target="_blank" rel="noreferrer">IF.data · Banco Central</a> · relatórios trimestrais; publicação até 60 dias após março, junho e setembro e 90 dias após dezembro.</p>
      <p>Conferência das divulgações dos bancos: {file.data?.riReviewedAt || 'data indisponível'}. A coleta automática do BC não atualiza a transcrição dos relatórios de RI.</p>
    </details>
    {selectedBank && <Expandable modal label={`Detalhes e fontes — ${selectedBank.name}`} onClose={() => setDetails(null)}><h2>{selectedBank.name} · {quarterLabel(selectedPoint?.period)}</h2><BankDetails bank={selectedBank} point={selectedPoint} previous={bankComparison(selectedBank, selectedPoint, comparison)} expanded /></Expandable>}
  </section>
}
