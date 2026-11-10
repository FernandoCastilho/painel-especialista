import { useEffect, useState } from 'react'
import { ZONES } from './Clock.jsx'
import { OnlineBadge } from './Acessos.jsx'
import { DESK_TABS } from './terminal.js'
import ThemeControl from './ThemeControl.jsx'
import { AvisosButton } from './Avisos.jsx'
import './TopBar.css'

const CLOCKS = [
  ['BRL', 'BRT'],
  ['USD', 'NYC'],
  ['GBP', 'LDN'],
  ['JPY', 'TYO'],
]
const STATE_TEXT = { ok: 'Dados', delayed: 'Dado antigo', err: 'Sem atualização', loading: 'Carregando' }

const part = (now, tz, opts) => new Intl.DateTimeFormat('pt-BR', { timeZone: tz, hourCycle: 'h23', ...opts }).format(now)

function Clocks() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="topbar-clocks" role="timer" aria-label="Horários de São Paulo, Nova York, Londres e Tóquio">
      {CLOCKS.map(([code, short], i) => (
        <span key={code} className={i === 2 ? 'opt' : undefined} title={ZONES[code].city}>
          <b>{short}</b>
          {part(now, ZONES[code].tz, { hour: '2-digit', minute: '2-digit', ...(code === 'BRL' ? { second: '2-digit' } : {}) })}
        </span>
      ))}
    </div>
  )
}

// Barra superior do terminal (computador): marca, seções, relógios e estado dos dados.
// Atalho: Alt+1 a Alt+9 (e Alt+0 para a 10ª) trocam de seção (as teclas F1 a F12 ficam com o navegador).
export default function TopBar({ tab, onTab, feed, feedAt, feedLabel, feedTitle }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && /^[0-9]$/.test(e.key)) {
        e.preventDefault()
        { const vis = DESK_TABS.filter((t) => !t.oculto); onTab(vis[(Number(e.key) + 9) % 10]?.id ?? vis[0].id) }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onTab])

  return (
    <div className="topbar">
      <div className="topbar-brand" title="Painel Especializado no Mercado">
        <abbr title="Painel Especializado no Mercado" style={{ textDecoration: 'none', cursor: 'help' }}>PEME</abbr>
      </div>
      <nav className="topbar-tabs" aria-label="Navegação principal">
        {DESK_TABS.filter((t) => !t.oculto).map((t, i) => (
          <button key={t.id} type="button" className={t.id === tab ? 'on' : ''} aria-current={t.id === tab ? 'page' : undefined} onClick={() => onTab(t.id)} title={`Alt+${(i + 1) % 10}`}>
            <i aria-hidden="true">{i + 1}</i>
            {t.label}
          </button>
        ))}
      </nav>
      <Clocks />
      <OnlineBadge />
      <div className={`topbar-feed ${feed}`} role="status" title={feedTitle || 'Estado das referências de câmbio'}>
        <span aria-hidden="true" />
        {feedLabel || STATE_TEXT[feed]}
        {feedAt && feed !== 'loading' && <b>{feedAt}</b>}
      </div>
      <ThemeControl />
      <AvisosButton className="topbar-info" />
      <span className="laser-slot laser-slot-top" />
    </div>
  )
}
