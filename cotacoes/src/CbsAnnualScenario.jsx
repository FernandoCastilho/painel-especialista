import { useState } from 'react'
import MoneyInput from './MoneyInput.jsx'
import { buildCbsAnnual } from './cbsAnnual.js'

const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export default function CbsAnnualScenario({ revenue, inputs, overrides, onOverridesChange }) {
  const [selected, setSelected] = useState(0)
  const months = buildCbsAnnual(revenue, overrides, inputs)
  const valid = months.filter(month => month.result.ok)
  const max = Math.max(0, ...valid.map(month => month.result.reserveDelayed))
  const top = max > 0 ? max * 1.15 : 1
  const x = index => 110 + index * 66
  const y = value => 175 - value / top * 140
  const current = months[selected]
  const uniform = valid.length === 12 && valid.every(month => month.result.reserveDelayed === valid[0].result.reserveDelayed)
  return <section className="cbs-annual" aria-labelledby="cbs-annual-title">
    <div className="cbs-chart-heading"><h4 id="cbs-annual-title">Reserva adicional por mês</h4><p>Cada mês é calculado separadamente, com os mesmos prazos e hipóteses.</p></div>
    <p className="cbs-chart-scale">Reserva adicional de CBS (R$) · {valid.length === 0 ? 'sem valores válidos' : max > 0 ? `escala de R$ 0 a ${money(top)}` : 'R$ 0'}</p>
    <p className="cbs-chart-mobile-hint">Deslize o gráfico para ver os 12 meses.</p>
    <div className="cbs-chart-scroll" tabIndex="0" role="region" aria-label="Gráfico de janeiro a dezembro, com rolagem horizontal">
    <svg className={`cbs-annual-chart${max === 0 ? ' is-zero' : ''}`} viewBox={max === 0 ? '0 135 890 90' : '0 0 890 220'} role="img" aria-labelledby="cbs-chart-title cbs-chart-description">
      <title id="cbs-chart-title">Reserva estimada de janeiro a dezembro</title>
      <desc id="cbs-chart-description">{max === 0 && valid.length === 12 ? 'Todos os meses têm reserva adicional de zero reais.' : 'Linha da reserva estimada. Use os botões dos meses ou a tabela para consultar valores exatos.'}</desc>
      {(valid.length === 0 ? [] : max === 0 ? [0] : [0, 0.5, 1]).map(fraction => <g key={fraction}><line x1="110" x2="845" y1={y(top * fraction)} y2={y(top * fraction)} vectorEffect="non-scaling-stroke" className="cbs-chart-grid"/></g>)}
      {months.map((month, index) => <g key={month.month}>
        {index > 0 && month.result.ok && months[index - 1].result.ok && <line x1={x(index - 1)} x2={x(index)} y1={y(months[index - 1].result.reserveDelayed)} y2={y(month.result.reserveDelayed)} vectorEffect="non-scaling-stroke" className="cbs-chart-line"/>}
        {month.result.ok && <circle cx={x(index)} cy={y(month.result.reserveDelayed)} r={selected === index ? 6 : 4} className="cbs-chart-dot"/>}
        <text x={x(index)} y="207" textAnchor="middle">{month.month}</text>
      </g>)}
    </svg>
    </div>
    <p className="cbs-consult-label">Consultar valores de um mês:</p>
    <div className="cbs-month-buttons" aria-label="Consultar mês">{months.map((month, index) => <button key={month.month} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>{month.month}</button>)}</div>
    <p className="cbs-month-reading" aria-live="polite"><b>{current.month}</b> · {current.result.ok ? <>Faturamento: {money(current.revenue)} · Reserva: <b>{money(current.result.reserveDelayed)}</b></> : 'Faturamento inválido. Corrija este mês para calcular a reserva.'}</p>
    <p>{valid.length === 0 ? 'Corrija os faturamentos para calcular os meses. Nenhuma reserva foi calculada.' : valid.length < 12 ? 'Meses com faturamento inválido ficam sem ponto e sem ligação na linha. Corrija-os para completar a simulação.' : max === 0 ? 'Com estes faturamentos e hipóteses, o modelo não indica reserva adicional de prazo.' : uniform ? 'A linha fica plana porque faturamento, prazos e hipóteses são iguais.' : 'A variação mostra o efeito dos faturamentos informados, mantendo os mesmos prazos.'} Os valores não se acumulam e não representam o saldo de caixa.</p>
    <details className="cbs-details cbs-month-editor"><summary>Editar faturamento dos meses e ver valores</summary>
      <p>Por padrão, o faturamento principal se repete nos 12 meses. Edite um mês para testar uma mudança; os demais continuam usando o valor principal.</p>
      <button type="button" className="cx-action" onClick={() => onOverridesChange({})}>Usar faturamento principal em todos</button>
      <div className="cbs-month-grid">{months.map((month, index) => <div key={month.month} className="cx-field"><label htmlFor={`cbs-month-${index}`}>{month.month} · faturamento</label><MoneyInput id={`cbs-month-${index}`} value={month.value} onChange={value => onOverridesChange(values => ({ ...values, [index]: value }))} aria-invalid={!month.result.ok} aria-describedby={`cbs-month-result-${index}`} /><p id={`cbs-month-result-${index}`}>{month.result.ok ? `Reserva: ${money(month.result.reserveDelayed)}` : 'Informe um faturamento positivo válido.'}</p></div>)}</div>
    </details>
  </section>
}
