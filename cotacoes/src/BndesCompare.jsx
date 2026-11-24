import CalculatorHelp from './CalculatorHelp.jsx'
import { useMemo, useState } from 'react'
import ChartFilters from './ChartFilters.jsx'
import DateRangePicker from './DateRangePicker.jsx'
import { useWidth } from './HistoryChart.jsx'
import MultiLinhas from './MultiLinhas.jsx'
import { PRESETS } from './BndesChart.jsx'
import { clip, colorOf, normalize, sameUnit, toPoints, viewRange } from './multiSeries.js'
import { dmy } from './format.js'

const nfOf = (d) => (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

// Comparação: várias séries da mesma família no mesmo gráfico. Mesma unidade → nível (taxas em % a.a.); unidades diferentes → variação %
// desde o início do período. O período é o mesmo da aba (atalhos e datas).
export default function ComparaSeries({ items, loading, period, compactHelp = false }) {
  const { preset, setPreset, custom, setCustom } = period
  const [ref, width] = useWidth()
  const same = sameUnit(items)
  const [modo, setModo] = useState('nivel')
  const pct = !same || modo === 'pct'
  const range = useMemo(() => viewRange(items.map((i) => i.list), preset, custom), [items, preset, custom])
  const bad = range && range.start > range.end
  const series = useMemo(() => items.map((it, i) => {
    const raw = toPoints(clip(it.list, bad ? null : range))
    return { key: it.id, name: it.name, short: it.short, unit: it.unit, stepped: it.stepped, color: colorOf(i), level: raw, points: pct ? normalize(raw) : raw, decimals: it.decimals }
  }), [items, range, bad, pct])
  const shown = series.filter((s) => s.points.length > 0)
  const unit = same ? items[0].unit : null
  const dec = Math.max(...items.map((i) => i.decimals ?? 2))
  const nf = nfOf(pct ? 2 : dec)
  const fmt = (v, axis = false) => (Number.isFinite(v) ? (pct ? `${v > 0 && !axis ? '+' : ''}${nf(v)}%` : unit === 'R$' ? `R$ ${nf(v)}` : axis ? nf(v) : unit && unit.startsWith('%') ? `${nf(v)}%` : nf(v)) : '—')
  if (!items.some((i) => i.list.length)) return <p role="status">{loading ? 'Carregando as séries…' : 'Séries indisponíveis agora. Ausência de dado não significa valor zero.'}</p>
  const first = items.map((i) => i.list[0]?.period).filter(Boolean).sort()[0], last = items.map((i) => i.list.at(-1)?.period).filter(Boolean).sort().at(-1)
  return (
    <>
      <ChartFilters label="Período da comparação">
        <div className="summary-period-controls">
          <div className="seg" role="group" aria-label="Período da comparação">{PRESETS.map(([v, l]) => <button key={v} type="button" aria-pressed={!custom && preset === v} onClick={() => { setCustom(null); setPreset(v) }}>{l}</button>)}</div>
          {range && <DateRangePicker label="Período da comparação" mode="day" start={range.start} end={range.end} min={first} max={last} onChange={(start, end) => setCustom({ start, end })} />}
        </div>
        {bad && <p role="alert">O início não pode ser posterior ao fim.</p>}
      </ChartFilters>
      {same && (
        <div className="seg ml-mode" role="group" aria-label="Como comparar">
          <button type="button" aria-pressed={modo === 'nivel'} onClick={() => setModo('nivel')}>Nível ({unit})</button>
          <button type="button" aria-pressed={modo === 'pct'} onClick={() => setModo('pct')}>Variação % no período</button>
        </div>
      )}
      {compactHelp ? <div className="bn-def">{items.length} séries · {range ? `${dmy(range.start)} a ${dmy(range.end)}` : ''} · {pct ? 'Variação % no período' : `Nível em ${unit}`}<CalculatorHelp title="Como ler o histórico dos indexadores"><p>{pct ? (same ? 'Variação percentual sobre o primeiro valor de cada série no período.' : 'Unidades diferentes: cada série aparece em variação percentual sobre o seu primeiro valor no período.') : `Nível em ${unit}.`} Passe o mouse (ou use as setas) para ver todas as séries na mesma data. Ao selecionar um trecho, taxas são comparadas em pontos percentuais e níveis em retorno percentual.</p></CalculatorHelp></div> : (
      <p className="bn-def">{items.length} séries · {range ? `${dmy(range.start)} a ${dmy(range.end)}` : ''} · {pct ? (same ? 'variação percentual sobre o primeiro valor de cada série no período' : 'unidades diferentes: cada série aparece em variação percentual sobre o seu primeiro valor no período') : `nível em ${unit}`} Passe o mouse (ou use as setas) para ver todas as séries na mesma data. Ao selecionar um trecho, taxas são comparadas em pontos percentuais e níveis em retorno percentual.</p>
      )}
      {shown.length > 0 && width > 0
        ? <div ref={ref}><MultiLinhas series={shown} history={items.map(it=>{const base=shown.find(s=>s.key===it.id)?.level[0]?.v;return {key:it.id,points:toPoints(it.list).map(p=>pct && base ? {...p,v:(p.v/base-1)*100}:p)}})} comparisonSeries={shown.map(s=>({...s,points:s.level}))} comparisonHistory={items.map(it=>({key:it.id,points:toPoints(it.list)}))} rate={!pct && !!unit?.startsWith('%')} width={width} fmt={fmt} ariaLabel={`Comparação de ${items.length} séries: ${items.map((i) => i.name).join(', ')}`} /></div>
        : <div ref={ref}><p role="status">{bad ? 'Ajuste o período.' : 'Sem observações no período escolhido; escolha um intervalo maior.'}</p></div>}
      {shown.length < items.length && !bad && <p className="status stale" role="status">Sem dado no período para: {series.filter((s) => !s.points.length).map((s) => s.name).join(', ')}.</p>}
    </>
  )
}
