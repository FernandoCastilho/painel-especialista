import { CATALOGO_SETORIAL } from './centralSetorial.js'
import { sectorEntityGraph } from './sectorEntities.js'

const list = value => Array.isArray(value) ? value : []
const plain = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const mentions = (text, term) => Boolean(plain(term)) && ` ${plain(text)} `.includes(` ${plain(term)} `)
// Explicit vocabulary already present in the corresponding catalogue/concept.
// These are navigation aliases, never claims about economic exposure.
const SECTOR_TERMS = {
  'base-florestal': ['madeira'], 'papel-celulose': ['celulose', 'papelão'],
  'transporte-logistica': ['transporte de cargas', 'logística'],
}
const CONCEPT_TERMS = {
  combustiveis: ['combustíveis', 'diesel', 'gasolina', 'petróleo'],
  'commodities-e-cambio': ['câmbio', 'commodities', 'dólar'],
  inflacao: ['inflação', 'IPCA'], fidc: ['FIDC'],
  'custo-de-funding': ['funding', 'custo de captação'],
  debenture: ['debênture', 'debêntures'],
  'reforma-tributaria': ['reforma tributária'],
  'split-payment': ['split payment'],
}

// Read editorial prose only. URLs, source lists and metadata must not create
// accidental mentions (e.g. a government URL containing another sector name).
function studyPassages(study) {
  const passages = []
  const add = (value, section) => {
    if (typeof value === 'string' && value.trim()) passages.push({ text: value.trim(), section })
    else if (Array.isArray(value)) value.forEach(item => add(item, section))
  }
  add(study.title, 'Título'); add(study.summary, 'Resumo executivo')
  for (const section of list(study.sections)) {
    const label = section.title || 'Estudo'
    add(section.paragraphs, label); add(section.bullets, label); add(section.rows, label)
  }
  return passages
}

/** Pure contextual projection of the application's validated knowledge graph.
 * No new news admission, recursive expansion or inferred economic correlation.
 */
export function buildSectorKnowledgeGraph(graph, { group, topicIndex, study } = {}) {
  const groupId = typeof group === 'string' ? group : group?.id
  const catalog = CATALOGO_SETORIAL.find(item => item.id === groupId)
  const allNodes = list(graph?.nodes), allLinks = list(graph?.links)
  const byId = new Map(allNodes.map(node => [node.id, node]))
  const focusId = `subsector:${groupId}:${topicIndex}`, parentId = `sector:${groupId}`
  const valid = catalog && Number.isInteger(topicIndex) && topicIndex >= 0 && topicIndex < catalog.topics.length && study && typeof study === 'object' && (!study.group || study.group === groupId) && (study.topicIndex === undefined || study.topicIndex === topicIndex) && byId.has(focusId) && byId.has(parentId)
  const meta = { ...graph?.meta, focusId: valid ? focusId : '', contextLabel: valid ? catalog.topics[topicIndex] : '', contextual: true }
  if (!valid) return { nodes: [], links: [], archiveItems: [], meta: { ...meta, newsCount: 0 } }
  const selected = new Set([focusId, parentId]), links = [], edgeKeys = new Set()
  const addLink = link => {
    if (!byId.has(link.source) || !byId.has(link.target) || link.source === link.target) return
    const key = [link.source, link.target].sort().join('|')
    if (edgeKeys.has(key)) return
    edgeKeys.add(key); selected.add(link.source); selected.add(link.target); links.push({ ...link })
  }
  addLink({ id: `context:${focusId}:parent`, source: focusId, target: parentId, label: 'Pertence a', reason: `${catalog.topics[topicIndex]} está cadastrado em ${catalog.label}. Relação de catálogo, não causalidade econômica.` })
  const passages = studyPassages(study)
  for (const node of allNodes) {
    if (selected.has(node.id) || node.type === 'news') continue
    let terms = [node.label, node.title]
    if (node.type === 'sector' && node.subtype === 'sector') {
      const entry = CATALOGO_SETORIAL.find(item => node.id === `sector:${item.id}`)
      if (!entry) continue // Generic panel categories (e.g. Indústria) are not a study-specific match.
      terms = [entry.label, ...entry.topics, ...list(SECTOR_TERMS[entry.id])]
    } else if (node.type === 'concept') terms.push(...list(CONCEPT_TERMS[node.id.replace('concept:', '')]))
    const term = terms.find(value => value && passages.some(passage => mentions(passage.text, value)))
    if (!term) continue
    const passage = passages.find(item => mentions(item.text, term))
    addLink({ id: `context:${focusId}:${node.id}`, source: focusId, target: node.id, label: 'Mencionado no estudo', reason: `O estudo de ${catalog.topics[topicIndex]} menciona “${term}” em “${passage.section}”: “${passage.text}” A ligação indica assunto em comum, não impacto comprovado.`, evidence: { section: passage.section, term, excerpt: passage.text } })
  }
  // Freeze the anchors before expansion: no traversal through added neighbors.
  const anchors = new Set(selected)
  for (const link of allLinks) {
    if (link.label === 'Mencionado no estudo') continue // Recomputed above from this study, never another study's prose.
    const source = byId.get(link.source), target = byId.get(link.target)
    if (!source || !target) continue
    const anchor = anchors.has(source.id) ? source : anchors.has(target.id) ? target : null
    const other = anchor?.id === source.id ? target : source
    if (!anchor || !['concept', 'news'].includes(other.type)) continue
    if (anchor.type === 'concept' && other.type !== 'news' && !anchors.has(other.id)) continue
    const broader = anchor.type === 'sector' && anchor.id !== focusId
    addLink({ ...link, reason: broader ? `Contexto do setor mais amplo “${anchor.label}”; não significa que o conteúdo trate especificamente de ${catalog.topics[topicIndex]}. ${link.reason}` : link.reason })
  }
  const nodes = allNodes.filter(node => selected.has(node.id)).map(node => ({ ...node }))
  // Associations, agencies and reference players come from the editorial list, never from news matching.
  const entities = sectorEntityGraph(groupId, topicIndex)
  nodes.push(...entities.nodes.map(node => ({ ...node })))
  links.push(...entities.links)
  const newsUrls = new Set(nodes.filter(node => node.type === 'news').map(node => node.href))
  return { nodes, links, archiveItems: list(graph?.archiveItems).filter(item => newsUrls.has(item.link)), meta: { ...meta, newsCount: newsUrls.size, hasEntities: entities.nodes.length > 0, entityPlayers: entities.players } }
}
