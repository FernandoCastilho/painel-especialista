import { useEffect, useState } from 'react'
import { ZONES } from './Clock.jsx'
import Flag from './Flag.jsx'
import { OnlineBadge } from './Acessos.jsx'
import { DESK_TABS } from './terminal.js'
import ThemeControl from './ThemeControl.jsx'
import { AvisosButton } from './Avisos.jsx'
import MascotSlot from './MascotSlot.jsx'
import './TopBar.css'
import Nav from './Nav.jsx'

const CLOCKS = [
  ['BRL', 'BRT'],
  ['USD', 'NYC'],
  ['GBP', 'LDN'],
  ['JPY', 'TYO'],
]
const STATE_TEXT = { ok: 'Dados', delayed: 'Dado antigo', idle: 'Fora do hor�rio de coleta', err: 'Sem atualiza��o', loading: 'Carregando' }

const part = (now, tz, opts) => new Intl.DateTimeFormat('pt-BR', { timeZone: tz, hourCycle: 'h23', ...opts }).format(now)

function Clocks() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="topbar-clocks" role="timer" aria-label="Hor�rios de S�o Paulo, Nova York, Londres e T�quio">
      {CLOCKS.map(([code, short], i) => (
        <span key={code} className={i === 2 ? 'topbar-clock opt' : 'topbar-clock'} title={ZONES[code].city}>
          <Flag code={ZONES[code].flag} width={13} height={9} className="topbar-clock-flag" />
          <b>{short}</b>
          {part(now, ZONES[code].tz, { hour: '2-digit', minute: '2-digit', ...(code === 'BRL' ? { second: '2-digit' } : {}) })}
        </span>
      ))}
    </div>
  )
}

// Barra superior do terminal (computador): marca, se��es, rel�gios e estado dos dados.
// Atalho: Alt+1 a Alt+9 (e Alt+0 para a 10�) trocam de se��o (as teclas F1 a F12 ficam com o navegador).
export default function TopBar({ tab, onTab, feed, feedAt, feedLabel, feedTitle, focusMode, onToggleFocus }) {
  useEffect(() => {
    if (focusMode) return undefined
    const onKey = (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && /^[0-9]$/.test(e.key)) {
        e.preventDefault()
        { const vis = DESK_TABS.filter((t) => !t.oculto); onTab(vis[(Number(e.key) + 9) % 10]?.id ?? vis[0].id) }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onTab, focusMode])

  const focusLabel = focusMode ? 'Sair da tela cheia' : 'Ativar tela cheia'

  return (
    <div className="topbar">
      <div className="topbar-brand" title="Painel Especializado no Mercado">
        <abbr title="Painel Especializado no Mercado" style={{ textDecoration: 'none', cursor: 'help' }}>PME</abbr>
      </div>
      <Nav desktop tab={tab} onTab={onTab} />
      <Clocks />
      <OnlineBadge />
      <div className={`topbar-feed ${feed}`} role="status" title={feedTitle || 'Estado das refer�ncias de c�mbio'}>
        <span aria-hidden="true" />
        {feedLabel || STATE_TEXT[feed]}
        {feedAt && feed !== 'loading' && <b>{feedAt}</b>}
      </div>
      <ThemeControl />
      <AvisosButton className="topbar-info" />
      <span className="laser-slot laser-slot-top" />
      <MascotSlot className="mascot-slot-top" />
      <button type="button" className="focus-mode-toggle" aria-controls="conteudo" aria-label={focusLabel} aria-pressed={focusMode} title={focusLabel} onClick={onToggleFocus}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d={focusMode ? 'M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5' : 'M4 9V4h5m11 5V4h-5M4 15v5h5m11-5v5h-5'} />
        </svg>
      </button>
    </div>
  )
}
