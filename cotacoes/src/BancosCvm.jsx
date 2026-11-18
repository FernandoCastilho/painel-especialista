import { useId, useState } from 'react'
import { useDataFile } from './useDataFile.js'
import ChartFullscreen from './ChartFullscreen.jsx'
import { marcasRedondas } from './chartEixo.js'
import { CVM_BANKS, CVM_METRICS, CVM_METRIC_KEYS, CVM_NOT_LISTED, CVM_SOURCE_PAGE, CVM_ITR_PAGE, cvmMoney, cvmSeries, cvmYearOverYear } from './bancosCvm.js'

const pct = value => `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const metricName = key => CVM_METRICS[key].short || CVM_METRICS[key].label

function CvmPlot({ series, metric, name, frequency }) {
  const id = useId(), available = series.filter(point => point.value !== null)
  if (!available.length) return <p role="status">Histórico não disponível para este indicador.</p>
  const values = available.map(point => point.value), low = Math.min(...values, 0), high = Math.max(...values)
  const eixo = marcasRedondas(low / 1e9, (high + Math.abs(high) * .08) / 1e9), minimum = eixo.lo * 1e9, maximum = eixo.hi * 1e9
  const width = Math.max(500, series.length * 56), slot = (width - 110) / series.length
  const x = i => 100 + slot * i + slot / 2, y = value => 210 - (value - minimum) / (maximum - minimum) * 175, base = y(Math.max(minimum, 0))
  return <figure className="bank-history-chart"><figcaption>{name} · {metricName(metric)} · R$ bilhões · {frequency === 'quarterly' ? 'trimestral' : 'anual'}</figcaption>
    <div className="bank-history-plot" role="region" aria-label="Gráfico do histórico contábil" tabIndex={0}><ChartFullscreen><svg viewBox={`0 0 ${width} 275`} role="img" aria-labelledby={`${id}-t ${id}-d`} style={{ minWidth: width }}>
      <title id={`${id}-t`}>{metricName(metric)} de {name}</title><desc id={`${id}-d`}>Barras por período. Períodos sem dado ficam vazios; nada foi estimado. Os valores estão na tabela abaixo.</desc>
      {eixo.ticks.map((tick, i) => <g key={i}><line x1="100" x2={width - 10} y1={y(tick * 1e9)} y2={y(tick * 1e9)} className="bank-history-grid" /><text x="90" y={y(tick * 1e9) + 4} textAnchor="end">{cvmMoney(tick * 1e9)}</text></g>)}
      {series.map((point, i) => <g key={point.key}>
        <text x={x(i)} y="239" textAnchor="middle">{point.label}</text>
        {point.value === null ? <text x={x(i)} y="260" textAnchor="middle">sem dado</text> : <rect x={x(i) - slot * .3} width={slot * .6} y={Math.min(y(point.value), base)} height={Math.max(2, Math.abs(base - y(point.value)))} className="cvm-bar" data-derived={point.derived || undefined}><title>{point.label}: R$ {cvmMoney(point.value)} bi{point.derived ? ' · 4º trimestre calculado (ano menos nove meses)' : ''}</title></rect>}
      </g>)}
    </svg></ChartFullscreen></div>
    <p className="muted">Deslize para ver todos os períodos. {frequency === 'quarterly' && 'Barras tracejadas são 4º trimestres calculados (ano menos nove meses). '}Eixo em números redondos, a partir de zero.</p>
  </figure>
}

export default function BancosCvm() {
  const file = useDataFile('bancos-cvm.json')
  const [bankId, setBankId] = useState('itau'), [metric, setMetric] = useState('assets'), [frequency, setFrequency] = useState('annual')
  const banks = (file.data?.banks || []).filter(bank => CVM_BANKS.some(item => item.id === bank.id))
  const bank = banks.find(item => item.id === bankId) || banks[0]
  const series = bank ? cvmSeries(bank, metric, frequency) : [], changes = cvmYearOverYear(series, frequency)
  // Comparação entre bancos: os mesmos períodos para todos (últimos 3 anos ou 8 trimestres).
  const limit = frequency === 'quarterly' ? 8 : 3
  const keys = [...new Set(banks.flatMap(item => cvmSeries(item, metric, frequency).map(point => point.key)))].sort().slice(-limit)
  const label = key => frequency === 'quarterly' ? `${Number(key.slice(4)) / 3}T${key.slice(0, 4)}` : key
  return <div className="cvm-panel">
    <p className="muted">Balanço e resultado contábeis consolidados · CVM (dados abertos) · valores em R$ bilhões. Base separada da comparação trimestral do Banco Central.</p>
    <div className="banks-controls">
      <label>Banco<select aria-label="Banco no balanço histórico" value={bank?.id || ''} onChange={e => setBankId(e.target.value)}>{banks.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Indicador<select aria-label="Indicador do balanço histórico" value={metric} onChange={e => setMetric(e.target.value)}>{CVM_METRIC_KEYS.map(key => <option key={key} value={key}>{CVM_METRICS[key].label}</option>)}</select></label>
      <label>Período<select aria-label="Periodicidade do balanço histórico" value={frequency} onChange={e => setFrequency(e.target.value)}><option value="annual">Anual</option><option value="quarterly">Trimestral</option></select></label>
    </div>
    {file.status === 'loading' && <p role="status">Carregando balanços da CVM…</p>}
    {file.status === 'error' && <p role="alert">Não foi possível carregar o balanço da CVM. Use “Atualizar” para tentar novamente.</p>}
    {(file.stale || file.data?.stale) && <p role="alert" className="banks-alert">A última consulta à CVM falhou em parte. Os números abaixo são os últimos disponíveis.</p>}
    {bank && <>
      <CvmPlot key={`${bank.id}-${metric}-${frequency}`} series={series} metric={metric} name={bank.name} frequency={frequency} />
      <div className="bank-detail-table" role="region" aria-label={`Comparação de ${metricName(metric)} entre bancos`} tabIndex={0}><table><caption>{CVM_METRICS[metric].label} · R$ bilhões · variação contra {frequency === 'quarterly' ? 'o mesmo trimestre do ano anterior' : 'o ano anterior'}</caption>
        <thead><tr><th scope="col">Banco</th>{keys.map(key => <th scope="col" key={key}>{label(key)}</th>)}</tr></thead>
        <tbody>{banks.map(item => {
          const itemSeries = cvmSeries(item, metric, frequency), itemChanges = cvmYearOverYear(itemSeries, frequency)
          return <tr key={item.id}><th scope="row">{item.name}</th>{keys.map(key => {
            const i = itemSeries.findIndex(point => point.key === key), point = itemSeries[i], change = i >= 0 ? itemChanges[i] : null
            return <td key={key}>{point && point.value !== null ? <>{cvmMoney(point.value)}{change !== null && <small className={`bank-change ${metric === 'profit' || metric === 'revenue' ? (change >= 0 ? 'bank-change--subiu' : 'bank-change--caiu') : 'bank-change--neutro'}`}>{pct(change)}</small>}</> : '—'}</td>
          })}</tr>
        })}</tbody></table></div>
      <details className="bank-history-sources" open={false}><summary>Valores de {bank.name} e fontes</summary><div className="bank-detail-table" role="region" aria-label={`Valores e fontes de ${bank.name}`} tabIndex={0}><table><thead><tr><th scope="col">Período</th><th scope="col">R$ bi</th><th scope="col">Variação</th><th scope="col">Origem</th></tr></thead>
        <tbody>{[...series].reverse().map((point, r) => { const i = series.length - 1 - r; return <tr key={point.key}><th scope="row">{point.label}</th><td>{cvmMoney(point.value)}</td><td>{changes[i] === null ? '—' : pct(changes[i])}</td><td>{point.value === null ? 'Sem dado equivalente; não estimado.' : <>{point.source}{point.derived ? ' · calculado' : ''} · <a href={point.source.startsWith('ITR') ? CVM_ITR_PAGE : CVM_SOURCE_PAGE} target="_blank" rel="noreferrer">Dados abertos da CVM</a></>}</td></tr> })}</tbody></table></div></details>
    </>}
    {file.status === 'ok' && !banks.length && <p role="status">Nenhum dado da CVM disponível.</p>}
    <details className="banks-method"><summary>Como interpretar este balanço</summary>
      <ul>
        <li>São demonstrações <strong>contábeis consolidadas</strong> (DFP anual e ITR trimestral). A comparação trimestral do Banco Central usa o conglomerado <em>prudencial</em>: perímetros diferentes, então os números não batem e as duas bases não são misturadas.</li>
        <li>O lucro é o <strong>contábil consolidado</strong>, incluindo participação de minoritários. Não é o lucro recorrente gerencial usado no ROE dos relatórios dos bancos.</li>
        <li>A CVM não publica o 4º trimestre isolado: receita e lucro do 4º trimestre são calculados como o ano menos os nove primeiros meses e vêm marcados como calculados. Ativo, patrimônio líquido e passivos são saldos de fim de período e não precisam desse cálculo.</li>
        <li>O plano de contas varia por banco; cada indicador é reconhecido pelo nome da conta. Havendo reapresentação, vale a versão mais recente do documento.</li>
        <li>Inadimplência, Basileia e carteira de crédito PF/PJ não existem nesta base e seguem só na comparação do Banco Central e dos relatórios dos bancos.</li>
        <li>{CVM_NOT_LISTED.join(' e ')} não têm registro de companhia aberta na CVM e não aparecem aqui.</li>
      </ul>
      <p><a href={CVM_SOURCE_PAGE} target="_blank" rel="noreferrer">Demonstrações anuais (DFP)</a> · <a href={CVM_ITR_PAGE} target="_blank" rel="noreferrer">Informações trimestrais (ITR)</a>. Os bancos publicam até 90 dias após o fim do ano e 45 dias após cada trimestre.</p>
    </details>
  </div>
}
