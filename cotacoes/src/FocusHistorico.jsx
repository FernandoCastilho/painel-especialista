import { useEffect, useRef, useState } from 'react'
import { useDataFile } from './useDataFile.js'
import MultiLinhas from './MultiLinhas.jsx'
import Estado from './Estado.jsx'
import { INDICATORS } from './scenarios.js'

const COR = ['var(--currency-usd)', 'var(--currency-eur)']
const fmtPct = (v) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const fmtBrl = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dmy = (d) => d.split('-').reverse().join('/')

// Cenários › Projeções: abaixo da tabela, a mediana do Focus semana a semana (52 semanas) para cada indicador, com uma linha
// por ano de referência. Os dados vêm de focus-history.json (coleta semanal, junto com o boletim).
export default function FocusHistorico() {
  const file = useDataFile('focus-history.json')
  const ref = useRef(null)
  const [width, setWidth] = useState(560)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.floor(e.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  const series = file.data?.series ?? {}
  const anos = file.data?.anos ?? []
  const graficos = INDICATORS.map((ind) => ({
    ind,
    series: anos.map((ano, i) => ({ key: `${ind.focus}-${ano}`, name: ano, unit: ind.id==='usd'?'R$':ind.unit, color: COR[i % COR.length], points: (series[ind.focus]?.[ano] ?? []).map((p) => ({ t: Date.parse(`${p.d}T12:00:00Z`), v: p.v })) })).filter((s) => s.points.length > 1),
  })).filter((g) => g.series.length)
  const ultima = Object.values(series).flatMap((porAno) => Object.values(porAno).flatMap((p) => p.map((x) => x.d))).sort().at(-1)
  return (
    <section className="focus-hist" aria-labelledby="focus-hist-title" ref={ref}>
      <h3 id="focus-hist-title">Histórico do Focus · {file.data?.semanas ?? 52} semanas</h3>
      <p className="muted">Mediana das expectativas a cada semana (coleta até sexta, boletim de segunda), por ano de referência{ultima ? ` · última semana: ${dmy(ultima)}` : ''}.</p>
      <p className="muted">Cada linha é a previsão para um ano. Se faltar histórico, a comparação com o ano anterior não aparece.</p>
      {file.status === 'loading' && <Estado>Carregando o histórico do Focus…</Estado>}
      {file.status === 'error' && <Estado tipo="erro" erro={file.error}>Histórico do Focus indisponível no momento.</Estado>}
      {file.data?.stale && <Estado tipo="aviso">Última coleta do histórico falhou; mantida a versão anterior.</Estado>}
      {file.data && !graficos.length && file.status !== 'loading' && <Estado>Ainda sem histórico coletado; a coleta é semanal, junto com o boletim.</Estado>}
      {graficos.length > 0 && (
        <div className="focus-hist-grade">
          {graficos.map(({ ind, series: s }) => (
            <article key={ind.id} className="focus-hist-item">
              <h4>{ind.label} <small className="muted">{ind.unit}</small></h4>
              <MultiLinhas series={s} frequency="day" rate={ind.id !== 'usd'} width={Math.min(width, graficos.length > 1 && width >= 760 ? Math.floor((width - 24) / 2) : width)} fmt={ind.id === 'usd' ? fmtBrl : fmtPct} ariaLabel={`${ind.label}: mediana do Focus por semana, ${anos.join(' e ')}`} />
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
