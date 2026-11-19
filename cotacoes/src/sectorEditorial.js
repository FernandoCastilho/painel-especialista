// Presentation only: preserve source studies, figures, dates and financial rules.
export function uniqueParagraphs(paragraphs = []) {
  const seen = new Set()
  return paragraphs.filter(text => {
    const key = text.trim().replace(/\s+/g, ' ')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function sectionParagraphs(section, summary = []) {
  const paragraphs = uniqueParagraphs(section.paragraphs)
  // Only the business overview repeats the opening. Preserve every other section.
  if (section.id !== 'negocio') return paragraphs
  const opening = new Set(summary.map(text => text.trim().replace(/\s+/g, ' ')))
  return paragraphs.filter(text => !opening.has(text.trim().replace(/\s+/g, ' ')))
}

export function readableSectionTitle(title) {
  if (/swot/i.test(title)) return 'O que fortalece e o que fragiliza o negócio'
  if (/porter/i.test(title)) return 'Concorrência e poder de negociação'
  return title
}

export function chartConsultationLabel(chart) {
  // Never infer consultation from the study review or the series reference period.
  const value = chart.consultedAt || chart.accessedAt || chart.source?.consultedAt || chart.source?.accessedAt
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Data de consulta não informada'
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) return 'Data de consulta não informada'
  return `Consulta: ${value.split('-').reverse().join('/')}`
}

const TERMS = [
  ['glosa', /glosas?/i, 'Valor cobrado que o pagador recusa ou contesta; pode atrasar ou reduzir o recebimento.'],
  ['homologação', /homologaç/i, 'Aprovação técnica de um produto ou fornecedor pelo comprador; não equivale a pedido garantido.'],
  ['lead time', /lead time/i, 'Tempo entre o pedido e a entrega.'],
  ['mix', /\bmix\b/i, 'Combinação de produtos, clientes ou canais de venda.'],
  ['capital de giro', /capital de giro/i, 'Recursos necessários para sustentar compras, estoques e despesas até receber pelas vendas.'],
  ['repasse', /repasse/i, 'Ajuste do preço de venda para compensar uma mudança nos custos.'],
  ['fluff', /\bfluff\b/i, 'Celulose absorvente usada, por exemplo, em fraldas e itens de higiene.'],
  ['grade', /\bgrades?\b/i, 'Tipo de material definido por propriedades técnicas para uma aplicação.'],
  ['urdume e trama', /urdume|trama/i, 'Os dois conjuntos de fios que se cruzam para formar um tecido plano.'],
]
export function studyGlossary(study) {
  const text = JSON.stringify({ summary: study.summary, sections: study.sections, canvasQuestions: study.canvasQuestions })
  return TERMS.filter(([, pattern]) => pattern.test(text)).map(([term, , meaning]) => ({ term, meaning }))
}
