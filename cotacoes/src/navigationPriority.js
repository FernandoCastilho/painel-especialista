import { APP_SECTIONS } from './appSections.js'
// Visual order is independent of the historical Alt+1…0 contract.
export const DESKTOP_PRIMARY = ['resumo', 'cenarios', 'calculadora', 'setores', 'noticias', 'podcast']
export const MOBILE_PRIMARY = ['resumo', 'cenarios', 'calculadora', 'setores']
export const MORE_GROUPS = [
  { label: 'Acompanhar', ids: ['juros', 'noticias', 'podcast'] },
  { label: 'Consultar', ids: ['bancos', 'feriados'] },
  { label: 'Aprender', ids: ['aprender'] },
]
export const shortcutTitle = id => {
  const index = APP_SECTIONS.filter(t => !t.oculto).findIndex(t => t.id === id)
  return index >= 0 && index < 10 ? 'Alt+' + ((index + 1) % 10) : undefined
}
