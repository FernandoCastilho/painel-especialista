import Flag from './Flag.jsx'
import { bandeiraDe } from './paises.js'
import RefreshButton from './RefreshButton.jsx'
import DateRangePicker from './DateRangePicker.jsx'
import { Aviso } from './Avisos.jsx'
import { useMemo } from 'react'
import { isWeekendBR } from './market.js'
import Explain from './Explain.jsx'
import { Plot, fmtDate, useWidth } from './HistoryChart.jsx'
import { estrChartPoints } from './estr.js'
import Estado from './Estado.jsx'

const n2 = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const rate = (v) => `${n2(v)}% a.a.`
const DAY = 864e5
const COLORS = { CDI: 'var(--chart-teal)', SELIC: 'var(--chart-purple)', ESTR: 'var(--chart-estr)' }

// Meta Selic só tem os dias de mudança: desenha em degraus.
const stepify = (pts) => pts.flatMap((p, i) => (i ? [{ t: p.t, bid: pts[i - 1].bid }, p] : [p]))

export function RateChart({ id, title, subtitle, color, points, history, step, scales, fmt, label, note, actions, help, refresh = ['macro.json'] }) {
  const [ref, width] = useWidth()
  const ok = points && points.length > 1
  const diff = ok ? points[points.length - 1].bid - points[0].bid : 0
  const trend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
  return (
    <article className="chart" style={{ '--series': color }}>
      <header>
        <h3>
          <i className="swatch" /> <Flag code={bandeiraDe(title)} width={18} height={12} />{title}
          <small>{subtitle}</small>
          {help && <Explain id={help} grafico />}
        </h3>
        <div className="parity-actions">
          <RefreshButton files={refresh} label={title} />
          {ok && (
            <div className={`pct ${trend}`}>
              {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '■'} {Math.abs(diff).toFixed(2).replace('.', ',')} p.p.
              <small>no período</small>
            </div>
          )}
        </div>
      </header>
      {actions && <div className="chart-actions">{actions}</div>}
      <div ref={ref}>
        {ok ? (
          <Plot points={points} history={history} step={step} scales={scales} width={width} color={color} code={id} fmt={fmt} label={label} nice />
        ) : (
          <div className="placeholder" style={{ height: 120 }}>Sem dados no período.</div>
        )}
      </div>
      {note && <Aviso title={title}><p>{note}</p></Aviso>}
    </article>
  )
}

export const toInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const fromInput = (v) => {
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Períodos só dos juros (independentes do câmbio). days: 0 = desde 1999.
export const PRESETS = [
  { id: '30', label: '30 dias', days: 30 },
  { id: '90', label: '90 dias', days: 90 },
  { id: '180', label: '6 meses', days: 180 },
  { id: '365', label: '1 ano', days: 365 },
  { id: '1825', label: '5 anos', days: 1825 },
  { id: '3650', label: '10 anos', days: 3650 },
  { id: 'all', label: 'Desde 1999', days: 0 },
]
export const rangeFor = (days) => {
  const end = startOfToday()
  const start = days ? new Date(end.getTime() - days * DAY) : new Date(1999, 0, 1)
  return { start, end }
}

export function RatesPeriod({ range, preset, onPreset, onDates }) {
  const today = toInput(new Date())
  return (
    <div className="period">
      <div className="seg" role="group" aria-label="Período dos juros">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => onPreset(p)}>
            {p.label}
          </button>
        ))}
      </div>
      <DateRangePicker label="Período dos juros" start={toInput(range.start)} end={toInput(range.end)} max={today} onChange={onDates} />
    </div>
  )
}

export function CdiChart({ macro, range }) {
  const from = range.start.getTime()
  const to = range.end.getTime() + DAY
  const points = useMemo(() => macro.cdi.filter(([t]) => t >= from && t <= to).map(([t, v]) => ({ t, bid: v })), [macro, from, to])
  const history = useMemo(() => macro.cdi.map(([t, v]) => ({ t, bid: v })), [macro])
  const first = macro.cdi[0]
  const last = macro.cdi[macro.cdi.length - 1]
  return (
    <RateChart
      id="CDI"
      title="Brasil · CDI"
      help="cdi"
      subtitle="taxa anualizada"
      color={COLORS.CDI}
      points={points}
      history={history}
      fmt={rate}
      label="CDI"
      note={`${last ? `Último: ${rate(last[1])} em ${fmtDate(last[0], true)} · ` : ''}${first ? `Série disponível desde ${fmtDate(first[0], true)}` : ''}`}
    />
  )
}

// Série que só registra os dias de mudança (Selic, juros de política): recorta no período e desenha em degraus.
export function stepWindow(all, from, to) {
  const start = Math.max(0, all.findLastIndex(([t]) => t <= from))
  const cut = all.slice(start).filter(([t], i) => i === 0 || t <= to)
  if (!cut.length) return []
  const pts = cut.map(([t, v], i) => ({ t: i === 0 ? Math.max(t, from) : t, bid: v }))
  // estende o degrau vigente até o fim do período (ou até hoje)
  const end = Math.min(to - DAY, Date.now())
  if (pts[pts.length - 1].t < end) pts.push({ t: end, bid: pts[pts.length - 1].bid })
  return stepify(pts)
}
export const stepHistory = (all) => stepify(all.map(([t, v]) => ({ t, bid: v })))

export function SelicChart({ macro, range }) {
  const all = macro.selic
  const from = range.start.getTime()
  const to = range.end.getTime() + DAY
  const points = useMemo(() => stepWindow(all, from, to), [all, from, to])
  const history = useMemo(() => stepHistory(all), [all])
  const last = all[all.length - 1]
  return (
    <RateChart
      id="SELIC"
      title="Brasil · Selic meta"
      help="selic"
      subtitle="Meta definida pelo Copom"
      color={COLORS.SELIC}
      points={points}
      history={history}
      step
      fmt={rate}
      label="Meta Selic"
      note={last ? `Atual: ${rate(last[1])}` : ''}
    />
  )
}

// €STR (BCE): taxa overnight da zona do euro, no mesmo formato do CDI e da SOFR.
export function EstrChart({ series, range }) {
  const all = useMemo(() => estrChartPoints(series), [series])
  const from = range.start.getTime()
  const to = range.end.getTime() + DAY
  const points = useMemo(() => all.filter((p) => p.t >= from && p.t <= to), [all, from, to])
  const last = series.points.at(-1)
  return (
    <RateChart
      id="ESTR"
      title="Área do euro · €STR"
      help="estr"
      subtitle="BCE · taxa overnight, dias úteis"
      color={COLORS.ESTR}
      points={points}
      history={all}
      fmt={rate}
      label="€STR"
      refresh={['estr.json']}
      note={`${last ? `Último: ${rate(last.value)} em ${last.date.split('-').reverse().join('/')} · ` : ''}Série desde ${series.points[0].date.split('-').reverse().join('/')} · Média ponderada aparada das operações overnight não garantidas em euro.`}
    />
  )
}

// Juros de política do exterior (Fed, BCE, Banco do Japão): série em degraus, uma mudança por decisão.
// O Fed publica uma faixa: a linha mostra o limite superior e a nota traz a faixa vigente.
const POLICY = {
  fed: { id: 'FED', title: 'EUA · Fed (faixa-alvo)', help: 'fedFaixa', subtitle: 'limite superior da faixa-alvo', label: 'Fed · limite superior', color: 'var(--chart-gold)' },
  ecb: { id: 'ECB', title: 'Área do euro · BCE (depósito)', help: 'bceDeposito', subtitle: 'taxa de depósito', label: 'BCE · depósito', color: 'var(--chart-estr)' },
  boj: { id: 'BOJ', title: 'Japão · Meta overnight', help: 'bojMeta', subtitle: 'alvo aproximado overnight', label: 'Japão · meta', color: 'var(--chart-pink)' },
}
export function PolicyChart({ kind, series, range }) {
  const def = POLICY[kind]
  const all = useMemo(() => (series?.usagePending ? [] : series?.points ?? [])
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p?.date || '') && Number.isFinite(p.upper ?? p.value))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => [Date.parse(`${p.date}T12:00:00Z`), p.upper ?? p.value]), [series])
  const from = range.start.getTime()
  const to = range.end.getTime() + DAY
  const points = useMemo(() => stepWindow(all, from, to), [all, from, to])
  const history = useMemo(() => stepHistory(all), [all])
  const last = (series?.usagePending ? [] : series?.points ?? []).filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p?.date || '')).sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  const atual = !last ? '' : Number.isFinite(last.lower) && Number.isFinite(last.upper) ? `Faixa atual: ${n2(last.lower)}% a ${n2(last.upper)}%, desde ${last.date.split('-').reverse().join('/')}`
    : Number.isFinite(last.value) ? `Atual: ${last.approximate ? '≈ ' : ''}${rate(last.value)}, desde ${last.date.split('-').reverse().join('/')}` : ''
  return (
    <RateChart
      id={def.id}
      title={def.title}
      help={def.help}
      subtitle={def.subtitle}
      color={def.color}
      points={points}
      history={history}
      step
      fmt={rate}
      label={def.label}
      refresh={['policy-rates.json']}
      note={[atual, kind === 'fed' ? 'A linha é o limite superior da faixa-alvo.' : kind === 'boj' ? 'Série do alvo aproximado; cada degrau é a primeira observação daquele nível.' : 'Cada degrau é uma decisão do BCE.'].filter(Boolean).join(' · ')}
    />
  )
}

const STALE_LABELS = { cdi: 'CDI', selic: 'Selic', sofr: 'SOFR', sofrAvg: 'médias da SOFR', focus: 'Boletim Focus', ptax: 'PTAX' }
const stamp = (t) => (t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'data desconhecida')

// Avisos sobre a coleta das taxas (carregando, falha, dado antigo); os gráficos abrem pela tabela, em tela própria.
export function MacroStatus({ macro: m }) {
  return (
    <>
      {m.status === 'loading' && <p className="status">Carregando dados…</p>}
      {m.status === 'error' && <Estado tipo="erro" erro={m.error}>Dados indisponíveis no momento.</Estado>}
      {m.stale && <p className="status stale">Atualização pendente; mantidas as últimas taxas disponíveis.</p>}
      {m.status === 'ok' && m.data.generatedAt && (Date.now() - m.data.generatedAt > 3 * 3600e3) && !isWeekendBR() && (
        <p className="status stale">Atenção: os dados foram coletados há mais de 3 horas; a atualização automática pode ter parado.</p>
      )}
      {m.status === 'ok' && Object.keys(m.data.stale ?? {}).some(k => ['cdi', 'selic', 'sofr', 'sofrAvg'].includes(k)) && (
        <p className="status stale">
          Atualização indisponível na última coleta; mantido o último dado publicado: {Object.entries(m.data.stale).filter(([k]) => ['cdi', 'selic', 'sofr', 'sofrAvg'].includes(k)).map(([k, t]) => `${STALE_LABELS[k] ?? k} (coletado em ${stamp(t)})`).join(', ')}.
        </p>
      )}
    </>
  )
}
