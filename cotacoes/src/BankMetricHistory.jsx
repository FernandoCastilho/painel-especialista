import { useId, useState } from 'react'
import { BANK_METRICS, bankNumber, quarterLabel, latestBankPoint } from './bancos.js'
import { bankMetricHistory, bankMetricAnalysis } from './bancosHistory.js'
import { marcasRedondas } from './chartEixo.js'

function HistoryPlot({ points, metric, name }) {
  const id = useId(), available = points.filter(point => point.item)
  if (!available.length) return <p role="status">Histórico não disponível para este indicador e critério.</p>
  const values = available.map(point => point.item.value), low = Math.min(...values), high = Math.max(...values)
  // eixo em números redondos: em bilhões quando o indicador é em reais, para a marca cair redonda na unidade mostrada
  const padding = Math.max((high - low) * .12, Math.abs(high) * .01, .01), divisor = BANK_METRICS[metric][1] === 'BRL' ? 1e9 : 1
  const eixo = marcasRedondas((low - padding) / divisor, (high + padding) / divisor), minimum = eixo.lo * divisor, maximum = eixo.hi * divisor
  const x = i => 100 + (points.length === 1 ? 250 : i / (points.length - 1) * 500), y = value => 210 - (value - minimum) / (maximum - minimum) * 175
  const unit = BANK_METRICS[metric][1], line = points.map((point, i) => !point.item ? '' : `${i && points[i - 1].item ? 'L' : 'M'}${x(i)},${y(point.item.value)}`).join(' ')
  return <figure className="bank-history-chart"><figcaption>{name} · {BANK_METRICS[metric][0]} · {unit === 'BRL' ? 'R$ bilhões' : '%'}</figcaption>
    <div className="bank-history-plot" role="region" aria-label="Gráfico histórico trimestral" tabIndex={0}><svg viewBox="0 0 640 275" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{BANK_METRICS[metric][0]} de {name}</title><desc id={`${id}-desc`}>Trimestres sem dados aparecem como lacunas, sem ligação entre os pontos. Valores e fontes estão na tabela abaixo. Eixo vertical ajustado à série.</desc>
      {eixo.ticks.map((tick, i) => { const value = tick * divisor; return <g key={i}><line x1="100" x2="600" y1={y(value)} y2={y(value)} className="bank-history-grid" /><text x="90" y={y(value) + 4} textAnchor="end">{bankNumber(value, unit)}</text></g> })}
      <path d={line} className="bank-history-line" />
      {points.map((point, i) => <g key={point.period}><text x={x(i)} y="239" textAnchor="middle">{quarterLabel(point.period)}</text>{point.item ? <circle cx={x(i)} cy={y(point.item.value)} r="5" className="bank-history-point"><title>{quarterLabel(point.period)}: {bankNumber(point.item.value, unit)}</title></circle> : <text x={x(i)} y="260" textAnchor="middle">sem dado</text>}</g>)}
    </svg></div><p className="muted">Deslize o gráfico para ver todos os trimestres. Eixo vertical ajustado à série. Lacunas indicam trimestres sem dado equivalente; não foram estimados.</p>
  </figure>
}

export default function BankMetricHistory({ banks, metric, mode, comparison, initialBank, ranking }) {
  const [bankId, setBankId] = useState(initialBank || banks[0]?.id)
  const bank = banks.find(item => item.id === bankId) || banks[0], points = bankMetricHistory(bank, mode, metric), current = latestBankPoint(bank, mode)
  return <div className="bank-metric-history">
    <h2>{BANK_METRICS[metric][0]} · histórico e análise</h2>
    <label className="bank-history-picker">Banco no histórico<select aria-label="Banco no histórico" value={bank.id} onChange={event => setBankId(event.target.value)}>{banks.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <p className="muted">{current?.sourceLabel || (current?.origin === 'ri' ? 'Relatório do banco' : 'Banco Central')} · {current?.scope}. Série limitada aos dados disponíveis da mesma origem e critério.</p>
    <HistoryPlot points={points} metric={metric} name={bank.name} />
    <section className="bank-history-analysis" aria-label="Análise da evolução"><h3>Leitura da evolução</h3><p>{bankMetricAnalysis(bank, mode, metric, comparison)}</p><p>{current?.metrics?.[metric]?.note || 'Consulte o critério da série e os documentos em Valores históricos e fontes.'}</p></section>
    <section className="bank-history-ranking" aria-label="Critério do troféu"><h3>{ranking.winners.length ? '🏆 Destaque do indicador' : 'Critério do destaque'}</h3>{ranking.winners.length > 0 && <p><strong>{banks.filter(item => ranking.winners.includes(item.id)).map(item => item.name).join(' · ')}</strong> · {ranking.scope}{ranking.winners.length > 1 ? ' · empate' : ''}</p>}<p>{ranking.reason}</p>{ranking.eligible.length > 0 && <p className="muted">Participantes: {ranking.eligible.map(item => item.bank.name).join(', ')}. Mesmo trimestre, origem e metodologia para este indicador.</p>}</section>
    <details className="bank-history-sources"><summary>Valores históricos e fontes</summary><div className="bank-detail-table" role="region" aria-label={`Histórico e fontes de ${bank.name}`} tabIndex={0}><table><thead><tr><th scope="col">Trimestre</th><th scope="col">{BANK_METRICS[metric][1] === 'BRL' ? 'R$ bi' : '%'}</th><th scope="col">Critério e fonte</th></tr></thead><tbody>{points.map(point => <tr key={point.period}><th scope="row">{quarterLabel(point.period)}</th><td>{bankNumber(point.item?.value, BANK_METRICS[metric][1])}</td><td>{point.item ? <>{point.item.note || point.item.basis} · <a href={point.item.source} target="_blank" rel="noreferrer">Documento de origem{point.item.page ? ` · p. ${point.item.page}` : ''}</a></> : 'Sem dado equivalente; não estimado.'}</td></tr>)}</tbody></table></div><a href={bank.ri} target="_blank" rel="noreferrer">Central de resultados de {bank.name}</a></details>
  </div>
}
