import { KNOWLEDGE_GLOSSARY } from './knowledgeGlossary.js'
import { SECTOR_STUDY_CONNECTIONS } from './generated.sectorKnowledge.js'
import { CONCEITOS, LIGACOES } from './educacao.js'
import { CATALOGO_SETORIAL } from './centralSetorial.js'
import { BANKING_TOPICS } from './bankingSectors.js'
import { INSUMOS } from './insumos.js'
import { canonicalNewsUrl, normalizeNewsText, publicationBounds, sectorNewsItemMatchesTopic, validateSectorNewsItem, SECTOR_NEWS_SOURCES } from './sectorNews.js'
import { CURADORIA_TOPICS, normalizeCuradoria, curateItems } from './curadoria.js'

export const KNOWLEDGE_WINDOW_DAYS = 7
export const KNOWLEDGE_WINDOW_MS = KNOWLEDGE_WINDOW_DAYS * 86400000
export const KNOWLEDGE_PENDING_ID = 'classification:pending'
export const KNOWLEDGE_TYPES = ['sector', 'concept', 'news', 'entity']
const list = value => Array.isArray(value) ? value : []
const record = value => value && typeof value === 'object' && !Array.isArray(value)
const text = value => typeof value === 'string' ? value.trim() : ''
const plain = value => normalizeNewsText(value).replace(/[^a-z0-9]+/g, ' ').trim()
const safeText = value => Boolean(text(value) && text(value).length <= 600 && !/[<>]/.test(value))
const stamp = value => typeof value === 'number' ? value : Date.parse(value)
const within = (value, now) => Number.isFinite(value) && value > 0 && value >= now - KNOWLEDGE_WINDOW_MS && value <= now
const phraseIn = (title, phrase) => (` ${plain(title)} `).includes(` ${plain(phrase)} `)
const conceptMention = (title, alias) => {
  if (!phraseIn(title, alias)) return false
  // Short financial acronyms also name institutions or unrelated subjects.
  return !/^(cet|cri|cra|cds)$/i.test(alias) || /credit|custo|taxa|juros|banc|recebive|emiss|divid|financ|invest|mercado|debentur|fund|capta|risco/.test(plain(title))
}
const shortId = value => { let n = 2166136261; for (const char of value) n = Math.imul(n ^ char.charCodeAt(0), 16777619); return (n >>> 0).toString(36) }

// Explicit navigation aliases, not economic causation or an official classification.
const SECTOR_ROUTES = {
  'alimentos-bebidas': 'alimentos-agroindustria', pecuaria: 'alimentos-agroindustria',
  metalmecanica: 'metalmecanico', 'quimicos-plasticos': 'quimicos',
  'atacado-distribuicao': 'atacado', 'transporte-cargas': 'transporte-logistica',
  'armazenagem-logistica': 'transporte-logistica', 'construcao-civil': 'construcao',
  infraestrutura: 'construcao', 'mercado-imobiliario': 'construcao',
  'software-ti': 'tic', telecom: 'tic',
}
const CONCEPT_ALIASES = {
  'substituicao-tributaria': ['substituição tributária', 'ICMS-ST'],
  'juros-forcados': ['juros forçados', 'repressão financeira', 'controle da curva de juros'],
  cet: ['custo efetivo total', 'CET'], 'escala-6x1': ['escala 6x1', 'escala 6 por 1', 'fim da 6x1'],
  'reforma-tributaria': ['reforma tributária', 'IBS e CBS', 'imposto seletivo'],
  'split-payment': ['split payment', 'pagamento segregado'], dividendos: ['dividendos'],
  'fee-de-estruturacao': ['fee de estruturação', 'comissão de estruturação'],
  'diferencial-de-juros': ['diferencial de juros'], 'cupom-cambial': ['cupom cambial'],
  sofr: ['SOFR'], euribor: ['Euribor'], 'custo-de-funding': ['funding', 'custo de captação'],
  cds: ['credit default swap', 'CDS'], 'liquidacao-antecipada': ['liquidação antecipada', 'break funding'],
  debenture: ['debênture', 'debêntures'], 'nota-comercial': ['nota comercial', 'notas comerciais'],
  fidc: ['FIDC', 'fundos de direitos creditórios'], cri: ['certificado de recebíveis imobiliários', 'CRI'],
  cra: ['certificado de recebíveis do agronegócio', 'CRA'], facil: ['regime FÁCIL'],
  drawback: ['drawback'], 'lei-de-maquila': ['maquila'], inflacao: ['inflação', 'IPCA'],
  focus: ['boletim Focus', 'relatório Focus'], 'commodities-e-cambio': ['câmbio', 'commodities', 'dólar'],
  'ic-br': ['IC-Br'], combustiveis: ['combustíveis', 'gasolina', 'diesel', 'petróleo'],
}
const SECTOR_ALIASES = {
  'base-florestal': ['madeira', 'florestas plantadas', 'serrarias', 'compensados', 'MDF', 'MDP'],
  'transporte-logistica': ['transporte de cargas', 'logística', 'frete', 'fretes', 'caminhões'],
  'papel-celulose': ['celulose', 'papelão', 'embalagens de papel', 'tubetes'],
  'alimentos-agroindustria': ['agroindústria', 'frigoríficos', 'laticínios', 'alimentos', 'bebidas', 'proteína animal'],
  metalmecanico: ['metalmecânica', 'metalmecânico', 'máquinas industriais', 'máquinas agrícolas', 'usinagem', 'fundição'],
  automotivo: ['automotivo', 'automotivos', 'autopeças', 'implementos rodoviários'],
  construcao: ['construção civil', 'construção residencial', 'construção de galpões', 'cimento', 'esquadrias', 'mercado imobiliário'],
  textil: ['têxtil', 'têxteis', 'vestuário', 'tecelagem', 'confecção', 'malharia'],
  quimicos: ['indústria química', 'químicos', 'plásticos', 'resinas', 'borracha'],
  atacado: ['atacado', 'atacadistas', 'distribuição de alimentos', 'distribuição de medicamentos'],
  tic: ['tecnologia da informação', 'cibersegurança', 'data centers', 'serviços de TI', 'software', 'telecomunicações'],
}
const COMPLEMENTARY_READINGS = [
  ['base-florestal', 'commodities-e-cambio', 'Leitura complementar sobre preços internacionais e conversão de moedas; a exposição de cada empresa precisa ser conferida.'],
  ['transporte-logistica', 'combustiveis', 'Leitura complementar sobre a formação do preço do combustível no estudo de transporte e logística.'],
  ['papel-celulose', 'drawback', 'Leitura complementar sobre operações de exportação; a elegibilidade do regime depende da operação.'],
  ['alimentos-agroindustria', 'cra', 'Leitura complementar sobre recebíveis do agronegócio e suas formas de financiamento.'],
  ['metalmecanico', 'commodities-e-cambio', 'Leitura complementar para investigar insumos e contratos em moeda estrangeira.'],
  ['automotivo', 'drawback', 'Leitura complementar sobre insumos e exportações; não afirma enquadramento automático no regime.'],
  ['construcao', 'cri', 'Leitura complementar sobre recebíveis imobiliários e suas formas de financiamento.'],
  ['textil', 'escala-6x1', 'Leitura complementar para investigar turnos e organização do trabalho; o enquadramento depende da atividade e das regras aplicáveis.'],
  ['quimicos', 'commodities-e-cambio', 'Leitura complementar para investigar preços internacionais e moedas de compra de insumos.'],
  ['atacado', 'split-payment', 'Leitura complementar sobre recolhimento de tributos no pagamento e planejamento do caixa.'],
  ['tic', 'custo-de-funding', 'Leitura complementar para comparar as fontes e o custo do financiamento de uma empresa.'],
]

/** Pure model. Links explain navigation/subject relationships, never statistical correlation.
 * archive: {schemaVersion:1,windowDays:7,items:[...]} created from graph.archiveItems.
 * Every archive item is revalidated and all relationships are recomputed.
 */
export function buildKnowledgeGraph({ sectorNews, news, temas, curadoria, archive, now = Date.now() } = {}) {
  if (!Number.isFinite(now)) throw new Error('Data de referência inválida para o mapa.')
  const nodes = [], links = [], byId = new Map(), edgeIds = new Set(), topicNodes = new Map()
  const coverageNotes = new Set(), accepted = new Map()
  let pendingNewsCount = 0, classifiedNewsCount = 0, rejectedRecordCount = 0, duplicateRecordCount = 0
  const reject = () => { rejectedRecordCount++; return undefined }
  const addNode = node => { if (!byId.has(node.id)) { nodes.push(node); byId.set(node.id, node) } return byId.get(node.id) }
  const addLink = (source, target, label, reason) => {
    if (!byId.has(source) || !byId.has(target) || source === target) return
    const key = [source, target].sort().join('|')
    if (edgeIds.has(key)) return
    edgeIds.add(key); links.push({ id: `link:${shortId(key)}`, source, target, label, reason })
  }
  for (const group of CATALOGO_SETORIAL) {
    const id = `sector:${group.id}`
    addNode({ id, label: group.label, title: group.label, type: 'sector', subtype: 'sector', group: group.label, summary: `${group.topics.length} subsetores no catálogo. A presença no mapa não indica estudo concluído.`, route: { tab: 'setores', view: `pasta/${group.id}` } })
    topicNodes.set(group.id, id)
    group.topics.forEach((label, index) => {
      const childId = `subsector:${group.id}:${index}`
      addNode({ id: childId, label, title: label, type: 'sector', subtype: 'subsector', group: group.label, summary: `Subsetor de ${group.label}. Abra o conteúdo para conferir a disponibilidade do estudo.`, route: { tab: 'setores', view: `topico/${group.id}/${index}` } })
      addLink(childId, id, 'Pertence a', `${label} está cadastrado em ${group.label}.`)
    })
  }
  for (const topic of [...BANKING_TOPICS, ...INSUMOS]) {
    const catalogId = SECTOR_ROUTES[topic.id]
    const same = CATALOGO_SETORIAL.find(group => plain(group.label) === plain(topic.label))
    const id = `sector-topic:${topic.id}`
    addNode({ id, label: topic.label, title: topic.label, type: 'sector', subtype: INSUMOS.some(item => item.id === topic.id) ? 'input' : 'sector', group: topic.grupo, summary: 'Conteúdo setorial e referências disponíveis no painel.', route: { tab: 'setores', view: topic.id } })
    topicNodes.set(topic.id, id)
    const catalogueTarget = catalogId || same?.id
    if (catalogueTarget) addLink(id, `sector:${catalogueTarget}`, 'Catálogo relacionado', `O painel associa a página “${topic.label}” ao catálogo “${byId.get(`sector:${catalogueTarget}`).label}” para navegação. Os recortes não são necessariamente equivalentes.`)
  }
  // Membership comes from the panel's own editorial catalogue, not inference.
  for (const topic of [...BANKING_TOPICS, ...INSUMOS]) {
    const target = topicNodes.get(topic.id)
    const id = `sector-group:${shortId(topic.grupo)}`
    addNode({ id, label: topic.grupo, title: topic.grupo, type: 'sector', subtype: 'category', group: 'Grupos editoriais', summary: 'Agrupamento editorial existente na aba Setores; não representa correlação econômica.' })
    addLink(target, id, 'Pertence ao grupo', `O painel cadastra “${topic.label}” no grupo editorial “${topic.grupo}”.`)
  }
  for (const concept of CONCEITOS) addNode({ id: `concept:${concept.id}`, label: concept.nome.replace(/ \(.*\)/, ''), title: concept.nome, type: 'concept', group: concept.topico, summary: concept.frase, route: { tab: 'aprender', view: concept.id } })
  const glossaryHub = 'category:panel-explanations'
  addNode({ id: glossaryHub, label: 'Explicações do painel', title: 'Explicações do painel', type: 'sector', subtype: 'category', group: 'Conteúdo do aplicativo', summary: 'Glossário usado nas explicações do painel. Cada ligação indica presença no glossário, não causalidade econômica.' })
  for (const entry of KNOWLEDGE_GLOSSARY) {
    const existing = byId.get(entry.nodeId)
    if (existing) {
      existing.glossaryBody = entry.body
      existing.summary = `${existing.summary}\n\n${entry.body}`
    } else addNode({ id: entry.nodeId, label: entry.label, title: entry.label, type: 'concept', subtype: 'glossary', group: 'Explicações do painel', summary: entry.body, body: entry.body, route: entry.route, routeStatus: entry.routeStatus, routeEvidence: entry.routeEvidence })
    addLink(entry.nodeId, glossaryHub, 'Explicação do painel', `“${entry.label}” consta no glossário de explicações do aplicativo. ${entry.routeStatus === 'unavailable' ? 'O texto está disponível nos detalhes; não há destino específico confirmado.' : 'O destino abre a área existente que contém esta explicação.'}`)
  }
  for (const [a, b, reason] of LIGACOES) addLink(`concept:${a}`, `concept:${b}`, 'Relaciona', reason)
  for (const [sector, concept, reason] of COMPLEMENTARY_READINGS) addLink(`sector:${sector}`, `concept:${concept}`, 'Conexão temática', reason)

  for (const [source, target, term, section, excerpt] of SECTOR_STUDY_CONNECTIONS) {
    addLink(source, target, 'Mencionado no estudo', `O estudo de ${byId.get(source)?.label || source} menciona “${term}” em “${section}”: “${excerpt}” Assunto em comum, não impacto comprovado.`)
  }

  function admit(raw, origin, topicIds = []) {
    if (!record(raw) || !safeText(raw.title) || !safeText(raw.source)) return reject()
    const link = canonicalNewsUrl(raw.link || raw.href)
    if (!link) return reject()
    let item
    if (origin === 'sector' || raw.sourceId) {
      const result = validateSectorNewsItem({ ...raw, link }, now, { windowMs: KNOWLEDGE_WINDOW_MS })
      if (!result.item) return reject()
      const source = SECTOR_NEWS_SOURCES.find(value => value.id === result.item.sourceId)
      topicIds = topicIds.filter(id => source?.topics.includes(id) && sectorNewsItemMatchesTopic(id, result.item))
      if (!topicIds.length) return reject()
      item = { ...result.item, origin: 'sector', topicIds }
    } else {
      // If a publication field is present, it must be valid and prevails over t.
      const bounds = raw.publishedAt !== undefined ? publicationBounds(raw) : null
      if (raw.publishedAt !== undefined && !bounds) return reject()
      const t = bounds?.t ?? raw.t
      if (bounds ? !within(bounds.min, now) || !within(bounds.max, now) : !within(t, now)) return reject()
      if (origin === 'curadoria') {
        topicIds = topicIds.filter(id => CURADORIA_TOPICS.some(topic => topic.id === id) && curateItems(id, [{ ...raw, link, t }], [], now).length)
        if (!topicIds.length) return reject()
      } else if (origin === 'temas') topicIds = topicIds.filter(id => topicNodes.has(id))
      else topicIds = [] // Untrusted generic topic tags never create an edge.
      item = { title: raw.title.trim(), link, source: raw.source.trim(), t, publishedAt: raw.publishedAt || new Date(t).toISOString(), datePrecision: bounds?.precision || 'instant', origin, topicIds, ...(typeof raw.sourceUrl === 'string' && canonicalNewsUrl(raw.sourceUrl) ? { sourceUrl: canonicalNewsUrl(raw.sourceUrl) } : {}) }
    }
    const prior = accepted.get(link)
    if (prior) {
      duplicateRecordCount++
      // Keep the earliest original publication; later collection cannot renew it.
      if (prior.t !== item.t) { if (item.t < prior.t) accepted.set(link, item); return }
      if (prior.origin === item.origin) prior.topicIds = [...new Set([...prior.topicIds, ...item.topicIds])]
      else if (item.origin === 'sector' || (item.origin === 'curadoria' && prior.origin !== 'sector')) accepted.set(link, item)
      return
    }
    accepted.set(link, item)
  }
  if (sectorNews?.schemaVersion === 1 && record(sectorNews.topics)) {
    for (const [id, topic] of Object.entries(sectorNews.topics)) for (const item of list(topic?.items)) admit(item, 'sector', [id])
    if (Object.values(sectorNews.sourceStates || {}).some(state => state?.accessSuspended || !['ok', 'empty'].includes(state?.status))) coverageNotes.add('Cobertura institucional parcial; algumas fontes estão suspensas ou sem atualização confirmada.')
  } else coverageNotes.add('Notícias setoriais indisponíveis nesta leitura.')
  const feed = record(news?.news) ? news.news : news
  if (record(feed)) for (const items of Object.values(feed)) for (const item of list(items)) admit(item, 'news')
  if (record(temas?.temas)) for (const [topicId, topic] of Object.entries(temas.temas)) for (const item of list(topic?.items)) admit(item, 'temas', [topicId])
  if (curadoria?.schemaVersion === 1) for (const topic of CURADORIA_TOPICS) {
    const data = normalizeCuradoria(curadoria, topic.id, now)
    if (data?.stale) coverageNotes.add('Curadoria com atualização parcial ou atrasada; a data de cada publicação continua sendo respeitada.')
    if (!data) continue
    // Curadoria's shared projection exposes t only. Keep the original publication
    // fields here, deriving t before that projection so a newer t cannot revive
    // an old/invalid publication or erase conservative day precision.
    for (const raw of list(curadoria.topics?.[topic.id]?.items)) {
      const explicitPublication = raw?.publishedAt !== undefined
      const bounds = explicitPublication ? publicationBounds(raw) : null
      if (explicitPublication && (!bounds || !within(bounds.min, now) || !within(bounds.max, now))) continue
      for (const item of curateItems(topic.id, [{ ...raw, t: bounds?.t ?? raw?.t }], [], now)) {
        admit({ ...item, ...(explicitPublication ? { publishedAt: raw.publishedAt, datePrecision: raw.datePrecision } : {}) }, 'curadoria', [topic.id])
      }
    }
  }
  if (Array.isArray(archive) || (archive?.schemaVersion === 1 && archive.windowDays === KNOWLEDGE_WINDOW_DAYS)) {
    for (const item of list(Array.isArray(archive) ? archive : archive.items)) if (['sector', 'curadoria', 'news', 'temas'].includes(item?.origin)) admit(item, item.origin, list(item.topicIds))
    for (const note of list(archive?.coverageNotes)) if (safeText(note)) coverageNotes.add(note)
    if (archive?.status === 'partial') coverageNotes.add('Histórico de notícias com cobertura parcial; consulte a data das publicações e das fontes.')
  }
  const archiveItems = [...accepted.values()].sort((a, b) => b.t - a.t || a.link.localeCompare(b.link))
  const titleSeen = new Map()
  for (const item of archiveItems) {
    const key = `${plain(item.title)}|${plain(item.source)}`
    if (titleSeen.has(key)) { duplicateRecordCount++; continue }
    titleSeen.set(key, true)
    const id = `news:${shortId(item.link)}`, matches = []
    if (item.origin === 'sector') for (const topic of item.topicIds) {
      const target = topicNodes.get(topic)
      if (target) matches.push([target, 'Conexão temática', `Publicação classificada no tema “${BANKING_TOPICS.find(value => value.id === topic)?.label || INSUMOS.find(value => value.id === topic)?.label || topic}” pelas regras setoriais do painel; a ligação não comprova impacto econômico.`])
    }
    if (item.origin === 'temas') for (const topic of item.topicIds) {
      const target = topicNodes.get(topic)
      if (target) matches.push([target, 'Publicado no tema', `A publicação está no tema “${byId.get(target).label}” do painel. Esta ligação registra a organização da fonte, não comprova impacto econômico.`])
    }
    for (const topic of [...BANKING_TOPICS, ...INSUMOS]) {
      if (phraseIn(item.title, topic.label)) matches.push([topicNodes.get(topic.id), 'Menciona', `O título menciona “${topic.label}”, conteúdo existente na aba Setores.`])
    }
    for (const concept of CONCEITOS) {
      const alias = (CONCEPT_ALIASES[concept.id] || [concept.nome]).find(value => conceptMention(item.title, value))
      if (alias) matches.push([`concept:${concept.id}`, 'Menciona', `O título menciona “${alias}”. Esta é uma conexão temática, não uma conclusão sobre impacto ou causalidade.`])
    }
    for (const entry of KNOWLEDGE_GLOSSARY) {
      if (!entry.conceptId && conceptMention(item.title, entry.label)) matches.push([entry.nodeId, 'Menciona', `O título menciona “${entry.label}”, explicação existente no painel.`])
    }
    for (const group of CATALOGO_SETORIAL) {
      const alias = (SECTOR_ALIASES[group.id] || [group.label]).find(value => phraseIn(item.title, value))
      if (alias) matches.push([`sector:${group.id}`, 'Menciona', `O título menciona “${alias}”, relacionado ao catálogo ${group.label}.`])
      group.topics.forEach((label, index) => {
        if (plain(label).length >= 5 && phraseIn(item.title, label)) matches.push([`subsector:${group.id}:${index}`, 'Menciona', `O título menciona o subsetor “${label}”.`])
      })
    }
    if (!matches.length) {
      pendingNewsCount++
      addNode({ id: KNOWLEDGE_PENDING_ID, label: 'Outras notícias', title: 'Notícias ainda não ligadas a um setor', type: 'sector', subtype: 'classification', group: 'Organização das notícias', summary: 'Notícias válidas na janela de sete dias cujo assunto ainda não tem correspondência objetiva com os setores ou conceitos cadastrados. Não é um setor econômico.' })
      matches.push([KNOWLEDGE_PENDING_ID, 'Outras notícias', 'Publicação válida e recente que ainda não foi ligada a um setor ou conceito. Esta ligação não indica relação com um setor.'])
    } else classifiedNewsCount++
    addNode({ id, label: item.title, title: item.title, type: 'news', group: 'Notícias · 7 dias', classification: matches[0][0] === KNOWLEDGE_PENDING_ID ? 'pending' : 'classified', summary: matches[0][0] === KNOWLEDGE_PENDING_ID ? 'Ainda não ligada a um setor. Consulte a fonte para avaliar o assunto.' : 'Publicação conectada por assunto. Consulte a fonte para avaliar o contexto.', href: item.link, source: item.source, sourceUrl: item.sourceUrl, publishedAt: item.publishedAt, datePrecision: item.datePrecision, t: item.t, licenseUrl: item.licenseUrl })
    for (const [target, label, reason] of matches) addLink(id, target, label, reason)
  }
  // Archive generation is only an assembly time, never a new source collection.
  const updates = [...[sectorNews, news, temas, curadoria].map(value => stamp(value?.generatedAt)), stamp(archive?.sourceUpdatedAt)].filter(value => Number.isFinite(value) && value <= now && value > 0)
  return { nodes, links, archiveItems, meta: { windowDays: KNOWLEDGE_WINDOW_DAYS, windowStart: now - KNOWLEDGE_WINDOW_MS, windowEnd: now, newsCount: nodes.filter(node => node.type === 'news').length, omittedNewsCount: 0, pendingNewsCount, classifiedNewsCount, rejectedRecordCount, duplicateRecordCount, coverageNotes: [...coverageNotes], lastUpdatedAt: updates.length ? Math.max(...updates) : null } }
}

/** Filter without mutating model. Selected news is retained even beyond maxNews. */
export function getKnowledgeView(graph, { query = '', types = KNOWLEDGE_TYPES, selectedId = '', local = false, maxNews = 36 } = {}) {
  const permitted = new Set(list(types)), words = plain(query).split(' ').filter(Boolean)
  const neighbors = new Set([selectedId])
  if (local && selectedId) for (const link of graph.links) {
    if (link.source === selectedId) neighbors.add(link.target)
    if (link.target === selectedId) neighbors.add(link.source)
  }
  let nodes = graph.nodes.filter(node => permitted.has(node.type) && (!local || !selectedId || neighbors.has(node.id)) && (!words.length || words.every(word => plain(`${node.label} ${node.title} ${node.group} ${node.summary} ${node.source || ''}`).includes(word)) || node.id === selectedId))
  let count = 0
  const newsLimit = Number.isFinite(maxNews) ? Math.max(0, Math.floor(maxNews)) : 36
  nodes = nodes.filter(node => node.type !== 'news' || node.id === selectedId || count++ < newsLimit)
  const ids = new Set(nodes.map(node => node.id))
  const links = graph.links.filter(link => ids.has(link.source) && ids.has(link.target) && (!local || !selectedId || link.source === selectedId || link.target === selectedId))
  return { nodes, links, meta: { ...graph.meta, totalNodes: graph.nodes.length, visibleNodes: nodes.length, visibleNews: nodes.filter(node => node.type === 'news').length, hiddenNews: graph.nodes.filter(node => node.type === 'news').length - nodes.filter(node => node.type === 'news').length } }
}
