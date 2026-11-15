import test from 'node:test'
import assert from 'node:assert/strict'
import { CATALOGO_SETORIAL, PAUTAS_SETORIAIS, TOPICOS_ESTUDO, normalizeSector, rotaPautaSetorial } from '../src/centralSetorial.js'
import { BANKING_TOPICS } from '../src/bankingSectors.js'

test('catálogo reúne quinze setores, subsetores únicos por grupo e oito temas de estudo', () => {
  assert.equal(CATALOGO_SETORIAL.length, 15)
  assert.equal(new Set(CATALOGO_SETORIAL.map(g => g.id)).size, 15)
  assert.equal(TOPICOS_ESTUDO.length, 8)
  for (const group of CATALOGO_SETORIAL) assert.equal(new Set(group.topics).size, group.topics.length)
  assert.equal(normalizeSector('Compensadós'), 'compensados')
})



test('pautas setoriais têm nomes e rotas únicos e reaproveitam os endereços equivalentes', () => {
  const topics = PAUTAS_SETORIAIS.flatMap(group => group.topics)
  const canonicalTopics = CATALOGO_SETORIAL.flatMap(group => group.topics).map(normalizeSector)
  const bankingTopics = BANKING_TOPICS.map(topic => normalizeSector(topic.label))
  assert.equal(new Set(topics.map(topic => normalizeSector(topic.title))).size, topics.length)
  assert.equal(new Set(topics.map(rotaPautaSetorial)).size, topics.length)
  for (const topic of topics) {
    const title = normalizeSector(topic.title)
    assert.ok(!canonicalTopics.includes(title), topic.title)
    if (topic.existingRoute) {
      assert.equal(rotaPautaSetorial(topic), BANKING_TOPICS.find(item => normalizeSector(item.label) === title)?.id)
    } else {
      assert.ok(!bankingTopics.includes(title), topic.title)
    }
    for (const [groupId, index] of topic.related ?? []) {
      assert.ok(CATALOGO_SETORIAL.find(group => group.id === groupId)?.topics[index])
    }
  }
})

test('novos setores preservam recortes distintos e os IDs legados', () => {
  assert.deepEqual(CATALOGO_SETORIAL.slice(-4).map(group => group.id), ['turismo','varejo','saude','pet'])
  assert.equal(CATALOGO_SETORIAL.find(group => group.id === 'alimentos-agroindustria').topics[5], 'Bebidas')
  assert.equal(CATALOGO_SETORIAL.find(group => group.id === 'textil').topics[4], 'Confecção')
  assert.deepEqual(CATALOGO_SETORIAL.find(group => group.id === 'varejo').topics, ['Alimentos','Bebidas','Vestuário'])
  assert.equal(CATALOGO_SETORIAL.reduce((sum, group) => sum + group.topics.length, 0), 81)
})

test('pauta Pet reutiliza o setor existente sem criar entrada duplicada', () => {
  assert.ok(!PAUTAS_SETORIAIS.flatMap(group => group.topics).some(topic => normalizeSector(topic.title) === 'pet'))
  assert.ok(CATALOGO_SETORIAL.some(group => group.id === 'pet'))
})
