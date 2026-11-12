import { calLabel, cnMissingYears, nextBusinessDay, offReasons, paymentCalendars } from './holidays.js'

const dm = (s) => s.split('-').reverse().join('/')

// Aviso sob um campo de data: não é dia útil em alguma praça escolhida. Nunca altera a data sozinho; oferece a próxima data comum.
export default function DateCheck({ date, hol, onUse }) {
  if (!date) return null
  const cals = paymentCalendars(hol.pracas)
  const why = offReasons(date, cals, hol.ctx)
  const noData = hol.pracas.includes('CN') && hol.loaded ? cnMissingYears([Number(date.slice(0, 4))], hol.ctx) : []
  if (!why.length && !noData.length) return null
  const next = why.length ? nextBusinessDay(date, cals, hol.ctx) : null
  return (
    <span className="date-check" role="alert">
      {why.length > 0 && (
        <>
          ⚠ {dm(date)} não é dia útil: {why.map((w) => `${calLabel(w.cal)} (${w.name})`).join('; ')}.
          {next && onUse && (
            <>
              {' '}Próximo dia útil comum: {dm(next)}{' '}
              <button type="button" className="link" onClick={() => onUse(next)}>usar</button>
            </>
          )}
        </>
      )}
      {noData.length > 0 && <> China: calendário de {noData.join(', ')} ainda não publicado.</>}
    </span>
  )
}
