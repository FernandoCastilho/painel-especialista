import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildKnowledgeGraph, getKnowledgeView, KNOWLEDGE_PENDING_ID, KNOWLEDGE_WINDOW_MS } from '../src/knowledgeGraph.js'
import { CONCEITOS, LIGACOES } from '../src/educacao.js'
import { CATALOGO_SETORIAL } from '../src/centralSetorial.js'
import { validateSectorNewsItem, SECTOR_NEWS_SOURCES, CC_BY_ND_3 } from '../src/sectorNews.js'

const NOW = Date.parse('2026-11-07T12:00:00Z')
const generic = (extra = {}) => ({ title: 'Inflação e dólar no mercado de crédito', link: 'https://agenciabrasil.ebc.com.br/economia/fixture-grafo', source: 'Agência Brasil', sourceUrl: 'https://agenciabrasil.ebc.com.br', t: NOW - 3600000, ...extra })
const source = SECTOR_NEWS_SOURCES.find(item => item.id === 'anvisa')
const institutional = (extra = {}) => ({ title: 'Anvisa suspende equipamento para radioterapia superficial', link: `${source.articlePrefix}2026/fixture-radioterapia`, source: 'Anvisa', sourceId: 'anvisa', publishedAt: new Date(NOW - 6 * 86400000).toISOString(), collectedAt: new Date(NOW - 1000).toISOString(), type: 'comunicado', licenseUrl: CC_BY_ND_3, ...extra })
const feedGraph = (items, options = {}) => buildKnowledgeGraph({ news: { news: { ALL: items } }, now: NOW, ...options })
const newsNodes = graph => graph.nodes.filter(node => node.type === 'news')
const archive = items => ({ schemaVersion: 1, windowDays: 7, generatedAt: NOW, items })

test('catálogo completo, rotas exatas e relações editoriais reais são preservados', () => {
  const graph = buildKnowledgeGraph({ now: NOW })
  for (const sector of CATALOGO_SETORIAL) {
    assert.deepEqual(graph.nodes.find(node => node.id === `sector:${sector.id}`).route, { tab: 'setores', view: `pasta/${sector.id}` })
    sector.topics.forEach((label, index) => {
      const node = graph.nodes.find(node => node.id === `subsector:${sector.id}:${index}`)
      assert.equal(node.label, label)
      assert.deepEqual(node.route, { tab: 'setores', view: `topico/${sector.id}/${index}` })
      assert.ok(graph.links.some(link => link.source === node.id && link.target === `sector:${sector.id}` && link.label === 'Pertence a'))
    })
  }
  assert.equal(graph.nodes.filter(node => node.type === 'concept' && node.subtype !== 'glossary').length, CONCEITOS.length)
  for (const [a, b, reason] of LIGACOES) assert.ok(graph.links.some(link => link.source === `concept:${a}` && link.target === `concept:${b}` && link.reason === reason))
  assert.ok(graph.links.every(link => graph.nodes.some(node => node.id === link.source) && graph.nodes.some(node => node.id === link.target)))
})

test('janela inclusiva de 168h, sem futuro nem datas inválidas ou ausentes', () => {
  for (const t of [NOW, NOW - KNOWLEDGE_WINDOW_MS, NOW - KNOWLEDGE_WINDOW_MS + 1]) assert.equal(newsNodes(feedGraph([generic({ t })])).length, 1)
  for (const t of [NOW + 1, NOW - KNOWLEDGE_WINDOW_MS - 1, NaN, undefined, null, 0, '2026-11-07']) assert.equal(newsNodes(feedGraph([generic({ t })])).length, 0, String(t))
  assert.throws(() => buildKnowledgeGraph({ now: NaN }), /Data de referência/)
})

test('coleta, geração e data do fato nunca rejuvenescem a publicação', () => {
  const graph = feedGraph([generic({ t: NOW - KNOWLEDGE_WINDOW_MS - 1, generatedAt: NOW, collectedAt: new Date(NOW).toISOString(), eventDate: '2026-11-07' })])
  assert.equal(newsNodes(graph).length, 0)
  assert.equal(newsNodes(feedGraph([generic({ t: NOW, publishedAt: '2026-01-01T12:00:00Z' })])).length, 0)
  assert.equal(newsNodes(feedGraph([generic({ t: NOW, publishedAt: 'não é data' })])).length, 0)
})

test('data apenas de dia usa limites conservadores sem inventar horário', () => {
  assert.equal(newsNodes(feedGraph([generic({ publishedAt: '2026-11-03', datePrecision: 'day' })])).length, 1)
  assert.equal(newsNodes(feedGraph([generic({ publishedAt: '2026-10-31', datePrecision: 'day' })])).length, 0)
  assert.equal(newsNodes(feedGraph([generic({ publishedAt: '2026-11-07', datePrecision: 'day' })])).length, 0)
  const node = newsNodes(feedGraph([generic({ publishedAt: '2026-11-03', datePrecision: 'day' })]))[0]
  assert.equal(node.publishedAt, '2026-11-03')
  assert.equal(node.datePrecision, 'day')
})

test('validador institucional aceita7d só explicitamente e mantém default5d', () => {
  assert.equal(validateSectorNewsItem(institutional(), NOW).item, undefined)
  assert.ok(validateSectorNewsItem(institutional(), NOW, { windowMs: KNOWLEDGE_WINDOW_MS }).item)
  assert.equal(validateSectorNewsItem(institutional({ publishedAt: new Date(NOW - KNOWLEDGE_WINDOW_MS - 1).toISOString() }), NOW, { windowMs: 1000 * KNOWLEDGE_WINDOW_MS }).item, undefined)
  assert.equal(validateSectorNewsItem(institutional(), NOW).item, undefined)
})

test('notícia institucional6d preserva origem/licença e conexão validada no arquivo e no archive', () => {
  const sectorNews = { schemaVersion: 1, topics: { 'produtos-saude': { items: [institutional()] } }, sourceStates: { anvisa: { status: 'failed', accessSuspended: true } } }
  const graph = buildKnowledgeGraph({ sectorNews, now: NOW })
  assert.equal(newsNodes(graph).length, 1)
  assert.ok(graph.links.some(link => link.target === 'sector-topic:produtos-saude' && link.label === 'Conexão temática'))
  const saved = graph.archiveItems[0]
  assert.equal(saved.sourceId, 'anvisa')
  assert.equal(saved.licenseUrl, CC_BY_ND_3)
  assert.equal(saved.collectedAt, institutional().collectedAt)
  assert.equal(newsNodes(buildKnowledgeGraph({ archive: archive(graph.archiveItems), now: NOW })).length, 1)
  assert.ok(graph.meta.coverageNotes.some(note => /suspensas/.test(note)))
})

test('archive revalida origem, licença, classificação e envelhecimento', () => {
  const base = { ...institutional(), origin: 'sector', topicIds: ['produtos-saude'] }
  for (const patch of [{ licenseUrl: 'https://example.org' }, { sourceId: 'fonte-inventada' }, { link: 'https://example.org/noticia' }, { topicIds: ['software-ti'] }, { publishedAt: new Date(NOW - KNOWLEDGE_WINDOW_MS - 1).toISOString() }]) {
    assert.equal(newsNodes(buildKnowledgeGraph({ archive: archive([{ ...base, ...patch }]), now: NOW })).length, 0)
  }
  assert.equal(newsNodes(buildKnowledgeGraph({ archive: { ...archive([base]), schemaVersion: 99 }, now: NOW })).length, 0)
})

test('dedupe URL normalizada/título e conserva publicação original mais antiga', () => {
  const items = [generic(), generic({ link: generic().link + '?utm_source=teste#ref' }), generic({ link: 'https://agenciabrasil.ebc.com.br/economia/outro-link' })]
  const graph = feedGraph(items)
  assert.equal(newsNodes(graph).length, 1)
  const duplicate = feedGraph([generic({ t: NOW }), generic({ t: NOW - 3600000 })])
  assert.equal(newsNodes(duplicate)[0].t, NOW - 3600000)
})

test('links inseguros e texto com marcação não entram no mapa', () => {
  for (const link of ['javascript:alert(1)', 'data:text/html,erro', 'http://example.org', 'https://user:pass@example.org', 'https://example.org:444/news']) assert.equal(newsNodes(feedGraph([generic({ link })])).length, 0)
  for (const patch of [{ title: '<script>alert(1)</script>' }, { source: '<img onerror=x>' }, { source: '' }, { title: '' }]) assert.equal(newsNodes(feedGraph([generic(patch)])).length, 0)
})

test('título explícito, palavra inteira e sigla em contexto financeiro; metadado genérico não inventa ligação', () => {
  const graph = feedGraph([generic({ title: 'Dólar e inflação alteram debate no mercado' })])
  assert.ok(graph.links.some(link => link.source === newsNodes(graph)[0].id && link.target === 'concept:inflacao' && /título menciona/.test(link.reason)))
  assert.equal(feedGraph([generic({ title: 'A imobiliária falou sobre criativo desenho', topics: ['cri', 'inflacao'] })]).meta.pendingNewsCount, 1)
  assert.equal(feedGraph([generic({ title: 'CET interdita rua para corrida de domingo' })]).meta.pendingNewsCount, 1)
  assert.equal(newsNodes(feedGraph([generic({ title: 'Banco divulga CET do financiamento' })])).length, 1)
})

test('matérias sem conexão objetiva entram como classificação pendente sem inventar setor', () => {
  const graph = feedGraph([generic({ title: 'Prefeitura publica horário do museu municipal' })])
  assert.equal(newsNodes(graph).length, 1)
  assert.equal(graph.meta.omittedNewsCount, 0)
  assert.equal(graph.meta.pendingNewsCount, 1)
  const edges = graph.links.filter(link => link.source === newsNodes(graph)[0].id)
  assert.equal(edges.length, 1)
  assert.equal(edges[0].target, KNOWLEDGE_PENDING_ID)
  assert.equal(graph.nodes.find(node => node.id === KNOWLEDGE_PENDING_ID).route, undefined)
  assert.equal(graph.archiveItems.length, 1)
})

test('curadoria7d preserva fonte original e revalida classificação no archive', () => {
  const item = generic({ title: 'Reforma tributária: IBS e CBS em debate', t: NOW - 6 * 86400000 })
  const curadoria = { schemaVersion: 1, windowDays: 7, generatedAt: NOW, topics: { reforma: { items: [item], status: 'ok', checkedAt: NOW, lastSuccessAt: NOW } } }
  const graph = buildKnowledgeGraph({ curadoria, now: NOW })
  assert.equal(newsNodes(graph).length, 1)
  assert.equal(graph.archiveItems[0].origin, 'curadoria')
  assert.equal(graph.archiveItems[0].sourceUrl, 'https://agenciabrasil.ebc.com.br')
  assert.equal(newsNodes(buildKnowledgeGraph({ archive: archive(graph.archiveItems), now: NOW })).length, 1)
  assert.equal(newsNodes(buildKnowledgeGraph({ archive: archive([{ ...graph.archiveItems[0], sourceUrl: 'https://fonte-inventada.org' }]), now: NOW })).length, 0)
})

test('curadoria usa publicação original antes da curadoria, sem perder precisão ou nome canônico da fonte', () => {
  const curatedGraph = patch => buildKnowledgeGraph({ now: NOW, curadoria: { schemaVersion: 1, windowDays: 7, generatedAt: NOW, topics: { reforma: { items: [generic({ title: 'Reforma tributária: IBS e CBS em debate', source: 'Nome bruto não canônico', t: NOW - 3600000, ...patch })], status: 'ok', checkedAt: NOW, lastSuccessAt: NOW } } } })
  for (const publishedAt of ['2026-01-01T12:00:00Z', new Date(NOW + 1).toISOString(), 'inválida', '2026-02-30T12:00:00Z']) {
    const graph = curatedGraph({ publishedAt })
    assert.equal(newsNodes(graph).length, 0, `t recente não substitui publicação ${publishedAt}`)
    assert.equal(graph.archiveItems.length, 0)
  }
  for (const publishedAt of ['2026-10-31', '2026-11-07']) assert.equal(newsNodes(curatedGraph({ publishedAt, datePrecision: 'day' })).length, 0, `limites conservadores para ${publishedAt}`)
  const graph = curatedGraph({ publishedAt: '2026-11-03', datePrecision: 'day', t: NOW - 20 * 86400000 })
  assert.equal(newsNodes(graph).length, 1, 'publicação válida prevalece também sobre t antigo')
  const node = newsNodes(graph)[0]
  assert.equal(node.publishedAt, '2026-11-03')
  assert.equal(node.datePrecision, 'day')
  assert.equal(node.source, 'Agência Brasil')
  assert.equal(graph.archiveItems[0].publishedAt, '2026-11-03')
  assert.equal(graph.archiveItems[0].datePrecision, 'day')
  const exact = curatedGraph({ publishedAt: new Date(NOW - KNOWLEDGE_WINDOW_MS).toISOString() })
  assert.equal(newsNodes(exact).length, 1, 'extremo exato de168h aceito')
  assert.equal(newsNodes(exact)[0].t, NOW - KNOWLEDGE_WINDOW_MS)
})

test('montagem do histórico não simula nova coleta e preserva lacunas de cobertura', () => {
  const graph = buildKnowledgeGraph({ now: NOW, archive: { ...archive([]), sourceUpdatedAt: NOW - 86400000, status: 'partial', coverageNotes: ['Fonte original sem atualização confirmada.'] } })
  assert.equal(graph.meta.lastUpdatedAt, NOW - 86400000)
  assert.ok(graph.meta.coverageNotes.includes('Fonte original sem atualização confirmada.'))
  assert.ok(graph.meta.coverageNotes.some(note => /Histórico.*parcial/.test(note)))
  assert.equal(buildKnowledgeGraph({ now: NOW, archive: archive([]) }).meta.lastUpdatedAt, null)
})

test('filtro/busca sem acento/foco local e limite preservam selecionado sem mutar grafo', () => {
  const graph = feedGraph(Array.from({ length: 5 }, (_, index) => generic({ title: `Inflação e crédito: notícia ${index}`, link: `https://agenciabrasil.ebc.com.br/noticia/${index}`, t: NOW - index * 3600000 })))
  const before = JSON.stringify(graph)
  assert.ok(getKnowledgeView(graph, { query: 'inflacao', types: ['concept'] }).nodes.some(node => node.id === 'concept:inflacao'))
  assert.ok(getKnowledgeView(graph, { types: [] }).nodes.length === 0)
  const selected = newsNodes(graph).at(-1)
  assert.ok(getKnowledgeView(graph, { maxNews: 1, selectedId: selected.id }).nodes.some(node => node.id === selected.id))
  const focused = getKnowledgeView(graph, { selectedId: selected.id, local: true, maxNews: 0 })
  assert.ok(focused.nodes.some(node => node.id === selected.id))
  assert.ok(focused.links.every(link => link.source === selected.id || link.target === selected.id))
  assert.equal(JSON.stringify(graph), before)
})

test('foco local mostra somente arestas diretas do selecionado, sem ligações entre vizinhos', () => {
  const graph = {
    nodes: ['A', 'B', 'C', 'D'].map(id => ({ id, label: id, type: 'concept' })),
    links: [
      { id: 'ab', source: 'A', target: 'B' },
      { id: 'ca', source: 'C', target: 'A' },
      { id: 'bc', source: 'B', target: 'C' },
      { id: 'bd', source: 'B', target: 'D' },
    ],
    meta: {},
  }
  const before = JSON.stringify(graph)
  const focused = getKnowledgeView(graph, { selectedId: 'A', local: true })
  assert.deepEqual(focused.nodes.map(node => node.id), ['A', 'B', 'C'])
  assert.deepEqual(focused.links.map(link => link.id), ['ab', 'ca'])
  assert.deepEqual(getKnowledgeView(graph, { selectedId: 'A', local: false }).links.map(link => link.id), ['ab', 'ca', 'bc', 'bd'])
  assert.equal(JSON.stringify(graph), before)
})

test('snapshot real gera relações sem fabricar matérias e expira com relógio avançado', async () => {
  const sectorNews = JSON.parse(await readFile(new URL('../public/sector-news.json', import.meta.url)))
  const curadoria = JSON.parse(await readFile(new URL('../public/curadoria-noticias.json', import.meta.url)))
  const graph = buildKnowledgeGraph({ sectorNews, curadoria, now: NOW })
  assert.ok(graph.meta.newsCount > 0)
  assert.ok(newsNodes(graph).every(node => node.source && node.href.startsWith('https://') && withinWindow(node.t)))
  const expired = buildKnowledgeGraph({ sectorNews, curadoria, archive: archive(graph.archiveItems), now: NOW + 30 * 86400000 })
  assert.equal(expired.meta.newsCount, 0)
})
function withinWindow(t) { return t >= NOW - KNOWLEDGE_WINDOW_MS && t <= NOW }

test('every eligible item from each live source has a connection and honest counters', () => {
  const unknown = generic({ title: 'Prefeitura anuncia programação local', link: 'https://example.org/museu' })
  const graph = buildKnowledgeGraph({ now: NOW,
    news: { news: { ALL: [unknown, generic({ link: 'javascript:bad' })] } },
    temas: { temas: { cobre: { items: [generic({ title: 'Oferta global tem novas condições', link: 'https://example.org/cobre' })] } } },
    sectorNews: { schemaVersion: 1, topics: { 'produtos-saude': { items: [institutional()] } } },
    curadoria: { schemaVersion: 1, windowDays: 7, topics: { reforma: { items: [generic({ title: 'Reforma tributária: IBS e CBS em debate', link: 'https://agenciabrasil.ebc.com.br/economia/reforma' })] } } },
    archive: archive([{ ...generic({ title: 'Cobre tem novos preços', link: 'https://example.org/archive' }), origin: 'news' }]),
  })
  assert.equal(graph.meta.newsCount, 5)
  assert.equal(graph.meta.pendingNewsCount, 1)
  assert.equal(graph.meta.classifiedNewsCount, 4)
  assert.equal(graph.meta.rejectedRecordCount, 1)
  assert.ok(newsNodes(graph).every(node => graph.links.some(link => link.source === node.id || link.target === node.id)))
  const copper = newsNodes(graph).find(node => node.href === 'https://example.org/cobre')
  assert.ok(graph.links.some(link => link.source === copper.id && link.target === 'sector-topic:cobre' && link.label === 'Publicado no tema'))
  const replay = buildKnowledgeGraph({ archive: archive(graph.archiveItems), now: NOW })
  assert.equal(replay.meta.newsCount, 5)
  assert.equal(replay.meta.pendingNewsCount, 1)
})

test('editorial groups connect all existing sector/input routes without collapsing distinct pages', async () => {
  const { BANKING_TOPICS } = await import('../src/bankingSectors.js')
  const { INSUMOS } = await import('../src/insumos.js')
  const graph = buildKnowledgeGraph({ now: NOW })
  for (const topic of [...BANKING_TOPICS, ...INSUMOS]) {
    const node = graph.nodes.find(node => node.id === `sector-topic:${topic.id}`)
    assert.deepEqual(node.route, { tab: 'setores', view: topic.id })
    assert.ok(graph.links.some(link => (link.source === node.id || link.target === node.id) && link.label === 'Pertence ao grupo'))
  }
  assert.ok(graph.nodes.every(node => graph.links.some(link => link.source === node.id || link.target === node.id)))
})

test('global graph includes generated links from actual studies including wood transport', async () => {
  const { SECTOR_STUDY_CONNECTIONS } = await import('../src/generated.sectorKnowledge.js')
  const graph = buildKnowledgeGraph({ now: NOW })
  assert.ok(SECTOR_STUDY_CONNECTIONS.length > 68)
  const focus = 'subsector:transporte-logistica:1'
  for (const target of ['sector:base-florestal', 'concept:combustiveis', 'concept:fidc']) {
    const link = graph.links.find(link => link.source === focus && link.target === target)
    assert.ok(link, target)
    assert.match(link.reason, /estudo.*menciona/)
  }
  assert.ok(SECTOR_STUDY_CONNECTIONS.some(([source]) => source === 'subsector:tic:0'))
  assert.ok(graph.links.every(link => graph.nodes.some(node => node.id === link.source) && graph.nodes.some(node => node.id === link.target)))
})

test('generated study connections are deterministic and current', async () => {
  const { sectorKnowledgeSource } = await import('../scripts/build-sector-knowledge.mjs')
  assert.equal(await sectorKnowledgeSource(), await readFile(new URL('../src/generated.sectorKnowledge.js', import.meta.url), 'utf8'))
})

test('all glossary explanations remain readable including aliases without duplicate concepts', async () => {
  const { KNOWLEDGE_GLOSSARY } = await import('../src/knowledgeGlossary.js')
  const graph = buildKnowledgeGraph({ now: NOW })
  for (const entry of KNOWLEDGE_GLOSSARY) {
    const nodes = graph.nodes.filter(node => node.id === entry.nodeId)
    assert.equal(nodes.length, 1)
    assert.ok(nodes[0].summary.includes(entry.body))
    assert.ok(graph.links.some(link => link.source === entry.nodeId && link.target === 'category:panel-explanations'))
    if (!entry.conceptId) assert.equal(nodes[0].routeEvidence, entry.routeEvidence)
  }
})
