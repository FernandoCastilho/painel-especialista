import { useId, useState } from 'react'
import { BANK_METRICS, bankNumber, quarterLabel, shiftQuarter, latestBankPoint } from './bancos.js'
import { bankMetricHistory, bankMetricComplement, bankMetricAnalysis } from './bancosHistory.js'

function HistoryPlot({ points, extra = [], extraLabel = 'RI', metric, name }) {
  const id = useId(), available = points.filter(point => point.item), extraAvailable = extra.filter(point => point.item)
  if (!available.length && !extraAvailable.length) return <p role="status">Histórico não disponível para este indicador e critério.</p>
  const all = [...points, ...extra], first = Math.min(...all.map(point => point.period)), last = Math.max(...all.map(point => point.period))
  const axis = []; for (let period = first; period <= last; period = shiftQuarter(period, 1)) axis.push(period)
  const main = new Map(points.map(point => [point.period, point])), second = new Map(extra.map(point => [point.period, point]))
  const values = [...available, ...extraAvailable].map(point => point.item.value), low = Math.min(...values), high = Math.max(...values)
  const padding = Math.max((high - low) * .12, Math.abs(high) * .01, .01), minimum = low - padding, maximum = high + padding
  const x = i => 100 + (axis.length === 1 ? 250 : i / (axis.length - 1) * 500), y = value => 210 - (value - minimum) / (maximum - minimum) * 175
  const unit = BANK_METRICS[metric][1]
  const path = map => axis.map((period, i) => { const item = map.get(period)?.item; return !item ? '' : `${i && map.get(axis[i - 1])?.item ? 'L' : 'M'}${x(i)},${y(item.value)}` }).join(' ')
  return <figure className="bank-history-chart"><figcaption>{name} · {BANK_METRICS[metric][0]} · {unit === 'BRL' ? 'R$ bilhões' : '%'}</figcaption>
    <div className="bank-history-plot" role="region" aria-label="Gráfico histórico trimestral" tabIndex={0}><svg viewBox="0 0 640 275" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{BANK_METRICS[metric][0]} de {name}</title><desc id={`${id}-desc`}>Trimestres sem dados aparecem como lacunas, sem ligação entre os pontos. {extraAvailable.length ? `Os pontos quadrados tracejados são do ${extraLabel}, com critério próprio, e não se ligam à linha principal. ` : ''}Valores e fontes estão na tabela abaixo. Eixo vertical ajustado à série.</desc>
      {[0, 1, 2, 3].map(i => { const value = minimum + (maximum - minimum) * i / 3; return <g key={i}><line x1="100" x2="600" y1={y(value)} y2={y(value)} className="bank-history-grid" /><text x="90" y={y(value) + 4} textAnchor="end">{bankNumber(value, unit)}</text></g> })}
      <path d={path(main)} className="bank-history-line" />
      {extraAvailable.length > 0 && <path d={path(second)} className="bank-history-line bank-history-line--ri" />}
      {axis.map((period, i) => { const point = main.get(period), other = second.get(period); return <g key={period}><text x={x(i)} y="239" textAnchor="middle">{quarterLabel(period)}</text>
        {point?.item ? <circle cx={x(i)} cy={y(point.item.value)} r="5" className="bank-history-point"><title>{quarterLabel(period)}: {bankNumber(point.item.value, unit)}</title></circle> : !other?.item && <text x={x(i)} y="260" textAnchor="middle">sem dado</text>}
        {other?.item && <rect x={x(i) - 5} y={y(other.item.value) - 5} width="10" height="10" className="bank-history-point bank-history-point--ri"><title>{extraLabel} · {quarterLabel(period)}: {bankNumber(other.item.value, unit)}</title></rect>}</g> })}
    </svg></div><p className="muted">Deslize o gráfico para ver todos os trimestres. Eixo vertical ajustado à série. Lacunas indicam trimestres sem dado equivalente; não foram estimados.{extraAvailable.length > 0 && ` Quadrados tracejados: ${extraLabel}, critério próprio, só para complementar; não é a mesma série.`}</p>
  </figure>
}

export default function BankMetricHistory({ banks, metric, mode, comparison, initialBank, ranking }) {
  const [bankId, setBankId] = useState(initialBank || banks[0]?.id)
  const bank = banks.find(item => item.id === bankId) || banks[0], points = bankMetricHistory(bank, mode, metric), extra = bankMetricComplement(bank, mode, metric), current = latestBankPoint(bank, mode)
  return <div className="bank-metric-history">
    <h2>{BANK_METRICS[metric][0]} · histórico e análise</h2>
    <label className="bank-history-picker">Banco no histórico<select aria-label="Banco no histórico" value={bank.id} onChange={event => setBankId(event.target.value)}>{banks.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <p className="muted">{current?.sourceLabel || (current?.origin === 'ri' ? 'Relatório do banco' : 'Banco Central')} · {current?.scope}. Série limitada aos dados disponíveis da mesma origem e critério.</p>
    <HistoryPlot points={points} extra={extra} extraLabel={current?.origin === 'ri' ? 'Banco Central' : 'RI'} metric={metric} name={bank.name} />
    <section className="bank-history-analysis" aria-label="Análise da evolução"><h3>Leitura da evolução</h3><p>{bankMetricAnalysis(bank, mode, metric, comparison)}</p><p>{current?.metrics?.[metric]?.note || 'Consulte o critério da série e os documentos em Valores históricos e fontes.'}</p></section>
    <section className="bank-history-ranking" aria-label="Critério do troféu"><h3>{ranking.winners.length ? '🏆 Destaque do indicador' : 'Critério do destaque'}</h3>{ranking.winners.length > 0 && <p><strong>{banks.filter(item => ranking.winners.includes(item.id)).map(item => item.name).join(' · ')}</strong> · {ranking.scope}{ranking.winners.length > 1 ? ' · empate' : ''}</p>}{ranking.growthWinners?.length > 0 && <p>🏆 Maior crescimento: <strong>{banks.filter(item => ranking.growthWinners.includes(item.id)).map(item => item.name).join(' · ')}</strong> · variação percentual na comparação escolhida{ranking.growthWinners.length > 1 ? ' · empate' : ''}</p>}<p>{ranking.reason}</p>{ranking.eligible.length > 0 && <p className="muted">Participantes: {ranking.eligible.map(item => item.bank.name).join(', ')}. Mesmo trimestre, origem e metodologia para este indicador.</p>}</section>
    <details className="bank-history-sources"><summary>Valores históricos e fontes</summary><div className="bank-detail-table" role="region" aria-label={`Histórico e fontes de ${bank.name}`} tabIndex={0}><table><thead><tr><th scope="col">Trimestre</th><th scope="col">{BANK_METRICS[metric][1] === 'BRL' ? 'R$ bi' : '%'}</th><th scope="col">Critério e fonte</th></tr></thead><tbody>{points.map(point => <tr key={point.period}><th scope="row">{quarterLabel(point.period)}</th><td>{bankNumber(point.item?.value, BANK_METRICS[metric][1])}</td><td>{point.item ? <>{point.item.note || point.item.basis} · <a href={point.item.source} target="_blank" rel="noreferrer">Documento de origem{point.item.page ? ` · p. ${point.item.page}` : ''}</a></> : 'Sem dado equivalente; não estimado.'}</td></tr>)}{extra.map(point => <tr key={`c${point.period}`}><th scope="row">{quarterLabel(point.period)} · {current?.origin === 'ri' ? 'BC' : 'RI'}</th><td>{bankNumber(point.item.value, BANK_METRICS[metric][1])}</td><td>{point.item.note || point.item.basis} · <a href={point.item.source} target="_blank" rel="noreferrer">Documento de origem{point.item.page ? ` · p. ${point.item.page}` : ''}</a></td></tr>)}</tbody></table></div><a href={bank.ri} target="_blank" rel="noreferrer">Central de resultados de {bank.name}</a></details>
  </div>
}
