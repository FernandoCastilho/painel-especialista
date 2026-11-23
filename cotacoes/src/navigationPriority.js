import { APP_SECTIONS } from './appSections.js'
// Visual order is independent of the historical Alt+1…0 contract.
export const DESKTOP_PRIMARY = ['rpn', 'resumo', 'cenarios', 'juros', 'calculadora', 'setores', 'ma', 'noticias', 'podcast']
export const MOBILE_PRIMARY = ['resumo', 'cenarios', 'juros', 'calculadora', 'rpn', 'setores']
export const MORE_GROUPS = [
  { label: 'Acompanhar', ids: ['ma', 'noticias', 'podcast'] },
  { label: 'Consultar', ids: ['bancos', 'feriados', 'novidades'] },
  { label: 'Aprender', ids: ['aprender'] },
]
export const shortcutTitle = id => {
  const index = APP_SECTIONS.filter(t => !t.oculto).findIndex(t => t.id === id)
  return index >= 0 && index < 10 ? 'Alt+' + ((index + 1) % 10) : undefined
}
