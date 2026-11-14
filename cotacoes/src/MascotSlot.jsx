import { useLayoutEffect, useRef } from 'react'
import { registerMascotSlot } from './mascotSlot.js'

// Espaço do cabeçalho onde a coruja pequena se encaixa (não cobre título, relógio nem botões).
export default function MascotSlot({ className = '' }) {
  const ref = useRef(null)
  useLayoutEffect(() => registerMascotSlot(ref.current), []) // antes da primeira pintura: a coruja já nasce no lugar
  return <span ref={ref} className={`mascot-slot ${className}`.trim()} />
}
