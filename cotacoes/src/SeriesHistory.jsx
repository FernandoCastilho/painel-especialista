import { useMemo, useState } from 'react'
import ChartFilters from './ChartFilters.jsx'
import DateRangePicker from './DateRangePicker.jsx'
import Expandable from './Expandable.jsx'
import { Plot, useWidth } from './HistoryChart.jsx'
import { contextDate } from './marketContext.js'
import { nf } from './format.js'
import './IndicatorHistory.css'

const PRESETS = [[3, '3 meses'], [6, '6 meses'], [12, '12 meses'], [24, '2 anos'], [60, '5 anos'], [120, '10 anos'], ['all', 'Tudo']]
const isDay = (p) => /^\d{4}-\d{2}-\d{2}$/.test(p)
const tOf = (p) => Date.parse(isDay(p) ? `${p}T12:00:00Z` : `${p}-15T12:00:00Z`)
const startFor = (last, months) => { const d = new Date(tOf(last)); d.setUTCMonth(d.getUTCMonth() - months); return d.toISOString().slice(0, isDay(last) ? 10 : 7) }

// Histórico de uma referência (commodity) em tela cheia: período e escala no topo, gráfico com seleção de trecho e tabela de observações.
export default function SeriesHistory({ item, points, onClose }) {
  const [ref, width] = useWidth()
  const [preset, setPreset] = useState(12)
  const [custom, setCustom] = useState(null)
  const list = useMemo(() => points.filter((p) => Number.isFinite(p.value)).sort((a, b) => a.period.localeCompare(b.period)), [points])
  const daily = list.length > 0 && isDay(list.at(-1).period)
  const range = custom ?? (list.length ? { start: preset === 'all' ? list[0].period : startFor(list.at(-1).period, preset), end: list.at(-1).period } : null)
  const shown = useMemo(() => (range ? list.filter((p) => p.period >= range.start && p.period <= range.end) : []), [list, range?.start, range?.end])
  const plot = useMemo(() => shown.map((p) => ({ t: tOf(p.period), bid: p.value })), [shown])
  const history = useMemo(() => list.map((p) => ({ t: tOf(p.period), bid: p.value })), [list])
  const label = (p) => (daily ? contextDate(p) : contextDate(p))
  const fmt = (v) => `${nf(v)} ${item.unit}`
  const bad = range && range.start > range.end
  return (
    <Expandable label={`histórico de ${item.label}`} modal onClose={onClose}>
      <h2>{item.label} · histórico</h2>
      {/* mesmo acabamento do histórico de indicador (IndicatorHistory.css) */}
      <div className="indicator-history">
      <p className="indicator-history__lead">{item.unit} · {item.nature}{item.benchmark ? ` · ${item.benchmark}` : ''}</p>
      {!list.length ? <p role="status">Histórico indisponível para esta referência. Ausência não significa zero.</p> : (
        <>
          <ChartFilters>
            <div className="summary-period-controls">
              <div className="seg" role="group" aria-label="Período da referência">{PRESETS.map(([v, l]) => <button key={v} type="button" aria-pressed={!custom && preset === v} onClick={() => { setCustom(null); setPreset(v) }}>{l}</button>)}</div>
              <DateRangePicker label="Período da referência" mode={daily ? 'day' : 'month'} start={range.start} end={range.end} min={list[0].period} max={list.at(-1).period} onChange={(start, end) => setCustom({ start, end })} />
            </div>
            {bad && <p role="alert">O início não pode ser posterior ao fim.</p>}
          </ChartFilters>
          <p className="muted">Cobertura: {label(list[0].period)} a {label(list.at(-1).period)} · {list.length} observações {daily ? (/semanal/.test(item.nature) ? 'semanais' : 'diárias') : 'mensais'}. Períodos sem dado não são preenchidos.</p>
          {plot.length > 1 && !bad
            ? <div ref={ref}><Plot points={plot} history={history} width={width} color="var(--chart-oil)" code={`commodity-${item.id}`} intraday={false} fmt={fmt} vfmt={(v) => nf(v)} dateLabel={daily ? undefined : (t) => contextDate(new Date(t).toISOString().slice(0, 7))} label={item.label} rate={/%/.test(item.unit)} labels /></div>
            : <p role="status">{bad ? 'Ajuste o período.' : 'Poucas observações no período; escolha um intervalo maior.'}</p>}
          <div className="oil-history-table" tabIndex={0} role="region" aria-label="Tabela de observações do período">
            <table><caption>{item.label} · observações do período (mais recentes primeiro, até 400)</caption><thead><tr><th scope="col">{daily ? 'Data' : 'Competência'}</th><th scope="col">{item.unit}</th></tr></thead>
              <tbody>{[...shown].reverse().slice(0, 400).map((p) => <tr key={p.period}><th scope="row">{label(p.period)}</th><td>{nf(p.value)}</td></tr>)}</tbody></table>
          </div>
        </>
      )}
      </div>
    </Expandable>
  )
}
