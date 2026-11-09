import test from 'node:test'
import assert from 'node:assert/strict'
import { CATALOGO_SETORIAL } from '../src/centralSetorial.js'
import { ENTITY_REGISTRY, ENTITY_TOPIC_KEYS, sectorEntityGraph } from '../src/sectorEntities.js'
import { buildSectorKnowledgeGraph } from '../src/sectorKnowledgeGraph.js'

const keys = CATALOGO_SETORIAL.flatMap(group => group.topics.map((_, index) => `${group.id}:${index}`))

test('todo subsetor do catálogo tem associações e a lista não cita subsetor inexistente', () => {
  assert.deepEqual([...ENTITY_TOPIC_KEYS].sort(), [...keys].sort())
  for (const [key, [associations]] of Object.entries(ENTITY_REGISTRY.topics)) assert.ok(associations.length >= 2, `${key} precisa de ao menos duas entidades`)
})

test('referências existem no cadastro, sem repetição por subsetor, e endereços são https', () => {
  const { associations, players, topics } = ENTITY_REGISTRY
  for (const [key, [assoc, refs]] of Object.entries(topics)) {
    assert.equal(new Set(assoc).size, assoc.length, `${key}: entidade repetida`)
    assert.equal(new Set(refs).size, refs.length, `${key}: player repetido`)
    for (const id of assoc) assert.ok(associations[id], `${key}: entidade ${id} não cadastrada`)
    for (const id of refs) assert.ok(players[id], `${key}: player ${id} não cadastrado`)
  }
  for (const [id, [acronym, name, kind, url, scope]] of Object.entries(associations)) {
    assert.ok(acronym && name && scope, id)
    assert.ok(['association', 'agency'].includes(kind), id)
    assert.equal(new URL(url).protocol, 'https:', id)
    assert.doesNotMatch(`${name}${scope}`, /[<>]/, id)
  }
  const used = new Set(Object.values(topics).flatMap(([assoc, refs]) => [...assoc, ...refs.map(ref => `p:${ref}`)]))
  for (const id of Object.keys(associations)) assert.ok(used.has(id), `entidade sem uso: ${id}`)
  for (const id of Object.keys(players)) assert.ok(used.has(`p:${id}`), `player sem uso: ${id}`)
})

test('toda entidade diz o que divulga e os papéis dos players são válidos e do próprio subsetor', () => {
  const { associations, publishes, roles, roleLabels, topics } = ENTITY_REGISTRY
  for (const id of Object.keys(associations)) assert.ok(publishes[id], `${id} sem descrição do que divulga`)
  assert.deepEqual(Object.keys(publishes).sort(), Object.keys(associations).sort())
  for (const [key, byPlayer] of Object.entries(roles)) {
    assert.ok(topics[key], key)
    for (const [player, role] of Object.entries(byPlayer)) {
      assert.ok(topics[key][1].includes(player), `${key}: ${player} não está na lista do subsetor`)
      assert.ok(role in roleLabels && role !== 'concorrente', `${key}: papel ${role} inválido ou redundante`)
    }
  }
})

test('Abimaq aparece em Máquinas industriais, com site oficial e sem inventar player onde não há', () => {
  const machines = sectorEntityGraph('metalmecanico', 3)
  const abimaq = machines.nodes.find(node => node.id === 'entity:abimaq')
  assert.equal(abimaq.type, 'entity')
  assert.equal(abimaq.href, 'https://www.abimaq.org.br')
  assert.match(abimaq.title, /Máquinas e Equipamentos/)
  assert.ok(machines.nodes.some(node => node.subtype === 'player'))
  assert.match(machines.nodes.find(node => node.id === 'entity:player:weg').kindLabel, /outro elo/)
  assert.match(abimaq.summary, /Costuma divulgar/)
  assert.equal(sectorEntityGraph('metalmecanico', 2).links.find(link => link.target === 'entity:player:gerdau').label, 'Fornecedor')
  const wood = sectorEntityGraph('transporte-logistica', 1)
  assert.equal(wood.players, 0)
  assert.deepEqual(sectorEntityGraph('inexistente', 0), { nodes: [], links: [], players: 0 })
})

test('o recorte do estudo liga entidades ao subsetor e preserva o restante do grafo', () => {
  const base = { nodes: [
    { id: 'sector:metalmecanico', label: 'Metalmecânico e máquinas', type: 'sector', subtype: 'sector' },
    { id: 'subsector:metalmecanico:3', label: 'Máquinas industriais', type: 'sector', subtype: 'subsector' },
  ], links: [{ id: 'l', source: 'subsector:metalmecanico:3', target: 'sector:metalmecanico', label: 'Pertence a', reason: 'x' }], archiveItems: [], meta: {} }
  const scoped = buildSectorKnowledgeGraph(base, { group: 'metalmecanico', topicIndex: 3, study: { group: 'metalmecanico', topicIndex: 3, title: 'Máquinas industriais', summary: [], sections: [] } })
  const entities = scoped.nodes.filter(node => node.type === 'entity')
  assert.ok(entities.length >= 3)
  assert.equal(scoped.meta.hasEntities, true)
  for (const node of entities) assert.ok(scoped.links.some(link => link.source === 'subsector:metalmecanico:3' && link.target === node.id))
  assert.ok(scoped.nodes.some(node => node.id === 'sector:metalmecanico'))
  assert.equal(base.nodes.length, 2, 'não muta o grafo de origem')
  const invalid = buildSectorKnowledgeGraph(base, { group: 'metalmecanico', topicIndex: 99, study: {} })
  assert.equal(invalid.nodes.length, 0)
  assert.equal(invalid.meta.hasEntities, undefined)
})

test('a busca geral acha entidades e players e abre o primeiro subsetor em que aparecem', async () => {
  const { sectorEntitySearchEntries } = await import('../src/sectorEntities.js')
  const entries = sectorEntitySearchEntries()
  assert.equal(entries.length, Object.keys(ENTITY_REGISTRY.associations).length + Object.keys(ENTITY_REGISTRY.players).length)
  const abimaq = entries.find(item => item.id === 'entity:abimaq:search')
  assert.equal(abimaq.route, 'setores/topico/metalmecanico/0')
  assert.match(abimaq.body, /Máquinas industriais/)
  assert.equal(new Set(entries.map(item => item.id)).size, entries.length)
})

test('verificador de links separa falha, aviso e ok', async () => {
  const { classifyLink } = await import('../scripts/check-entity-links.mjs')
  const url = 'https://www.abimaq.org.br'
  assert.equal(classifyLink(url, { status: 200, finalUrl: 'https://abimaq.org.br/' }).level, 'ok')
  assert.equal(classifyLink(url, { status: 404 }).level, 'falha')
  assert.equal(classifyLink(url, { status: 503 }).level, 'falha')
  assert.equal(classifyLink(url, { error: 'ENOTFOUND' }).level, 'falha')
  assert.equal(classifyLink(url, { status: 403 }).level, 'aviso')
  assert.equal(classifyLink(url, { status: 406 }).level, 'aviso')
  assert.equal(classifyLink(url, { error: 'ETIMEDOUT' }).level, 'aviso')
  assert.equal(classifyLink(url, { error: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }).level, 'aviso')
  assert.equal(classifyLink('https://www.portaldaindustria.com.br', { status: 200, finalUrl: 'https://www.sistemaindustria.portaldaindustria.com.br/' }).level, 'ok')
  assert.equal(classifyLink(url, { status: 200, finalUrl: 'https://outro.com.br/' }).level, 'aviso')
})
