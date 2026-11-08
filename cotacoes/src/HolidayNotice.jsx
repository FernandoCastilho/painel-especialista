import { calFlag, calLabel, cnMissingYears, upcomingHolidays } from './holidays.js'
import Flag from './Flag.jsx'
import { marketDate } from './marketReturns.js'

const today = () => marketDate(Date.now())
const dm = (s) => s.split('-').reverse().join('/')
// "02/11/2026 (em 5 dias)", "(hoje)" ou "(amanhã)": a data e quanto falta.
const when = (d, t) => {
  const diff = Math.round((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${t}T12:00:00Z`)) / 864e5)
  return `${dm(d)} (${diff === 0 ? 'hoje' : diff === 1 ? 'amanhã' : `em ${diff} dias`})`
}

// Aviso de feriados nas praças escolhidas (próximos dias) e de calendário chinês ainda não publicado.
export default function HolidayNotice({ hol, days = 30, list = false }) {
  const t = today()
  const up = upcomingHolidays(t, days, hol.pracas, hol.ctx)
  const y = Number(t.slice(0, 4))
  const missing = hol.pracas.includes('CN') && hol.loaded ? cnMissingYears([y, y + 1], hol.ctx) : []
  if (!up.length && !missing.length) return list ? <p className="status">Nenhum feriado nas praças escolhidas nos próximos {days} dias.</p> : null
  const items = (
    <ul>
      {up.map((u) => (
        <li key={u.date + u.cal}>
          <b>{when(u.date, t)}</b> · feriado em <Flag code={calFlag(u.cal)} width={16} height={11} /> <b>{calLabel(u.cal)}</b>: {u.name}
          {u.cal === 'NY' && ' (sem liquidação em USD)'}
        </li>
      ))}
    </ul>
  )
  const note = missing.length > 0 && (
    <p className="status stale">
      China: o calendário oficial de {missing.join(' e ')} ainda não foi publicado pelo governo (costuma sair em novembro). Esses anos aparecem só com fins de semana; confira antes de fechar datas.
    </p>
  )
  if (list) return <div className="holiday-notice" role="status">{up.length > 0 && items}{note}</div>
  // Resumo: uma linha com o primeiro dia de feriado e as praças; o resto fica recolhido
  const first = up[0]
  const dates = new Set(up.map((u) => u.date)).size
  return (
    <details className="holiday-notice compact">
      <summary>
        {first ? <><b>Feriados nos próximos {days} dias</b> · {dates} {dates === 1 ? 'data' : 'datas'} · primeiro: <b>{when(first.date, t)}</b> em {[...new Set(up.filter((u) => u.date === first.date).map((u) => u.cal))].map((c) => <span key={c}><Flag code={calFlag(c)} width={16} height={11} /> {calLabel(c)} </span>)}</> : 'Calendário da China: ano ainda não publicado'}
        {first && missing.length > 0 && ' · aviso China'}
      </summary>
      {up.length > 0 && items}
      {note}
    </details>
  )
}
