import { calFlag, calLabel, cnMissingYears, upcomingHolidays } from './holidays.js'
import Flag from './Flag.jsx'
import { marketDate } from './marketReturns.js'

const today = () => marketDate(Date.now())
const dm = (s) => s.split('-').reverse().join('/')
const weekdays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
// A data do feriado é civil: usar UTC evita mudar o dia conforme o fuso do navegador.
const weekday = (s) => weekdays[new Date(`${s}T12:00:00Z`).getUTCDay()]
// "02/11/2026 · segunda-feira (em 5 dias)", "(hoje)" ou "(amanhã)": a data e quanto falta.
const when = (d, t) => {
  const diff = Math.round((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${t}T12:00:00Z`)) / 864e5)
  return `${dm(d)} · ${weekday(d)} (${diff === 0 ? 'hoje' : diff === 1 ? 'amanhã' : `em ${diff} dias`})`
}

// Aviso de feriados nas praças escolhidas (próximos dias) e de calendário chinês ainda não publicado.
export default function HolidayNotice({ hol, days = 30, list = false, pracas = hol.pracas, expanded = false }) {
  const t = today()
  const up = upcomingHolidays(t, days, pracas, hol.ctx, { includeWeekends: expanded })
  const y = Number(t.slice(0, 4))
  const lastYear = Number(new Date(Date.parse(`${t}T12:00:00Z`) + days * 864e5).getUTCFullYear())
  const missing = pracas.includes('CN') && hol.loaded ? cnMissingYears([...new Set([y, lastYear])], hol.ctx) : []
  if (!expanded && !up.length && !missing.length) return list ? <p className="status">Nenhum feriado nas praças escolhidas nos próximos {days} dias.</p> : null
  const items = (
    <ul>
      {up.map((u) => (
        <li key={u.date + u.cal}>
          <b>{when(u.date, t)}</b> · feriado em <Flag code={calFlag(u.cal)} width={16} height={11} /> <b>{{ NY: 'EUA (Federal Reserve)', JP: 'Japão' }[u.cal] ?? calLabel(u.cal)}</b>: {u.name}
          {u.cal === 'NY' && ' (sem liquidação em USD)'}
        </li>
      ))}
    </ul>
  )
  const note = missing.length > 0 && (
    <p className="status stale">
      China: calendário oficial de {missing.join(' e ')} indisponível nesta consulta. Confira a publicação oficial antes de fechar datas.
    </p>
  )
  if (list) return <div className="holiday-notice" role="status">{up.length > 0 && items}{note}</div>
  // O conteúdo fica recolhido inicialmente; o summary nativo permite abrir por clique ou teclado.
  const first = up[0]
  const dates = new Set(up.map((u) => u.date)).size
  return (
    <details className="holiday-notice compact">
      <summary>
        {expanded ? <b>Feriados nos próximos {days} dias</b> : first ? <><b>Feriados nos próximos {days} dias</b> · {dates} {dates === 1 ? 'data' : 'datas'} · primeiro: <b>{when(first.date, t)}</b> em {[...new Set(up.filter((u) => u.date === first.date).map((u) => u.cal))].map((c) => <span key={c}><Flag code={calFlag(c)} width={16} height={11} /> {calLabel(c)} </span>)}</> : <b>Feriados nos próximos {days} dias</b>}
        {!expanded && first && missing.length > 0 && ' · aviso China'}
      </summary>
      {expanded && !up.length && <p className="status">Nenhum feriado encontrado no período nos calendários disponíveis.</p>}
      {expanded && pracas.includes('CN') && !hol.loaded && <p className="status stale">China: aguardando os dados oficiais; os feriados chineses ainda não estão incluídos na lista.</p>}
      {up.length > 0 && items}
      {note}
    </details>
  )
}
