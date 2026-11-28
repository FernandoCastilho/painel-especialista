import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ExpandIcon from './ExpandIcon.jsx'
import { useFiltros } from './ChartFilters.jsx'
import './ChartFullscreen.css'

// O host do portal permanece o mesmo ao mudar de lugar. Não remonta o gráfico,
// preservando filtros, seleções e tooltips. O dialog nativo isola foco e fundo.
// Os filtros do mesmo escopo (período e escala) sobem junto para o topo da tela cheia.
// Para sair: Esc duas vezes (a primeira só avisa, para não fechar sem querer). Em tela de toque, sem tecla Esc, fica o botão Fechar.
const ESC_JANELA = 2500
export default function ChartFullscreen({ children, disabled = false, compact = false }) {
  const [expanded, setExpanded] = useState(false)
  const filtros = useFiltros()
  const [host] = useState(() => typeof document === 'undefined' ? null : document.createElement('div'))
  const inline = useRef(null), dialog = useRef(null), button = useRef(null), primeiroEsc = useRef(0)
  const [aviso, setAviso] = useState(false)
  useLayoutEffect(() => {
    if (!aviso) return undefined
    const id = setTimeout(() => setAviso(false), ESC_JANELA)
    return () => clearTimeout(id)
  }, [aviso])
  // 1º Esc arma e avisa; 2º Esc dentro da janela sai
  const esc = () => {
    const agora = Date.now()
    if (agora - primeiroEsc.current < ESC_JANELA) { primeiroEsc.current = 0; setAviso(false); setExpanded(false) }
    else { primeiroEsc.current = agora; setAviso(true) }
  }
  useLayoutEffect(() => {
    if (disabled || !host) return
    const origin = inline.current, modal = dialog.current, trigger = button.current
    const overflow = document.body.style.overflow
    if (expanded) {
      if (filtros) modal.appendChild(filtros.host)
      modal.appendChild(host)
      modal.showModal()
      document.body.style.overflow = 'hidden'
    } else origin.appendChild(host)
    const close = () => setExpanded(false)
    window.addEventListener('hashchange', close)
    return () => {
      window.removeEventListener('hashchange', close)
      if (expanded) {
        modal.close()
        origin.appendChild(host)
        if (filtros?.inline.isConnected) filtros.inline.appendChild(filtros.host)
        document.body.style.overflow = overflow
        queueMicrotask(() => trigger?.focus())
      }
    }
  }, [expanded, disabled, host, filtros])
  if (disabled || !host) return children
  const keepEscapeInside = event => { if (expanded && event.key === 'Escape') event.stopPropagation() }
  const content = <>
    <div className="chart-fullscreen-toolbar" onKeyDown={keepEscapeInside}><button ref={button} type="button" className={expanded ? 'btn-sair' : 'btn-expand'} aria-label={expanded ? 'Fechar gráfico maximizado' : 'Maximizar gráfico'} title={expanded ? undefined : 'Ampliar'} aria-expanded={expanded} onClick={event => { event.stopPropagation(); setExpanded(value => !value) }}>{expanded ? 'Fechar ×' : <ExpandIcon />}</button></div>
    <div className="chart-fullscreen-content" onKeyDown={keepEscapeInside}>{children}</div>
    {expanded && <p className={'chart-fullscreen-esc' + (aviso ? ' is-armado' : '')} role="status">{aviso ? 'Aperte Esc de novo para sair' : 'Esc duas vezes para sair'}</p>}
  </>
  return <>
    <div ref={inline} className={'chart-fullscreen' + (compact ? ' chart-fullscreen-compact' : '')} />
    <dialog ref={dialog} className="chart-fullscreen is-expanded" aria-label="Gráfico maximizado" onCancel={event => { event.preventDefault(); event.stopPropagation(); esc() }} onClose={() => { if (expanded) setExpanded(false) }} onKeyDown={event => {
      // O alvo trata primeiro Escape (por exemplo, limpa a seleção). Não o
      // cancelamos aqui: sem seleção, o navegador dispara cancel no dialog.
      if (event.key === 'Escape') event.stopPropagation()
    }} />
    {createPortal(content, host)}
  </>
}
