import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildKnowledgeGraph } from '../src/knowledgeGraph.js'
import { buildSectorKnowledgeGraph } from '../src/sectorKnowledgeGraph.js'

const studies = JSON.parse(await readFile(new URL('../src/sectorStudies/studies.json', import.meta.url)))
const wood = studies.find(item => item.group === 'transporte-logistica' && item.topicIndex === 1)
const context = { group: wood.group, topicIndex: wood.topicIndex, study: wood }
const now = Date.parse('2026-11-09T12:00:00Z')
const graph = buildKnowledgeGraph({ now, news: { news: { ALL: [
  { title: 'Fretes têm novas regras', link: 'https://example.com/fretes', source: 'Fonte de teste', t: now - 1000 },
  { title: 'Diesel tem nova referência', link: 'https://example.com/diesel', source: 'Fonte de teste', t: now - 1000 },
  { title: 'Software tem novas regras', link: 'https://example.com/software', source: 'Fonte de teste', t: now - 1000 },
] } } })
const has = (model, id) => model.nodes.some(node => node.id === id)

test('wood transport maps real study mentions to existing catalogue and concepts', () => {
  const before = JSON.stringify(graph), studyBefore = JSON.stringify(wood)
  const model = buildSectorKnowledgeGraph(graph, context)
  for (const id of ['subsector:transporte-logistica:1', 'sector:transporte-logistica', 'sector:base-florestal', 'sector:papel-celulose', 'concept:combustiveis', 'concept:fidc']) assert.ok(has(model, id), id)
  const diesel = model.links.find(link => link.source === model.meta.focusId && link.target === 'concept:combustiveis')
  assert.equal(diesel.evidence.term, 'diesel')
  assert.ok(diesel.evidence.excerpt.includes('diesel'))
  assert.ok(model.links.every(link => link.reason && has(model, link.source) && has(model, link.target)))
  assert.equal(JSON.stringify(graph), before)
  assert.equal(JSON.stringify(wood), studyBefore)
})

test('projection excludes unrelated siblings and sectors, explains broader news', () => {
  const model = buildSectorKnowledgeGraph(graph, context)
  for (const id of ['subsector:transporte-logistica:0', 'subsector:transporte-logistica:2', 'sector:tic', 'sector-topic:industria', 'sector:textil', 'sector:alimentos-agroindustria']) assert.ok(!has(model, id), id)
  assert.ok(!model.nodes.some(node => node.href === 'https://example.com/software'))
  const news = model.nodes.find(node => node.href === 'https://example.com/fretes')
  assert.ok(news)
  const edge = model.links.find(link => link.source === news.id || link.target === news.id)
  assert.match(edge.reason, /setor mais amplo/)
  assert.match(edge.reason, /não significa.*especificamente/)
  assert.ok(model.nodes.some(node => node.href === 'https://example.com/diesel'))
})

test('invalid or mismatched context returns empty graph, never global fallback', () => {
  for (const options of [{}, { ...context, topicIndex: -1 }, { ...context, topicIndex: 999 }, { ...context, group: 'tic' }, { ...context, study: null }]) {
    const model = buildSectorKnowledgeGraph(graph, options)
    assert.deepEqual(model.nodes, [])
    assert.deepEqual(model.links, [])
    assert.equal(model.meta.newsCount, 0)
  }
  assert.deepEqual(buildSectorKnowledgeGraph(null, context).nodes, [])
})

test('text matching is word bounded and ignores source URLs and metadata', () => {
  const model = buildSectorKnowledgeGraph(graph, { ...context, study: { group: wood.group, topicIndex: 1, title: wood.title, summary: ['O antifidc não é conceito.'], sources: [{ url: 'https://example.com/software/inflacao' }] } })
  assert.ok(!has(model, 'concept:fidc'))
  assert.ok(!has(model, 'concept:inflacao'))
  assert.ok(!has(model, 'sector:tic'))
})

test('scope changes with the selected study and does not expand concept chains', () => {
  const study = { group: 'textil', topicIndex: 0, title: 'Fiação', summary: ['Produção de fios.'] }
  const model = buildSectorKnowledgeGraph(graph, { group: 'textil', topicIndex: 0, study })
  assert.ok(has(model, 'subsector:textil:0'))
  assert.ok(!has(model, 'subsector:transporte-logistica:1'))
  assert.ok(!has(model, 'sector:base-florestal'))
  assert.ok(!has(model, 'concept:combustiveis'))
  assert.equal(model.meta.contextLabel, 'Fiação')
})
