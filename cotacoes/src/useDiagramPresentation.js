import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export function useDiagramPresentation(historyKey, resetScrollOnDesktop = false) {
  const [paused, setPaused] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [scale, setScale] = useState(1)
  const figureRef = useRef(null)
  const maximizeRef = useRef(null)
  const dialogRef = useRef(null)
  const wasExpanded = useRef(false)
  useLayoutEffect(() => {
    if (!expanded) return
    const fit = () => {
      const figure = figureRef.current
      if (figure) {
        if (resetScrollOnDesktop && window.innerWidth > 600) figure.parentElement.scrollTop = 0
        setScale(Math.min((window.innerWidth - 24) / figure.offsetWidth, (window.innerHeight - 72) / figure.offsetHeight, 1.5))
      }
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(figureRef.current)
    window.addEventListener('resize', fit)
    return () => { observer.disconnect(); window.removeEventListener('resize', fit) }
  }, [expanded, resetScrollOnDesktop])
  useEffect(() => {
    if (!expanded) {
      if (wasExpanded.current) maximizeRef.current?.focus()
      wasExpanded.current = false
      return
    }
    wasExpanded.current = true
    window.history.pushState({ ...window.history.state, [historyKey]: true }, '')
    const onBack = () => setExpanded(false)
    window.addEventListener('popstate', onBack)
    const appRoot = document.getElementById('root')
    const previousInert = appRoot?.inert
    if (appRoot) appRoot.inert = true
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusLaser = () => dialogRef.current?.querySelector('.laser-btn')?.focus()
    dialogRef.current?.focus()
    const focusObserver = new MutationObserver(() => {
      if (dialogRef.current?.querySelector('.laser-btn')) { focusLaser(); focusObserver.disconnect() }
    })
    focusObserver.observe(dialogRef.current, { childList: true, subtree: true })
    focusLaser()
    const onKey = event => {
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); setExpanded(false) }
      if (event.key === 'Tab') { event.preventDefault(); focusLaser() }
      if (event.key.toLowerCase() === 'p' && !event.ctrlKey && !event.altKey && !event.metaKey) { event.preventDefault(); setPaused(value => !value) }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      focusObserver.disconnect()
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      if (appRoot) appRoot.inert = previousInert
      window.removeEventListener('popstate', onBack)
      if (window.history.state?.[historyKey]) window.history.back()
    }
  }, [expanded, historyKey])
  return { paused, setPaused, expanded, setExpanded, scale, figureRef, maximizeRef, dialogRef }
}
