import { useEffect, useId, useRef, useState } from 'react'

// The tooltip is shared by the marks in a chart, with a hover bridge and Escape dismissal.
export function useRecoveryMapTooltip() {
  const id = useId()
  const [active, setActive] = useState(null)
  const timer = useRef(null)
  const root = useRef(null)
  const keep = () => clearTimeout(timer.current)
  const hide = () => { keep(); setActive(null) }
  const leave = () => { keep(); timer.current = setTimeout(() => setActive(null), 160) }
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (!active) return
    const key = event => { if (event.key === 'Escape') setActive(null) }
    const outside = event => { if (!root.current?.contains(event.target)) setActive(null) }
    document.addEventListener('keydown', key)
    document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', outside) }
  }, [active])
  const show = value => { keep(); setActive(value) }
  const trigger = (value, activate) => ({
    role:'button', tabIndex:0, 'aria-describedby':active === value ? id : undefined,
    onPointerEnter:event => { if (event.pointerType !== 'touch') show(value) },
    onPointerLeave:event => { if (document.activeElement !== event.currentTarget) leave() },
    onFocus:() => show(value), onBlur:leave,
    onClick:() => { show(value); activate() },
    onKeyDown:event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        if (!event.repeat) { show(value); activate() }
      }
    },
  })
  return { id, active, root, trigger, keep, leave, hide }
}

export default function RecoveryMapTooltip({ tip, label, count, share }) {
  // Sem dica aberta, o mesmo quadro aparece vazio (tracejado): o espaço reservado não fica parecendo um buraco na tela.
  if (!label) return <div className="rj-map-tooltip-space" aria-hidden="true"><div className="rj-map-tooltip rj-map-tooltip-empty">Explore o mapa para ver o nome e a quantidade.</div></div>
  return <div className="rj-map-tooltip-space"><div id={tip.id} className="rj-map-tooltip" role="tooltip"
    onPointerEnter={tip.keep} onPointerLeave={tip.leave}>
    <strong>{label}</strong>
    <span>{new Intl.NumberFormat('pt-BR').format(count)} {count === 1 ? 'menção' : 'menções'} · {share} do recorte</span>
  </div></div>
}
