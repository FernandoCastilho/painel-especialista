// Layout only. Short windows fall back to document/dialog scrolling, never hide content.
export function marketNewsHeight({ width, height, top, bottom = height }) {
  if (width < 1000) return null
  const available = Math.floor(Math.min(height, bottom) - Math.max(0, top) - 24)
  return available >= 180 ? available : null
}
export function observeMarketNewsHeight(element, win = window) {
  let frame
  const update = () => {
    frame = undefined
    const viewport = win.visualViewport
    const dialog = element.closest('dialog.is-dialog')
    const height = viewport?.height ?? win.innerHeight
    const top = element.getBoundingClientRect().top - (viewport?.offsetTop ?? 0)
    const bottom = dialog ? dialog.getBoundingClientRect().bottom - (viewport?.offsetTop ?? 0) : height
    const next = marketNewsHeight({ width: win.innerWidth, height, top, bottom })
    if (next === null) element.style.removeProperty('--market-news-height')
    else element.style.setProperty('--market-news-height', `${next}px`)
  }
  const schedule = () => { if (frame === undefined) frame = win.requestAnimationFrame(update) }
  const resize = new win.ResizeObserver(schedule)
  for (let node = element; node; node = node.parentElement) resize.observe(node)
  const dialog = element.closest('dialog')
  const mutation = new win.MutationObserver(schedule)
  if (dialog) mutation.observe(dialog, { attributes: true, attributeFilter: ['class', 'open', 'style'] })
  win.addEventListener('resize', schedule)
  win.addEventListener('scroll', schedule, true) // Includes internal dialog scrolling.
  win.visualViewport?.addEventListener('resize', schedule)
  win.visualViewport?.addEventListener('scroll', schedule)
  update()
  return () => {
    if (frame !== undefined) win.cancelAnimationFrame(frame)
    resize.disconnect(); mutation.disconnect()
    win.removeEventListener('resize', schedule)
    win.removeEventListener('scroll', schedule, true)
    win.visualViewport?.removeEventListener('resize', schedule)
    win.visualViewport?.removeEventListener('scroll', schedule)
    element.style.removeProperty('--market-news-height')
  }
}
