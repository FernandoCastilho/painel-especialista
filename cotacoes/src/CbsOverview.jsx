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
  const x = i => 30 + i * 71
  const y = n => 125 - ((n - low) / span) * 95
  return <section className="cbs-series"><h4>{title}</h4><div className="cbs-chart-scroll" role="region" tabIndex="0" aria-label={title}>
    <p>Escala: {money(low)} a {money(high)}. Consulte os valores exatos em “Editar meses e ver valores”.</p>
    <svg className="cbs-series-chart" viewBox="0 0 850 140" role="img" aria-label={`${title} por mês, valores em “Editar meses e ver valores”`}>
      <line x1="15" x2="835" y1={y(0)} y2={y(0)} className="cbs-chart-grid" />
      {values.map((v, i) => Number.isFinite(v) ? <g key={i}>
        {i > 0 && Number.isFinite(values[i - 1]) && <line x1={x(i - 1)} x2={x(i)} y1={y(values[i - 1])} y2={y(v)} className="cbs-chart-line" />}
        <circle cx={x(i)} cy={y(v)} r="4" className="cbs-chart-dot" />
      </g> : null)}
    </svg>
    {/* Meses em texto da página, fora do desenho: o desenho encolhe no celular e a letra junto; aqui fica sempre legível. */}
    <div className="cbs-series-months" aria-hidden="true">{CBS_MONTHS.map((month, i) => <span key={month} style={{ left: `${x(i) / 850 * 100}%` }}>{month}</span>)}</div>
    </div></section>
}

export default function CbsOverview({ revenue, inputs, monthlyCmv, monthlyPurchases, overrides, onOverridesChange }) {
  const months = buildCbsAnnual(revenue, overrides, inputs).map(m => ({ ...m,
    ncg: operatingWorkingCapital({ revenue: m.revenue, receiveDays: inputs.receiveDays, payDays: inputs.payDays,
      stockDays: inputs.stockDays, monthlyCmv, monthlyPurchases }) }))
  // 2026 é ano de teste: CBS e IBS não substituem nada, então não há diferença a mostrar.
  const testYear = months[0].result.illustrative
  // O que nenhum mês consegue calcular vira um aviso só, em vez de "Não calculado" repetido 12 vezes.
  const hasTax = months.some(m => m.result.ok)
  const hasNcg = months.some(m => m.ncg)
  const validRevenue = m => Number.isFinite(m.revenue) && m.revenue > 0
  return <section className="desk-panel cx-panel cbs-overview"><h3>Faturamento, giro e impacto tributário</h3>
    <p>Os 12 meses são cenários independentes; não são um fluxo de caixa nem transportam saldos. O faturamento principal se repete nos 12 meses até ser alterado. CMV e compras são mantidos constantes.</p>
    <Series title="Faturamento (R$/mês)" values={months.map(m => m.revenue)} />
    <Series title="NCG operacional simplificada (R$ de saldo)" values={months.map(m => m.ncg?.total)} />
    {testYear ? <p className="cbs-series-flat"><b>Diferença tributária estimada (R$/mês):</b> não se aplica em 2026.</p>
      : <Series title="Diferença tributária estimada (R$/mês)" values={months.map(m => m.result.ok ? m.result.monthlyTaxDelta : null)} />}
    <p>Impacto negativo indica imposto menor sob as hipóteses selecionadas, não economia comprovada. A reserva de prazo é separada e não deve ser somada automaticamente à NCG. Valores de NCG são saldos, não devem ser somados ao longo do ano.</p>
    <details className="cbs-details cbs-month-editor"><summary>Editar meses e ver valores</summary>
      <p>Edite um mês para testar uma mudança; os demais continuam com o faturamento principal.</p>
      <button type="button" className="cx-action" onClick={() => onOverridesChange({})}>Usar faturamento principal em todos os meses</button>
      {!testYear && !hasTax && <p className="cbs-neutral-note cbs-month-notice">Reserva e diferença tributária não calculadas: confira os campos indicados no topo da calculadora.</p>}
      {!hasNcg && <p className="cbs-neutral-note cbs-month-notice">NCG não calculada: informe CMV, compras mensais a prazo e prazos válidos.</p>}
      <div className="cbs-month-grid">{months.map((m, i) => <div className="cx-field" key={m.month}><label htmlFor={`cbs-month-${i}`}>{m.month} · faturamento</label>
        <MoneyInput id={`cbs-month-${i}`} value={m.value} onChange={value => onOverridesChange(prev => ({ ...prev, [i]: value }))} aria-invalid={!validRevenue(m)} aria-describedby={`cbs-month-result-${i}`} />
        <p id={`cbs-month-result-${i}`}>{!validRevenue(m) ? 'Informe um faturamento positivo válido.' : <>
          {!testYear && m.result.ok && <>Reserva: {money(m.result.reserveDelayed)}<br />Diferença tributária: {money(m.result.monthlyTaxDelta)}<br /></>}
          {m.ncg && <>NCG: {money(m.ncg.total)}</>}
        </>}</p></div>)}</div>
    </details>
  </section>
}
