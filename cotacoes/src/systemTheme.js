// The saved choice overrides the OS; without one, the panel stays automatic.
export const THEME_QUERY = '(prefers-color-scheme: light)'
export const THEME_COLORS = { dark: '#050505', light: '#f3f3f1' }
export const THEME_STORAGE_KEY = 'painel-theme'
export const THEME_EVENT = 'painel-theme-change'
const sessionChoices = new WeakMap()
// Tema imposto por uma tela enquanto ela está aberta (Apresentar é sempre clara). Não altera a escolha salva.
const overrides = new WeakMap()
const normalize = value => value === 'light' || value === 'dark' ? value : 'system'

export function readSystemTheme(target = globalThis) {
  return target.matchMedia?.(THEME_QUERY).matches ? 'light' : 'dark'
}

export function readThemePreference(target = globalThis) {
  if (sessionChoices.has(target)) return sessionChoices.get(target)
  try { return normalize(target.localStorage?.getItem(THEME_STORAGE_KEY)) } catch { return 'system' }
}

export function readTheme(target = globalThis) {
  if (overrides.has(target)) return overrides.get(target)
  const preference = readThemePreference(target)
  return preference === 'system' ? readSystemTheme(target) : preference
}

export function setThemePreference(value, target = globalThis) {
  const preference = normalize(value)
  // Keep the control usable for this visit even if storage is blocked or full.
  sessionChoices.set(target, preference)
  try {
    if (preference === 'system') target.localStorage?.removeItem(THEME_STORAGE_KEY)
    else target.localStorage?.setItem(THEME_STORAGE_KEY, preference)
  } catch { /* The choice still applies in memory. */ }
  target.dispatchEvent?.(new Event(THEME_EVENT))
}

// 'light' ou 'dark' impõe o tema; qualquer outro valor devolve o painel à escolha do usuário.
export function setThemeOverride(value, target = globalThis) {
  if (value === 'light' || value === 'dark') overrides.set(target, value)
  else overrides.delete(target)
  target.dispatchEvent?.(new Event(THEME_EVENT))
}

export function subscribeSystemTheme(onChange, target = globalThis) {
  const media = target.matchMedia?.(THEME_QUERY)
  if (!media) return () => {}
  const changed = () => onChange()
  if (media.addEventListener) {
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }
  media.addListener?.(changed)
  return () => media.removeListener?.(changed)
}

export function subscribeTheme(onChange, target = globalThis) {
  const changed = () => onChange()
  const stored = event => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return
    // Ignore unrelated storage areas; clearing local storage restores automatic.
    try { if (event.storageArea && event.storageArea !== target.localStorage) return } catch { return }
    sessionChoices.delete(target)
    onChange()
  }
  const stopSystem = subscribeSystemTheme(changed, target)
  target.addEventListener?.(THEME_EVENT, changed)
  target.addEventListener?.('storage', stored)
  return () => {
    stopSystem()
    target.removeEventListener?.(THEME_EVENT, changed)
    target.removeEventListener?.('storage', stored)
  }
}

export function connectSystemTheme(target = globalThis, doc = globalThis.document) {
  const apply = () => {
    const theme = readTheme(target)
    doc.documentElement.dataset.theme = theme
    doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
  }
  apply()
  return subscribeTheme(apply, target)
}
