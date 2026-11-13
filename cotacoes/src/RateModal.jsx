import { useMemo, useState } from 'react'
import Expandable from './Expandable.jsx'
import ChartFilters from './ChartFilters.jsx'
import { CdiChart, EstrChart, PolicyChart, RateChart, RatesPeriod, SelicChart, fromInput, rangeFor } from './Macro.jsx'
import SofrChart from './Sofr.jsx'
import CdiFuturo from './CdiFuturo.jsx'
import { CURVAS, CurveDetail } from './Curves.jsx'
import { useDataFile } from './useDataFile.js'
import { normalizeEstr } from './estr.js'
import Estado from './Estado.jsx'

const rate = (v) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`
const TITLES = {
  selic: 'Selic meta', cdi: 'CDI', di1: 'DI 1 ano', sofr: 'SOFR', estr: '€STR',
  fed: 'Fed (faixa-alvo)', ecb: 'BCE (depósito)', boj: 'Japão (meta overnight)', cdif: 'CDI futuro',
  ...Object.fromEntries(Object.entries(CURVAS).map(([id, c]) => [`curva-${id}`, c.title])),
}
const POLICY = ['fed', 'ecb', 'boj']
const SERIES = ['selic', 'cdi', 'sofr', 'estr', ...POLICY] // séries no tempo: levam o filtro de período

// Vértice de 1 ano (252 dias úteis) da curva DI da B3 em cada data de comparação disponível (hoje, 1 dia, 1 semana… 1 ano).
function di1Points(curves) {
  const br = curves?.br
  if (!br?.compare) return []
  return br.compare
    .map((c) => {
      const pts = br.curves?.[c.date]
      if (!pts?.length) return null
      const v = pts.reduce((b, p) => (!b || Math.abs(p[0] - 252) < Math.abs(b[0] - 252) ? p : b), null)
      return { t: Date.parse(`${c.date}T12:00:00Z`), bid: v[1] }
    })
    .filter(Boolean)
    .sort((a, b) => a.t - b.t)
    .filter((p, i, a) => i === 0 || p.t !== a[i - 1].t)
}

function Estr({ range }) {
  const f = useDataFile('estr.json')
  let series = null
  try { series = f.data ? normalizeEstr(f.data) : null } catch { /* arquivo inválido: o gráfico não aparece */ }
  return series?.points.length ? <EstrChart series={series} range={range} /> : <Estado tipo={f.status === 'loading' ? 'info' : 'erro'}>{f.status === 'loading' ? 'Carregando €STR…' : '€STR indisponível no momento.'}</Estado>
}

function Policy({ kind, range }) {
  const f = useDataFile('policy-rates.json')
  const series = f.data?.series?.[kind.toUpperCase()]
  if (!series?.points?.length || series.usagePending) return <Estado tipo={f.status === 'loading' ? 'info' : 'erro'}>{f.status === 'loading' ? 'Carregando fonte oficial…' : 'Série indisponível no momento.'}</Estado>
  return (
    <>
      {(f.stale || series.stale) && <p className="status stale" role="status">Atualização pendente; mantido o último dado disponível.</p>}
      <PolicyChart kind={kind} series={series} range={range} />
    </>
  )
}

// Tela de detalhe dos juros: o gráfico de um indicador, do CDI futuro ou de uma curva, aberto pela linha da tabela.
// Período e datas ficam aqui dentro, como no gráfico das moedas.
export default function RateModal({ kind, macro, curves, hol, onClose }) {
  const [preset, setPreset] = useState('365')
  const [range, setRange] = useState(() => rangeFor(365))
  const onPreset = (p) => { setPreset(p.id); setRange(rangeFor(p.days)) }
  const onDates = (a, b) => {
    let start = fromInput(a), end = fromInput(b)
    if (start > end) [start, end] = [end, start]
    setPreset('custom'); setRange({ start, end })
  }
  const data = macro?.data
  const di = useMemo(() => (kind === 'di1' ? di1Points(curves?.data) : []), [kind, curves?.data])
  const title = TITLES[kind] ?? kind
  if (kind === 'cdif') return <Expandable modal label={`detalhes: ${title}`} onClose={onClose}><CdiFuturo curves={curves} macro={data} hol={hol} /></Expandable>
  return (
    <Expandable modal label={`detalhes: ${title}`} onClose={onClose}>
      <section className="macro rate-modal">
        {!kind.startsWith('curva-') && <h2>{title}</h2>}{/* a curva já traz o mesmo título no gráfico */}
        {SERIES.includes(kind) && <ChartFilters><RatesPeriod range={range} preset={preset} onPreset={onPreset} onDates={onDates} /></ChartFilters>}
        {kind === 'cdi' && (data?.cdi?.length ? <CdiChart macro={data} range={range} /> : <p className="status">CDI indisponível no momento.</p>)}
        {kind === 'selic' && (data?.selic?.length ? <SelicChart macro={data} range={range} /> : <p className="status">Selic indisponível no momento.</p>)}
        {kind === 'sofr' && (data?.sofr?.length ? <SofrChart macro={data} range={range} /> : <p className="status">SOFR indisponível no momento.</p>)}
        {kind === 'estr' && <Estr range={range} />}
        {POLICY.includes(kind) && <Policy kind={kind} range={range} />}
        {kind.startsWith('curva-') && <CurveDetail id={kind.slice(6)} curves={curves} />}
        {kind === 'di1' && (
          <RateChart id="DI1" title="Brasil · DI 1 ano" subtitle="vértice de 252 dias úteis" color="var(--chart-di)" points={di} fmt={rate} label="DI 1 ano" scales={false}
            refresh={['curves.json']} note="Cada ponto é o vértice de 1 ano da curva DI x pré em uma data de comparação (hoje, 1 dia, 1 semana, 1 mês, 3 e 6 meses, 1 ano); não é uma série diária." />
        )}
      </section>
    </Expandable>
  )
}
