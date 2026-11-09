import test from 'node:test'
import assert from 'node:assert/strict'
import { KNOWLEDGE_GLOSSARY } from '../src/knowledgeGlossary.js'
import { GLOSSARY } from '../src/glossary.js'
import { CONCEITOS } from '../src/educacao.js'
import { APP_SECTIONS } from '../src/appSections.js'

test('registry covers every glossary entry exactly once with readable original content', () => {
  assert.deepEqual(KNOWLEDGE_GLOSSARY.map(item => item.key).sort(), Object.keys(GLOSSARY).sort())
  assert.equal(new Set(KNOWLEDGE_GLOSSARY.map(item => item.nodeId)).size, KNOWLEDGE_GLOSSARY.length)
  for (const item of KNOWLEDGE_GLOSSARY) {
    assert.equal(item.summary, GLOSSARY[item.key].a)
    assert.ok(item.body.includes(GLOSSARY[item.key].a))
    assert.ok(item.routeEvidence)
  }
})
test('aliases reuse real learning concepts and routes only use existing application tabs', () => {
  assert.deepEqual(KNOWLEDGE_GLOSSARY.filter(item => item.conceptId).map(item => item.key).sort(), ['cupom', 'focus', 'sofr'])
  for (const item of KNOWLEDGE_GLOSSARY) {
    if (item.conceptId) {
      assert.ok(CONCEITOS.some(concept => concept.id === item.conceptId))
      assert.equal(item.nodeId, `concept:${item.conceptId}`)
    }
    if (item.route) {
      assert.equal(item.routeStatus, 'verified')
      assert.ok(APP_SECTIONS.some(section => section.id === item.route.tab))
      assert.equal(typeof item.route.view, 'string')
    } else assert.equal(item.routeStatus, 'unavailable')
  }
})
test('unknown renderer is explicitly unavailable rather than given a guessed route', () => {
  const entry = KNOWLEDGE_GLOSSARY.find(item => item.key === 'minigrafico')
  assert.equal(entry.routeStatus, 'unavailable')
  assert.equal(entry.route, undefined)
  assert.ok(entry.body)
})
