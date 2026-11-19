import { useState } from 'react'
import { buildCbsAnnual } from './cbsAnnual.js'

const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export default function CbsAnnualScenario({ revenue, inputs, overrides }) {
  const [selected, setSelected] = useState(0)
  const months = buildCbsAnnual(revenue, overrides, inputs)
  const valid = months.filter(month => month.result.ok)
  const max = Math.max(0, ...valid.map(month => month.result.reserveDelayed))
  const top = max > 0 ? max * 1.15 : 1
  const x = index => 30 + index * 66
  const y = value => 175 - value / top * 140
  const current = months[selected]
  const uniform = valid.length === 12 && valid.every(month => month.result.reserveDelayed === valid[0].result.reserveDelayed)
  return <section className="cbs-annual" aria-labelledby="cbs-annual-title">
    <div className="cbs-chart-heading"><h4 id="cbs-annual-title">Reserva adicional por mês</h4><p>Cada mês é calculado separadamente, com os mesmos prazos e hipóteses.</p></div>
    {/* Meses iguais: uma linha de texto diz mais que um gráfico reto (como na visão geral). */}
    {uniform ? <p className="cbs-series-flat"><b>Reserva adicional:</b> {money(valid[0].result.reserveDelayed)} em todos os meses.</p> : <>
    <p className="cbs-chart-scale">Reserva adicional de CBS e IBS (R$) · {valid.length === 0 ? 'sem valores válidos' : max > 0 ? `escala de R$ 0 a ${money(top)}` : 'R$ 0'}</p>
    <svg className="cbs-annual-chart" viewBox={max === 0 ? '0 135 786 90' : '0 0 786 220'} role="img" aria-labelledby="cbs-chart-title cbs-chart-description">
      <title id="cbs-chart-title">Reserva estimada de janeiro a dezembro</title>
      <desc id="cbs-chart-description">{max === 0 && valid.length === 12 ? 'Todos os meses têm reserva adicional de zero reais.' : 'Linha da reserva estimada. Use os botões dos meses ou a tabela para consultar valores exatos.'}</desc>
      {(valid.length === 0 ? [] : max === 0 ? [0] : [0, 0.5, 1]).map(fraction => <g key={fraction}><line x1="10" x2="776" y1={y(top * fraction)} y2={y(top * fraction)} vectorEffect="non-scaling-stroke" className="cbs-chart-grid"/></g>)}
      {months.map((month, index) => <g key={month.month}>
        {index > 0 && month.result.ok && months[index - 1].result.ok && <line x1={x(index - 1)} x2={x(index)} y1={y(months[index - 1].result.reserveDelayed)} y2={y(month.result.reserveDelayed)} vectorEffect="non-scaling-stroke" className="cbs-chart-line"/>}
        {month.result.ok && <circle cx={x(index)} cy={y(month.result.reserveDelayed)} r={selected === index ? 6 : 4} className="cbs-chart-dot"/>}
        <text x={x(index)} y="207" textAnchor="middle">{month.month}</text>
      </g>)}
    </svg></>}
    {!uniform && <>
    <p className="cbs-consult-label">Consultar valores de um mês:</p>
    <div className="cbs-month-buttons" aria-label="Consultar mês">{months.map((month, index) => <button key={month.month} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>{month.month}</button>)}</div>
    <p className="cbs-month-reading" aria-live="polite"><b>{current.month}</b> · {current.result.ok ? <>Faturamento: {money(current.revenue)} · Reserva: <b>{money(current.result.reserveDelayed)}</b></> : 'Faturamento inválido. Corrija este mês para calcular a reserva.'}</p>
    </>}
    <p>{valid.length === 0 ? 'Corrija os faturamentos para calcular os meses. Nenhuma reserva foi calculada.' : valid.length < 12 ? 'Meses com faturamento inválido ficam sem ponto e sem ligação na linha. Corrija-os para completar a simulação.' : max === 0 ? 'Com estes faturamentos e hipóteses, o modelo não indica reserva adicional de prazo.' : uniform ? 'O valor se repete porque faturamento, prazos e hipóteses são iguais.' : 'A variação mostra o efeito dos faturamentos informados, mantendo os mesmos prazos.'} Os valores não se acumulam e não representam o saldo de caixa.</p>
    <p className="cbs-month-pointer">Para mudar o faturamento de um mês, use “Editar meses e ver valores” no quadro “Faturamento, giro e impacto tributário”.</p>
  </section>
}
