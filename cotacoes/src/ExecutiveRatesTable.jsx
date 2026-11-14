import { rateDirection } from './rateDirection.js'
import RefreshButton from './RefreshButton.jsx'
import { useId } from 'react'
import { Aviso } from './Avisos.jsx'
import Flag from './Flag.jsx'
import Explain from './Explain.jsx'
import { bandeiraDe } from './paises.js'
import { TIPOS_TAXA, splitUnit } from './glossary.js'
import './ExecutiveRatesTable.css'

export const EXECUTIVE_RATE_PERIODS = [
  { id: 'day', label: 'Última disponível' },
  { id: 'month', label: 'Há 1 mês' },
  { id: 'halfYear', label: 'Há 180 dias' },
  { id: 'year', label: 'Há 1 ano' },
]

/**
 * Apresentação apenas: não consulta fontes, escolhe datas nem calcula taxas.
 * periods: [{ id, label }]
 * rows: [{ id, label, unit, cells: { [periodId]: { value, date, status, source, sourceUrl? } } }]
 * Os quatro textos de cada célula já devem chegar formatados pelo consumidor.
 * Uma célula ausente não é zero, nem repete o último valor de outro período.
 * onOpen(id): opcional; com ele, o nome do indicador vira botão e a linha abre o gráfico daquele indicador.
 */
// onOpen: o clique no valor abre o gráfico do indicador (o "?" da linha fica de fora: o clique fica só nas células e no nome).
function RateCell({ cell, current, compare, metaId, onOpen }) {
  const direction = compare ? rateDirection(current?.comparisonValue, cell?.comparisonValue) : null
  const hasValue = cell?.value != null && cell.value !== ''
  const status = cell?.status || (!hasValue ? 'Não disponível' : '')
  const material = /pendente|erro|falha|carregando|sem |indispon|aguardando|defas|desatual/i.test(status)

  return (
    <td aria-describedby={metaId} onClick={onOpen} className={`executive-rates__cell${hasValue ? '' : ' executive-rates__cell--missing'}`}>
      <span className="executive-rates__value">{hasValue ? cell.value : '—'}{direction && <span className={`executive-rates__direction executive-rates__direction--${direction}`} role="img" aria-label={direction === 'up' ? 'Alta até a última taxa disponível' : direction === 'down' ? 'Queda até a última taxa disponível' : 'Sem alteração até a última taxa disponível'}>{direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'}</span>}</span>
      {material && <span className="executive-rates__status">{status}</span>}
    </td>
  )
}

export default function ExecutiveRatesTable({
  rows = [],
  periods = EXECUTIVE_RATE_PERIODS,
  title = 'Cotações e indicadores',
  description,
  footnote,
  refresh,
  onOpen,
  compareRates = false,
  emptyMessage = 'Nenhum indicador disponível.',
}) {
  const id = useId()
  const titleId = `${id}-title`
  const hintId = `${id}-hint`
  const units = [...new Set(rows.map((r) => splitUnit(r.unit).unidade).filter(Boolean))]
  const commonUnit = units.length === 1 ? units[0] : ''

  return (
    <section className="executive-rates" aria-labelledby={titleId}>
      <header className="executive-rates__heading">
        <h2 id={titleId}>{title}</h2>
        {refresh && <RefreshButton files={refresh} label={title} />}
      </header>
      <p className="executive-rates__hint" id={hintId}>Deslize a tabela para ver todos os períodos →</p>
      <div
        className="executive-rates__scroll"
        role="region"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        tabIndex={0}
      >
        <table className="executive-rates__table">
          <caption className="executive-rates__sr-only">{title}: valores e respectivas datas por período.</caption>
          <colgroup>
            <col className="executive-rates__indicator-column" />
            {periods.map((period) => <col key={period.id} />)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="executive-rates__indicator">Indicador <span>{commonUnit || 'Unidade'}</span></th>
              {periods.map((period) => <th key={period.id} scope="col">{period.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={onOpen ? 'executive-rates__row--open' : undefined}>
                <th scope="row" className="executive-rates__indicator">
                  {(() => {
                    const { tipo, unidade } = splitUnit(row.unit)
                    const extra = tipo && TIPOS_TAXA[tipo] ? { t: tipo, a: TIPOS_TAXA[tipo] } : null
                    // com explicação do tipo no "?" e unidade no cabeçalho, a linha fica só com o nome (mais baixa)
                    const resto = commonUnit ? (extra || !tipo ? '' : tipo) : extra ? unidade : row.unit
                    return <>
                      <span className="executive-rates__name">{onOpen
                        ? <button type="button" className="executive-rates__open" aria-label={`${row.label}: abrir gráfico`} onClick={() => onOpen(row.id)}><Flag code={bandeiraDe(row.label)} width={18} height={12} />{row.label} <span aria-hidden="true">›</span></button>
                        : <><Flag code={bandeiraDe(row.label)} width={18} height={12} />{row.label}</>}{row.help && <Explain id={row.help} fixed tipo={extra} />}</span>
                      {resto && <span className="executive-rates__unit">{resto}</span>}
                    </>
                  })()}
                </th>
                {periods.map((period) => <RateCell key={period.id} cell={row.cells?.[period.id]} current={row.cells?.day} compare={compareRates && period.id !== 'day'} metaId={`${id}-${row.id}-${period.id}`} onOpen={onOpen ? () => onOpen(row.id) : undefined} />)}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="executive-rates__empty" colSpan={periods.length + 1}>{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {compareRates && <p className="executive-rates__comparison">Setas: movimento de cada período histórico até a última taxa disponível. ↑ alta (vermelho), ↓ queda (verde), → sem alteração.</p>}
      <div className="executive-rates__sr-only">
        <ul>{rows.map(row => <li key={row.id}><b>{row.label} · {row.unit}</b><ul>{periods.map(period => { const cell = row.cells?.[period.id]; return <li key={period.id} id={`${id}-${row.id}-${period.id}`}><b>{period.label}:</b> {cell?.date || 'Data indisponível'} · {cell?.status || 'Observação na data indicada'}</li> })}</ul></li>)}</ul>
      </div>
      <Aviso title={title}>
        {description && <p>{description}</p>}
        {footnote && <p>{footnote}</p>}
        <ul>{rows.map(row => <li key={row.id}><b>{row.label} · {row.unit}</b><ul>{periods.map(period => { const cell = row.cells?.[period.id]; return <li key={period.id}><b>{period.label}:</b> {cell?.date || 'Data indisponível'} · {cell?.status || 'Observação na data indicada'}</li> })}</ul></li>)}</ul>
      </Aviso>
    </section>
  )
}
