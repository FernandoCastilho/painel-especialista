import MoneyInput from './MoneyInput.jsx'
import { buildCbsAnnual, operatingWorkingCapital, CBS_MONTHS } from './cbsAnnual.js'

const money = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function Series({ title, values }) {
  const available = values.filter(Number.isFinite)
  if (!available.length) return <p><b>{title}:</b> não calculado; faltam dados.</p>
  // Meses iguais: uma linha de texto diz mais que um gráfico reto.
  if (available.length === values.length && available.every(v => v === available[0])) return <p className="cbs-series-flat"><b>{title}:</b> {money(available[0])}, igual em todos os meses.</p>
  const low = Math.min(0, ...available), high = Math.max(0, ...available)
  const span = high - low || 1
  const x = i => 45 + i * 68
  const y = n => 125 - ((n - low) / span) * 95
  return <section><h4>{title}</h4><div className="cbs-chart-scroll" role="region" tabIndex="0" aria-label={title}>
    <p>Escala: {money(low)} a {money(high)}. Consulte os valores exatos na tabela.</p>
    <svg style={{ width: '100%', height: 'auto' }} viewBox="0 0 850 165" role="img" aria-label={`${title} por mês, valores na tabela abaixo`}>
      <line x1="35" x2="825" y1={y(0)} y2={y(0)} className="cbs-chart-grid" />
      {values.map((v, i) => Number.isFinite(v) ? <g key={i}>
        {i > 0 && Number.isFinite(values[i - 1]) && <line x1={x(i - 1)} x2={x(i)} y1={y(values[i - 1])} y2={y(v)} className="cbs-chart-line" />}
        <circle cx={x(i)} cy={y(v)} r="4" className="cbs-chart-dot" />
      </g> : null)}
      {CBS_MONTHS.map((month, i) => <text key={month} x={x(i)} y="152" textAnchor="middle">{month}</text>)}
    </svg></div></section>
}

export default function CbsOverview({ revenue, inputs, monthlyCmv, monthlyPurchases, overrides, onOverridesChange }) {
  const months = buildCbsAnnual(revenue, overrides, inputs).map(m => ({ ...m,
    ncg: operatingWorkingCapital({ revenue: m.revenue, receiveDays: inputs.receiveDays, payDays: inputs.payDays,
      stockDays: inputs.stockDays, monthlyCmv, monthlyPurchases }) }))
  const show = v => Number.isFinite(v) ? money(v) : 'Não calculado'
  return <section className="desk-panel cx-panel cbs-overview"><h3>Faturamento, giro e impacto tributário</h3>
    <p>Os 12 meses são cenários independentes; não são um fluxo de caixa nem transportam saldos. A média de faturamento se repete até ser alterada. CMV e compras são mantidos constantes.</p>
    <Series title="Faturamento (R$/mês)" values={months.map(m => m.revenue)} />
    <Series title="NCG operacional simplificada (R$ de saldo)" values={months.map(m => m.ncg?.total)} />
    <Series title="Diferença tributária estimada (R$/mês)" values={months.map(m => m.result.ok ? m.result.monthlyTaxDelta : null)} />
    <p>Impacto negativo indica imposto menor sob as hipóteses selecionadas, não economia comprovada. A reserva de prazo é separada e não deve ser somada automaticamente à NCG. Valores de NCG são saldos, não devem ser somados ao longo do ano.</p>
    <details><summary>Editar meses e ver valores</summary><button type="button" className="cx-action" onClick={() => onOverridesChange({})}>Repetir média em todos os meses</button>
      <div className="cbs-month-grid">{months.map((m, i) => <div className="cx-field" key={m.month}><label htmlFor={`overview-month-${i}`}>{m.month} · faturamento</label>
        <MoneyInput id={`overview-month-${i}`} value={m.value} onChange={value => onOverridesChange(prev => ({ ...prev, [i]: value }))} />
        <p>Faturamento: {show(m.revenue)}<br />NCG: {show(m.ncg?.total)}<br />Diferença tributária: {show(m.result.ok ? m.result.monthlyTaxDelta : null)}</p></div>)}</div>
    </details>
  </section>
}
