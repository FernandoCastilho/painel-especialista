import { useNewsClock } from './useNewsClock.js'
import { NEWS_WINDOW_DAYS, newsCollectionStale } from './newsWindow.js'
import HeavyVehicles from './HeavyVehicles.jsx'
import SectorNews from './SectorNews.jsx'
import ChartComparison from './ChartComparison.jsx'
import { Aviso } from './Avisos.jsx'
import { buildFeed } from './feed.js'
import RefreshButton from './RefreshButton.jsx'
import './MarketTable.css'
import './MarketTerminal.css'
import { accumulatedReturns, cnhPtaxCross, compatiblePtax, marketDate, ptaxLabel } from './marketReturns.js'
import { quoteAgeState } from './quoteFreshness.js'
import { nextChartIndex } from './chartNavigation.js'
import { dataTimestamp } from './dataTimestamp.js'
import { comparisonSeries } from './comparisonSeries.js'
import Expandable from './Expandable.jsx'
import ChartFilters from './ChartFilters.jsx'
import Estado from './Estado.jsx'
import { mensagemErro } from './erro.js'
import DateRangePicker from './DateRangePicker.jsx'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeIpca } from './ipca.js'
import Explain from './Explain.jsx'
import NoticiasPorDia from './NoticiasPorDia.jsx'
import { MoedasNoticias, TemaNoticias } from './ReformaTributaria.jsx'
import CuradoriaNoticias from './CuradoriaNoticias.jsx'
import GoogleTrends from './GoogleTrends.jsx'
import { moedasDaManchete, nomeDaMoeda } from './moedasNoTexto.js'
import { CURRENCIES, seriesName } from './useQuotes.js'
import { centralFull, fullWindow, fromInput, toInput, useHistory, useIntraday, useCentralDaily } from './useHistory.js'
import { liveCross, mergeDaily, mergeTicks } from './parity.js'
import { periodChange } from './stats.js'
import { flagSvg } from './flags.js'
import Flag from './Flag.jsx'
import { shareQuotesImage } from './shareImage.js'
import { rateTiles } from './snapshot.js'
import { useNews } from './useNews.js'
import Sparkline from './Sparkline.jsx'
import { Plot, useWidth, fmtTime } from './HistoryChart.jsx'
import { KpiRow, Panel } from './TerminalDesk.jsx'
import { useDataFile } from './useDataFile.js'
const RateModal = lazy(() => import('./RateModal.jsx'))

const brl = (v, d = 4) => !Number.isFinite(v) ? '—' : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}`
const pct = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2).replace('.', ',')}%`
const p2 = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const bps = (d) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(Math.round(d * 100))} bps`
const SPARK = [
  { id: 'day', label: 'Dia', days: 1, intraday: true },
  { id: 'week', label: 'Semana', days: 7 },
  { id: 'month', label: 'Mês', days: 30 },
  { id: 'year', label: 'Ano', days: 359 },
]
const toneOf = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat')
const NAMES = { USD: 'Dólar', EUR: 'Euro', JPY: 'Iene', CNH: 'Yuan' }

// Janela do minigráfico: recorte do histórico de 360 dias que já está em cache (sem consulta nova).
function useWindow(spark) {
  if (spark.range) return spark.range
  const days = spark.days
  const win = fullWindow(fromInput(marketDate(Date.now())))
  return { start: new Date(win.end.getTime() - days * 864e5), end: win.end }
}

function Arrow({ v }) {
  return <span aria-hidden="true">{v > 0 ? '▲' : v < 0 ? '▼' : '■'}</span>
}

function QuoteRow({ code, quote, ptax, returns, selected, onOpen, color }) {
  const cur = CURRENCIES.find(c => c.code === code)
  const hasDay = !!quote && !quote.fallback && Number.isFinite(quote.pct)
  const delta = hasDay && Number.isFinite(quote.delta) ? quote.delta : null
  const open = () => onOpen(code)
  const series = quote?.source || code
  return <tbody className={'market-record' + (selected ? ' is-selected' : '')} style={{ '--series': color }}>
    <tr className="market-values" onClick={open}>
      <th scope="row"><button type="button" className="market-open" aria-pressed={selected} onClick={e => { e.stopPropagation(); open() }} aria-label={cur.name + ': abrir gráfico' + (quote?.stale ? '. Última cotação válida de ' + dataTimestamp(quote.timestamp) : '')}>
        <b><Flag code={series} width={20} height={14} /> {series}/BRL <span aria-hidden="true">›</span></b><small>{seriesName(cur, series)}</small>
        {quoteAgeState(quote) && <small className="market-state" title={quote?.stale ? quote.error : undefined}>{quote?.stale ? 'Última válida · ' + dataTimestamp(quote.timestamp) : quoteAgeState(quote)}</small>}
      </button></th>
      <td className="market-price">{quote ? brl(quote.bid, code === 'JPY' ? 5 : 4).replace('R$ ', '') : <span className="muted">—</span>}</td>
      <td className={delta == null ? 'muted' : 'pct ' + toneOf(delta)}>{delta == null ? <span aria-label={quote?.cross ? 'Variação absoluta indisponível para o cruzamento' : 'Variação absoluta indisponível'} title={quote?.cross ? 'A fonte não fornece variação absoluta deste cruzamento' : 'Variação absoluta não fornecida'}>—</span> : (delta > 0 ? '+' : delta < 0 ? '−' : '') + Math.abs(delta).toLocaleString('pt-BR', { minimumFractionDigits: code === 'JPY' ? 5 : 4, maximumFractionDigits: code === 'JPY' ? 5 : 4 })}</td>
      <td className={hasDay ? 'pct ' + toneOf(quote.pct) : 'muted'}>{hasDay ? pct(quote.pct) : <span aria-label="Variação percentual do dia indisponível">—</span>}</td>
      {['month', 'year'].map(period => <td key={period} className={returns?.[period] ? 'pct ' + toneOf(returns[period].value) : 'muted'}>{returns?.[period] ? pct(returns[period].value) : <span aria-label={(period === 'month' ? 'Acumulado do mês' : 'Acumulado do ano') + ' indisponível'}>—</span>}</td>)}
      <td className="market-ptax" title={ptax?.cross ? 'Referência cruzada, não oficial: PTAX do dólar ÷ USD/CNH no horário do boletim' : undefined}>{ptax ? <>{brl(ptax.sell, code === 'JPY' ? 5 : 4).replace('R$ ', '')}<small className="ptax-kind">{ptaxLabel(ptax)}</small></> : <span aria-label="PTAX compatível indisponível">—</span>}</td>
    </tr>
  </tbody>
}

// Paridade entre duas moedas à escolha: base à esquerda, cotada à direita (padrão EUR/USD, convenção de mercado).
// Valor ao vivo e minigráfico saem das séries em reais de cada moeda.
const cross = (v, q) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: v >= 100 ? 2 : v >= 1 ? 4 : 6, maximumFractionDigits: v >= 100 ? 2 : v >= 1 ? 4 : 6 })} ${q}`
function PairSelect({ value, onChange, label }) {
  return (
    <select className="pair-sel" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
    </select>
  )
}
function ParityTile({ quotes, spark, onOpen, color }) {
  const [base, setBase] = useState('EUR')
  const [quote, setQuote] = useState('USD')
  const pick = (which, v) => {
    // moedas iguais não fazem paridade: troca a outra ponta
    if (which === 'base') {
      if (v === quote) setQuote(base)
      setBase(v)
    } else {
      if (v === base) setBase(quote)
      setQuote(v)
    }
  }
  const w = useWindow(spark)
  const dia = !!spark.intraday
  const bh = useHistory(base, w.start, w.end, dia)
  const qh = useHistory(quote, w.start, w.end, dia)
  const bi = useIntraday(base, spark.day ? fromInput(spark.day) : fromInput(marketDate(Date.now())), !dia)
  const qi = useIntraday(quote, spark.day ? fromInput(spark.day) : fromInput(marketDate(Date.now())), !dia)
  const [a, b] = dia ? [qi, bi] : [qh, bh]
  const pts = a.status === 'ok' && b.status === 'ok' ? (dia ? mergeTicks : mergeDaily)(a.data.points, b.data.points, true) : []
  const change = periodChange(pts)
  const p = liveCross(quotes?.[base], quotes?.[quote])
  const hasDay = !!p && Number.isFinite(p.pct) && p.comparable !== false && !quotes[base].fallback && !quotes[quote].fallback
  const trend = toneOf(hasDay ? p.pct : change)
  const eurUsd = base === 'EUR' && quote === 'USD'
  const [big, setBig] = useState(false)
  return (
    <>
    <div style={{ '--series': color }} className="tile wide pair-tile">
      <span className="tile-head">
        <span className="flag" aria-hidden="true" dangerouslySetInnerHTML={{ __html: flagSvg(base, 'width="26" height="18"') }} />
        <PairSelect value={base} onChange={(v) => pick('base', v)} label="Moeda base" />
        <span className="pair-slash" aria-hidden="true">/</span>
        <PairSelect value={quote} onChange={(v) => pick('quote', v)} label="Moeda cotada" />
        <span className="flag" aria-hidden="true" dangerouslySetInnerHTML={{ __html: flagSvg(quote, 'width="26" height="18"') }} />
        <button type="button" className="more" onClick={() => (eurUsd ? onOpen('PAR') : pts.length > 1 && setBig(true))}>Detalhes ›</button>
      </span>
      <span className="tile-body">
        <span className="tile-num">
          <span className="tile-price">{p ? cross(p.main, quote) : '—'}</span>
          {hasDay ? (
            <span className={`pct ${trend}`}>
              <Arrow v={p.pct} /> {pct(p.pct)}
            </span>
          ) : (
            p && <small className="muted">{p.comparable === false ? 'var. do dia indisponível: cotações de horários distintos' : 'var. do dia indisponível'}</small>
          )}
          <small className="muted">{NAMES[quote]} por 1 {NAMES[base].toLowerCase()}{(a.stale || b.stale) && ' · última série disponível'}</small>
        </span>
        {pts.length > 0 && <span className="tile-spark expandable" role="button" tabIndex={0} title="Ampliar" onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && pts.length > 1) { e.preventDefault(); setBig(true) } }} onClick={() => pts.length > 1 && setBig(true)}>
          <Sparkline points={pts} tone={change != null ? toneOf(change) : trend} />
        </span>}
      </span>
          <small className="muted tile-period">
            {spark.label}
            {change != null ? <span className={`pct ${toneOf(change)}`}> {pct(change)}</span> : spark.intraday && (a.status === 'error' || b.status === 'error' ? ' · falha na consulta' : a.status === 'empty' || b.status === 'empty' ? ' · sem amostras em comum' : ' · variação indisponível')}
          </small>
    </div>
    {big && (
      <Expandable modal label="Detalhes da taxa cruzada" onClose={() => setBig(false)}>
        <div className="resumo-chart big">
          <h3>{base}/{quote} <small className="muted">· {spark.label}</small>{change != null && <span className={`pct ${toneOf(change)}`}> {pct(change)}</span>}</h3>
          {(a.stale || b.stale) && <p className="status stale" role="status">Não foi possível atualizar. Paridade calculada com a última série disponível.</p>}
          <Wide render={(wv) => <Plot points={pts} width={wv} color={color} code={`par-${base}-${quote}-${spark.id}`} intraday={dia} fmt={(v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} vfmt={(v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} labels label={`${base}/${quote}`} />} />
        </div>
      </Expandable>
    )}
    </>
  )
}

// Último valor (%) no fim de cada linha, afastado na vertical para os rótulos não se sobreporem.
function endLabels(norm, y) {
  const items = norm.map((s) => ({ code: s.code, color: s.color, y: y(s.pts.at(-1).v), text: pct(s.pts.at(-1).v) })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < 13) items[i].y = items[i - 1].y + 13
  return items
}

// Linhas sobrepostas em variação % desde o início do período (escalas diferentes ficam comparáveis).
function MultiPlot({ series, width, intraday, history = series }) {
  const H = 240
  const M = { t: 12, r: 64, b: 28, l: 52 }
  const [hover, setHover] = useState(null)
  const norm = series.map((s) => ({ ...s, pts: s.points.map((p) => ({ t: p.t, v: (p.bid / s.points[0].bid - 1) * 100, bid: p.bid })) }))
  const all = norm.flatMap((s) => s.pts)
  const t0 = Math.min(...all.map((p) => p.t))
  const t1 = Math.max(...all.map((p) => p.t))
  let lo = Math.min(0, ...all.map((p) => p.v))
  let hi = Math.max(0, ...all.map((p) => p.v))
  const pad = Math.max(hi - lo, 0.2) * 0.12
  lo -= pad
  hi += pad
  const iw = width - M.l - M.r
  const ih = H - M.t - M.b
  const x = (t) => M.l + (t1 === t0 ? iw / 2 : ((t - t0) / (t1 - t0)) * iw)
  const y = (v) => M.t + (1 - (v - lo) / (hi - lo)) * ih
  const yTicks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4)
  const nx = width < 420 ? 3 : 5
  const xTicks = Array.from({ length: nx }, (_, i) => t0 + ((t1 - t0) * i) / (nx - 1))
  const fmtX = (t) => (intraday ? fmtTime(t) : new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }))
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * width
    setHover(t0 + ((px - M.l) / iw) * (t1 - t0))
  }
  const at = (s, t) => s.pts.reduce((b, p) => (Math.abs(p.t - t) < Math.abs(b.t - t) ? p : b), s.pts[0])
  const times = [...new Set(all.map(p => p.t))].sort((a,b) => a-b)
  const onKey = e => {
    const current = hover == null ? 0 : times.reduce((best,t,i) => Math.abs(t-hover)<Math.abs(times[best]-hover) ? i : best,0)
    const next = nextChartIndex(e.key,current,times.length)
    if (next != null) { e.preventDefault(); setHover(times[next]) }
  }
  return (
    <><ChartComparison margin={M} series={series.map(s=>({key:s.code,name:s.code,points:s.points}))} history={history.map(s=>({key:s.code,points:s.points}))} unavailable={intraday ? 'A visão intradiária não contém histórico anual comparável.' : ''}><svg className="hist-svg" viewBox={`0 0 ${width} ${H}`} width="100%" role="img" tabIndex={0} onKeyDown={onKey} onFocus={() => setHover(t0)} aria-label="Variação percentual das moedas selecionadas no período; use setas, Home e End para consultar amostras" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }}>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={M.l} x2={width - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
          <text x={M.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--mut)">{pct(v)}</text>
        </g>
      ))}
      <line x1={M.l} x2={width - M.r} y1={y(0)} y2={y(0)} stroke="var(--mut)" strokeDasharray="4 3" />
      {xTicks.map((t, i) => (
        <text key={i} x={x(t)} y={H - 8} textAnchor={i === 0 ? 'start' : i === nx - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--mut)">{fmtX(t)}</text>
      ))}
      {norm.map((s) => (
        <path key={s.code} d={s.pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('')} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
      ))}
      {endLabels(norm, y).map((l) => (
        <text key={l.code} x={width - M.r + 6} y={l.y} dy="0.32em" fontSize="11" fontWeight="700" fill={l.color} pointerEvents="none">{l.text}</text>
      ))}
      {hover != null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={H - M.b} stroke="var(--mut)" />
          {norm.map((s) => {
            const p = at(s, hover)
            return <circle key={s.code} cx={x(p.t)} cy={y(p.v)} r="3.5" fill={s.color} />
          })}
          {(() => {
            const bw = 150, bh = 22 + norm.length * 18
            const hx = x(hover)
            const bx = hx + 10 + bw > width - 4 ? hx - 10 - bw : hx + 10
            const p0 = at(norm[0], hover)
            return (
              <g pointerEvents="none">
                <rect x={bx} y={M.t} width={bw} height={bh} rx="8" fill="var(--card, #161b22)" stroke="var(--line)" opacity="0.96" />
                <text className="comparison-tooltip-time" x={bx + 10} y={M.t + 16} fontSize="11" fill="var(--mut)">{intraday ? fmtTime(p0.t) : new Date(p0.t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</text>
                {norm.map((s, k) => {
                  const p = at(s, hover)
                  const d = s.code === 'JPY' ? 4 : 4
                  return (
                    <text key={s.code} x={bx + 10} y={M.t + 34 + k * 18} fontSize="12" fill="var(--fg)">
                      <tspan fill={s.color} fontWeight="700">{s.code}</tspan>
                      <tspan dx="6">{p.bid.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}</tspan>
                      <tspan dx="6" fill={p.v > 0 ? 'var(--up)' : p.v < 0 ? 'var(--down)' : 'var(--mut)'}>{pct(p.v)}</tspan>
                    </text>
                  )
                })}
              </g>
            )
          })()}
        </g>
      )}
    </svg></ChartComparison><p className="chart-access-text" role="status" aria-live="polite">{hover != null && `${fmtX(hover)} · ${norm.map(s => s.code + ': ' + pct(at(s,hover).v)).join(' · ')}`}</p></>
  )
}

// Gráfico do Resumo: moedas escolhidas nos botões (várias ao mesmo tempo) e o período dos botões Dia/Semana/Mês/Ano.

// Tela ampliada (mesmo visual do detalhe das moedas).
function Overlay({ onClose, children }) {
  useEffect(() => {
    const onKey = (ev) => ev.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll') }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Fechar">×</button>
        {children}
      </div>
    </div>
  )
}

// Mede a largura disponível e desenha o gráfico nela.
function Wide({ render }) {
  const [ref, width] = useWidth()
  return <div ref={ref}>{width > 0 ? render(width) : null}</div>
}

function ResumoChart({ colors, spark, selection: sel, onSelection: setSel, onPrevious, comparison = false }) {
  const w = useWindow(spark)
  const dia = !!spark.intraday
  // hooks em número fixo (uma consulta por moeda; ficam em cache)
  const hs = CURRENCIES.map((c) => useHistory(c.code, w.start, w.end, dia)) // eslint-disable-line react-hooks/rules-of-hooks
  const is = CURRENCIES.map((c) => useIntraday(c.code, spark.day ? fromInput(spark.day) : fromInput(marketDate(Date.now())), !dia)) // eslint-disable-line react-hooks/rules-of-hooks
  const [ref, width] = useWidth()
  const central = useCentralDaily()
  const toggle = (code) => setSel((s) => (s.includes(code) ? (s.length > 1 ? s.filter((c) => c !== code) : s) : CURRENCIES.map((c) => c.code).filter((c) => c === code || s.includes(c))))
  const rows = CURRENCIES.map((c, k) => {
    const st = dia ? is[k] : hs[k]
    return { code: c.code, color: colors?.[c.code], st, points: st.status === 'ok' ? st.data.points : [], source: st.data?.source }
  }).filter((r) => sel.includes(r.code))
  const { available: ready, comparable, incomplete } = comparisonSeries(rows)
  const staleCodes = rows.filter((r) => r.st.stale).map((r) => r.code)
  const incompleteNote = incomplete.length > 0 && <Estado tipo="aviso">{incomplete.map((r) => `${r.code}: ${r.points.length === 1 ? `uma cotação no período (${brl(r.points[0].bid)}); aguardando outra para calcular variação` : r.st.status === 'empty' ? 'sem amostras na data selecionada' : r.st.error ? `histórico indisponível · ${mensagemErro(r.st.error)}` : 'aguardando cotações'}`).join(' · ')}</Estado>
  const staleNote = staleCodes.length > 0 && <Estado tipo="aviso">Não foi possível atualizar {staleCodes.join(', ')}. Mantida a última série disponível.</Estado>
  const failed = rows.every((r) => r.st.status === 'error')
  const one = rows.length === 1
  const r0 = rows[0]
  const chg = (r) => periodChange(r.points)
  const [big, setBig] = useState(false)
  const chart = (wv) => (
        ready.length > 0 && (one || comparable.length > 0) ? (
          one ? (
            <Plot points={r0.points} history={dia ? undefined : centralFull(central.data, r0.code, r0.source)} width={wv} color={r0.color} code={`rs-${r0.code}-${spark.id}`} intraday={dia} fmt={(v) => brl(v)} vfmt={(v) => v.toLocaleString('pt-BR', { minimumFractionDigits: v < 0.1 ? 5 : 4, maximumFractionDigits: v < 0.1 ? 5 : 4 })} labels label={`${r0.source ?? r0.code}/BRL`} />
          ) : (
            <MultiPlot series={comparable} history={comparable.map(s=>({...s,points:dia ? s.points : centralFull(central.data,s.code,s.source)}))} width={wv} intraday={dia} />
          )
        ) : (
          <div className="placeholder" style={{ height: 120 }}>
            {failed ? 'Histórico indisponível no momento.' : rows.some((r) => r.st.status === 'loading') ? 'Carregando…' : dia ? 'Sem amostras na data selecionada. Isso não confirma fechamento do mercado.' : 'Histórico indisponível no momento.'}
          </div>
        )
  )
  return (
    <>
    <div className="resumo-chart">
      <div className="sec-head">
        <h3 className={comparison ? '' : 'expandable'} tabIndex={comparison ? undefined : 0} onKeyDown={(e) => { if (!comparison && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setBig(true) } }} onClick={() => !comparison && setBig(true)} role={comparison ? undefined : 'button'} title={comparison ? undefined : 'Ampliar'}>
          {one ? <>{`${r0.source ?? r0.code}/BRL`} <small className="muted">· {spark.label}</small>{chg(r0) != null && <span className={`pct ${toneOf(chg(r0))}`}> {pct(chg(r0))}</span>}</> : <>Variação no período <small className="muted">· {spark.label}</small></>}
          {!comparison && <span className="muted" aria-hidden="true"> ›</span>}
        </h3>
        {comparison && <div className="chips" role="group" aria-label="Moedas do gráfico (escolha uma ou mais)">
          {CURRENCIES.map((c) => (
            <button key={c.code} type="button" aria-pressed={sel.includes(c.code)} style={sel.includes(c.code) ? { borderColor: colors?.[c.code] } : undefined} onClick={() => toggle(c.code)}>
              {sel.includes(c.code) && <i className="chip-dot" style={{ background: colors?.[c.code] }} aria-hidden="true" />}
              {c.code}
            </button>
          ))}
        </div>}
      </div>
      {!one && (
        <p className="chart-legend">
          {rows.map((r) => (
            <span key={r.code}><i className="chip-dot" style={{ background: r.color }} aria-hidden="true" />{r.code} {chg(r) != null && <b className={`pct ${toneOf(chg(r))}`}>{pct(chg(r))}</b>}</span>
          ))}
        </p>
      )}
      <p className="chart-basis">{one && r0.points.length ? `Desde a 1ª amostra: ${dataTimestamp(r0.points[0].t)} até ${dataTimestamp(r0.points.at(-1).t)}. ` : 'Comparação normalizada desde a primeira amostra disponível de cada série. '}A variação deste gráfico não é o Δ dia da fonte contra a referência anterior. Horários em Brasília; amostras podem ter lacunas.</p>
      {staleNote}
      {incompleteNote}
      {dia && rows.some(r => r.st.previousDay) && <button type="button" className="btn" onClick={() => onPrevious(rows.map(r => r.st.previousDay).filter(Boolean).sort().at(-1))}>Ver último dia anterior com amostras disponíveis</button>}
      <div ref={ref}>
        {chart(width)}
      </div>
      <footer className="terminal-chart-source muted">{rows.filter(r => r.st.data).map(r => r.code + ': ' + (r.st.data.generatedAt ? 'atualizado em ' + dataTimestamp(r.st.data.generatedAt) : 'data da atualização não disponível')).join(' | ')}</footer>
    </div>
    {big && (
      <Overlay onClose={() => setBig(false)}>
        <div className="resumo-chart big">
      <div className="sec-head">
        <h3>
          {one ? <>{`${r0.source ?? r0.code}/BRL`} <small className="muted">· {spark.label}</small>{chg(r0) != null && <span className={`pct ${toneOf(chg(r0))}`}> {pct(chg(r0))}</span>}</> : <>Variação no período <small className="muted">· {spark.label}</small></>}
        </h3>
        {comparison && <div className="chips" role="group" aria-label="Moedas do gráfico (escolha uma ou mais)">
          {CURRENCIES.map((c) => (
            <button key={c.code} type="button" aria-pressed={sel.includes(c.code)} style={sel.includes(c.code) ? { borderColor: colors?.[c.code] } : undefined} onClick={() => toggle(c.code)}>
              {sel.includes(c.code) && <i className="chip-dot" style={{ background: colors?.[c.code] }} aria-hidden="true" />}
              {c.code}
            </button>
          ))}
        </div>}
      </div>
      {!one && (
        <p className="chart-legend">
          {rows.map((r) => (
            <span key={r.code}><i className="chip-dot" style={{ background: r.color }} aria-hidden="true" />{r.code} {chg(r) != null && <b className={`pct ${toneOf(chg(r))}`}>{pct(chg(r))}</b>}</span>
          ))}
        </p>
      )}
          {staleNote}
      {incompleteNote}
          <p className="chart-basis">Variação desde a primeira amostra disponível na janela selecionada; não é o Δ dia da fonte. Horários em Brasília.</p>
          <Wide render={chart} />
        </div>
      </Overlay>
    )}
    </>
  )
}

// Quadros das moedas com minigráfico e seletor de período (o seletor vale só para o câmbio).
function MoedasPanel({ quotes, ptax, onOpen, colors, quoteRefresh, searchTarget }) {
  const [newsTab, setNewsTab] = useState('moedas') // o quadro de Notícias abre sempre em Moedas
  useEffect(()=>{const desired=searchTarget?.context?.newsTab;if(NEWS_TABS.some(t=>t.id===desired))setNewsTab(desired)},[searchTarget])
  const daily = useCentralDaily()
  const returns = Object.fromEntries(CURRENCIES.map(c => [c.code, quotes?.[c.code]?.source && quotes[c.code].source !== c.code ? { month: null, year: null } : accumulatedReturns(daily.data, c.code)]))
  const ptaxes = Object.fromEntries(CURRENCIES.map(c => [c.code, compatiblePtax(c.code, quotes?.[c.code], ptax?.[c.code])]))
  // Yuan: sem PTAX oficial; referência cruzada com o intraday do dia do boletim do dólar.
  const ptaxDay = fromInput(ptaxes.USD?.date ?? marketDate(Date.now()))
  const usdTicks = useIntraday('USD', ptaxDay, !ptaxes.USD), cnhTicks = useIntraday('CNH', ptaxDay, !ptaxes.USD)
  if (ptaxes.USD && quotes?.CNH && !quotes.CNH.fallback && usdTicks.status === 'ok' && cnhTicks.status === 'ok') ptaxes.CNH = cnhPtaxCross(ptaxes.USD, usdTicks.data.points, cnhTicks.data.points)
  const [selection, setSelection] = useState(['USD'])
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareSelection, setCompareSelection] = useState(['USD', 'EUR'])
  const [compareSpark, setCompareSpark] = useState(SPARK[0])
  const compareTrigger = useRef(null)
  const closeCompare = () => { setCompareOpen(false); requestAnimationFrame(() => compareTrigger.current?.focus()) }

  const spark = SPARK.find((s) => s.id === 'day')
  const limits = fullWindow(fromInput(marketDate(Date.now())))
  const openSelected = code => { if (CURRENCIES.some(c => c.code === code)) setSelection([code]); onOpen(code, spark) }
  return (
      <Expandable label="Mercado hoje">
      <section className="market-terminal" aria-labelledby="r-moedas">
        <div className="sec-head terminal-titlebar">
          <h2 id="r-moedas">Mercado hoje <Explain id="mercadoHoje" /> <button type="button" className="img-share" aria-label="Enviar imagem das últimas cotações de câmbio" title="Compartilha as últimas cotações de câmbio, sem gráficos ou petróleo" onClick={() => shareQuotesImage(quotes)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg></button></h2>
          {quoteRefresh && <RefreshButton custom={quoteRefresh} label="cotações do câmbio" />}
          <button type="button" ref={compareTrigger} className="compare-trigger" aria-label="Comparar moedas" aria-haspopup="dialog" aria-expanded={compareOpen} title="Montar comparação de moedas" onClick={() => setCompareOpen(true)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 3v18h18M5 16l5-7 4 4 6-9M5 10l5 4 5-7 5 9" /></svg><span>Comparar</span></button>
        </div>
        <div className="terminal-main">
        <div className="terminal-quotes">
        <p className="market-scroll-hint">Deslize para ver mês, ano e PTAX →</p>
        <div className="market-table-wrap" role="region" aria-label="Tabela de câmbio; role horizontalmente para ver todas as colunas" tabIndex={0}>
          <table className="market-table" aria-busy={!quotes}>
            <caption className="market-caption">Câmbio em reais · últimas referências disponíveis</caption>
            <thead><tr><th scope="col">Par</th><th scope="col">Cotação <small>(R$)</small></th><th scope="col" aria-label="Variação absoluta do dia em reais">Δ dia <small>(R$)</small></th><th scope="col" aria-label="Variação percentual do dia">Δ dia %</th><th scope="col" aria-label="Acumulado no mês em percentual">Mês %</th><th scope="col" aria-label="Acumulado no ano em percentual">Ano %</th><th scope="col" aria-label="PTAX de venda em reais por unidade">PTAX <small>venda</small></th></tr></thead>
            {CURRENCIES.map(c => <QuoteRow key={c.code} code={c.code} quote={quotes?.[c.code]} returns={returns[c.code]} selected={selection.includes(c.code)} ptax={ptaxes[c.code]} onOpen={openSelected} color={colors?.[c.code]} />)}
          </table>
        </div>
        </div>
        <div className="terminal-chart terminal-news">
        <Panel title="Notícias" tabs={NEWS_TABS} tab={newsTab} onTab={setNewsTab} semAtualizar>{newsTab === 'moedas' ? <MoedasNoticias /> : ['imposto', 'split-payment', 'reforma', 'escala-6x1'].includes(newsTab) ? <CuradoriaNoticias id={newsTab} /> : newsTab === 'eleicoes' ? <TemaNoticias id="eleicoes-eua" simples /> : newsTab === 'trends' ? <GoogleTrends /> : newsTab === 'veiculos-pesados' ? <><HeavyVehicles compact/><SectorNews id="veiculos-pesados" label="Veículos pesados" /></> : <MarketNews bare />}</Panel>
        </div>
        </div>


        <Aviso title="Câmbio · datas e metodologia">
          <p id="market-help">Toque na linha para selecionar e abrir o gráfico. Filtros alteram apenas os gráficos. Cotação e Δ dia: última referência da fonte; mês/ano: observações diárias de dias encerrados, não a cotação intradiária.</p>
          <p>O traço indica dado indisponível. A cotação do CNH usa a compra de USD/BRL dividida pela venda de USD/CNH. As duas variações usam a mesma cotação anterior estimada, mantendo a diferença proporcional atual entre compra e venda do USD/CNH. Sem dados para estimar a base anterior, as duas variações ficam indisponíveis.</p>
          <p>Não há PTAX oficial do yuan. A coluna mostra uma referência cruzada (PTAX do dólar ÷ USD/CNH no horário do boletim), só com cotações das duas pontas a até 15 min dele. CNY e CNH são referências distintas.</p>
          <ul>{CURRENCIES.map(c => { const q = quotes?.[c.code], p = ptaxes[c.code], r = returns[c.code]; return <li key={c.code}>
            <b>{q?.source || c.code}/BRL:</b> <span className={quoteAgeState(q) ? 'status stale' : ''}>{!q ? quotes ? 'Cotação indisponível' : 'Carregando cotação' : (q.stale ? 'Atualização pendente · ' : q.fallback ? 'Referência diária de reserva · ' : quoteAgeState(q) ? quoteAgeState(q) + ' · ' : '') + dataTimestamp(q.timestamp)}</span>
            {' · '}{q ? q.cross ? 'CNH offshore por cruzamento' : q.fallback ? 'referência diária' : '' : 'Aguardando cotação válida'}
            {p && <> · PTAX venda, boletim {p.kind}, {p.date.split('-').reverse().join('/')}, R$ por 1 {c.code}</>}
            {['month', 'year'].map(k => <span key={k}> · {k === 'month' ? 'Mês' : 'Ano'}: {r[k] ? `base ${r[k].baseDate.split('-').reverse().join('/')} → ${r[k].endDate.split('-').reverse().join('/')}` : 'sem base/cobertura compatível'}</span>)}
          </li> })}</ul>
          <p>Acumulados: (última observação diária ÷ última observação diária anterior ao início do mês/ano − 1) × 100, mesma série diária. Dias civis em America/Sao_Paulo. Barras do dia atual excluídas; lacunas superiores a 7 dias junto à base ou ao fim impedem o cálculo. {daily.status === 'error' ? 'Falha ao consultar o histórico dos acumulados.' : daily.status === 'loading' ? 'Carregando histórico dos acumulados.' : 'Arquivo histórico: ' + dataTimestamp(daily.data?.generatedAt)}</p>
          <p>PTAX é referência oficial independente, não spot. Gráficos: {spark.label}; histórico desde {toInput(limits.start).split('-').reverse().join('/')}, sujeito a lacunas.</p>
          <p>Cotação do dia: última referência recebida, não um feed em tempo real. “Dado antigo” sinaliza horário há mais de 10 min; esse limite não é garantia de latência. O horário original permanece indicado acima. Ausência de novo preço não é tratada como mercado fechado.</p>
          </Aviso>
      </section>
      {compareOpen && <Expandable modal label="Comparar moedas" onClose={closeCompare}>
        <section className="currency-comparison" aria-labelledby="comparison-title"><h2 id="comparison-title">Comparar moedas</h2>
          <h3>Taxa entre duas moedas</h3><ParityTile quotes={quotes} spark={spark} onOpen={code => { closeCompare(); openSelected(code) }} color={colors?.PAR} />
          <h3>Evolução comparada em percentual</h3>
          <ChartFilters><div className="seg" role="group" aria-label="Período do comparador">{SPARK.map(p => <button type="button" key={p.id} aria-pressed={compareSpark.id === p.id} onClick={() => setCompareSpark(p)}>{p.label}</button>)}</div>
            <DateRangePicker label="Período personalizado" start={compareSpark.range ? toInput(compareSpark.range.start) : compareSpark.day ?? toInput(new Date(Date.now() - (compareSpark.days ?? 1) * 864e5))} end={compareSpark.range ? toInput(compareSpark.range.end) : compareSpark.day ?? toInput(limits.end)} min={toInput(limits.start)} max={toInput(limits.end)} onChange={(a, b) => setCompareSpark(a === b ? { id: 'custom-day', label: `Dia ${a.split('-').reverse().join('/')}`, intraday: true, day: a } : { id: 'custom', label: `${a.split('-').reverse().join('/')} → ${b.split('-').reverse().join('/')}`, range: { start: fromInput(a), end: fromInput(b) } })} />
          </ChartFilters>
          <ResumoChart comparison colors={colors} spark={compareSpark} selection={compareSelection} onSelection={setCompareSelection} onPrevious={day => setCompareSpark({ id:'previous', label:`Amostras de ${day.split('-').reverse().join('/')}`, intraday:true, day })} />
        </section>
      </Expandable>}
      </Expandable>
  )
}

// Faixa de juros no topo do app (todas as abas): rótulo com "?" e os indicadores parados, todos visíveis na tela (quebram de linha se faltar espaço).
export function RatesTop({ macro, curves, onOpen }) {
  const rates = rateTiles(macro.data, curves.data)
  return (
    <div className="rates-top">
      <span className="rates-label">Juros <Explain id="faixaJuros" /></span>
      {rates.length ? (
        <div className="rates-grid" role="region" aria-label={`Juros: ${rates.map((r) => `${r.label} ${p2(r.value)}%`).join('; ')}`}>
          {rates.map((r) => (
            <button type="button" key={r.key} className="qb" onClick={onOpen} title={`${r.sub}${r.delta != null && r.prevAt ? ` · variação sobre a publicação anterior (${new Date(r.prevAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })})` : ''}`}>
              <b className="tk">{r.label}</b> {p2(r.value)}%
              {r.delta != null && (
                <span className="qb-delta">
                  {' '}{Math.round(r.delta * 100) === 0 ? <span title="sem variação">=</span> : <><Arrow v={r.delta} /> {bps(r.delta)}</>}
                </span>
              )}
              <small className="muted"> {r.short ?? r.sub}</small>
              {Date.now() - r.at > 4 * 864e5 && <small className="qb-old"> · {new Date(r.at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })}</small>}
            </button>
          ))}
        </div>
      ) : (
        <p className="status">Juros indisponíveis no momento.</p>
      )}
    </div>
  )
}

const NEWS_TABS = [
  { id: 'moedas', label: 'Moedas', refresh: ['temas.json'] },
  { id: 'manchetes', label: 'Manchetes', refresh: ['news.json'] },
  { id: 'imposto', label: 'Imposto', refresh: ['curadoria-noticias.json'] },
  { id: 'split-payment', label: 'Split payment', refresh: ['curadoria-noticias.json'] },
  { id: 'reforma', label: 'Reforma tributária', refresh: ['curadoria-noticias.json'] },
  { id: 'escala-6x1', label: 'Escala 6x1', refresh: ['curadoria-noticias.json'] },
  { id: 'eleicoes', label: 'Eleições EUA', refresh: ['temas.json'] },
  { id: 'trends', label: 'Google Trends', refresh: ['trends.json'] },
  { id: 'veiculos-pesados', label: 'Veículos pesados', refresh: ['sector-news.json','heavy-vehicles.json'] },
]
// Bandeira das moedas de que a manchete provavelmente fala (as da busca e as citadas no título).
function MoedasCitadas({ item }) {
  const codes = moedasDaManchete(item)
  if (!codes.length) return null
  return <span className="news-flags" role="img" aria-label={`Moedas citadas: ${codes.map(nomeDaMoeda).join(', ')}`} title={`Moedas citadas: ${codes.map(nomeDaMoeda).join(', ')}`}>{codes.map(c => <Flag key={c} code={c} width={18} height={12} />)}</span>
}
// Manchetes: a semana de hoje para trás, com a quebra por dia na própria lista e a bandeira das moedas citadas.
function MarketNews({ bare = false }) {
  const news = useNews()
  const now = useNewsClock()
  const headlines = buildFeed(news.data?.news, 'ALL', 200, now)
  const stale = news.error || news.stale || newsCollectionStale(news.data, now)
  return <aside className="market-news" aria-labelledby="market-news-title"><h2 id="market-news-title" className={bare ? 'sr-only' : undefined}>Notícia</h2>
    {news.error && <p role="status">Não foi possível atualizar as notícias. {headlines.length ? 'Só são mantidas publicações ainda dentro das últimas 120 horas.' : ''}</p>}
    {news.data && Object.keys(news.data.stale || {}).length > 0 && <p role="status">Há fontes sem novas manchetes válidas; só permanecem as publicadas nas últimas 120 horas.</p>}
    {!news.data && news.status === 'loading' ? <p>Carregando notícias.</p> : <NoticiasPorDia data={{ items: headlines, generatedAt: news.data?.generatedAt, stale, windowDays: NEWS_WINDOW_DAYS }} simples ariaLabel="Manchetes dos últimos cinco dias" prefixo={(n) => <MoedasCitadas item={n} />} />}
  </aside>
}
// Mercado: cards de câmbio e juros, tabela de pares com manchetes e referência do Brent. Juros, curvas e agenda ficam nas próprias abas.
export default function Resumo({ quotes, ptax, onOpen, colors, macro, curves, goto, status, quoteRefresh, searchTarget }) {
  const rates = rateTiles(macro?.data, curves?.data)
  const [rateOpen, setRateOpen] = useState(null)
  useDataFile('oil.json')
  const ipcaFile = useDataFile('ipca.json')
  const indices = useDataFile('indices.json')
  const ipcaSeries = useMemo(() => { try { return ipcaFile.data ? normalizeIpca(ipcaFile.data) : null } catch { return null } }, [ipcaFile.data])
  return (
    <div className="terminal-desk">
      <KpiRow quotes={quotes} rates={rates} ipca={ipcaSeries} ibov={indices.data} macro={macro?.data} colors={colors} onOpen={onOpen} onRate={setRateOpen} goto={goto} status={status} />
      {rateOpen && <Suspense fallback={null}><RateModal kind={rateOpen} macro={macro} curves={curves} onClose={() => setRateOpen(null)} /></Suspense>}
      <div className="resumo desk-markets"><MoedasPanel searchTarget={searchTarget} quotes={quotes} ptax={ptax} onOpen={onOpen} colors={colors} quoteRefresh={quoteRefresh} /></div>
    </div>
  )
}

