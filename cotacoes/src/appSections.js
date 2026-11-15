// Catálogo único: rótulos curtos do terminal e rotas ocultas são intencionais.
export const APP_SECTIONS = [
  { id: 'resumo', label: 'Mercado hoje', terminalLabel: 'Mercado', icon: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M14.5 9.5c-.4-1-1.3-1.5-2.5-1.5-1.4 0-2.5.7-2.5 1.8 0 2.4 5 1.2 5 3.6 0 1.1-1.1 1.8-2.5 1.8-1.3 0-2.2-.6-2.6-1.6', 'M12 6.5V8M12 16v1.5'] },
  { id: 'juros', label: 'Juros', icon: ['M5 20V11', 'M12 20V5', 'M19 20v-6'] },
  { id: 'cenarios', label: 'Cenários', icon: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'] },
  { id: 'noticias', label: 'Notícias', icon: ['M6 3h9l4 4v14H6z', 'M14 3v5h5', 'M9 12h6M9 16h6'] },
  { id: 'bndes', label: 'BNDES', icon: ['M4 20h16', 'M6 20V10l6-5 6 5v10', 'M10 20v-5h4v5'] },
  { id: 'setores', label: 'Setores', icon: ['M3 20h18', 'M5 20V9l5 3V8l5 3V5l4 2v13'] },
  { id: 'bancos', label: 'Bancos', icon: ['M3 9l9-6 9 6H3z', 'M5 10v9M10 10v9M14 10v9M19 10v9', 'M3 21h18'] },
  { id: 'calculadora', label: 'Calculadoras', oculto: true, icon: ['M6 3h12v18H6z', 'M9 7h6', 'M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01M9 18h.01M12 18h.01M15 18h.01'] },
  { id: 'feriados', label: 'Feriados', icon: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4M16 3v4'] },
  { id: 'aprender', label: 'Aprender', icon: ['M3 9l9-5 9 5-9 5-9-5z', 'M7 11.5V16c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4.5', 'M21 9v6'] },
  { id: 'apresentar', label: 'Apresentar', oculto: true, icon: ['M3 5h18v12H3z', 'M8 21h8', 'M12 17v4', 'M8 12l3-3 2 2 3-4'] }, // protótipo: abre por #apresentar e pelo comando APRESENTAR
  { id: 'config', label: 'Configurações', terminalLabel: 'Config', oculto: true, icon: ['M12 9a3 3 0 100 6 3 3 0 000-6z', 'M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z'] },
]
