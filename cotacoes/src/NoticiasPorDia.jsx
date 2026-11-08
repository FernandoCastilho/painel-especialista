import { NEWS_WINDOW_DAYS, recentNews, newsCollectionStale } from './newsWindow.js'
import { useNewsClock } from './useNewsClock.js'
import { useMemo, useState } from 'react'
import { dayOf, groupByDay, searchItems } from './reforma.js'
import Estado from './Estado.jsx'

const TZ = 'America/Sao_Paulo'
const dayLabel = (key, today) => {
  const d = new Date(`${key}T12:00:00Z`)
  const w = d.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' })
  const dm = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
  return key === today ? `Hoje · ${dm}` : `${w.charAt(0).toUpperCase()}${w.slice(1)} · ${dm}`
}
const short = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).replace('.', '')
const hm = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })

// Matérias dos últimos cinco dias por dia, com filtro de dia e busca. data = { items, windowDays, stale }. Usada por Reforma tributária, Setores e Insumos.
// `simples` (abas de Notícias do Mercado): só a linha do tempo dos últimos cinco dias, de hoje para trás, com a quebra por dia na própria lista,
// sem filtros, busca nem legenda. `prefixo(item)`: marca opcional antes do título (ex.: bandeiras das moedas).
export default function NoticiasPorDia({ data, label = 'matérias', ariaLabel = 'Matérias dos últimos cinco dias', simples = false, prefixo, windowDays = NEWS_WINDOW_DAYS }) {
  const [day, setDay] = useState('all')
  const [q, setQ] = useState('')
  const now = useNewsClock()
  const today = dayOf(now)
  const daysCount = windowDays === 7 ? 7 : NEWS_WINDOW_DAYS
  const hours = daysCount * 24
  const items = useMemo(() => daysCount === 7
    ? (Array.isArray(data?.items) ? data.items : []).filter(item => Number.isFinite(item?.t) && item.t > 0 && item.t >= now - hours * 3600000 && item.t <= now)
    : recentNews(data?.items, now), [data, now, daysCount, hours])
  const stale = newsCollectionStale(data, now)
  const found = useMemo(() => searchItems(items, q), [items, q])
  const days = useMemo(() => groupByDay(found), [found])
  const allDays = useMemo(() => groupByDay(items), [items])
  const activeDay = allDays.some(d => d.key === day) ? day : 'all'
  const shown = activeDay === 'all' ? days : days.filter((d) => d.key === activeDay)
  const total = shown.reduce((n, d) => n + d.count, 0)
  return (
    <div className="reforma" aria-label={ariaLabel}>
      <p className="muted reforma-count">Publicações dos últimos {daysCount} dias ({hours} horas), agrupadas pelo dia de publicação em Brasília.</p>
      {stale && <Estado tipo="aviso">Atualização incompleta, atrasada ou não confirmada. Só são exibidas publicações ainda dentro das últimas {hours} horas.</Estado>}
      {!simples && <div className="reforma-controls">
        <div className="seg reforma-days" role="group" aria-label={`Dia dos últimos ${daysCount} dias`}>
          <button type="button" aria-pressed={activeDay === 'all'} onClick={() => setDay('all')}>{daysCount} dias · {found.length}</button>
          {allDays.map((d) => <button key={d.key} type="button" aria-pressed={activeDay === d.key} onClick={() => setDay(d.key)}>{d.key === today ? 'Hoje' : short(d.key)} · {days.find((x) => x.key === d.key)?.count ?? 0}</button>)}
        </div>
        <label className="reforma-busca">Buscar nas matérias
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: preço, China, tarifa" />
        </label>
      </div>}
      {shown.length === 0 ? <Estado>{items.length && !simples ? 'Nenhuma matéria para esse filtro.' : stale ? `Nenhuma publicação válida nas últimas ${hours} horas no arquivo disponível. Não foi possível confirmar a cobertura atual.` : `Nenhuma publicação válida nas últimas ${hours} horas nas fontes consultadas. Isso não significa ausência de notícias sobre o tema.`}</Estado> : (
        <div className="reforma-list">
          {!simples && <p className="muted reforma-count" role="status">{total} {total === 1 ? 'matéria' : 'matérias'} · últimos {daysCount} dias ({hours} horas de publicação) · horário de Brasília. Títulos da imprensa agrupados por dia; não são resumo nem análise do conteúdo.</p>}
          {shown.map((d) => (
            <section key={d.key} aria-label={dayLabel(d.key, today)}>
              <h3 className="reforma-day">{dayLabel(d.key, today)} <small>{d.count} {d.count === 1 ? 'matéria' : 'matérias'}{simples ? '' : ` · ${d.sources.slice(0, 3).map(([s, n]) => `${s} (${n})`).join(', ')}`}</small></h3>
              <ul>
                {d.items.map((n) => (
                  <li key={n.link}>
                    <time dateTime={new Date(n.t).toISOString()}>{hm(n.t)}</time>
                    <span>{prefixo?.(n)}<a href={n.link} target="_blank" rel="noopener noreferrer">{n.title}</a><small>{n.source}</small></span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
