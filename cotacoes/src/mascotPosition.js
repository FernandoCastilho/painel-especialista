export const MASCOT_PREFERENCE_KEY = 'painel.mascot.ui.v1'
export const MASCOT_SIZE = { width: 144, height: 228 }
export function clampMascot(position, width, height, topInset = 8) {
  const maxX = Math.max(8, width - MASCOT_SIZE.width - 8)
  const maxY = Math.max(8, height - MASCOT_SIZE.height - 8)
  const minY = Math.min(maxY, Math.max(8, topInset))
  return { x: Math.min(maxX, Math.max(8, Number.isFinite(position?.x) ? position.x : maxX)), y: Math.min(maxY, Math.max(minY, Number.isFinite(position?.y) ? position.y : maxY)) }
}
export function readMascotPreferences(storage) {
  try {
    const value = JSON.parse(storage.getItem(MASCOT_PREFERENCE_KEY))
    return { hidden: value?.hidden === true, desktop: Number.isFinite(value?.desktop?.x) && Number.isFinite(value?.desktop?.y) ? { x: value.desktop.x, y: value.desktop.y } : null }
  } catch { return { hidden: false, desktop: null } }
}
