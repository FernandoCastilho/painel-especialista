import { useMemo, useState } from 'react'
import './Calendario.css'
import Flag from './Flag.jsx'
import Help from './Help.jsx'
import { hasFlag } from './flags.js'
import RefreshButton from './RefreshButton.jsx'
import { useDataFile } from './useDataFile.js'
import { explicarEvento, formatarValorCalendario, NIVEL, traduzirEvento } from './calendarImpact.js'
import { COUNTRIES, PERIODS, countryOf, dayKey, filterEvents, groupByDay, mergeEvents, TZ } from './calendar.js'

const IMPACTS = [['high', 'Alto'], ['medium', 'Médio'], ['low', 'Baixo']]
const hour = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
const dayLabel = (key, today) => {
  const d = new Date(`${key}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
  return key === today ? `${d} · hoje` : d
}

// Balão "?" do evento: o que é, efeito na economia e ligação com o Brasil; sem categoria mapeada, diz que o impacto é baixo.
function EventHelp({ e }) {
  const x = explicarEvento(e)
  const titulo = traduzirEvento(e.title)
  return (
    <Help label={`Impacto de ${titulo}`} wide fixed>
      <b className="ex-t">{titulo}</b>
      {titulo !== e.title && <span className="ex"><i>Nome na fonte:</i> <span lang="en">{e.title}</span></span>}
      {x.mapeado && <span className="ex"><i>{x.nome}:</i> {x.oque}</span>}
      <span className="ex"><i>Na economia:</i> {x.economia}</span>
      <span className="ex"><i>Brasil:</i> {x.brasil}</span>
      <span className="ex"><i>Impacto:</i> {x.mapeado ? `${NIVEL[x.nivel] ?? x.nivel}, segundo a fonte.` : `Baixo${x.nivelFonte && x.nivelFonte !== 'low' ? ` para o Brasil (a fonte o classifica como ${(NIVEL[x.nivelFonte] ?? x.nivelFonte).toLowerCase()} para o mercado local)` : ''}.`}</span>
    </Help>
  )
}

function ImpactMark({ impact }) {
  const n = impact === 'high' ? 3 : impact === 'medium' ? 2 : impact === 'low' ? 1 : 0
  const label = { high: 'Impacto alto', medium: 'Impacto médio', low: 'Impacto baixo', holiday: 'Feriado' }[impact]
  return <span className={`cal-impact ${impact}`} role="img" aria-label={label} title={label}>{impact === 'holiday' ? '⚑' : '●'.repeat(n) + '○'.repeat(3 - n)}</span>
}

// Cenários › Calendário econômico: eventos do mundo (Forex Factory, BLS, BEA, Fed) e do Brasil (agenda curada), por dia, em horário de Brasília.
export default function Calendario() {
  const file = useDataFile('calendar.json')
  const [period, setPeriod] = useState('semana')
  const [impacts, setImpacts] = useState(['high', 'medium'])
  const [country, setCountry] = useState('all')
  const now = Date.now()
  const today = dayKey(now)
  const events = useMemo(() => mergeEvents(file.data, now), [file.data])
  const shown = useMemo(() => filterEvents(events, { period, impacts: impacts.includes('low') ? [...impacts, 'holiday'] : impacts, country, now }), [events, period, impacts, country])
  const days = useMemo(() => groupByDay(shown), [shown])
  const toggle = (id) => setImpacts((cur) => (cur.includes(id) ? (cur.length > 1 ? cur.filter((x) => x !== id) : cur) : [...cur, id]))
  const failed = file.status === 'error'
  const stale = Object.keys(file.data?.stale ?? {})
  return (
    <section className="calendario" aria-labelledby="cal-title">
      <div className="ctx-head"><h2 id="cal-title">Calendário econômico</h2><RefreshButton files={['calendar.json']} label="Calendário econômico" /></div>
      <div className="cal-filters">
        <div className="seg" role="group" aria-label="Período do calendário">
          {PERIODS.map((p) => <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Impacto dos eventos">
          {IMPACTS.map(([id, label]) => <button key={id} type="button" aria-pressed={impacts.includes(id)} onClick={() => toggle(id)}>{label}</button>)}
        </div>
        <label className="cal-country">País
          <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="País do evento">
            <option value="all">Todos</option>
            {COUNTRIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>
      {failed && <p className="status stale" role="status">Não foi possível carregar o calendário coletado; mostrando só a agenda do Brasil.</p>}
      {stale.length > 0 && <p className="status stale" role="status">Parte dos dados não foi atualizada na última coleta; mantidos os últimos dados disponíveis.</p>}
      {days.length === 0 ? <p className="status" role="status">Nenhum evento neste filtro. Amplie o período ou inclua impacto médio e baixo.</p> : (
        <div className="cal-wrap" role="region" aria-label="Eventos do calendário econômico" tabIndex={0}>
          <table className="cal-table">
            <thead><tr><th scope="col">Hora</th><th scope="col">País</th><th scope="col">Evento</th><th scope="col">Impacto</th><th scope="col">Previsto</th><th scope="col">Anterior</th></tr></thead>
            {days.map((d) => (
              <tbody key={d.key}>
                <tr className="cal-day"><th colSpan={6} scope="colgroup">{dayLabel(d.key, today)}</th></tr>
                {d.events.map((e) => {
                  const c = countryOf(e.country)
                  return (
                    <tr key={`${e.src}${e.t}${e.title}${e.country}`} className={`cal-row ${e.impact}${e.t < now ? ' past' : ''}`}>
                      <td className="cal-time">{hour(e.t)}</td>
                      <td className="cal-country-cell">{c.flag && hasFlag(c.flag) ? <Flag code={c.flag} width={18} height={12} /> : null} <span className="cal-cname">{c.name}</span></td>
                      <th scope="row" className="cal-title">{traduzirEvento(e.title)}{e.tentative && <em className="tent"> previsto</em>}<EventHelp e={e} /></th>
                      <td><ImpactMark impact={e.impact} /></td>
                      <td className="cal-num">{formatarValorCalendario(e.forecast) ?? '—'}</td>
                      <td className="cal-num">{formatarValorCalendario(e.previous) ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
      <p className="status">Horário de Brasília. IPCA e IPCA-15 aparecem como "previsto" enquanto a data não é confirmada. Sem valor realizado.</p>
    </section>
  )
}
