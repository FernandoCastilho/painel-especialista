import { dataTimestamp } from './dataTimestamp.js'
import { periodChange } from './stats.js'
import { chartLinePath } from './chartLinePath.js'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFilterSlot } from './ChartFilters.jsx'
import { nextChartIndex } from './chartNavigation.js'
import { marcasRedondas } from './chartEixo.js'
import { focoPorTeclado, limitarBalao, margemEixo, rotuloEixo, saidaDeToque, useLarguraBalao, useTocarFora } from './chartToque.js'
import './ChartAccess.css'
import { useMacro } from './useMacro.js'
import Explain from './Explain.jsx'
import { centralFull, useCentralDaily, useHistory, useIntraday } from './useHistory.js'
import { seriesName } from './useQuotes.js'
import { readStorage } from './storage.js'
import { priorYear, rangeBetween } from './rangeCompare.js'
import { resample, scaleOptions } from './resample.js'
import { flagSvg } from './flags.js'

const H = 240
const M = { t: 12, r: 16, b: 28, l: 58 }

export const fmtDate = (t, long) =>
  new Date(t).toLocaleDateString('pt-BR', long ? { day: '2-digit', month: 'short', year: 'numeric' } : { day: '2-digit', month: '2-digit' })
export const fmtTime = (t, sec) => new Date(t).toLocaleTimeString('pt-BR', { timeZone:'America/Sao_Paulo', hour:'2-digit', minute:'2-digit', ...(sec ? {second:'2-digit'} : {}) })
const fmtMonth = (t) => new Date(t).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
const brl = (v, d = 4) => !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: d, maximumFractionDigits: d })

// Largura do contêiner do gráfico. Usa "ref de função" para medir também quando o elemento aparece depois (dados que chegam tarde):
// com um ref comum, o gráfico ficava preso na largura inicial (480 px).
export function useWidth() {
  const [el, setEl] = useState(null)
  const [w, setW] = useState(480)
  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return
    setW(Math.max(260, Math.floor(el.getBoundingClientRect().width)))
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [setEl, w]
}

const signed = (v, d) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const DRAG_PX = 6

// Escala dos pontos: Auto mantém o dado original; Hora, Dia, Mês e Ano agrupam (só para escalas mais grossas que o dado).
export function Plot({ points, scales = true, ...props }) {
  const [scale, setScale] = useState('auto')
  const options = useMemo(() => (scales ? scaleOptions(points) : []), [points, scales])
  const slot = useFilterSlot()
  const active = options.find((o) => o.id === scale && o.enabled)
  const view = useMemo(() => (active ? resample(points, active.id) : points), [points, active])
  const picker = options.some((o) => o.enabled) && (
        <div className="seg scale-seg" role="group" aria-label="Agrupar os pontos do gráfico">
          <span className="seg-label" aria-hidden="true">Agrupar:</span>
          <button type="button" aria-pressed={!active} aria-label="Auto: escala original dos dados" title="Escala original dos dados" onClick={() => setScale('auto')}>Auto</button>
          {options.map((o) => <button type="button" key={o.id} aria-pressed={active?.id === o.id} disabled={!o.enabled} aria-label={`Escala por ${o.label.toLowerCase()}`} title={o.enabled ? o.title : o.reason} onClick={() => setScale(o.id)}>{o.label}</button>)}
        </div>
  )
  return (
    <>
      {picker && (slot ? createPortal(picker, slot) : picker)}
      <PlotView {...props} points={view} history={props.history ?? points} intraday={active ? active.id === 'hora' : props.intraday} dateLabel={active?.name ?? props.dateLabel} compare={props.compare ?? !props.intraday} />
    </>
  )
}

// `history`: série completa para achar o mesmo trecho um ano antes (padrão: os próprios pontos). `step`: série em degraus.
function PlotView({ points: base, width, color, code, intraday, fmt, vfmt, label, nice, rate = nice, labels, light, dateLabel, history, step = false, steppedLine = false, compare = !intraday, compareReason = 'esta visão intradiária não contém histórico comparável.' }) {
  const [hover, setHover] = useState(null)
  const [sel, setSel] = useState(null)
  const [dragging, setDragging] = useState(false)
  const drag = useRef(null)
  const plotRef = useTocarFora(hover != null, setHover)
  const sig = `${base.length}:${base[0]?.t}:${base[base.length - 1]?.t}`
  useEffect(() => { setSel(null) }, [sig])
  // seleção guardada como dois pontos (tempo e valor): vale mesmo quando o gráfico se estende ao ano anterior
  const range = useMemo(() => (sel ? rangeBetween(sel.a, sel.b) : null), [sel])
  const prior = useMemo(() => (range && compare ? priorYear(history ?? base, range.t0, range.t1, step) : null), [range, compare, history, base, step])
  // com um trecho selecionado, o gráfico se estende para trás até o mesmo trecho do ano anterior
  const points = useMemo(() => {
    if (dragging || !prior || prior.t0 >= base[0].t) return base
    const src = history ?? base
    const from = prior.t0 - Math.max(2 * 864e5, (base[base.length - 1].t - prior.t0) * 0.03)
    const ext = src.filter((p) => p.t >= from && p.t <= base[base.length - 1].t)
    return ext.length > 1 ? ext : base
  }, [prior, base, history, dragging])
  const [announcement, setAnnouncement] = useState('')
  const plotId = useId()
  const g = useMemo(() => {
    const t0 = points[0].t
    const t1 = points[points.length - 1].t
    const vals = points.map((p) => p.bid)
    let lo = Math.min(...vals)
    let hi = Math.max(...vals)
    // amplitude mínima: série (quase) constante não ganha zoom que sugere oscilação inexistente (Selic parada, por exemplo)
    const mid = (hi + lo) / 2
    const minSpan = nice ? 0.5 : Math.abs(mid) * 0.003
    if (hi - lo < minSpan) {
      lo = mid - minSpan / 2
      hi = mid + minSpan / 2
    }
    const pad = (hi - lo || hi * 0.01) * 0.12
    lo -= pad
    hi += pad
    // eixo sempre em números redondos (passos 1, 2, 2,5 ou 5 × 10^k), com o domínio estendido até a marca vizinha
    const eixo = marcasRedondas(lo, hi)
    lo = eixo.lo
    hi = eixo.hi
    const yTicks = eixo.ticks
    const casas = eixo.casas
    // casas da variação do trecho selecionado (não do eixo): valores na casa dos milhares ficam sem centavos
    const dec = nice ? casas : Math.min(5, Math.max(Math.abs(hi) >= 1000 ? 0 : 2, Math.ceil(-Math.log10((hi - lo) / 4)) + 1))
    // margem esquerda pelo maior rótulo: números longos e negativos (−1.000.000) não saem cortados
    const l = margemEixo(yTicks.map((v) => rotuloEixo(v, casas)), M.l)
    const iw = width - l - M.r
    const ih = H - M.t - M.b
    const x = (t) => l + (t1 === t0 ? iw / 2 : ((t - t0) / (t1 - t0)) * iw)
    const y = (v) => M.t + (1 - (v - lo) / (hi - lo)) * ih
    const nx = width < 420 ? 3 : 5
    const xTicks = t0 === t1 ? [t0] : Array.from({ length: nx }, (_, i) => t0 + ((t1 - t0) * i) / (nx - 1))
    const line = chartLinePath(points, x, y, 'bid', steppedLine)
    const base = H - M.b
    const area = `${line}L${x(t1).toFixed(1)},${base}L${x(t0).toFixed(1)},${base}Z`
    return { t0, t1, l, x, y, dec, casas, yTicks, xTicks, line, area, base, long: t1 - t0 > 200 * 864e5, years: t1 - t0 > 3 * 365 * 864e5 }
  }, [points, width, steppedLine, nice])

  const pointAt = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * width
    let best = 0
    let bd = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(g.x(p.t) - px)
      if (d < bd) {
        bd = d
        best = i
      }
    })
    return { px, best }
  }
  const onMove = (e) => {
    const { px, best } = pointAt(e)
    setHover(best)
    const d = drag.current
    if (!d) return
    if (!d.moved && Math.abs(px - d.px) < DRAG_PX) return
    d.moved = true
    setSel({ a: d.point, b: points[best] })
  }
  const onDown = (e) => {
    if (e.button !== 0 || points.length < 2) return
    const { px, best } = pointAt(e)
    setHover(best)
    setDragging(true)
    drag.current = { px, point: points[best], moved: false, had: sel != null, before: sel }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* sem captura: o arrasto segue dentro do gráfico */ }
  }
  const onCancel = () => { setDragging(false); if (drag.current) setSel(drag.current.before); drag.current = null }
  const onUp = () => {
    setDragging(false)
    // toque simples, sem arrastar, desfaz a seleção anterior
    if (drag.current && !drag.current.moved && drag.current.had) setSel(null)
    drag.current = null
  }

  const last = points[points.length - 1]
  // rótulos de valor: ver abaixo
  // rótulos de valor só onde importam: último, primeiro, máximo e mínimo, sem encavalar (mínimo de 64 px entre eles)
  const marks = useMemo(() => {
    const vals = points.map((p) => p.bid)
    const cand = [points.length - 1, 0, vals.indexOf(Math.max(...vals)), vals.indexOf(Math.min(...vals))]
    const kept = []
    for (const i of cand) if (!kept.some((k) => Math.abs(g.x(points[k].t) - g.x(points[i].t)) < 64 || points[k].bid === points[i].bid)) kept.push(i) // sem repetir o mesmo valor
    return kept.sort((a, b) => a - b)
  }, [points, g])
  const hp = hover != null ? points[hover] : null
  const [tipRef, tipW] = useLarguraBalao(hp)
  const gid = `a-${plotId.replaceAll(':', '')}`
  const onKey = (e) => {
    if (e.key === 'Escape' && sel) { e.preventDefault(); e.stopPropagation(); setSel(null); return }
    const next = nextChartIndex(e.key, hover, points.length)
    if (next == null) return
    e.preventDefault()
    // Shift + setas estende o trecho a partir do ponto em foco
    if (e.shiftKey && hover != null) setSel({ a: sel?.a ?? points[hover], b: points[next] })
    setHover(next)
    const point = points[next]
    setAnnouncement(`${label ?? code}: ${dateLabel ? dateLabel(point.t) : intraday ? fmtTime(point.t, true) : fmtDate(point.t, true)}; ${fmt ? fmt(point.bid) : brl(point.bid)}`)
  }
  const when = (t) => (dateLabel ? dateLabel(t) : intraday ? fmtTime(t) : fmtDate(t, true))
  const fmtPct = (v) => (v == null ? '—' : `${signed(v, 2)}%`)
  const unit = rate ? ' p.p.' : ''
  const abs = (v) => `${signed(v, g.dec)}${unit}`
  const tone = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat')

  return (
    <div ref={plotRef} className={`plot${light ? ' light' : ''}`} onPointerLeave={(e) => { if (!saidaDeToque(e)) setHover(null) }}>
      <span id={`${plotId}-hint`} className="chart-access-text">Use as setas para percorrer os pontos; Home e End vão ao primeiro e ao último. Shift com as setas seleciona um trecho; Escape limpa. Com o mouse ou o dedo, arraste sobre o gráfico para selecionar um trecho.</span>
      <span className="chart-access-text" role="status" aria-live="polite">{announcement}</span>
      <svg
        tabIndex={0}
        aria-describedby={`${plotId}-hint`}
        onFocus={(e) => { if (focoPorTeclado(e)) setHover(0) }}
        onBlur={() => setHover(null)}
        onKeyDown={onKey}
        viewBox={`0 0 ${width} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={`Gráfico de linha de ${label ?? `${code}/BRL`}, de ${dateLabel ? dateLabel(g.t0) : intraday ? fmtTime(g.t0) : fmtDate(g.t0, true)} a ${dateLabel ? dateLabel(g.t1) : intraday ? fmtTime(g.t1) : fmtDate(g.t1, true)}`}
        onPointerMove={onMove}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        style={{ touchAction: 'pan-y' }}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.18" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {g.yTicks.map((v) => (
          <g key={v}>
            <line x1={g.l} x2={width - M.r} y1={g.y(v)} y2={g.y(v)} className="gridline" />
            <text x={g.l - 8} y={g.y(v)} dy="0.32em" textAnchor="end" className="tick">
              {rotuloEixo(v, g.casas)}
            </text>
          </g>
        ))}
        {g.xTicks.map((t, i) => (
          <text
            key={t}
            x={g.x(t)}
            y={H - 8}
            textAnchor={i === 0 ? 'start' : i === g.xTicks.length - 1 ? 'end' : 'middle'}
            className="tick"
          >
            {dateLabel ? dateLabel(t) : intraday ? fmtTime(t) : g.years ? new Date(t).getFullYear() : g.long ? fmtMonth(t) : fmtDate(t)}
          </text>
        ))}
        <path d={g.area} fill={`url(#${gid})`} />
        <path className="line" style={{ color }} d={g.line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={g.x(last.t)} cy={g.y(last.bid)} r="4" fill={color} className="ring" />
        {labels && (vfmt ?? fmt) && marks.map((i) => {
          const p = points[i]
          const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'
          return (
            <g key={p.t} pointerEvents="none">
              <circle cx={g.x(p.t)} cy={g.y(p.bid)} r="2.5" fill={color} />
              <text x={g.x(p.t)} y={g.y(p.bid) - 9} textAnchor={anchor} className="vlabel">{(vfmt ?? fmt)(p.bid)}</text>
            </g>
          )
        })}
        {[{ r: range, cls: 'cur' }, ...(prior ? [{ r: prior, cls: 'prior' }] : [])].map(({ r, cls }) => r && (
          <g key={cls} pointerEvents="none" className={`sel sel-${cls}`}>
            <rect x={g.x(r.t0)} y={M.t} width={Math.max(0, g.x(r.t1) - g.x(r.t0))} height={H - M.t - M.b} className="sel-band" fill={color} />
            {[r.t0, r.t1].map((t) => <line key={t} x1={g.x(t)} x2={g.x(t)} y1={M.t} y2={g.base} className="sel-line" />)}
            <line x1={g.x(r.t0)} y1={g.y(r.v0)} x2={g.x(r.t1)} y2={g.y(r.v1)} className={`sel-chord ${tone(r.delta)}`} />
            <circle cx={g.x(r.t0)} cy={g.y(r.v0)} r="3" className="sel-dot" /><circle cx={g.x(r.t1)} cy={g.y(r.v1)} r="3" className="sel-dot" />
            <text x={Math.min(Math.max((g.x(r.t0) + g.x(r.t1)) / 2, g.l + 62), width - M.r - 62)} y={M.t + 13} textAnchor="middle" className={`sel-label ${tone(r.delta)}`}>{fmtPct(r.pct)} · {abs(r.delta)}</text>
          </g>
        ))}
        {hp && (
          <g pointerEvents="none">
            <line x1={g.x(hp.t)} x2={g.x(hp.t)} y1={M.t} y2={g.base} className="cross" />
            <circle cx={g.x(hp.t)} cy={g.y(hp.bid)} r="5" fill={color} className="ring" />
          </g>
        )}
      </svg>
      {range && (
        <div className="sel-panel" role="status">
          <span><b>Trecho</b> {when(range.t0)} → {when(range.t1)}: <em className={tone(range.delta)}>{fmtPct(range.pct)}{rate && ' rel.'} · {abs(range.delta)}</em></span>
          {compare && (prior
            ? <span><b>Ano anterior</b> {when(prior.t0)} → {when(prior.t1)}: <em className={tone(prior.delta)}>{fmtPct(prior.pct)}{rate && ' rel.'} · {abs(prior.delta)}</em> {Number.isFinite(range.pct) && Number.isFinite(prior.pct) && <> · diferença <em>{rate ? signed(range.delta - prior.delta, 2) : signed(range.pct - prior.pct, 2)} p.p.</em></>}</span>
            : <span className="muted"><b>Ano anterior</b> indisponível: o histórico não cobre esse trecho.</span>)}
          {!compare && <span className="muted"><b>Ano anterior</b> indisponível: {compareReason}</span>}
          {prior && !step && <span className="muted">Datas diárias sem publicação usam a última observação disponível em até 7 dias; meses ausentes não são preenchidos.</span>}
          <button type="button" className="sel-clear" onClick={() => setSel(null)}>Limpar seleção</button>
        </div>
      )}
      {hp && (
        <div ref={tipRef} className={`tip${range ? ' tip-low' : ''}`} style={{ left: limitarBalao(g.x(hp.t), tipW, width) }}>
          <strong>{dateLabel ? dateLabel(hp.t) : intraday ? fmtTime(hp.t, true) : fmtDate(hp.t, true)}</strong>
          {fmt ? (
            <span>{label} {fmt(hp.bid)}</span>
          ) : intraday ? (
            <span>Compra {brl(hp.bid)} · Venda {brl(hp.ask)}</span>
          ) : (
            <>
              <span>Fechamento {brl(hp.bid)}</span>
              <span>Máx. {brl(hp.high)} · Mín. {brl(hp.low)}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function useSeries(currency, start, end, day) {
  // hooks sempre chamados; só um deles usado por modo
  const daily = useHistory(currency.code, start, end, !!day)
  const intra = useIntraday(currency.code, day ?? start, !day)
  return day ? intra : daily
}

// valor dos rótulos dentro do gráfico: 4 casas (5 para o iene, que vale centavos de real)
const quoteFmt = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: v < 0.1 ? 5 : 4, maximumFractionDigits: v < 0.1 ? 5 : 4 })

export default function HistoryChart({ currency, color, start, end, day, onDay }) {
  const intraday = !!day
  const h = useSeries(currency, start, end, day)
  const central = useCentralDaily()
  const full = useMemo(() => (intraday ? undefined : centralFull(central.data, currency.code, h.data?.source)), [central.data, currency.code, h.data?.source, intraday])
  const [ref, width] = useWidth()
  const pts = h.status === 'ok' ? h.data.points : null
  const [tableOpen, setTableOpen] = useState(() => readStorage('tabelaAberta') === '1')
  useEffect(() => { try { localStorage.setItem('tabelaAberta', tableOpen ? '1' : '0') } catch { /* sem armazenamento */ } }, [tableOpen])
  const macroH = useMacro()
  const ptaxH = macroH.data?.ptaxHist?.[currency.code]
  const td = currency.code === 'JPY' ? 4 : 2 // iene vale centavos: precisa de mais casas
  const pct = periodChange(pts)
  const trend = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'

  return (
    <article className="chart" style={{ '--series': color }}>
      <header>
        <h3>
          <span className="flag" aria-hidden="true" dangerouslySetInnerHTML={{ __html: flagSvg(currency.code, 'width="24" height="16"') }} /> {h.data?.source ?? currency.code}/BRL
          <small>{seriesName(currency, h.data?.source)}</small>
          <Explain id="historico" />
        </h3>
        {pct != null && (
          <div className={`pct ${trend}`}>
            {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '■'} {pct.toFixed(2).replace('.', ',')}%
            <small>{intraday ? 'desde a 1ª amostra' : 'no período'}</small>
          </div>
        )}
      </header>
      <div ref={ref}>
        {h.status === 'loading' && <div className="placeholder" style={{ height: H }}>Carregando…</div>}
        {h.status === 'empty' && <div className="placeholder" role="status">Sem amostras na data selecionada. Isso não confirma fechamento do mercado.
          <small>Arquivo intraday consultado: {dataTimestamp(h.generatedAt)}.</small>
          {h.previousDay && onDay && <button type="button" className="btn" onClick={() => onDay(h.previousDay)}>Ver último dia anterior com amostras ({h.previousDay.split('-').reverse().join('/')})</button>}
        </div>}
        {h.status === 'error' && (
          <div className="placeholder err" style={{ height: 120 }}>
            Não foi possível carregar o histórico.<br />
            <small>{h.error}</small>
          </div>
        )}
        {pts && <Plot points={pts} history={full} width={width} color={color} code={currency.code} intraday={intraday} fmt={intraday ? brl : undefined} vfmt={quoteFmt} labels label={intraday ? 'Cotação' : undefined} />}
      </div>
      {pts && h.warning && <p className="status stale" role="status">{h.warning}</p>}
      {pts?.length === 1 && <p className="status stale" role="status">Uma única amostra disponível; aguardando outra para calcular a variação.</p>}
      {pts && <p className="status">{intraday ? `Da primeira amostra: ${dataTimestamp(pts[0].t)} até ${dataTimestamp(pts.at(-1).t)}. Horários em Brasília. Esta variação não é o Δ dia da fonte contra a referência anterior.` : `Cobertura exibida: ${fmtDate(pts[0].t, true)} a ${fmtDate(pts.at(-1).t, true)}.`}</p>}
      {pts && h.stale && <p className="status stale" role="status">Não foi possível atualizar. Mantida a última série disponível. {h.error}</p>}
      {pts && intraday && (
        <p className="status">
          Amostras observadas da fonte, com possíveis lacunas. Arquivo gerado em {dataTimestamp(h.data.generatedAt)}; esse horário não é o da última cotação.
        </p>
      )}
      {pts && !intraday && h.data?.feed && (
        <p className="status stale">Série intradiária indisponível: mostrando a referência diária, sem máxima e mínima do dia.</p>
      )}
      {pts && (
        <details className="table" open={tableOpen} onToggle={(e) => setTableOpen(e.currentTarget.open)}>
          <summary>Ver tabela ({pts.length} {intraday ? (pts.length === 1 ? 'amostra' : 'amostras') : 'dias'})</summary>
          <div className="scroll">
            <table>
              <thead>
                {intraday ? <tr><th>Hora</th><th>Cotação</th></tr> : <tr><th>Data</th><th>Fech.</th><th>Máx.</th><th>Mín.</th><th>PTAX</th></tr>}
              </thead>
              <tbody>
                {pts.map((p, i) => ({ ...p, prevBid: i > 0 ? pts[i - 1].bid : null })).reverse().map((p) => (
                  <tr key={p.t}>
                    {intraday ? (
                      <><td>{fmtTime(p.t, true)}</td><td>{brl(p.bid, td)}</td></>
                    ) : (
                      <><td>{new Date(p.t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td><td>{brl(p.bid, td)}{p.prevBid != null && p.bid !== p.prevBid && <span style={{ fontSize: '.7em', marginLeft: 3 }}>{p.bid > p.prevBid ? '▲' : '▼'}</span>}</td><td>{brl(p.high, td)}</td><td>{brl(p.low, td)}</td><td>{ptaxH?.[new Date(p.t).toISOString().slice(0, 10)] ? brl(ptaxH[new Date(p.t).toISOString().slice(0, 10)], td) : '—'}</td></>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </article>
  )
}
