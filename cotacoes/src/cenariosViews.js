// Assuntos da aba Cenários (#cenarios/<id>), na ordem da faixa de assuntos.
export const CEN_VIEWS = [
  { id: 'projecoes', label: 'Projeções' },
  { id: 'calendario', label: 'Calendário econômico' },
  { id: 'inadimplencia', label: 'Inadimplência' },
  { id: 'recuperacao', label: 'Recuperação judicial' },
  { id: 'atividade', label: 'Atividade e emprego' },
  { id: 'commodities', label: 'Commodities' },
  { id: 'indexadores', label: 'Indexadores' },
  { id: 'inflacao', label: 'Inflação' },
]
// Seções dentro de um assunto (#cenarios/assunto/secao): a tela abre já rolada até a seção.
export const CEN_SECTIONS = { 'inflacao/fiscal': 'cen-fiscal', 'commodities/frete': 'cen-frete' }
// Nome de cada seção no Mapa do site.
export const CEN_SECTION_LABELS = { 'inflacao/fiscal': 'Fiscal · dívida pública', 'commodities/frete': 'Frete marítimo' }
