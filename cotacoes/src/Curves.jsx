import ChartFullscreen from './ChartFullscreen.jsx'
import { ancoraRotulo, marcasValor, yRotulo } from './chartMarcas.js'
import Flag from './Flag.jsx'
import { bandeiraDe } from './paises.js'
import RefreshButton from './RefreshButton.jsx'
import { Aviso } from './Avisos.jsx'
import { useId, useMemo, useState } from 'react'
import { nextChartIndex } from './chartNavigation.js'
import { marcasRedondas } from './chartEixo.js'
import { mesesDoEixo } from './faixaCurva.js'
import { focoPorTeclado, limitarBalao, rotuloEixo, saidaDeToque, useLarguraBalao, useTocarFora } from './chartToque.js'
import './ChartAccess.css'
import { isWeekendBR } from './market.js'
import { dataTimestamp } from './dataTimestamp.js'
import Explain from './Explain.jsx'
import { useWidth } from './HistoryChart.jsx'
import CupomLeitura from './CupomLeitura.jsx'
import { useDataFile } from './useDataFile.js'
import { normalizeEuroCurve } from './euroCurve.js'
import Estado from './Estado.jsx'
import IndicatorTable from './IndicatorTable.jsx'
import { curveTable } from './curveTable.js'

const H = 260
const M = { t: 14, r: 16, b: 30, l: 52 }
const SHADES = ['var(--chart-teal)', 'var(--chart-gold)', 'var(--chart-purple)', 'var(--chart-pink)', 'var(--chart-blue)', 'var(--chart-lime)', 'var(--chart-neutral)']
const pct = (v) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const day = (iso) => iso.split('-').reverse().join('/')

// Eixo X: BR em anos úteis (day252 / 252), EUA em posições iguais por vencimento.
// `escalaDesde`: prazo mínimo (dias úteis) que entra na escala vertical; vértices mais curtos ficam fora do quadro (cortados), só no desenho.
// `prazo` (opcional, só no eixo BR): { de, ate } em dias úteis; o gráfico mostra só os vértices nesse intervalo, com o eixo em meses
// (21 dias úteis por mês, a mesma conta do balão). `soUltimo` (opcional): abre só com a curva do último dia ligada; as outras
// datas seguem na legenda para ligar. Sem essas propriedades, nada muda (página Juros).
function CurveChart({ title, subtitle, data, mode, source, help, bare = false, escalaDesde = 0, prazo, soUltimo = false }) {
  const [ref, width] = useWidth()
  const [off, setOff] = useState(() => new Set(soUltimo ? (data?.compare ?? []).slice(1).map((c) => c.date) : []))
  const [hover, setHover] = useState(null)
  const plotRef = useTocarFora(hover != null, setHover)
  const [announcement, setAnnouncement] = useState('')
  const chartId = useId()
  const clipId = `curva-${chartId.replace(/[^\w-]/g, '')}`
  const compare = data?.compare ?? []
  const periodHelp = { curvaDi: 'periodosDi', cupom: 'periodosCupom', treasuries: 'periodosUst', curvaEuro: 'periodosEuro' }[help]
  const shown = compare.filter((c) => !off.has(c.date))

  const g = useMemo(() => {
    if (!shown.length) return null
    const corte = prazo && mode !== 'us' ? (pts) => pts.filter((p) => p[0] >= prazo.de && p[0] <= prazo.ate) : (pts) => pts
    const series = shown.map((c) => ({ ...c, pts: corte(data.curves[c.date]) })).filter((s) => s.pts.length)
    if (!series.length) return null
    const labels = mode === 'us' ? [...new Map(series.flatMap((s) => s.pts.map((p) => [p[0], p[2]]))).entries()].sort((a, b) => a[0] - b[0]) : null
    const xv = (yrs) => (labels ? labels.findIndex((l) => l[0] === yrs) : yrs)
    const meses = prazo && !labels
    const x0 = meses ? prazo.de / 252 : 0
    const x1 = labels ? labels.length - 1 : meses ? prazo.ate / 252 : Math.max(...series.flatMap((s) => s.pts.map((p) => p[0] / 252)))
    const todos = series.flatMap((s) => s.pts)
    const naEscala = todos.filter((p) => p[0] >= escalaDesde)
    const vals = (naEscala.length ? naEscala : todos).map((p) => p[1])
    let lo = Math.min(...vals)
    let hi = Math.max(...vals)
    const pad = (hi - lo || 1) * 0.12
    // eixo em números redondos, com o domínio estendido até a marca vizinha
    const eixo = marcasRedondas(lo - pad, hi + pad)
    lo = eixo.lo
    hi = eixo.hi
    const iw = width - M.l - M.r
    const ih = H - M.t - M.b
    const X = (p) => M.l + (((labels ? xv(p[0]) : p[0] / 252) - x0) / (x1 - x0 || 1)) * iw
    const Y = (v) => M.t + (1 - (v - lo) / (hi - lo)) * ih
    const yTicks = eixo.ticks
    const xTicks = labels
      ? labels.filter((_, i) => i % (width < 520 ? 3 : 2) === 0 || i === labels.length - 1).map((l) => ({ x: X([l[0]]), t: l[1] }))
      : meses
        ? mesesDoEixo(prazo.de / 21, prazo.ate / 21).map((m) => ({ x: M.l + ((m / 12 - x0) / (x1 - x0 || 1)) * iw, t: `${m}m` }))
            .reduce((acc, t) => (!acc.length || t.x - acc.at(-1).x >= 30 ? [...acc, t] : acc), [])
        : [0, 1, 2, 3, 5, 7, 10, 15, 20, 30].filter((y) => y <= x1 + 0.01).map((y) => ({ x: M.l + (y / (x1 || 1)) * iw, t: `${y}a` }))
          .reduce((acc, t) => (!acc.length || t.x - acc.at(-1).x >= 30 ? [...acc, t] : acc), []) // pelo menos 30 px entre rótulos: sem encavalar
    return { series, X, Y, yTicks, xTicks, casas: eixo.casas, iw, ih }
  }, [shown.map((s) => s.date).join(), width, data, mode, escalaDesde, prazo?.de, prazo?.ate])

  const onMove = (e) => {
    if (!g) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * width
    const pts = g.series[0].pts
    let best = 0
    let bd = Infinity
    pts.forEach((p, i) => {
      const d = Math.abs(g.X(p) - px)
      if (d < bd) ((bd = d), (best = i))
    })
    setHover(best)
  }

  const hp = g && hover != null ? g.series[0].pts[hover] : null
  const [tipRef, tipW] = useLarguraBalao(hp)
  const vertexLabel = (p) => (mode === 'us' ? p[2] : `${Math.round(p[0])} d.u. (~${(p[0] / 21).toFixed(1).replace('.', ',')} m)`)
  const at = (s, p) => (mode === 'us' ? s.pts.find((q) => q[0] === p[0]) : s.pts.reduce((b, q) => (Math.abs(q[0] - p[0]) < Math.abs(b[0] - p[0]) ? q : b)))

  const onKey = (e) => {
    const next = nextChartIndex(e.key, hover, g?.series[0]?.pts.length ?? 0)
    if (next == null) return
    e.preventDefault()
    setHover(next)
    const point = g.series[0].pts[next]
    setAnnouncement(`${vertexLabel(point)}: ${g.series.map(s => { const q = at(s, point); return q ? `${s.label}, ${pct(q[1])}` : '' }).filter(Boolean).join('; ')}`)
  }

  return (
    <article className="chart curve">
      {!bare && (
        <header>
          <h3>
            <Flag code={bandeiraDe(title)} width={18} height={12} />{title}
            <small>{subtitle}</small>
            <Explain id={help} grafico />
          </h3>
          <RefreshButton files={['curves.json']} label={title} />
        </header>
      )}
      {/* uma linha curta só; o detalhe das datas de comparação fica no "?" da legenda */}
      {!prazo && <p className="chart-comparison-note">Eixo por prazo de vencimento, não por data.{escalaDesde > 0 && ' Vencimentos com menos de 3 meses ficam fora da escala; seguem na tabela.'}</p>}
      <div className="curve-legend">
        {periodHelp && <span className="curve-legend-title">Curvas de comparação <Explain id={periodHelp} /></span>}
        {compare.map((c, i) => (
          <button key={c.date} type="button" className={off.has(c.date) ? 'series-hidden' : 'series-visible'} aria-pressed={!off.has(c.date)} style={{ '--series': SHADES[i % SHADES.length] }} onClick={() => setOff((o) => { const n = new Set(o); n.has(c.date) ? n.delete(c.date) : n.add(c.date); return n })}>
            <i className="swatch" /> {c.label} <small>{day(c.date)}<span className="curve-legend-state"> · {off.has(c.date) ? 'Oculta' : 'Visível'}</span></small>
          </button>
        ))}
      </div>
      <div ref={ref}>
        {g ? (
          <ChartFullscreen><div ref={plotRef} className="plot" onPointerLeave={(e) => { if (!saidaDeToque(e)) setHover(null) }}>
            <span id={`${chartId}-hint`} className="chart-access-text">Use as setas para percorrer os prazos; Home e End vão ao primeiro e ao último.</span>
            <span className="chart-access-text" role="status" aria-live="polite">{announcement}</span>
            <svg tabIndex={0} aria-describedby={`${chartId}-hint`} onFocus={(e) => { if (focoPorTeclado(e)) setHover(0) }} onBlur={() => setHover(null)} onKeyDown={onKey} viewBox={`0 0 ${width} ${H}`} width="100%" height={H} role="img" aria-label={`Curva de juros: ${title}`} onPointerMove={onMove} onPointerDown={onMove}>
              {g.yTicks.map((v) => (
                <g key={v}>
                  <line x1={M.l} x2={width - M.r} y1={g.Y(v)} y2={g.Y(v)} className="gridline" />
                  <text x={M.l - 8} y={g.Y(v)} dy="0.32em" textAnchor="end" className="tick">{rotuloEixo(v, g.casas)}</text>
                </g>
              ))}
              {g.xTicks.map((t, i) => (
                <text key={t.t + i} x={t.x} y={H - 8} textAnchor="middle" className="tick">{t.t}</text>
              ))}
              <clipPath id={clipId}><rect x={M.l} y={M.t} width={g.iw} height={g.ih} /></clipPath>
              {g.series.map((s) => {
                const color = SHADES[compare.findIndex((c) => c.date === s.date) % SHADES.length]
                const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${g.X(p).toFixed(1)},${g.Y(p[1]).toFixed(1)}`).join('')
                // rótulos de valor só na curva do último dia, e só nos vencimentos dentro da escala
                const vis = s.id === 'hoje' ? s.pts.filter((p) => p[0] >= escalaDesde) : []
                const marcas = marcasValor(vis.map((p) => p[1]), vis.map((p) => g.X(p)))
                return (
                  <g key={s.date}>
                    <path clipPath={`url(#${clipId})`} d={d} fill="none" stroke={color} strokeWidth={s.id === 'hoje' ? 2.5 : 1.6} strokeLinejoin="round" strokeLinecap="round" opacity={s.id === 'hoje' ? 1 : 0.85} />
                    {s.id === 'hoje' && s.pts.map((p) => <circle clipPath={`url(#${clipId})`} key={p[0]} cx={g.X(p)} cy={g.Y(p[1])} r="2.6" fill={color} />)}
                    {marcas.map(({ i, vale }) => {
                      const p = vis[i]
                      return <text key={p[0]} x={g.X(p)} y={yRotulo(g.Y(p[1]), vale, M.t, H - M.b)} textAnchor={ancoraRotulo(i, vis.length)} className="vlabel" pointerEvents="none">{pct(p[1])}</text>
                    })}
                  </g>
                )
              })}
              {hp && <line x1={g.X(hp)} x2={g.X(hp)} y1={M.t} y2={H - M.b} className="cross" pointerEvents="none" />}
            </svg>
            {hp && (
              <div ref={tipRef} className="tip" style={{ left: limitarBalao(g.X(hp), tipW, width) }}>
                <strong>{vertexLabel(hp)}</strong>
                {g.series.map((s) => {
                  const q = at(s, hp)
                  return q ? <span key={s.date}>{s.label}: {pct(q[1])}</span> : null
                })}
              </div>
            )}
          </div></ChartFullscreen>
        ) : (
          <div className="placeholder" style={{ height: H }}>Selecione ao menos uma data.</div>
        )}
      </div>
      <Aviso title={title}><p className="status">{source}</p>
      {compare[0]?.date && <p className="status">Referência: {day(data.sourceDate || compare[0].date)}{data.checkedAt ? ` · Conferência dos vértices: ${dataTimestamp(data.checkedAt)}` : ''}.</p>}</Aviso>
      {data.discoveryPending && <p className="status stale" role="status">Catálogo de datas indisponível. Vértices conferidos somente nas datas oficiais já conhecidas; não foi possível confirmar uma referência mais recente.</p>}
      {!data.discoveryPending && data.warnings?.length>0 && <p className="status stale" role="status">Comparações históricas com pendência: {data.warnings.join(' · ')}</p>}
    </article>
  )
}

// As três curvas do arquivo central (a do euro vem de arquivo próprio): mesmo texto no gráfico e na tabela.
export const CURVAS = {
  br: { help: 'curvaDi', title: 'Brasil · DI x pré', subtitle: 'taxa % a.a. por prazo em dias úteis', mode: 'br', nome: 'DI x pré', source: 'Taxas referenciais calculadas a partir dos ajustes dos futuros de DI; publicadas após o fechamento do pregão.' },
  cc: { escalaDesde: 63, help: 'cupom', title: 'Brasil · Cupom cambial', subtitle: 'DI x dólar, % a.a. por prazo em dias úteis', mode: 'br', nome: 'cupom cambial', source: 'Cupom cambial a partir dos ajustes dos futuros. Vértices curtos (menos de 1 mês) omitidos por serem muito ruidosos; publicado após o fechamento.' },
  us: { help: 'treasuries', title: 'EUA · Treasuries', subtitle: 'Par yield curve, % a.a. por vencimento', mode: 'us', nome: 'Treasuries', source: 'Curva de títulos públicos (par yield), não de futuros; fechamento do dia anterior ou do dia, conforme a divulgação.' },
  eu: { help: 'curvaEuro', title: 'Área do euro · Curva soberana AAA', subtitle: 'taxa spot % a.a. por vencimento', mode: 'us', nome: 'curva do euro', source: 'Títulos soberanos da área do euro com classificação AAA, taxa spot estimada pelo modelo de Svensson. Não é o rendimento de um título específico, como o Bund alemão, e a taxa spot difere da par yield usada nas Treasuries, então a comparação com a curva dos EUA é de formato e não de nível exato.' },
}
const grafico = (id, data, bare = false, extra = {}) => { const c = CURVAS[id]; return <CurveChart bare={bare} escalaDesde={c.escalaDesde} help={c.help} title={c.title} subtitle={c.subtitle} data={data} mode={c.mode} source={c.source} {...extra} /> }

// Curva DI x pré sozinha, para o painel do Mercado. `prazo` e `soUltimo` (opcionais) seguem para o gráfico: ver CurveChart.
export function CurvePanel({ curves: c, prazo, soUltimo }) {
  if (!c || c.status === 'loading') return <div className="placeholder">Carregando curvas…</div>
  if (c.status === 'error') return <Estado tipo="erro" erro={c.error}>Curvas de juros indisponíveis agora.</Estado>
  return (
    <>
      {c.stale && <p className="status stale" role="status">Não foi possível atualizar as curvas. Mantida a última coleta disponível.</p>}
      {c.data?.br ? grafico('br', c.data.br, true, { prazo, soUltimo }) : <p className="status">Curva DI indisponível nesta atualização.</p>}
    </>
  )
}

// Curva soberana da área do euro (BCE): arquivo próprio, então aparece mesmo se a coleta das curvas do Brasil e dos EUA estiver pendente.
export function useEuroCurve() {
  const f = useDataFile('euro-curve.json')
  let data = null
  try { data = f.data ? normalizeEuroCurve(f.data) : null } catch { /* arquivo inválido: mostra indisponível */ }
  return { data, loading: f.status === 'loading', stale: !!(data?.stale || f.stale) }
}

// Gráfico de uma curva: na aba Juros (`preview`, sem os avisos gerais da coleta, que a página dá uma vez só) e na tela
// de detalhe. No detalhe, o cupom leva junto a leitura de cenário.
// Avisos gerais da coleta das curvas, uma vez por página (os gráficos em `preview` não os repetem).
export function CurvesStatus({ curves: c }) {
  const d = c?.data
  return (
    <>
      {c?.stale && <p className="status stale" role="status">Não foi possível atualizar as curvas. Mantida a última coleta disponível.</p>}
      {d?.generatedAt && Date.now() - d.generatedAt > 3 * 3600e3 && !isWeekendBR() && <p className="status stale" role="status">Curvas coletadas há mais de 3 horas; atualização pode estar pendente.</p>}
    </>
  )
}

export function CurveDetail({ id, curves: c, preview = false }) {
  const euro = useEuroCurve()
  if (id === 'eu') {
    if (!euro.data) return <p className="status">{euro.loading ? 'Carregando curva do euro…' : 'Curva do euro indisponível nesta atualização.'}</p>
    return (
      <>
        {euro.stale && <p className="status stale" role="status">Não foi possível atualizar a curva do euro. Mantida a última coleta disponível.</p>}
        {grafico('eu', euro.data)}
      </>
    )
  }
  if (!c || c.status === 'loading') return <div className="placeholder">Carregando curvas…</div>
  if (c.status === 'error') return <Estado tipo="erro" erro={c.error}>Curvas de juros indisponíveis agora.</Estado>
  const d = c.data
  return (
    <>
      {!preview && c.stale && <p className="status stale" role="status">Não foi possível atualizar as curvas. Mantida a última coleta disponível.</p>}
      {d?.stale?.[id] && <p className="status stale" role="status">Atualização pendente desta curva; última coleta: {new Date(d.stale[id]).toLocaleString('pt-BR')}.</p>}
      {!preview && d?.generatedAt && Date.now() - d.generatedAt > 3 * 3600e3 && !isWeekendBR() && <p className="status stale" role="status">Curvas coletadas há mais de 3 horas; atualização pode estar pendente.</p>}
      {d?.[id] ? grafico(id, d[id]) : <p className="status">Curva indisponível nesta atualização.</p>}
      {!preview && id === 'cc' && d?.cc && d?.br && <CupomLeitura curves={d} />}
    </>
  )
}

const TABELAS = ['br', 'cc', 'us', 'eu']

// Aba Juros: cada curva vira uma tabela (prazo × data de comparação); a linha abre o gráfico em tela própria.
export default function Curves({ curves: c, onOpen, region, onlyId }) {
  const tables = TABELAS.filter(id => !onlyId || id === onlyId).filter(id => region === 'brasil' ? ['br', 'cc'].includes(id) : region === 'exterior' ? ['us', 'eu'].includes(id) : true)
  const stale = Object.entries(c.data?.stale ?? {}).filter(([id]) => tables.includes(id))
  const d = c.data
  const euro = useEuroCurve()
  const dados = { br: d?.br, cc: d?.cc, us: d?.us, eu: euro.data }
  return (
    <section className="macro curve-tables" aria-label="Curvas de juros">
      <p className="ind-note">Curvas de juros: taxas em % a.a. por prazo, na última data e nas datas de comparação.{onOpen ? ' Toque em uma linha para abrir o gráfico da curva.' : ''}</p>
      {c.stale && <p className="status stale" role="status">Não foi possível atualizar as curvas. Mantida a última coleta disponível. {c.error}</p>}
      {c.status === 'loading' && <div className="placeholder">Carregando curvas…</div>}
      {c.status === 'ok' && c.data.generatedAt && (Date.now() - c.data.generatedAt > 3 * 3600e3) && !isWeekendBR() && (
        <p className="status stale">Atenção: as curvas foram coletadas há mais de 3 horas; a atualização automática pode ter parado.</p>
      )}
      {c.status === 'ok' && stale.length > 0 && (
        <p className="status stale">
          Atualização indisponível na última coleta; mantido o último dado publicado: {stale.map(([k, t]) => `${{ br: 'DI x pré', cc: 'cupom cambial', us: 'Treasuries' }[k] ?? k} (coletado em ${t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'data desconhecida'})`).join(', ')}.
        </p>
      )}
      {c.status === 'error' && <Estado tipo="erro" erro={c.error}>Curvas de juros indisponíveis agora.</Estado>}
      {region !== 'brasil' && euro.stale && <p className="status stale" role="status">Não foi possível atualizar a curva do euro. Mantida a última coleta disponível.</p>}
      {tables.map((id) => {
        const def = CURVAS[id]
        const pronto = id === 'eu' ? !euro.loading : c.status === 'ok'
        const t = pronto && dados[id] ? curveTable(dados[id], def.mode) : { columns: [], rows: [] }
        return (
          <div key={id} id={`${onlyId ? 'juros-detail-curva' : 'juros-curva'}-${id}`} className="executive-rates curve-table juros-tabela">
            <header className="executive-rates__heading">
              <h2><Flag code={bandeiraDe(def.title)} width={18} height={12} />{def.title} <small>{def.subtitle}</small></h2>
              <Explain id={def.help} />
            </header>
            {!pronto && id === 'eu' && <p className="status">Carregando curva do euro…</p>}
            {pronto && !t.rows.length && <p className="status">Curva indisponível nesta atualização.</p>}
            {t.rows.length > 0 && (
              <>
                <p className="table-swipe-hint">Deslize a tabela para ver as outras datas →</p>
                <div className="executive-rates__scroll">
                  <IndicatorTable
                    first="Prazo"
                    caption={`${def.title}: taxas por prazo`}
                    columns={t.columns.map((col) => ({ label: col.label, small: col.small, aria: `${col.label}, ${col.small}` }))}
                    rows={t.rows.map((r) => ({ id: `curva-${id}`, key: r.id, name: r.name, sub: r.sub, openLabel: `${def.title}, ${r.name}: abrir gráfico da curva`, cells: r.values.map((v) => ({ text: v == null ? '—' : pct(v) })) }))}
                    onOpen={onOpen}
                  />
                </div>
              </>
            )}
          </div>
        )
      })}
    </section>
  )
}
