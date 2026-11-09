import { GLOSSARY } from './glossary.js'

// Routes identify an existing owning area, not a fabricated glossary deep link.
// Entries without a verified current renderer remain readable in graph details.
const ROUTES = {
  mercadoHoje: ['resumo', '', 'Resumo.jsx: Explain mercadoHoje'],
  faixaJuros: ['resumo', '', 'Resumo.jsx: Explain faixaJuros'],
  historico: ['resumo', '', 'App.jsx: HistoryChart in currency sheet; open a currency chart'],
  paridade: ['resumo', '', 'App.jsx: ParityChart in PAR sheet; open the parity chart'],
  selic: ['juros', '', 'Macro.jsx: help selic'],
  cdi: ['juros', '', 'Macro.jsx: help cdi'],
  estr: ['juros', '', 'Macro.jsx: help estr'],
  curvaDi: ['juros', '', 'Curves.jsx: CurveChart help curvaDi'],
  curvaEuro: ['juros', '', 'Curves.jsx: CurveChart help curvaEuro'],
  periodosDi: ['juros', '', 'Curves.jsx: periodHelp mapping curvaDi'],
  periodosCupom: ['juros', '', 'Curves.jsx: periodHelp mapping cupom'],
  periodosUst: ['juros', '', 'Curves.jsx: periodHelp mapping treasuries'],
  periodosEuro: ['juros', '', 'Curves.jsx: periodHelp mapping curvaEuro'],
  treasuries: ['juros', '', 'Curves.jsx: CurveChart help treasuries'],
  cdiFuturo: ['juros', '', 'CdiFuturo.jsx: Explain cdiFuturo; App.jsx juros'],
  tr: ['cenarios', 'indexadores', 'Indexadores.jsx: dynamic lower-case INDEX_KEYS; App.jsx cenarios/indexadores'],
  tbf: ['cenarios', 'indexadores', 'Indexadores.jsx: dynamic lower-case INDEX_KEYS; App.jsx cenarios/indexadores'],
  tlp: ['cenarios', 'indexadores', 'Indexadores.jsx: dynamic lower-case INDEX_KEYS; App.jsx cenarios/indexadores'],
  noticias: ['noticias', '', 'News.jsx: Explain noticias'],
}
const CONCEPTS = { sofr: 'sofr', cupom: 'cupom-cambial', focus: 'focus' }

export const KNOWLEDGE_GLOSSARY = Object.entries(GLOSSARY).map(([key, entry]) => {
  const conceptId = CONCEPTS[key]
  const target = ROUTES[key]
  const route = conceptId ? { tab: 'aprender', view: conceptId } : target ? { tab: target[0], view: target[1] } : undefined
  const body = [entry.a, entry.b && `Exemplo: ${entry.b}`, entry.c && `Na prática: ${entry.c}`, entry.d, entry.l].filter(Boolean).join('\n\n')
  return {
    key,
    nodeId: conceptId ? `concept:${conceptId}` : `glossary:${key}`,
    ...(conceptId ? { conceptId } : {}),
    label: entry.t,
    summary: entry.a,
    body,
    ...(route ? { route } : {}),
    routeStatus: route ? 'verified' : 'unavailable',
    routeEvidence: conceptId ? `educacao.js: CONCEITOS ${conceptId}; Aprender.jsx` : target?.[2] || 'Texto disponível no glossário do código; destino específico atual não confirmado.',
  }
})
