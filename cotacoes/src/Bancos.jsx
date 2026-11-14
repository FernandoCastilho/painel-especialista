import { useState } from 'react'
import { useDataFile } from './useDataFile.js'
import RefreshButton from './RefreshButton.jsx'
import Expandable from './Expandable.jsx'
import { BANK_SOURCE_PAGE, BANKS, BANK_METRICS, bankNumber, quarterLabel, latestBankPoint, bankComparison, metricChange } from './bancos.js'
import BankMetricHistory from './BankMetricHistory.jsx'
import { bankMetricLeaders } from './bancosHistory.js'
import './Bancos.css'

function Value({ point, previous, metric, trophy }) {
  const raw = point?.metrics?.[metric], item = Number.isFinite(raw?.value) ? raw : null, change = metricChange(point, previous, metric)
  const symbol = change?.direction === 'subiu' ? '↑' : change?.direction === 'caiu' ? '↓' : '—'
  return <><span className="bank-value-line"><span title={item?.note || item?.basis}>{item ? bankNumber(item.value, BANK_METRICS[metric][1]) : 'Não disponível'}</span>{trophy}</span>{change && <small className={`bank-change bank-change--${change.direction}${/^(npl|provision)/.test(metric) ? ' bank-change--neutro' : ''}`} aria-label={`${change.direction}${change.direction !== 'estável' ? ` ${bankNumber(Math.abs(change.value), '%').replace('%', '')} ${change.unit}` : ''}`} title={`${change.direction} · direção da variação, não avaliação de qualidade`}><span aria-hidden="true">{symbol}</span>{change.direction !== 'estável' && ` ${bankNumber(Math.abs(change.value), '%').replace('%', '')} ${change.unit}`}</small>}</>
}
function BankDetails({ bank, point, previous, expanded = false }) {
  return <details className="bank-details" open={expanded || undefined}><summary>Detalhes e fontes — {bank.name}</summary>
    <p>{point?.sourceLabel || (point?.origin === 'ri' ? 'Resultado do banco' : 'Banco Central')} · {point?.scope || 'Sem dados disponíveis'} · {quarterLabel(point?.period)}. {point?.note}</p>
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
  const [mode, setMode] = useState('latest'), [segment, setSegment] = useState('Total'), [comparison, setComparison] = useState(-1), [query, setQuery] = useState(''), [details, setDetails] = useState(null), [history, setHistory] = useState(null)
  const banks = (file.data?.banks || []).filter(b => BANKS.some(item => item.id === b.id) && b.name.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))).map(b => ({ ...b, logo: BANKS.find(item => item.id === b.id).logo }))
  const selectedBank = file.data?.banks?.find(bank => bank.id === details)
  const selectedPoint = latestBankPoint(selectedBank, mode)
  const metrics = ['basel', 'assets', 'creditPJ', 'creditPF', 'creditTotal', `provision${segment}`, `provisionRatio${segment}`, `npl${segment}`, 'profit', 'roe']
  const bankColumns = banks.map(bank => {
    const point = latestBankPoint(bank, mode)
    return { bank, point, previous: bankComparison(bank, point, comparison) }
  })
  const rankings = Object.fromEntries(metrics.map(key => [key, bankMetricLeaders(bankColumns, key)]))
  const openHistory = (event, metric) => {
    const cellBank = event.target.closest('[data-bank-cell]')?.dataset.bankCell
    event.currentTarget.querySelector('.bank-history-button')?.focus()
    setHistory({ metric, bank: cellBank || banks[0]?.id })
  }
  return <section className="banks-panel" aria-labelledby="banks-title">
    <div className="banks-heading"><div><h2 id="banks-title">Bancos · capital, crédito e resultado</h2><p className="muted">Última divulgação disponível por banco · valores em R$ bilhões · índices em %</p></div><RefreshButton files={['bancos.json']} label="bancos" /></div>
    <div className="banks-controls">
      <label>Base de comparação<select aria-label="Base de comparação" value={mode} onChange={e => setMode(e.target.value)}><option value="latest">Último resultado por banco</option><option value="bc">Banco Central · base padronizada</option></select></label>
      <label>Provisões e inadimplência<select aria-label="Provisões e inadimplência" value={segment} onChange={e => setSegment(e.target.value)}><option value="Total">Total</option><option value="PJ">Pessoa jurídica</option><option value="PF">Pessoa física</option></select></label>
      <label>Evolução versus<select aria-label="Evolução versus" value={comparison} onChange={e => setComparison(Number(e.target.value))}><option value={-1}>Trimestre anterior</option><option value={-4}>Mesmo trimestre do ano anterior</option></select></label>
      <label>Buscar banco<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nome do banco" /></label>
    </div>
    <details className="banks-cautions"><summary>Cuidados na comparação · períodos e critérios podem diferir</summary><p className="banks-note">Confira o trimestre e o critério de cada banco: carteiras ampliadas, SCR e perímetros contábeis podem diferir. Crescimento da carteira e aumento de provisão não significam melhora automática. Basileia maior indica mais capital relativo aos riscos; sua queda isolada não comprova deterioração.</p></details>
    {file.status === 'loading' && <p role="status">Carregando balanços dos bancos…</p>}
    {file.status === 'error' && <p role="alert">Não foi possível carregar os balanços. Use “Atualizar bancos” para tentar novamente.</p>}
    {(file.stale || file.data?.stale) && <p role="alert" className="banks-alert">A última consulta falhou em parte. Os números abaixo são os últimos disponíveis; confira o trimestre de cada banco.</p>}
    {file.status === 'ok' && !banks.length && <p role="status">Nenhum banco encontrado.</p>}
    {banks.length > 0 && <><p className="muted banks-scroll-hint">Deslize para comparar. Toque num indicador para ver histórico e critérios. As setas mostram variação, não qualidade; em provisão e inadimplência elas ficam sem cor.</p>
      <div className="banks-table-scroll" role="region" aria-label="Comparação dos balanços dos bancos" tabIndex={0}><table className="banks-table" style={{ '--bank-columns': banks.length }}><caption>{banks.length} bancos · variações em % para valores e em pontos percentuais para índices · {comparison === -1 ? 'comparação trimestral' : 'comparação anual'}</caption>
        <colgroup><col className="banks-indicator-column" />{banks.map(bank => <col key={bank.id} />)}</colgroup>
        <thead><tr><th scope="col">Indicador</th>{bankColumns.map(({ bank, point }) => <th scope="col" key={bank.id} data-bank={bank.id}><div className="bank-identity"><img src={bank.logo} alt={`Logotipo ${bank.name}`} width="24" height="24" /><strong>{bank.name}</strong><button type="button" className="bank-source-button" onClick={() => setDetails(bank.id)} aria-label={`Fontes e critérios — ${bank.name}`} title={`Informações de ${bank.name}`}><span aria-hidden="true" className="bank-info-icon">i</span></button></div><span className="bank-quarter">{quarterLabel(point?.period)}</span></th>)}</tr></thead>
        <tbody>{metrics.map(key => <tr key={key} data-metric={key} className="bank-metric-row" onClick={event => openHistory(event, key)}><th scope="row"><button type="button" className="bank-history-button" aria-label={`Ver histórico de ${BANK_METRICS[key][0]}`}><span className="bank-metric-label">{BANK_METRICS[key][0]}</span><small>{BANK_METRICS[key][1] === 'BRL' ? 'R$ bi' : '%'}</small></button></th>{bankColumns.map(({ bank, point, previous }) => <td key={bank.id} data-bank-cell={bank.id}><Value point={point} previous={previous} metric={key} trophy={rankings[key].winners.includes(bank.id) ? <span className="bank-trophy" role="img" aria-label={`${rankings[key].rule.label} — ${bank.name}`} title="Destaque: consulte o critério no histórico">🏆</span> : null} /></td>)}</tr>)}
        </tbody></table></div></>}
    <details className="banks-method"><summary>Como interpretar e comparar os dados</summary>
      <ul><li>Basileia mede capital em relação aos ativos ponderados pelo risco. CET1 fica nos detalhes, quando divulgado.</li><li>Provisão é saldo para perdas esperadas; despesa de PDD é fluxo do período. Não são intercambiáveis. Uma provisão maior pode refletir risco maior ou reforço de cobertura.</li><li>Inadimplência gerencial acima de 90 dias e carteira inadimplida arrastada do SCR têm critérios próprios, identificados nas fontes.</li><li>O lucro exibido é trimestral e contábil. ROE/ROAE pode ser recorrente, excluir ágio ou usar janelas diferentes (trimestre, semestre ou período informado pelo banco): consulte o critério, sem tratar metodologias diferentes como equivalentes.</li><li>As variações são calculadas a partir dos valores transcritos e podem diferir marginalmente da publicação por arredondamento. Só aparecem entre períodos exatos da mesma fonte e critério. Valores indisponíveis não viram zero e dados antigos não preenchem lacunas de um trimestre novo.</li><li>PJ e PF podem não somar a carteira total quando há exterior, financeira, garantias ou outros perímetros. Aberturas por porte preservam a classificação original.</li></ul>
      <p><a href={BANK_SOURCE_PAGE} target="_blank" rel="noreferrer">IF.data · Banco Central</a> · relatórios trimestrais; publicação até 60 dias após março, junho e setembro e 90 dias após dezembro.</p>
      <p>Conferência das divulgações dos bancos: {file.data?.riReviewedAt || 'data indisponível'}. A coleta automática do BC não atualiza a transcrição dos relatórios de RI.</p>
    </details>
    {history && <Expandable modal label={`Histórico de ${BANK_METRICS[history.metric][0]}`} onClose={() => setHistory(null)}><BankMetricHistory key={`${history.metric}-${mode}`} banks={banks} metric={history.metric} mode={mode} comparison={comparison} initialBank={history.bank} ranking={rankings[history.metric]} /></Expandable>}
    {selectedBank && <Expandable modal label={`Detalhes e fontes — ${selectedBank.name}`} onClose={() => setDetails(null)}><h2>{selectedBank.name} · {quarterLabel(selectedPoint?.period)}</h2><BankDetails bank={selectedBank} point={selectedPoint} previous={bankComparison(selectedBank, selectedPoint, comparison)} expanded /></Expandable>}
  </section>
}
