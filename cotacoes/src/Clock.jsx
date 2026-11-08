import { useEffect, useState } from 'react'
import { flagSvg } from './flags.js'

// Relógio de cada praça, no fuso do mercado que representa.
// open/close: horário aproximado de negociação local (dias úteis).
export const ZONES = {
  BRL: { flag: 'BRL', city: 'São Paulo', short: 'SP', tz: 'America/Sao_Paulo', open: 9, close: 18 },
  USD: { flag: 'USD', city: 'Nova York', short: 'NY', tz: 'America/New_York', open: 8, close: 17 },
  GBP: { flag: 'GBP', city: 'Londres', short: 'LDN', tz: 'Europe/London', open: 8, close: 17 },
  JPY: { flag: 'JPY', city: 'Tóquio', short: 'TYO', tz: 'Asia/Tokyo', open: 9, close: 17 },
  CNH: { flag: 'CNH', city: 'Xangai', short: 'SHA', tz: 'Asia/Shanghai', open: 9, close: 17 },
}

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(id)
  }, [])
  return now
}

const part = (now, tz, opts) => new Intl.DateTimeFormat('pt-BR', { timeZone: tz, ...opts }).format(now)

export function isUsualTradingTime(now, zone) {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: zone.tz, weekday: 'short' }).format(now)
  if (wd === 'Sat' || wd === 'Sun') return false
  const h = Number(part(now, zone.tz, { hour: '2-digit', hourCycle: 'h23' }))
  return h >= zone.open && h < zone.close
}

function One({ zone, now }) {
  const withinHours = isUsualTradingTime(now, zone)
  const status = `${zone.city} — ${withinHours ? 'dentro' : 'fora'} do horário habitual de negociação. Feriados e horários especiais não verificados.`
  return (
    <span
      className="clock-one"
      role="group"
      title={status}
      aria-label={`${part(now, zone.tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}. ${status}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}
    >
      <span
        aria-hidden="true"
        style={{ width: 7, height: 7, borderRadius: '50%', background: withinHours ? 'var(--up)' : 'var(--mut)', display: 'inline-block' }}
      />
      <span className="clock-flag" aria-hidden="true" style={{ display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: flagSvg(zone.flag, 'width="18" height="12"') }} />
      <b>{part(now, zone.tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</b>
    </span>
  )
}

export default function Clock({ codes: all }) {
  const now = useNow()
  const codes = all.filter((c) => ZONES[c])
  if (!codes.length) return null
  return (
    <div
      className="clock"
      role="timer"
      aria-label={`Horários locais: ${codes.map((c) => ZONES[c].city).join(', ')}`}
      style={{ display: 'flex', flexWrap: 'nowrap', justifyContent: 'space-between', gap: 4, overflow: 'hidden', fontSize: '0.78rem' }}
    >
      {codes.map((c) => (
        <One key={c} zone={ZONES[c]} now={now} />
      ))}
    </div>
  )
}
