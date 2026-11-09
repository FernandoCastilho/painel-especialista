const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = value => typeof value === 'string'
const texts = value => Array.isArray(value) && value.every(text)
const list = (value, valid) => Array.isArray(value) && value.every(valid)
const source = value => object(value) && text(value.url) && text(value.label) && (value.purpose === undefined || text(value.purpose))
const optional = (value, valid) => value === undefined || valid(value)
const section = value => object(value) && text(value.id) && text(value.title)
  && optional(value.paragraphs, texts) && optional(value.bullets, texts)
  && optional(value.sources, values => list(values, source))
  && optional(value.rows, rows => texts(value.columns) && list(rows, row => texts(row) && row.length === value.columns.length))
const chart = value => object(value) && text(value.id) && text(value.title) && text(value.unit) && text(value.scope) && text(value.method) && text(value.period)
  && source(value.source) && Array.isArray(value.years) && value.years.every(year => text(year) || Number.isFinite(year))
  && Array.isArray(value.series) && value.series.length > 0 && value.series.every(series => object(series) && text(series.label)
    && Array.isArray(series.values) && series.values.length === value.years.length && series.values.every(Number.isFinite))
const flow = value => object(value) && text(value.emoji) && text(value.label)
const diagram = value => object(value) && list(value.nodes, node => object(node) && text(node.id) && text(node.label) && text(node.detail)
    && optional(node.emoji, text) && optional(node.bank, text))
  && list(value.edges, edge => object(edge) && text(edge.from) && text(edge.to) && text(edge.label)
    && value.nodes.some(node => node.id === edge.from) && value.nodes.some(node => node.id === edge.to)
    && optional(edge.product, flow) && optional(edge.cash, flow))
  && optional(value.cycle, cycle => object(cycle) && text(cycle.title) && texts(cycle.steps) && cycle.steps.length === 3 && optional(cycle.text, text))

// Valida os campos consumidos pelo renderer; não certifica o conteúdo editorial.
export function validSectorStudy(value, group, topicIndex) {
  return object(value) && value.group === group && value.topicIndex === topicIndex
    && text(value.title) && texts(value.summary) && list(value.sections, section)
    && list(value.charts, chart) && list(value.sources, source) && texts(value.limitations) && text(value.method)
    && list(value.canvasQuestions, item => object(item) && text(item.dimension) && text(item.question))
    && (text(value.transcript) || texts(value.transcript)) && optional(value.diagram, diagram)
    && optional(value.audio, audio => object(audio) && text(audio.src) && optional(audio.durationSeconds, Number.isFinite))
}
