import { useEffect, useRef } from 'react'
import { registerMascotSlot } from './mascotSlot.js'

// Espaço do cabeçalho onde a coruja pequena se encaixa (não cobre título, relógio nem botões).
export default function MascotSlot({ className = '' }) {
  const ref = useRef(null)
  useEffect(() => registerMascotSlot(ref.current), [])
  return <span ref={ref} className={`mascot-slot ${className}`.trim()} />
}
