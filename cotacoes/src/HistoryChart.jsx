import ChartFullscreen from './ChartFullscreen.jsx'
import { dataTimestamp } from './dataTimestamp.js'
import { periodChange } from './stats.js'
import { chartLinePath } from './chartLinePath.js'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFilterSlot } from './ChartFilters.jsx'
import { nextChartIndex } from './chartNavigation.js'
import { marcasRedondas, rotuloData } from './chartEixo.js'
import { ancoraRotulo, marcasValor, yRotulo } from './chartMarcas.js'
import { focoPorTeclado, limitarBalao, margemEixo, rotuloEixo, saidaDeToque, useLarguraBalao, useTocarFora } from './chartToque.js'
import './ChartAccess.css'
import { useMacro } from './useMacro.js'
import Explain from './Explain.jsx'
import { centralFull, toInput, useCentralDaily, useHistory, useIntraday } from './useHistory.js'
import { seriesName } from './useQuotes.js'
import { readStorage } from './storage.js'
import { priorYear, rangeBetween } from './rangeCompare.js'
import { resample, scaleOptions } from './resample.js'
import { flagSvg } from './flags.js'
import { useDataFile } from './useDataFile.js'
import { eventosDiarios, eventosDoDia, itensDoDia } from './fxNoticias.js'
import { marcosEntre, marcosQueCabem } from './eventosMercado.js'
import { destaquesPorHora, noticiasPerto, useFxAgora } from './fxAgora.js'
import { marketDate } from './marketReturns.js'
import { extremos as acharExtremos, noPregao } from './pregao.js'
import { PREGAO_FIXADO_ARQUIVO, diaCurto, fixadoAtivo, juntarPontos, pontosFixados } from './pregaoFixado.js'
import { lerValor, linhasValor, moeda, reais, simular as simularTrecho } from './simulacaoCambio.js'

const H = 240
const FAIXA = 22 // faixa abaixo das datas para os rótulos dos eventos de mercado
const M = { t: 12, r: 16, b: 28, l: 58 }

export const fmtDate = (t, long) =>
  new Date(t).toLocaleDateString('pt-BR', long ? { day: '2-digit', month: 'short', year: 'numeric' } : { day: '2-digit', month: '2-digit' })
export const fmtTime = (t, sec) => new Date(t).toLocaleTimeString('pt-BR', { timeZone:'America/Sao_Paulo', hour:'2-digit', minute:'2-digit', ...(sec ? {second:'2-digit'} : {}) })
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

// Escala dos pontos: Auto mantém o dado original; 5 min, 15 min, 30 min, Hora, Dia, Mês e Ano agrupam (só para escalas mais grossas que o dado).
export function Plot({ points, scales = true, ...props }) {
  const [scale, setScale] = useState('auto')
  const options = useMemo(() => (scales ? scaleOptions(points) : []), [points, scales])
  const slot = useFilterSlot()
  const active = options.find((o) => o.id === scale && o.enabled)
  const view = useMemo(() => (active ? resample(points, active.id) : points), [points, active])
  // só as escalas possíveis para este dado; se nenhuma for possível além de "Auto", o controle some
  const usable = options.filter((o) => o.enabled)
  const picker = usable.length > 0 && (
        <div className="seg scale-seg" role="group" aria-label="Agrupar os pontos do gráfico">
          <span className="seg-label" aria-hidden="true">Agrupar:</span>
          <button type="button" aria-pressed={!active} aria-label="Auto: escala original dos dados" title="Escala original dos dados" onClick={() => setScale('auto')}>Auto</button>
          {usable.map((o) => <button type="button" key={o.id} aria-pressed={active?.id === o.id} aria-label={`Escala por ${o.label.toLowerCase()}`} title={o.title} onClick={() => setScale(o.id)}>{o.label}</button>)}
        </div>
  )
  return (
    <>
      {picker && (slot ? createPortal(picker, slot) : picker)}
      <PlotView {...props} points={view} history={props.history ?? points} eventos={active ? undefined : props.eventos} intraday={active ? !!active.intradiario : props.intraday} dateLabel={active?.name ?? props.dateLabel} compare={props.compare ?? !props.intraday} />
    </>
  )
}

// `history`: série completa para achar o mesmo trecho um ano antes (padrão: os próprios pontos). `step`: série em degraus.
function PlotView({ points: base, width, color, code, intraday, fmt, vfmt, label, nice, rate = nice, labels, light, dateLabel, history, step = false, steppedLine = false, compare = !intraday, compareReason = 'esta visão intradiária não contém histórico comparável.', eventos, extremos = false, marcos, simular }) {
  const [hover, setHover] = useState(null)
  const [aberto, setAberto] = useState(null)
  const [sel, setSel] = useState(null)
  const [valorTxt, setValorTxt] = useState('')
  const [lado, setLado] = useState('pagar')
  const [dragging, setDragging] = useState(false)
  const drag = useRef(null)
  const plotRef = useTocarFora(hover != null, setHover)
  // Balão da notícia: fecha ao tocar fora dele (tocar noutra bolinha troca a notícia)
  const balaoRef = useRef(null)
  useEffect(() => {
    if (!aberto) return undefined
    const fora = (e) => { if (!balaoRef.current?.contains(e.target) && !e.target.closest?.('.fx-dot')) setAberto(null) }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [aberto])
  // Tamanho do desenho na tela: na tela cheia o SVG é ampliado pelo viewBox, e as bolinhas, o balão
  // e a dica (HTML por cima do gráfico) precisam da mesma escala para cair no ponto certo da linha.
  const svgRef = useRef(null)
  const [caixa, setCaixa] = useState(null)
  useEffect(() => {
    const el = svgRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => setCaixa({ w: el.clientWidth, h: el.clientHeight, top: el.offsetTop }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const sig = `${base.length}:${base[0]?.t}:${base[base.length - 1]?.t}`
  useEffect(() => { setSel(null); setAberto(null) }, [sig])
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
    return { t0, t1, l, x, y, dec, casas, yTicks, xTicks, line, area, base }
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
  // rótulos de valor: último, primeiro, máximo, mínimo e os picos e vales mais marcados, sem encavalar
  const marks = useMemo(() => marcasValor(points.map((p) => p.bid), points.map((p) => g.x(p.t))), [points, g])
  // máxima e mínima com nome e horário (ou data); os rótulos comuns perto delas saem, para não repetir nem encavalar
  const ext = useMemo(() => {
    if (!extremos || points.length < 2) return []
    // na visão do dia, só o pregão (9h às 18h) conta: a amostra da madrugada costuma ser o fechamento da véspera
    // escala agrupada (5, 15, 30 min ou hora): a máxima e a mínima vêm das amostras originais, com o valor e o horário reais,
    // e a marca fica no ponto do bloco que as contém (o mesmo valor do quadro de notícias perto da máxima)
    if (intraday && history && history !== points && history.length > 1) {
      const e = acharExtremos(history, true)
      if (!e) return []
      const bloco = (t) => { const i = points.findIndex((p) => p.t >= t); return i < 0 ? points.length - 1 : i }
      return [{ i: bloco(history[e.hi].t), tipo: 'max', real: history[e.hi] }, { i: bloco(history[e.lo].t), tipo: 'min', real: history[e.lo] }]
    }
    const e = acharExtremos(points, intraday)
    return e ? [{ i: e.hi, tipo: 'max' }, { i: e.lo, tipo: 'min' }] : []
  }, [extremos, points, intraday, history])
  const rotulos = ext.length ? marks.filter(({ i }) => !ext.some((e) => Math.abs(g.x(points[i].t) - g.x(points[e.i].t)) < 96)) : marks
  const setas = useMemo(() => (marcos?.length ? marcosQueCabem(marcos, g.x, { de: g.t0, ate: g.t1 }) : []), [marcos, g])
  const altura = H + (setas.length ? FAIXA : 0)
  const valorEm = (t) => points.reduce((b, p) => (Math.abs(p.t - t) < Math.abs(b.t - t) ? p : b), points[0]).bid
  const hp = hover != null ? points[hover] : null
  const kx = caixa?.w && caixa?.h ? Math.min(caixa.w / width, caixa.h / altura) : 1
  const ox = caixa?.w ? (caixa.w - width * kx) / 2 : 0
  const oy = caixa?.h ? (caixa.h - altura * kx) / 2 + (caixa.top || 0) : 0
  const naTela = (x, y) => ({ left: ox + x * kx, top: oy + y * kx })
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
    <ChartFullscreen><div ref={plotRef} className={`plot${light ? ' light' : ''}`} onPointerLeave={(e) => { if (!saidaDeToque(e)) setHover(null) }}>
      <span id={`${plotId}-hint`} className="chart-access-text">Use as setas para percorrer os pontos; Home e End vão ao primeiro e ao último. Shift com as setas seleciona um trecho; Escape limpa. Com o mouse ou o dedo, arraste sobre o gráfico para selecionar um trecho.</span>
      <span className="chart-access-text" role="status" aria-live="polite">{announcement}</span>
      <svg
        ref={svgRef}
        tabIndex={0}
        aria-describedby={`${plotId}-hint`}
        onFocus={(e) => { if (focoPorTeclado(e)) setHover(0) }}
        onBlur={() => setHover(null)}
        onKeyDown={onKey}
        viewBox={`0 0 ${width} ${altura}`}
        width="100%"
        height={altura}
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
          <marker id={`${gid}-seta`} viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0L8,4L0,8Z" className="marco-ponta" />
          </marker>
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
            {dateLabel ? dateLabel(t) : rotuloData(t, { de: g.t0, ate: g.t1, intradiario: intraday })}
          </text>
        ))}
        <path d={g.area} fill={`url(#${gid})`} />
        <path className="line" style={{ color }} d={g.line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={g.x(last.t)} cy={g.y(last.bid)} r="4" fill={color} className="ring" />
        {labels && (vfmt ?? fmt) && rotulos.map(({ i, vale }) => {
          const p = points[i]
          const y = g.y(p.bid)
          return (
            <g key={p.t} pointerEvents="none">
              <circle cx={g.x(p.t)} cy={y} r="2.5" fill={color} />
              <text x={g.x(p.t)} y={yRotulo(y, vale, M.t, g.base)} textAnchor={ancoraRotulo(i, points.length)} className="vlabel">{(vfmt ?? fmt)(p.bid)}</text>
            </g>
          )
        })}
        {ext.map(({ i, tipo, real }) => {
          const p = points[i]
          const r = real ?? p
          const x = g.x(p.t)
          const y = g.y(p.bid)
          const ancora = x < g.l + 80 ? 'start' : x > width - M.r - 80 ? 'end' : 'middle'
          return (
            <g key={tipo} pointerEvents="none" className={`extremo ${tipo}`}>
              <circle cx={x} cy={y} r="4" />
              <text x={x} y={yRotulo(y, tipo === 'min', M.t, g.base)} textAnchor={ancora} className="vlabel extremo-rot">
                {tipo === 'max' ? 'Máx.' : 'Mín.'} {(vfmt ?? fmt ?? brl)(r.bid)} · {intraday ? fmtTime(r.t) : fmtDate(r.t)}
              </text>
            </g>
          )
        })}
        {setas.map((m) => {
          const y = g.y(valorEm(m.t))
          const x = m.px
          const ancora = x < g.l + 30 ? 'start' : x > width - M.r - 30 ? 'end' : 'middle'
          const rotulo = <text x={x} y={H + 14} textAnchor={ancora} className="marco-rot">{m.rotulo}</text>
          return (
            <g key={`${m.t}-${m.rotulo}`} className={`marco${m.agenda ? ' agenda' : ''}`}>
              <title>{`${m.rotulo}, ${intraday ? fmtTime(m.t) : fmtDate(m.t, true)}: ${m.fonte}`}</title>
              {m.ate != null && <line x1={x} x2={g.x(Math.min(m.ate, g.t1))} y1={H + 2} y2={H + 2} className="marco-faixa" />}
              {Math.min(g.base - 2, y + 30) - (y + 7) >= 8 && <line x1={x} x2={x} y1={Math.min(g.base - 2, y + 30)} y2={y + 7} className="marco-seta" markerEnd={`url(#${gid}-seta)`} />}
              <line x1={x} x2={x} y1={g.base} y2={g.base + 5} className="marco-pe" />
              {m.link ? <a href={m.link} target="_blank" rel="noopener noreferrer" aria-label={`${m.rotulo}: ${m.fonte}`}>{rotulo}</a> : rotulo}
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
      {eventos?.length > 0 && !range && (
        <div className="fx-dots" onKeyDown={(e) => { if (e.key === 'Escape' && aberto) { e.preventDefault(); e.stopPropagation(); setAberto(null) } }}>
          {eventos.filter((ev) => ev.t >= g.t0 && ev.t <= g.t1).map((ev) => (
            <button
              type="button"
              key={`${ev.t}-${ev.itens[0]?.link}`}
              className={`fx-dot ${ev.tom}${aberto?.t === ev.t ? ' on' : ''}`}
              style={naTela(g.x(ev.t), g.y(ev.bid))}
              aria-expanded={aberto?.t === ev.t}
              aria-label={`${intraday ? fmtTime(ev.t) : fmtDate(ev.t, true)}: ${ev.pct != null ? `${code} ${ev.pct > 0 ? 'subiu' : 'caiu'} ${Math.abs(ev.pct).toFixed(2).replace('.', ',')}%, ` : ''}${ev.itens.length} ${ev.itens.length === 1 ? 'manchete' : 'manchetes'}`}
              onClick={() => setAberto(aberto?.t === ev.t ? null : ev)}
            />
          ))}
        </div>
      )}
      {aberto && !range && (() => {
        // Balão de pensamento amarelo no meio do gráfico, acima da bolinha tocada (ou abaixo, se ela está na metade de cima),
        // sem cobri-la; duas bolinhas pequenas ligam o balão à notícia, como num pensamento.
        const px = g.x(aberto.t), py = g.y(aberto.bid)
        const acima = py > (M.t + g.base) / 2
        const cx = width / 2
        const borda = acima ? py - 30 : py + 30
        const rabo = [[10, 6], [21, 4]].map(([d, r]) => ({ x: px + (cx - px) * (d / 60), y: acima ? py - d : py + d, r }))
        return (
          <div className="fx-balao-camada">
            {rabo.map((b, i) => <span key={i} className="fx-balao-rabo" aria-hidden="true" style={{ ...naTela(b.x, b.y), width: b.r * 2, height: b.r * 2 }} />)}
            <div ref={balaoRef} className={`fx-balao ${acima ? 'sobe' : 'desce'}`} style={naTela(cx, borda)} role="region" aria-label="Notícia da bolinha" tabIndex={-1}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAberto(null) } }}>
              <p className="fx-news-head">
                <b>{intraday ? fmtTime(aberto.t) : fmtDate(aberto.t, true)}</b>
                {aberto.pct != null && <em className={aberto.tom}>{aberto.pct > 0 ? '▲' : '▼'} {signed(aberto.pct, 2)}% no dia</em>}
                <button type="button" className="fx-balao-fechar" aria-label="Fechar notícia" onClick={() => setAberto(null)}>×</button>
              </p>
              <ul>
                {aberto.itens.map((n) => (
                  <li key={n.link}>
                    {intraday || n.semHora ? null : <><time dateTime={new Date(n.t).toISOString()}>{fmtTime(n.t)}</time>{' '}</>}
                    <a href={n.link} target="_blank" rel="noopener noreferrer">{n.title}</a> <small>{n.source}{n.geral ? ' · mercado do dia' : ''}</small>
                  </li>
                ))}
              </ul>
              <p className="fx-news-note">{intraday ? 'Horário de publicação informado pela fonte, em Brasília.' : 'Manchetes publicadas nesse dia (horário de Brasília, quando a fonte informa).'} Mostra o que saiu na imprensa, não comprova a causa do movimento.</p>
            </div>
          </div>
        )
      })()}
      {simular && (() => {
        const valor = lerValor(valorTxt)
        const sim = range && valor ? simularTrecho({ valor, v0: range.v0, v1: range.v1, lado }) : null
        const cot = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
        return (
          <div className="fx-sim">
            <div className="fx-sim-campos">
              <label className="fx-sim-valor">
                <span>Valor em {simular}</span>
                <input type="text" inputMode="decimal" autoComplete="off" placeholder="Ex.: 500.000" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} aria-invalid={valorTxt.trim() !== '' && !valor} />
              </label>
              <div className="seg fx-sim-lado" role="radiogroup" aria-label="Lado da operação">
                {[['pagar', 'Vou pagar'], ['receber', 'Vou receber']].map(([id, rot]) => (
                  <button type="button" key={id} role="radio" aria-checked={lado === id} aria-pressed={lado === id} onClick={() => setLado(id)}>{rot}</button>
                ))}
              </div>
            </div>
            {valorTxt.trim() !== '' && !valor && <p className="fx-sim-aviso">Valor não reconhecido. Use, por exemplo, 500.000 ou 500 mil.</p>}
            {sim ? (() => {
              const [l1, l2] = linhasValor(sim, { valor, code: simular, v0: range.v0, v1: range.v1 })
              return (
                <div className="fx-sim-res" role="status">
                  <p title={`${moeda(valor, simular)} a ${cot(range.v0)} = ${reais(sim.r0)}`}><span aria-hidden="true">🔸</span>{l1}</p>
                  <p title={`${reais(sim.r0)} → ${reais(sim.r1)}: diferença de ${reais(Math.abs(sim.dif))}`} className={sim.efeito === 'igual' ? '' : sim.favoravel ? 'bom' : 'ruim'}><span aria-hidden="true">🔸</span>{l2}</p>
                  {intraday && !noPregao(range.t0) && <p className="fx-sim-fora">O trecho começa às {fmtTime(range.t0)}, fora do pregão: esse ponto costuma ser o fechamento anterior repetido pela fonte, não negócio do dia. Para medir só o pregão, comece depois das 9h.</p>}
                </div>
              )
            })() : (
              valor && <p className="fx-sim-dica">Clique e arraste no gráfico para escolher o trecho e ver o efeito em reais.</p>
            )}
            <p className="fx-sim-nota">Conta de referência pela cotação do gráfico ({intraday ? 'compra' : 'fechamento'}), sem spread, IOF nem tarifas. O valor digitado não é salvo.</p>
          </div>
        )
      })()}
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
        <div ref={tipRef} className={`tip${range ? ' tip-low' : ''}`} style={{ left: limitarBalao(g.x(hp.t) * kx, tipW, width * kx) + ox }}>
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
    </div></ChartFullscreen>
  )
}

function useSeries(currency, start, end, day, fixado) {
  // hooks sempre chamados; só um deles usado por modo
  const daily = useHistory(currency.code, start, end, !!day)
  const intra = useIntraday(currency.code, day ?? start, !day)
  const dia = day ? toInput(day) : null
  // pregão fixado: as amostras guardadas daquele dia completam (ou substituem, depois que saem do intraday) as do arquivo ao vivo
  const comFixado = useMemo(() => {
    const pin = dia ? pontosFixados(fixado, currency.code, dia) : []
    if (!pin.length || intra.status === 'loading') return null
    if (intra.status === 'ok') return { ...intra, fixado: true, data: { ...intra.data, points: juntarPontos(intra.data.points, pin) } }
    return { key: intra.key, status: 'ok', fixado: true, data: { source: currency.code, points: pin, generatedAt: fixado.generatedAt, feed: fixado.fonte, resolution: fixado.resolution } }
  }, [intra, fixado, currency.code, dia])
  return day ? comFixado ?? intra : daily
}

// valor dos rótulos dentro do gráfico: 4 casas (5 para o iene, que vale centavos de real)
const quoteFmt = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: v < 0.1 ? 5 : 4, maximumFractionDigits: v < 0.1 ? 5 : 4 })

export default function HistoryChart({ currency, color, start, end, day, onDay }) {
  const intraday = !!day
  const fixadoArq = useDataFile(PREGAO_FIXADO_ARQUIVO)
  const fixado = fixadoArq.status === 'ok' ? fixadoAtivo(fixadoArq.data) : null
  const h = useSeries(currency, start, end, day, fixado)
  const central = useCentralDaily()
  const full = useMemo(() => (intraday ? undefined : centralFull(central.data, currency.code, h.data?.source)), [central.data, currency.code, h.data?.source, intraday])
  const [ref, width] = useWidth()
  const pts = h.status === 'ok' ? h.data.points : null
  const [tableOpen, setTableOpen] = useState(() => readStorage('tabelaAberta') === '1')
  useEffect(() => { try { localStorage.setItem('tabelaAberta', tableOpen ? '1' : '0') } catch { /* sem armazenamento */ } }, [tableOpen])
  const macroH = useMacro()
  const ptaxH = macroH.data?.ptaxHist?.[currency.code]
  const fx = useDataFile('fx-noticias.json')
  const eventos = useMemo(() => {
    const diaFixado = intraday && h.fixado && currency.code === 'USD' && fixado?.noticias?.dia === toInput(day)
    if (!pts || (fx.status !== 'ok' && !diaFixado)) return undefined
    if (!intraday) return eventosDiarios(pts, fx.data, currency.code)
    const doArquivo = fx.status === 'ok' ? eventosDoDia(pts, fx.data, currency.code, day) : []
    if (!diaFixado) return doArquivo
    // pregão fixado: as manchetes guardadas daquele dia viram bolinhas, uma por hora
    const e = acharExtremos(pts, true)
    const faixa = e ? [pts[e.lo].bid, pts[e.hi].bid] : undefined
    const vistos = new Set(doArquivo.flatMap((ev) => ev.itens.map((n) => n.link)))
    const extras = destaquesPorHora(fixado.noticias.itens, pts[0].t, pts.at(-1).t, faixa)
      .filter((n) => !vistos.has(n.link))
      .map((n) => {
        const perto = pts.reduce((b, p) => (Math.abs(p.t - n.t) < Math.abs(b.t - n.t) ? p : b), pts[0])
        return { t: n.t, bid: perto.bid, dia: fixado.dia, tom: 'news', itens: [n] }
      })
    return [...doArquivo, ...extras].sort((a, b) => a.t - b.t)
  }, [pts, fx.status, fx.data, currency.code, intraday, day, h.fixado, fixado])
  const marcos = useMemo(() => (pts?.length ? marcosEntre(pts[0].t, pts.at(-1).t, { intradiario: intraday }) : undefined), [pts, intraday])
  // notícias publicadas perto da máxima do dia: manchetes de 15 em 15 minutos (fx-agora.json) e as de hora em hora (fx-noticias.json)
  const diaVisto = intraday && pts?.length ? marketDate(pts.at(-1).t) : null
  const agora = useFxAgora(currency.code === 'USD' && intraday)
  const maxima = useMemo(() => {
    // máxima do pregão (9h às 18h): a amostra da madrugada costuma ser o fechamento da véspera
    const e = intraday && pts?.length > 1 ? acharExtremos(pts, true) : null
    return e ? pts[e.hi] : null
  }, [pts, intraday])
  const perto = useMemo(() => {
    if (!maxima || !diaVisto) return []
    const doDia = fx.status === 'ok' ? itensDoDia(fx.data, currency.code, diaVisto, Infinity) : []
    const guardadas = fixado?.noticias?.dia === diaVisto && currency.code === 'USD' ? fixado.noticias.itens : []
    const e = acharExtremos(pts, true)
    const faixa = e ? [pts[e.lo].bid, pts[e.hi].bid] : undefined
    return noticiasPerto([agora?.dia === diaVisto ? agora.itens : [], guardadas, doDia], maxima.t, { faixa })
  }, [maxima, diaVisto, agora, fixado, pts, fx.status, fx.data, currency.code])
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
        {pts && <Plot points={pts} history={full} width={width} color={color} code={currency.code} intraday={intraday} fmt={intraday ? brl : undefined} vfmt={quoteFmt} labels label={intraday ? 'Cotação' : undefined} eventos={eventos} extremos marcos={marcos} simular={currency.code} />}
        {perto.length > 0 && (
          <section className="fx-perto" aria-label="Notícias perto da máxima do dia">
            <p className="fx-perto-head"><b>Notícias perto da máxima</b> ({brl(maxima.bid)} às {fmtTime(maxima.t)})</p>
            <ul>
              {perto.map((n) => (
                <li key={n.link}>
                  <time dateTime={new Date(n.t).toISOString()}>{fmtTime(n.t)}</time>{' '}
                  <a href={n.link} target="_blank" rel="noopener noreferrer">{n.title}</a> <small>{n.source}</small>
                </li>
              ))}
            </ul>
            <p className="muted fx-news-note">Manchetes publicadas de 1 hora antes a 30 minutos depois da máxima, buscadas de 15 em 15 minutos. Mostram o que saiu na imprensa naquele momento, não comprovam a causa do movimento.</p>
          </section>
        )}
        {intraday && pts?.some((p) => !noPregao(p.t)) && <p className="fx-legend">Máx. e mín. do dia contam só o pregão (9h às 18h de Brasília). Amostras fora desse horário aparecem na linha, mas não entram na conta.</p>}
        {marcos?.length > 0 && <p className="fx-legend"><span className="marco-chave" aria-hidden="true">↑</span> eventos de mercado com data oficial, da agenda do painel e de uma lista conferida. Nome sublinhado abre a fonte; no computador, passe o mouse sobre o nome para ver a origem.</p>}
        {eventos?.length > 0 && (intraday
          ? <p className="fx-legend"><span className="fx-dot news" aria-hidden="true" /> Manchetes sobre a moeda e o mercado publicadas neste dia, no horário em que saíram. Toque numa bolinha para ler.</p>
          : <p className="fx-legend"><span className="fx-dot up" aria-hidden="true" /> maiores altas <span className="fx-dot down" aria-hidden="true" /> maiores baixas da moeda no período (variação de 0,5% ou mais, só dias com manchetes guardadas). Toque numa bolinha para ver as manchetes.</p>)}
      </div>
      {pts && h.fixado && <p className="status pregao-fixado-nota">Pregão de {diaCurto(fixado.dia)} fixado no painel até {diaCurto(fixado.ate)}, com as amostras e as manchetes guardadas daquele dia.</p>}
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
