import { useLayoutEffect, useRef } from 'react'

// Ajuste: a peça do painel é desenhada numa largura própria e ampliada (ou reduzida) por inteiro até ocupar o corpo do slide.
// Assim o gráfico fica grande como num slide, com as letras na mesma proporção, sem mudar a peça original.
// A medida é refeita quando o conteúdo muda de tamanho (dados que chegam, campos digitados).
// `rolar`: o conteúdo pode passar da área e rolar (campos das calculadoras), em vez de ser reduzido até caber.
export default function Ajuste({ children, min = 0.45, max = 2.4, rolar = false }) {
  const caixa = useRef(null), miolo = useRef(null)
  useLayoutEffect(() => {
    const c = caixa.current, m = miolo.current
    if (!c || !m || typeof ResizeObserver === 'undefined') return
    let z = 1, passos = 0, quadro = 0, pausa = 0
    const aplicar = () => { m.style.width = `${c.clientWidth / z}px`; m.style.transform = `scale(${z})` }
    const medir = () => {
      const W = c.clientWidth, H = c.clientHeight, h = m.offsetHeight
      if (!W || !H || !h) return
      let alvo = Math.min(max, Math.max(min, H / h))
      if (m.scrollWidth > m.clientWidth + 1) alvo = Math.min(alvo, Math.max(min, (z * m.clientWidth) / m.scrollWidth))
      // Ampliar só nos primeiros passos; reduzir sempre (nunca deixar o conteúdo cortado por uma oscilação).
      if (alvo > z && (passos >= 5 || (alvo - z) / z < 0.01)) return
      if (alvo === z) return
      z = alvo < z ? alvo * 0.995 : alvo // ao reduzir, uma pequena folga evita corte por arredondamento
      passos++
      aplicar()
    }
    const agendar = () => {
      cancelAnimationFrame(quadro)
      quadro = requestAnimationFrame(() => { quadro = requestAnimationFrame(medir) })
      clearTimeout(pausa); pausa = setTimeout(() => { passos = 0 }, 600)
    }
    aplicar(); agendar()
    const ro = new ResizeObserver(agendar)
    ro.observe(m); ro.observe(c)
    return () => { ro.disconnect(); cancelAnimationFrame(quadro); clearTimeout(pausa) }
  }, [min, max])
  // Ao deixar de rolar (saída do modo Dados), volta ao topo: a caixa sem rolagem guardaria a posição e cortaria o conteúdo.
  useLayoutEffect(() => { if (!rolar && caixa.current) caixa.current.scrollTop = caixa.current.scrollLeft = 0 }, [rolar])
  return <div className={`sl-ajuste${rolar ? ' sl-ajuste-rolar' : ''}`} ref={caixa}><div className="sl-miolo" ref={miolo}>{children}</div></div>
}
