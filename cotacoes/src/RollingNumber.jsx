import { useEffect, useRef, useState } from 'react'
import { reduceMotion } from './motion.js'
import { rollPlan } from './rollNumber.js'

const ROLL_MS = 420
const TICK_MS = 900

// Valor de um quadro: na primeira vez aparece pronto; quando muda, rola do antigo ao novo e acende em verde (subiu) ou vermelho (caiu).
// Com "reduzir movimento" ligado, o valor novo entra direto.
export default function RollingNumber({ value, className }) {
  const [shown, setShown] = useState(value)
  const [tick, setTick] = useState(null)
  const prev = useRef(value)
  useEffect(() => {
    const plan = rollPlan(prev.current, value)
    prev.current = value
    if (!plan || reduceMotion() || typeof requestAnimationFrame !== 'function') { setShown(value); return undefined }
    let frame, start
    const step = (now) => {
      start ??= now
      const p = Math.min(1, (now - start) / ROLL_MS)
      setShown(plan.at(p >= 1 ? 1 : 1 - (1 - p) ** 4))
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    setTick(plan.up ? 'up' : 'down')
    const off = setTimeout(() => setTick(null), TICK_MS)
    return () => { cancelAnimationFrame(frame); clearTimeout(off) }
  }, [value])
  return <span className={className} data-tick={tick || undefined}>{shown}</span>
}
