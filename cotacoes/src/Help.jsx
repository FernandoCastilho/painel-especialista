import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Ícone "?" com explicação: abre ao passar o mouse, ao focar pelo teclado ou ao tocar/clicar (fixa).
// `fixed`: o balão sai do contêiner (portal no corpo da página) e se posiciona pela janela, para não ser cortado nem ficar atrás de células de uma tabela com rolagem.
export default function Help({ label, align = 'left', wide = false, fixed = false, portalTarget, children }) {
  const [pinned, setPinned] = useState(false)
  const [hover, setHover] = useState(false)
  const ref = useRef(null)
  const id = useId()
  // foco dentro do balão (ex.: campo da calculadora da Finimp) o mantém aberto, mesmo se o mouse sair dele
  const [focusIn, setFocusIn] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const show = !dismissed && (pinned || hover || focusIn)
  const popRef = useRef(null)
  const mobile = typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 560px)').matches
  const [shift, setShift] = useState(0)
  const [pos, setPos] = useState(null)
  // Balões longos ("wide", ex.: gráficos com "Como ler") também flutuam pela janela, como os de tabela.
  const floating = (fixed || wide) && !mobile
  // O balão flutuante fica fora do "?": um intervalo curto deixa o mouse atravessar até ele sem fechar.
  const leaveTimer = useRef(null)
  const enter = () => { clearTimeout(leaveTimer.current); setDismissed(false); setHover(true) }
  const leave = () => { clearTimeout(leaveTimer.current); leaveTimer.current = setTimeout(() => setHover(false), floating ? 220 : 0) }
  useEffect(() => () => clearTimeout(leaveTimer.current), [])
  // um balão aberto por vez: abrir outro "?" fecha este na hora (sem esperar o intervalo de saída)
  useEffect(() => {
    if (!show) return
    window.dispatchEvent(new CustomEvent('help-open', { detail: id }))
    const other = (e) => { if (e.detail !== id) { clearTimeout(leaveTimer.current); setHover(false); setPinned(false); setFocusIn(false) } }
    window.addEventListener('help-open', other)
    return () => window.removeEventListener('help-open', other)
  }, [show, id])

  // Mantém o balão dentro da janela (perto da borda direita ou esquerda ele deslocava para fora da tela).
  useLayoutEffect(() => {
    if (floating) return
    if (!show || !popRef.current) return setShift(0)
    const r = popRef.current.getBoundingClientRect()
    const base = r.left - shift
    const w = r.width
    const max = window.innerWidth - 8
    setShift(base + w > max ? max - (base + w) : base < 8 ? 8 - base : 0)
  }, [show]) // eslint-disable-line react-hooks/exhaustive-deps

  // Balão "fixed" (tabelas e gráficos): portal no corpo da página, ao lado do "?", sem rolagem interna. Começa estreito e alarga
  // (formato retangular, deitado) até caber inteiro na altura da janela; prefere a direita do botão, depois a esquerda, e só então
  // embaixo/em cima. Fecha ao rolar a página.
  useLayoutEffect(() => {
    if (!floating || !show || !ref.current || !popRef.current) return setPos(null)
    const el = popRef.current, b = ref.current.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight, room = vh - 16
    const maxW = Math.max(240, vw - 16)
    let w = Math.min(el.offsetWidth || 290, maxW), h
    for (const cand of [w, 420, 520, 640, 760, 900, maxW]) {
      w = Math.min(cand, maxW)
      el.style.width = `${w}px`
      h = el.offsetHeight
      if (h <= Math.min(room, 440)) break // deitado: alarga até ficar baixo (ou até a largura máxima)
    }
    const right = vw - 8 - (b.right + 8), leftRoom = b.left - 8 - 8
    let left
    if (w <= right) left = b.right + 8
    else if (w <= leftRoom) left = b.left - 8 - w
    else left = Math.min(Math.max(8, b.left - 8), Math.max(8, vw - w - 8))
    const side = w <= right || w <= leftRoom
    let top
    if (side) top = Math.min(Math.max(8, b.top + b.height / 2 - h / 2), Math.max(8, vh - 8 - h)) // ao lado, centralizado no botão
    else top = b.bottom + 6 + h <= vh - 8 ? b.bottom + 6 : b.top - 6 - h >= 8 ? b.top - 6 - h : Math.max(8, vh - 8 - h)
    setPos({ top, left, width: w })
  }, [show, floating])
  useEffect(() => {
    if (!floating || !show) return
    const close = () => { setHover(false); setPinned(false); setFocusIn(false) }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close) }
  }, [floating, show])

  useEffect(() => {
    if (!pinned) return
    const onDown = (e) => !ref.current?.contains(e.target) && !popRef.current?.contains(e.target) && setPinned(false)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('pointerdown', onDown)
    }
  }, [pinned])

  useEffect(() => {
    if (!show) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      clearTimeout(leaveTimer.current)
      setDismissed(true)
      setPinned(false)
      setHover(false)
      setFocusIn(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [show])

  const pop = (
        <span role="tooltip" id={id} ref={popRef} className={`pop ${align}${wide ? ' wide' : ''}`} style={floating ? { position: 'fixed', zIndex: 70, top: pos?.top ?? -9999, left: pos?.left ?? 0, right: 'auto', maxWidth: 'none', ...(pos?.width ? { width: pos.width } : {}) } : shift ? { transform: `translateX(${shift}px)` } : undefined}
          onPointerEnter={floating ? enter : undefined} onPointerLeave={floating ? leave : undefined}
          onFocus={() => setFocusIn(true)} onBlur={(e) => { if (!popRef.current?.contains(e.relatedTarget)) setFocusIn(false) }}>
          {children}
          {(pinned || fixed) && mobile && <button type="button" className="pop-close" onClick={() => { setPinned(false); setHover(false); setFocusIn(false) }}>Fechar</button>}
        </span>
  )

  return (
    <span
      className="help"
      ref={ref}
      onPointerEnter={(e) => e.pointerType === 'mouse' && enter()}
      onPointerLeave={leave}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={show}
        aria-describedby={show ? id : undefined}
        onClick={() => { setDismissed(false); setPinned((p) => !p) }}
        onFocus={() => { setDismissed(false); setHover(true) }}
        onBlur={() => setHover(false)}
      >
        ?
      </button>
      {/* no celular o balão vira uma folha fixa na base da tela: vai para o corpo da página, senão a coluna fixa (sticky) das
          linhas de baixo de uma tabela fica por cima dele */}
      {show && pinned && mobile && createPortal(<span className="pop-backdrop" onClick={() => setPinned(false)} aria-hidden="true" />, portalTarget || document.body)}
      {show && (floating || mobile ? createPortal(pop, portalTarget || document.body) : pop)}
    </span>
  )
}
