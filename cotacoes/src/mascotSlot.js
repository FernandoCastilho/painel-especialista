// Lugar reservado para a coruja pequena nos cabeçalhos: quem desenha o cabeçalho registra o espaço; a coruja ocupa o que estiver visível.
const slots = new Set(), listeners = new Set()
const emit = () => { for (const fn of listeners) fn() }
export function registerMascotSlot(el) {
  if (!el) return () => {}
  slots.add(el); emit()
  return () => { slots.delete(el); emit() }
}
export const currentMascotSlot = () => [...slots].find((el) => el.isConnected && el.getClientRects().length > 0) ?? null
export function subscribeMascotSlot(fn) { listeners.add(fn); return () => listeners.delete(fn) }
