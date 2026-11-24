import ChartFullscreen from './ChartFullscreen.jsx'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { comparisonRows } from './chartComparison.js'
import { nextChartIndex } from './chartNavigation.js'
import './ChartComparison.css'
const date = t => new Date(t).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
const number = v => Number.isFinite(v) ? v.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : '—'
const signed = v => v == null ? 'indisponível' : (v > 0 ? '+' : '') + number(v)
// Complementa SVGs existentes sem substituir tooltips, legendas, barras ou filtros.
export default function ChartComparison({ children, series = [], history = series, frequency = 'auto', rate = false, compound = false, margin = { l: 56, r: 18, t: 12, b: 28 }, categorical = false, compact = false, html = false, unavailable = '', onRangeChange, resetKey }) {
  const box = useRef(null), gesture = useRef(null), cursor = useRef(0), cursorTime = useRef(null), anchor = useRef(null)
  const rangeRef = useRef(null)
  const [svg, setSvg] = useState(null), [range, setRange] = useState(null)
  rangeRef.current = range
  const id = useId()
  const timeKey = [...new Set(series.flatMap(s => s.points.map(p => p.t)))].filter(Number.isFinite).sort((a, b) => a - b).join(',')
  const times = useMemo(() => timeKey ? timeKey.split(',').map(Number) : [], [timeKey])
  const signature = resetKey ?? series.map(s => `${s.key}:${s.points.length}:${s.points[0]?.t}:${s.points.at(-1)?.t}`).join('|')
  useEffect(() => { setRange(null); onRangeChange?.(null); anchor.current = null; gesture.current = null }, [signature,onRangeChange])
  useEffect(() => {
    const el = box.current?.querySelector(html ? '[data-comparison-plot]' : 'svg')
    if (!el || !times.length) return
    setSvg(el)
    if(cursorTime.current != null)cursor.current=Math.max(0,times.indexOf(cursorTime.current))
    const locate = e => {
      const rect = el.getBoundingClientRect(), w = el.viewBox?.baseVal?.width || el.clientWidth
      const px = (e.clientX - rect.left) / rect.width * w
      const ratio = Math.max(0, Math.min(1, (px - margin.l) / (w - margin.l - margin.r)))
      const wanted = times[0] + ratio * (times.at(-1) - times[0])
      return categorical ? Math.min(times.length - 1, Math.floor(ratio * times.length)) : times.reduce((best, t, i) => Math.abs(t - wanted) < Math.abs(times[best] - wanted) ? i : best, 0)
    }
    let suppress = false
    const down = e => {
      if (e.button !== 0 || times.length < 2) return
      const i = locate(e); cursor.current = i; cursorTime.current=times[i]; anchor.current = times[i]
      gesture.current = { x: e.clientX, y: e.clientY, t: times[i], previous: rangeRef.current, moved: false }
      try { el.setPointerCapture(e.pointerId) } catch { /* saída do gráfico encerra o gesto */ }
    }
    const move = e => {
      cursor.current = locate(e); cursorTime.current=times[cursor.current]
      const g = gesture.current
      if (!g || Math.abs(e.clientX - g.x) < 6 || Math.abs(e.clientX - g.x) < Math.abs(e.clientY - g.y)) return
      g.moved = true
      setRange([g.t, times[cursor.current]])
    }
    const up = () => { if (gesture.current?.moved) {suppress=true;onRangeChange?.(rangeRef.current)} else if(gesture.current && rangeRef.current){setRange(null);onRangeChange?.(null)} gesture.current = null }
    const cancel = () => { if (gesture.current) setRange(gesture.current.previous); gesture.current = null }
    const click = e => { if (suppress) { e.preventDefault(); e.stopPropagation(); suppress = false } }
    const key = e => {
      if (e.key === 'Escape' && rangeRef.current) { e.preventDefault(); e.stopPropagation(); setRange(null); onRangeChange?.(null); anchor.current = null; return }
      const next = nextChartIndex(e.key, cursor.current, times.length)
      if (next == null) return
      if (e.shiftKey) {
        e.preventDefault(); e.stopPropagation()
        anchor.current ??= times[cursor.current]
        setRange([anchor.current, times[next]]);onRangeChange?.([anchor.current,times[next]])
      } else anchor.current = null
      cursor.current = next; cursorTime.current=times[next]
    }
    const focus = () => { cursor.current = 0; cursorTime.current=times[0]; anchor.current = null }
    el.style.touchAction = 'pan-y'
    if(html)el.style.position='relative'
    const focusTarget = compact && el.closest('button') ? el.closest('button') : el
    if (focusTarget === el) el.setAttribute('tabindex', '0')
    el.removeAttribute('aria-hidden')
    const description = focusTarget.getAttribute('aria-describedby')
    focusTarget.setAttribute('aria-describedby', [description, `${id}-hint`].filter(Boolean).join(' '))
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', cancel); el.addEventListener('lostpointercapture', up)
    focusTarget.addEventListener('keydown', key, true); el.addEventListener('click', click, true); focusTarget.addEventListener('focus', focus)
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', cancel); el.removeEventListener('lostpointercapture', up); focusTarget.removeEventListener('keydown', key, true); el.removeEventListener('click', click, true); focusTarget.removeEventListener('focus', focus); if(description)focusTarget.setAttribute('aria-describedby',description);else focusTarget.removeAttribute('aria-describedby') }
  }, [times, categorical, margin.l, margin.r, id, html, compact, onRangeChange])
  const rows = range && range[0] !== range[1] ? comparisonRows(series, history, ...range, { frequency, compound }) : []
  const w = svg?.viewBox?.baseVal.width || svg?.clientWidth, h = svg?.viewBox?.baseVal.height || svg?.clientHeight
  const x = t => categorical ? margin.l + (times.indexOf(t) + 0.5) / times.length * (w - margin.l - margin.r) : margin.l + (t - times[0]) / (times.at(-1) - times[0] || 1) * (w - margin.l - margin.r)
  const change = (r, row) => r ? compound ? `${signed(r.accumulated)}% acumulado composto` : `${signed(r.delta)}${rate || row?.unit?.startsWith('%') ? ' p.p.' : row?.unit ? ' ' + row.unit : ''}${!rate && !row?.unit?.startsWith('%') && r.pct != null ? ` (${signed(r.pct)}%)` : ''}` : 'Indisponível: faltam observações comparáveis'
  const priorRanges = (unavailable ? [] : rows).map(r=>r.prior).filter((r,i,a)=>r && r.t0>=times[0] && r.t1<=times.at(-1) && (!categorical || (times.includes(r.t0) && times.includes(r.t1))) && a.findIndex(p=>p?.t0===r.t0 && p?.t1===r.t1)===i)
  const Tag = compact ? 'span' : 'div'
  return <ChartFullscreen disabled={compact}><Tag ref={box} className={`chart-comparison${compact ? ' chart-comparison-compact' : ''}`}>
    {children}
    <span id={`${id}-hint`} className="chart-access-text">Arraste horizontalmente para selecionar. Shift com setas seleciona pelo teclado; Escape limpa. {unavailable || 'Comparação com o mesmo período do ano anterior quando houver histórico.'}</span>
    {rows.length > 0 && svg && !html && createPortal(<g className="comparison-band" pointerEvents="none">{priorRanges.map(r=><rect key={r.t0} className="comparison-prior-band" x={x(r.t0)} y={margin.t} width={Math.max(0,x(r.t1)-x(r.t0))} height={Math.max(0,h-margin.t-margin.b)} fill="var(--currency-eur)" fillOpacity="0.08" stroke="var(--currency-eur)" strokeDasharray="4 3" />)}<rect x={Math.min(x(range[0]), x(range[1]))} y={margin.t} width={Math.abs(x(range[1]) - x(range[0]))} height={Math.max(0, h - margin.t - margin.b)} fill="var(--accent)" opacity="0.14" /><line x1={x(range[0])} x2={x(range[0])} y1={margin.t} y2={h-margin.b} stroke="var(--accent)" strokeDasharray="4 3" /><line x1={x(range[1])} x2={x(range[1])} y1={margin.t} y2={h-margin.b} stroke="var(--accent)" strokeDasharray="4 3" /></g>, svg)}
    {rows.length>0 && svg && html && createPortal(<span aria-hidden="true" style={{position:'absolute',pointerEvents:'none',left:Math.min(x(range[0]),x(range[1])),top:0,bottom:0,width:Math.abs(x(range[1])-x(range[0])),background:'var(--accent)',opacity:0.14}}/>,svg)}
    {rows.length > 0 && <Tag className="comparison-readout" role="status" aria-live="polite">
      <strong>Selecionado: {date(Math.min(...range))} a {date(Math.max(...range))}</strong>
      {rows.map(r => <Tag key={r.key} className="comparison-row"><b>{r.name}</b><span>Trecho: {r.current && !compound ? `${number(r.current.v0)} → ${number(r.current.v1)} · ` : ''}{change(r.current,r)}</span><span>Ano anterior: {unavailable || change(r.prior,r)}{!unavailable && r.prior ? ` · ${date(r.prior.t0)} a ${date(r.prior.t1)}` : ''}</span>{r.current && r.prior && !unavailable && <span>Diferença entre {compound ? 'acumulados' : 'variações'}: {signed(compound ? r.current.accumulated - r.prior.accumulated : rate || r.unit?.startsWith('%') ? r.current.delta - r.prior.delta : r.current.pct == null || r.prior.pct == null ? null : r.current.pct - r.prior.pct)} p.p.</span>}</Tag>)}
      {!compact && !unavailable && rows.some(r=>r.prior && r.prior.t0<times[0]) && <span>Trecho anterior fora da janela visível; a comparação usa o histórico carregado.</span>}
      {!compact && <button type="button" onClick={() => { setRange(null); onRangeChange?.(null); anchor.current = null }}>Limpar seleção</button>}
      {compact && <span>Escape limpa a seleção.</span>}
    </Tag>}
  </Tag></ChartFullscreen>
}
